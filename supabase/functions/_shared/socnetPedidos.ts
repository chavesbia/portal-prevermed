// Varredura dos pedidos SOCNET (Exporta 221785) direcionados à PreverMed.
// Usada pela rotina soc-pedidos-sync (grava a cópia local) e, em contingência, pela soc-agenda-lookup.
const SOC_URL = 'https://ws1.soc.com.br/WebSoc/exportadados';
export type Row = Record<string, unknown>;

export const pick = (r: Row, keys: string[]) => {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(r)) map[k.toUpperCase().replace(/[^A-Z]/g, '')] = r[k];
  for (const k of keys) { const v = map[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); }
  return null;
};

async function exporta(params: Record<string, string>): Promise<Row[] | null> {
  try {
    const resp = await fetch(`${SOC_URL}?parametro=${encodeURIComponent(JSON.stringify({ ...params, tipoSaida: 'json' }))}`, { method: 'POST' });
    const t = new TextDecoder('iso-8859-1').decode(await resp.arrayBuffer()).trim();
    if (!resp.ok) return null;
    if (!t || /^"?(sem|nenhum) resultado\.?"?$/i.test(t)) return [];
    const p = JSON.parse(t); return Array.isArray(p) ? p : (p?.data ?? []);
  } catch { return null; }
}

const TIPO_FICHA: Record<string, string> = {
  '1': 'Admissional', '2': 'Periódico', '3': 'Retorno ao Trabalho', '4': 'Mudança de Risco', '5': 'Demissional', '6': 'Monitoração Pontual',
};
const fmtBR = (dias: number) => { const d = new Date(Date.now() + dias * 864e5); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };

export type FichaSocnet = {
  sequencial_ficha: string; cpf: string; data_ficha: string | null; tipo_exame: string | null;
  empresa_codigo: string | null; empresa_nome: string | null; assessoria_codigo: string | null; assessoria_nome: string | null;
  funcionario: Record<string, string | null>; exames: string[]; pendentes: number;
};

// O relatório devolve um único dia por chamada; o SOC aceita no máximo 5 chamadas simultâneas: fila de 4 com nova tentativa.
export async function varrerPedidosSocnet(diasAtras = 15, diasFrente = 15): Promise<{ fichas: FichaSocnet[]; falhas: number; linhas: Row[]; diasSemResposta: string[] } | null> {
  const empresa = Deno.env.get('SOC_CODIGO_EMPRESA');
  const codigo = Deno.env.get('SOC_CODIGO_EXPORTA_SOCNET_PEDIDOS');
  const chave = Deno.env.get('SOC_CHAVE_EXPORTA_SOCNET_PEDIDOS');
  if (!empresa || !codigo || !chave) return null;
  const dias = Array.from({ length: diasAtras + diasFrente + 1 }, (_, i) => i - diasAtras);
  const lotes: (Row[] | null)[] = new Array(dias.length).fill(null);
  let prox = 0;
  const trabalhador = async () => {
    while (prox < dias.length) {
      const i = prox++;
      for (let t = 0; t < 3 && lotes[i] === null; t++) {
        if (t) await new Promise((r) => setTimeout(r, 400 * t));
        lotes[i] = await exporta({ empresa, codigo, chave, DataInicio: fmtBR(dias[i]) });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, trabalhador));
  const falhas = lotes.filter((l) => l === null).length;
  if (falhas === lotes.length) return null;
  const fichas = new Map<string, FichaSocnet>();
  for (const r of lotes.flatMap((l) => l ?? [])) {
    const seq = pick(r, ['SEQUENCIALFICHA']); if (!seq) continue;
    const cpf = (pick(r, ['CPF']) ?? '').replace(/\D/g, '').padStart(11, '0');
    if (!fichas.has(seq)) fichas.set(seq, {
      sequencial_ficha: seq, cpf, data_ficha: pick(r, ['DATAFICHA']),
      tipo_exame: TIPO_FICHA[pick(r, ['TIPOEXAME']) ?? ''] ?? null,
      empresa_codigo: pick(r, ['CODIGOEMPRESA']), empresa_nome: pick(r, ['NOMEEMPRESA']),
      assessoria_codigo: pick(r, ['CODIGOEMPRESAREPASSE']), assessoria_nome: pick(r, ['NOMEEMPRESAREPASSE']),
      funcionario: { codigo: pick(r, ['CODIGOFUNCIONARIO']), nome: pick(r, ['NOME']), nascimento: pick(r, ['DTNASC']), sexo: pick(r, ['SEXO']) === '2' ? 'FEMININO' : 'MASCULINO' },
      exames: [], pendentes: 0,
    });
    const f = fichas.get(seq)!;
    const nome = (pick(r, ['NOMEEXAME']) ?? '').toUpperCase();
    if (nome && !f.exames.includes(nome)) f.exames.push(nome);
    if (!pick(r, ['DATARESULTADO'])) f.pendentes++;
  }
  const diasSemResposta = dias.filter((_, i) => lotes[i] === null).map(fmtBR);
  return { fichas: [...fichas.values()], falhas, linhas: lotes.flatMap((l) => l ?? []), diasSemResposta };
}

// Formato que a tela/robô já consomem
export const fichaParaPedido = (f: FichaSocnet) => ({
  sequencialFicha: f.sequencial_ficha, dataFicha: f.data_ficha, tipoExame: f.tipo_exame,
  empresa: { codigo: f.empresa_codigo, nome: f.empresa_nome },
  assessoria: { codigo: f.assessoria_codigo, nome: f.assessoria_nome },
  funcionario: f.funcionario, exames: f.exames,
});
