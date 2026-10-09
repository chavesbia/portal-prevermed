// Regras de agenda configuradas em Administração → Agenda (calendário, bloqueios, limites, exames especiais)
// deno-lint-ignore-file no-explicit-any
type Admin = any;

export type Regras = {
  calendario: { dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }[];
  bloqueios: { data: string; hora_fim_antecipada: string | null; motivo: string }[];
  limites: { tipo_exame: string; dia_semana: number | null; maximo: number }[];
  exames: { exame_nome: string; dias_semana: number[]; hora_inicio: string; hora_fim: string; antecedencia_dias: number; parceiro: boolean; observacao: string | null }[];
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const hm = (t: string) => t.slice(0, 5);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
export const brData = (iso: string) => iso.split('-').reverse().join('/');
export const isoData = (br: string) => br.split('/').reverse().join('-');
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const hojeSP = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const difDias = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

export async function carregarRegras(admin: Admin, unidadeId: string): Promise<Regras> {
  const ou = `unidade_id.is.null,unidade_id.eq.${unidadeId}`;
  const [cal, bl, li, ex, fer] = await Promise.all([
    admin.from('agenda_calendario').select('dia_semana, hora_inicio, hora_fim, ativo').eq('unidade_id', unidadeId),
    admin.from('agenda_bloqueios').select('data, hora_fim_antecipada, motivo').or(ou).gte('data', hojeSP()),
    admin.from('agenda_limites').select('tipo_exame, dia_semana, maximo').or(ou),
    admin.from('agenda_exames_regras').select('exame_nome, dias_semana, hora_inicio, hora_fim, antecedencia_dias, parceiro, observacao').or(ou).eq('ativo', true),
    admin.from('feriados').select('data, descricao').gte('data', hojeSP()),
  ]);
  return {
    calendario: cal.data ?? [],
    bloqueios: [...(bl.data ?? []), ...(fer.data ?? []).map((f: any) => ({ data: f.data, hora_fim_antecipada: null, motivo: `Feriado${f.descricao ? `: ${f.descricao}` : ''}` }))],
    limites: li.data ?? [],
    exames: ex.data ?? [],
  };
}

/** Motivo do bloqueio do dia/horário para a unidade (calendário e bloqueios). null = liberado */
export function bloqueioUnidade(r: Regras, iso: string, hora: string): string | null {
  const d = diaSemana(iso);
  if (r.calendario.length) {
    const c = r.calendario.find((x) => x.dia_semana === d && x.ativo);
    if (!c) return `A unidade não atende às ${DIAS[d]}s.`;
    if (hora < hm(c.hora_inicio) || hora >= hm(c.hora_fim)) return `Atendimento às ${DIAS[d]}s das ${hm(c.hora_inicio)} às ${hm(c.hora_fim)}.`;
  }
  for (const b of r.bloqueios.filter((x) => x.data === iso)) {
    if (!b.hora_fim_antecipada) return `${brData(iso)} indisponível — ${b.motivo}.`;
    if (hora >= hm(b.hora_fim_antecipada)) return `Em ${brData(iso)} o atendimento encerra às ${hm(b.hora_fim_antecipada)} — ${b.motivo}.`;
  }
  return null;
}

export function limiteDia(r: Regras, iso: string, tipoExame: string): number | null {
  const d = diaSemana(iso);
  const l = r.limites.filter((x) => x.tipo_exame === tipoExame && (x.dia_semana === null || x.dia_semana === d));
  return l.length ? Math.min(...l.map((x) => x.maximo)) : null;
}

export function regrasDosExames(r: Regras, exames: string[]) {
  const sel = new Set(exames.map(norm));
  return r.exames.filter((e) => sel.has(norm(e.exame_nome)));
}

/** Motivo de exame especial não atender o dia/horário. null = atende */
export function bloqueioExames(r: Regras, iso: string, hora: string, exames: string[]): string | null {
  const d = diaSemana(iso);
  for (const e of regrasDosExames(r, exames)) {
    const dias = e.dias_semana.map((x) => DIAS[x]).join(', ');
    if (!e.dias_semana.includes(d)) return `${e.exame_nome}: realizado somente às ${dias}.`;
    if (hora < hm(e.hora_inicio) || hora >= hm(e.hora_fim)) return `${e.exame_nome}: realizado das ${hm(e.hora_inicio)} às ${hm(e.hora_fim)}.`;
    if (difDias(hojeSP(), iso) < e.antecedencia_dias) return `${e.exame_nome}: exige ${e.antecedencia_dias} dia(s) de antecedência${e.parceiro ? ' (agendado no parceiro)' : ''}.`;
  }
  return null;
}

export function descreverExames(r: Regras, exames: string[]) {
  return regrasDosExames(r, exames).map((e) => ({
    exame: e.exame_nome,
    texto: `Somente às ${e.dias_semana.map((x) => DIAS[x]).join(', ')}, das ${hm(e.hora_inicio)} às ${hm(e.hora_fim)}`
      + (e.antecedencia_dias ? `, com ${e.antecedencia_dias} dia(s) de antecedência` : '')
      + (e.parceiro ? ' (realizado em parceiro)' : '') + (e.observacao ? `. ${e.observacao}` : '') + '.',
  }));
}

export async function contarDia(admin: Admin, unidadeId: string, iso: string, tipoExame: string) {
  const { count } = await admin.from('soc_agendamentos').select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId).eq('data_agendada', iso).eq('tipo_exame', tipoExame)
    .in('status', ['agendado_soc', 'solicitado', 'aguardando_aprovacao']);
  return count ?? 0;
}
