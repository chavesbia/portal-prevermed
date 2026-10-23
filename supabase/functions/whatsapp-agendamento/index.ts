// Robô de agendamento via WhatsApp (n8n/Evolution). Guarda a etapa da conversa por telefone
// e reaproveita as mesmas funções da página pública (consulta, horários e gravação com as regras da Agenda).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { CATALOGO } from './catalogo.ts';
import { naoAgendaveisGlobais } from '../_shared/agendaRegras.ts';
import { preparosDosExames } from '../_shared/preparosExames.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  telefone: z.string().regex(/^\d{8,15}$/),
  texto: z.string().max(1000).default(''),
  nome: z.string().max(120).optional(),
  // Foto/PDF enviado no WhatsApp (Evolution com "Webhook Base64" ligado)
  arquivo: z.object({ nome: z.string().max(120).optional(), tipo: z.string().max(80), base64: z.string().max(7_000_000) }).optional(),
});

const EXPIRA_MS = 2 * 60 * 60 * 1000;
const PORTAL = 'https://portal.prevermed.com.br/agendamento';
const TIPOS_ATIVO = ['Periódico', 'Demissional', 'Mudança de Risco', 'Monitoração Pontual', 'Consulta Ocupacional', 'Retorno ao Trabalho'];
// Rótulo do WhatsApp → tipo gravado na Agenda
const TIPO_SISTEMA: Record<string, string> = { 'Consulta Ocupacional': 'Consulta' };
const EXTRAS = ['AUDIOMETRIA', 'ACUIDADE VISUAL', 'ELETROCARDIOGRAMA-ECG', 'ELETROENCEFALOGRAMA-EEG', 'ESPIROMETRIA', 'GLICEMIA DE JEJUM (GLICOSE)', 'HEMOGRAMA COMPLETO', 'EXAME TOXICOLÓGICO (QUERATINA)', 'RAIO X TÓRAX PA (OIT)'];
// Grafia exibida no WhatsApp (o nome do catálogo continua sendo o gravado)
const ROTULO: Record<string, string> = { 'ELETROCARDIOGRAMA-ECG': 'Eletrocardiograma - ECG', 'ELETROENCEFALOGRAMA-EEG': 'Eletroencefalograma - EEG', 'GLICEMIA DE JEJUM (GLICOSE)': 'Glicemia de Jejum (Glicose)', 'EXAME TOXICOLÓGICO (QUERATINA)': 'Exame Toxicológico', 'RAIO X TÓRAX PA (OIT)': 'Raio X Tórax PA (OIT)' };
// Exames laboratoriais (jejum) → preferir manhã; sem eles → preferir após 10:30
const LAB = /GLICEMIA|GLICOSE|HEMOGRAMA|COLESTEROL|TRIGLICER|LIPID|CREATININA|UREIA|TGO|TGP|GAMA|URINA|FEZES|PARASITOL|SANGUE|SORO|VDRL|HEPATITE|PLAQUETA|COLINESTERASE|CHUMBO|ACIDO|ÁCIDO|DOSAGEM/;
const MIMES: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
const RODAPE = '\n\n_Digite *0* para voltar ou *Sair* para encerrar._';

type Dados = Record<string, any>;
// semVolta: etapa irreversível (gravou no SOC/Agenda) — limpa o histórico do "V"
type Res = { resposta: string; etapa: string; dados: Dados; semVolta?: boolean };
type Ctx = { admin: any; telefone: string; nome?: string };

const so = (s: string) => s.replace(/\D/g, '');
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const menu = (itens: string[]) => itens.map((t, i) => `*${i + 1}* - ${t}`).join('\n');
const escolha = (texto: string, n: number) => { const i = Number(so(texto)) - 1; return so(texto) && i >= 0 && i < n ? i : -1; };
const brData = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const isoDe = (br: string) => { const [d, m, y] = br.split('/'); return `${y}-${m}-${d}`; };

function cpfValido(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

async function chamar(fn: string, body: unknown) {
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) as any };
}

const boasVindas = (nome?: string): Res => ({
  etapa: 'AGUARDANDO_CNPJ', dados: {},
  resposta: `Olá${nome ? `, ${titulo(nome.split(' ')[0])}` : ''}! 👋\n\nSeja bem-vindo(a) à central de Agendamento da *PreverMed*.\nPara iniciarmos, digite o *CNPJ* da empresa (apenas números):\n\n🔒 _Os dados informados serão utilizados exclusivamente para os fins de agendamento, nos termos da LGPD (Lei nº 13.709/2018)._\n\n_Para encerrar, digite *Sair*._`,
});

const pedirCnpj = (d: Dados): Res => ({ etapa: 'AGUARDANDO_CNPJ', dados: d, resposta: `Para iniciarmos, digite o *CNPJ* da empresa (apenas números ou com pontuação):${RODAPE}` });

// Registro de rastreabilidade (visível só para ADM Master) + alerta ao Depto. Saúde quando precisa de gente
async function registrar(ctx: Ctx, tipo: 'agendamento' | 'analise_pcmso' | 'atendimento_humano', d: Dados, protocolo?: string, detalhes: Dados = {}) {
  const ymd = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
  const prot = protocolo ?? `${tipo === 'analise_pcmso' ? 'AN' : 'AT'}-${ymd}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  try {
    const { data: reg } = await ctx.admin.from('whatsapp_registros').insert({
      tipo, protocolo: prot, telefone: ctx.telefone, nome_whatsapp: ctx.nome ?? null, empresa_cnpj: d.cnpj ?? null, empresa_nome: d.empresaNome ?? null,
      colaborador_nome: d.colaboradorNome ?? null, cargo: d.lotCargo ?? null,
      detalhes: { cpf: d.cpf, unidade: d.lotUnidade, setor: d.lotSetor, tipoExame: d.tipoLabel, ...detalhes },
    }).select('id').single();
    if (tipo !== 'agendamento') {
      const { data: dep } = await ctx.admin.from('departments').select('id').eq('name', 'Saúde').maybeSingle();
      const { data: us } = dep ? await ctx.admin.from('user_departments').select('user_id').eq('department_id', dep.id) : { data: [] };
      const ids = [...new Set((us ?? []).map((u: any) => u.user_id))];
      const titulo_ = tipo === 'analise_pcmso' ? `WhatsApp: análise de PCMSO (${prot})` : `WhatsApp: pedido de atendente (${prot})`;
      const conteudo = `Empresa: ${d.empresaNome ?? '-'} (CNPJ ${d.cnpj ?? '-'}) · Colaborador: ${d.colaboradorNome ?? '-'} · Cargo: ${d.lotCargo ?? '-'} · Tipo: ${d.tipoLabel ?? '-'} · Telefone: ${ctx.telefone}`;
      if (ids.length) await ctx.admin.from('notifications').insert(ids.map((user_id) => ({ user_id, notification_type: 'aso_alerta', title: titulo_, content: conteudo, related_id: reg?.id ?? null, related_type: 'whatsapp_registro' })));
    }
  } catch (e) { console.error('registrar whatsapp', e); }
  return prot;
}

const portal = (motivo: string): Res => ({
  etapa: 'FINALIZADO', dados: {},
  resposta: `${motivo}\n\nEsse agendamento precisa ser feito pelo portal, onde é possível enviar os dados e documentos necessários:\n${PORTAL}\n\nSe precisar, digite *1* para iniciar um novo atendimento.`,
});

async function pedirCpf(d: Dados): Promise<Res> {
  return { etapa: 'AGUARDANDO_CPF', dados: d, resposta: `🏢 Empresa: *${titulo(d.empresaNome)}*\n\nAgora digite o *CPF* do colaborador:${RODAPE}` };
}

async function pedirUnidade(d: Dados): Promise<Res> {
  const { data } = await chamar('soc-agenda-horarios', { listarUnidades: true });
  const unidades = (data?.unidades ?? []) as { id: string; nome: string }[];
  if (!unidades.length) return portal('No momento não há unidades disponíveis para agendamento pelo WhatsApp.');
  d.unidades = unidades.map((u) => ({ id: u.id, nome: u.nome }));
  return { etapa: 'ESCOLHENDO_UNIDADE', dados: d, resposta: `Em qual unidade o colaborador será atendido?\n\n${menu(d.unidades.map((u: any) => titulo(u.nome)))}${RODAPE}` };
}

async function pedirDatas(d: Dados): Promise<Res> {
  const ini = new Date(Date.now() - 3 * 3600_000); ini.setUTCDate(ini.getUTCDate() + 1);
  const fim = new Date(ini); fim.setUTCDate(fim.getUTCDate() + 20);
  const { ok, data } = await chamar('soc-agenda-horarios', {
    unidadeId: d.unidade.id, dataInicio: brData(ini), dataFim: brData(fim), tipoExame: d.tipoExame, exames: d.exames ?? [],
  });
  if (!ok) return { etapa: 'ESCOLHENDO_UNIDADE', dados: d, resposta: `Não consegui consultar a agenda agora. Tente escolher a unidade novamente em instantes.\n\n${menu(d.unidades.map((u: any) => titulo(u.nome)))}${RODAPE}` };
  const porData = (data?.porData ?? {}) as Record<string, { hora: string }[]>;
  const { data: ja } = await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    .from('soc_agendamentos').select('data_agendada').eq('colaborador_cpf', d.cpf).in('status', ['agendado_soc', 'aguardando_aprovacao', 'solicitado']);
  const ocupadas = new Set((ja ?? []).map((a: any) => a.data_agendada));
  const datas = Object.keys(porData).filter((k) => !ocupadas.has(isoDe(k))).sort((a, b) => isoDe(a).localeCompare(isoDe(b))).slice(0, 5);
  if (!datas.length) {
    const motivo = data?.indisponiveis?.[0]?.motivo;
    return { etapa: 'ESCOLHENDO_UNIDADE', dados: d, resposta: `Não há horários livres nessa unidade nos próximos dias${motivo ? ` (${motivo})` : ''}.\n\nEscolha outra unidade:\n${menu(d.unidades.map((u: any) => titulo(u.nome)))}${RODAPE}` };
  }
  d.horarios = Object.fromEntries(datas.map((k) => [k, porData[k].map((h) => h.hora)]));
  d.datas = datas;
  // Regras de horário dos exames já filtram as datas no backend; não exibimos o detalhe ao solicitante
  return { etapa: 'ESCOLHENDO_DATA', dados: d, resposta: `📅 Datas disponíveis em *${titulo(d.unidade.nome)}*:\n\n${menu(datas)}${RODAPE}` };
}

function lotacao(d: Dados) {
  return [d.lotUnidade && `🏢 Unidade: *${titulo(d.lotUnidade)}*`, d.lotSetor && `📂 Setor: *${titulo(d.lotSetor)}*`, d.lotCargo && `💼 Cargo: *${titulo(d.lotCargo)}*`].filter(Boolean).join('\n');
}

const ehClinico = (e: string) => semAcento(e).includes('CLINIC');
const nomeExame = (e: string) => (ehClinico(e) ? 'Exame Clínico' : ROTULO[e] ?? titulo(e));
const chaveExame = (e: string) => (ehClinico(e) ? 'CLINICO' : semAcento(e));
// Na Monitoração Pontual o Exame Clínico é opcional: sai da base e vira opção da lista de extras
const extrasDe = (d: Dados) => ((d.tipoLabel === 'Monitoração Pontual' || d.externo) && !(d.exames ?? []).some(ehClinico) ? ['EXAME CLÍNICO', ...EXTRAS] : EXTRAS);
const listaExames = (ex: string[]) => (ex.length ? ex.map((e) => `• ${nomeExame(e)}`).join('\n') : '• _(nenhum exame selecionado)_');
// Exames que não vieram do PCMSO
const adicionais = (d: Dados) => { const base = new Set((d.examesBase ?? []).map(chaveExame)); return (d.exames ?? []).filter((e: string) => !base.has(chaveExame(e))); };
// Linha compacta: com PCMSO resume; sem PCMSO lista em linha
function textoExames(d: Dados) {
  if (d.socnet) return `Autorizados no pedido: ${(d.exames ?? []).map(nomeExame).join(' • ')}`;
  const ad = adicionais(d).map(nomeExame);
  if ((d.examesBase ?? []).length) return [...d.examesBase.map(nomeExame), ...ad].join(' • ');
  return (d.exames ?? []).map(nomeExame).join(' • ') || '-';
}
function adicionar(d: Dados, novos: string[]) {
  const vistos = new Set<string>(); const lista: string[] = [];
  for (const e of [...(d.exames ?? []), ...novos]) { const k = chaveExame(e); if (!vistos.has(k)) { vistos.add(k); lista.push(e); } }
  d.exames = lista.slice(0, 40);
}
// Busca no catálogo oficial do SOC por todas as palavras digitadas (sem acento)
async function buscarExame(d: Dados, termo: string): Promise<Res> {
  const q = semAcento(termo).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const alias: Record<string, string> = { RX: 'RAIO', ECG: 'ELETROCARDIOGRAMA', EEG: 'ELETROENCEFALOGRAMA' };
  const ws = q.map((w) => alias[w] ?? w);
  if (!ws.length || ws.join('').length < 2) return { etapa: 'ADICIONANDO_EXAMES', dados: d, resposta: `Digite pelo menos 2 letras do nome do exame.${RODAPE}` };
  const fora = new Set((await naoAgendaveisGlobais(createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!))).map(semAcento));
  const cat = [...new Set([...extrasDe(d), ...CATALOGO])].filter((n) => !fora.has(semAcento(n)));
  const ach = cat.filter((n) => { const s = semAcento(n).replace(/[^A-Z0-9 ]/g, ' '); return ws.every((w) => s.includes(w)); });
  if (!ach.length) return { etapa: 'ADICIONANDO_EXAMES', dados: d, resposta: `Não encontrei "${termo}" no catálogo de exames. Tente outra palavra (ex: _raio_, _glicemia_, _espirometria_).${RODAPE}` };
  if (ach.length === 1) { d.achados = ach; return { etapa: 'EXAME_BUSCA', dados: d, resposta: `Encontramos o exame:\n\n🧪 *${nomeExame(ach[0])}*\n\n*1* - Sim, adicionar\n*2* - Buscar outro${RODAPE}` }; }
  d.achados = ach.slice(0, MAX_OP);
  const mais = ach.length > MAX_OP ? `\n\n_Mostrando ${MAX_OP} de ${ach.length}. Digite mais letras para refinar._` : '';
  return { etapa: 'EXAME_BUSCA', dados: d, resposta: `Encontrei estas opções no catálogo:\n\n${menu(d.achados.map(nomeExame))}${mais}\n\nDigite o *número* da opção ou mais letras para refinar.${RODAPE}` };
}
const menuAlterar = (d: Dados): Res => ({ etapa: 'ALTERAR_EXAMES', dados: d, resposta: `✏️ *Alterar lista de exames*\n\n*1* - Adicionar outro exame\n*2* - Remover exame${RODAPE}` });

function pedirExtras(d: Dados): Res {
  if (!d.exames?.length) {
    const m = menuExtras(d);
    return { ...m, resposta: `🩺 Este atendimento não possui exames pré-definidos.\n\nSelecione os *exames que serão realizados*:\n\n${menu(extrasDe(d).map(nomeExame))}\n\nDigite os números desejados (ex: *1, 2*) ou parte do nome para buscar no catálogo (ex: _raio_, _glicemia_).${RODAPE}` };
  }
  const lista = listaExames(d.exames);
  return { etapa: 'PERGUNTANDO_EXTRAS', dados: d, resposta: `🩺 Exames *previstos* para este atendimento:\n\n${lista}\n\nDeseja acrescentar algum exame complementar?\n\n*1* - Não, apenas os exames acima\n*2* - Sim, quero adicionar outros exames${RODAPE}` };
}
const menuExtras = (d: Dados): Res => ({ etapa: 'ADICIONANDO_EXAMES', dados: d, resposta: `Escolha os *exames complementares* desejados:\n\n${menu(extrasDe(d).map(nomeExame))}\n\nDigite os números desejados (ex: *1, 2*) ou parte do nome para buscar no catálogo (ex: _raio_, _glicemia_).${RODAPE}` });
const confExames = (d: Dados, prefixo = ''): Res => ({ etapa: 'CONF_EXAMES', dados: d, resposta: `${prefixo}📋 *Confira os exames selecionados para este atendimento:*\n\n${listaExames(d.exames ?? [])}\n\n*1* - Confirmar exames\n*2* - Alterar lista de exames${RODAPE}` });
const bloqueioPcmso = (d: Dados): Res => ({ etapa: 'PCMSO_BLOQUEIO', dados: d, resposta: `⚠️ *Atenção:* Não localizamos os exames do PCMSO ativos para o cargo *${titulo(d.lotCargo || 'informado')}* nesta unidade.\n\nPara a conformidade do ASO, este atendimento precisa de validação técnica prévia da nossa equipe.\n\n*1* - Solicitar análise da equipe técnica PreverMed\n*2* - Falar com um atendente humano\n*3* - Voltar e conferir o cargo/setor informado${RODAPE}` });

const pedirObs = (d: Dados): Res => ({ etapa: 'OBSERVACOES', dados: d, resposta: `📝 *OBSERVAÇÃO* para a equipe do *BALCÃO DE ATENDIMENTO*\n\n_(ex: PCD, atendimento preferencial, restrição de mobilidade, contato do gestor ou outras informações)_\n\nCaso não possua nenhuma observação para atendimento, digite *1* para avançar.${RODAPE}` });
const pedirAnexo = (d: Dados): Res => d.externo && !d.socnet
  ? { etapa: 'ANEXO', dados: d, resposta: `📎 Envie agora a *foto ou PDF da guia/autorização de exames* (obrigatório para este atendimento).${RODAPE}` }
  : d.livre
    ? { etapa: 'ANEXO', dados: d, resposta: `📎 *Kit de atendimento / Guia*\n\nEnvie a foto ou PDF do kit (guia, ficha clínica e ASO), ou digite *1* para continuar sem anexo.\n\n${AVISO_KIT}${RODAPE}` }
    : { etapa: 'ANEXO', dados: d, resposta: `📎 Deseja anexar algum documento?\n\nEnvie o arquivo ou foto agora, ou digite *1* para continuar sem anexo.${RODAPE}` };
const AVISO_KIT = '⚠️ *Atenção:* O atendimento no balcão depende da apresentação do kit (guia, ficha clínica e ASO) para realização do atendimento.';

function receberAnexo(etapa: string, d: Dados, arquivo: { nome?: string; tipo: string; base64: string }): Res {
  const tipo = arquivo.tipo.split(';')[0].trim().toLowerCase();
  const ext = MIMES[tipo];
  if (!ext) return { etapa, dados: d, resposta: `Esse tipo de arquivo não é aceito. Envie *foto* (JPG/PNG) ou *PDF*, ou digite *1* para continuar.${RODAPE}` };
  if (arquivo.base64.length > 6_800_000) return { etapa, dados: d, resposta: `Arquivo muito grande (máx. 5 MB). Envie outro, ou digite *1* para continuar.${RODAPE}` };
  const nomeArq = (arquivo.nome?.replace(/[^\w.\- ]/g, '').slice(0, 100) || `whatsapp`).replace(/\.[^.]*$/, '') + `.${ext}`;
  const lista = listaAnexos(d);
  if (lista.length >= 10) return { etapa: 'ANEXO_OK', dados: d, resposta: `Limite de *10 anexos* atingido. Digite *1* para continuar.${RODAPE}` };
  lista.push({ nome: nomeArq, tipo: tipo === 'image/jpg' ? 'image/jpeg' : tipo, base64: arquivo.base64.replace(/^data:[^,]+,/, '') });
  d.anexos = lista; delete d.anexo;
  return { etapa: 'ANEXO_OK', dados: d, resposta: `✅ *Documento recebido com sucesso!*\n📄 Arquivo: ${nomeArq}\n📎 Total de anexos: *${lista.length}*\n\n*1* - Continuar\n*2* - Enviar outro documento${RODAPE}` };
}

const listaAnexos = (d: Dados): any[] => d.anexos ?? (d.anexo ? [d.anexo] : []);
const nomeLocal = (n: any) => `PreverMed - ${titulo(String(n ?? '').replace(/^\s*prevermed\s*-\s*/i, ''))}`;
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const ENDERECOS: Record<string, string> = { LAPA: 'Rua Afonso Sardinha, 155 - 1° andar', OSASCO: 'Rua Avelino Lopes, 248' };
const endereco = (u: any) => { const n = semAcento(String(u?.nome ?? '')); const k = Object.keys(ENDERECOS).find((k) => n.includes(k)); return k ? ENDERECOS[k] : ''; };
// final=true → comprovante: com endereço completo, sem observação/anexo
const examesResumo = (d: Dados) => {
  if (d.socnet) return `🧪 ${textoExames(d)}`;
  const ad = adicionais(d).map(nomeExame);
  if ((d.examesBase ?? []).length) return `🧪 Exames *previstos:* ${d.examesBase.map(nomeExame).join(' • ')}\n➕ Exames *adicionais:* ${ad.length ? ad.join(' • ') : 'nenhum'}`;
  return `🧪 Exames: ${textoExames(d)}`;
};
const blocoAgendamento = (d: Dados, final = false) =>
  `🏢 Empresa: *${titulo(d.empresaNome)}*\n🪪 CNPJ: ${fmtCnpj(d.cnpj)}\n👤 Colaborador: *${titulo(d.colaboradorNome)}*\n🪪 CPF: ${fmtCpf(d.cpf)}\n${lotacao(d) ? lotacao(d) + '\n' : ''}🩺 Tipo de exame: *${d.tipoLabel ?? d.tipoExame}*\n${final ? `🧪 Exames: ${textoExames(d)}` : examesResumo(d)}\n📍 Local: *${nomeLocal(d.unidade.nome)}*\n${final && endereco(d.unidade) ? `🗺️ Endereço: ${endereco(d.unidade)}\n` : ''}📅 Data: *${d.data}* às *${d.hora}*` +
  (final ? (() => {
    const preparos = preparosDosExames([...(d.examesBase ?? []), ...(d.exames ?? [])].map((e: any) => typeof e === 'string' ? e : e.nome ?? ''));
    return preparos.length ? '\n\n📋 *Preparos dos exames*\n\n' + preparos.map((p) => `*${nomeExame(p.nome)}*\n${p.texto}`).join('\n\n') : '';
  })() : `\n📝 Observação para o balcão: ${d.obs || '-'}\n📎 Anexos: ${listaAnexos(d).length ? `(${listaAnexos(d).length}) ` + listaAnexos(d).map((a: any) => a.nome).join(', ') : 'não'}`);

function resumo(d: Dados): Res {
  const semKit = d.livre && !d.externo && !d.socnet && !listaAnexos(d).length ? `\n\n${AVISO_KIT}` : '';
  return { etapa: 'CONFIRMANDO', dados: d, resposta: `Confira os dados do agendamento:\n\n${blocoAgendamento(d)}${semKit}\n\n⚠️ *Atenção:* Confira todos os dados antes de confirmar. Informações incorretas podem gerar *custos adicionais* com a correção do ASO e/ou a realização de exames complementares extras.\n\n*1* - Confirmar agendamento e dados\n*2* - Escolher outra data${RODAPE}` };
}

// ---- Pré-cadastro de colaborador sem cadastro no SOC (mesma regra da página pública) ----
const TIPOS_CADASTRO = ['Admissional', 'Periódico', 'Demissional', 'Mudança de Risco', 'Monitoração Pontual', 'Consulta Ocupacional', 'Retorno ao Trabalho'];
type Item = { codigo: string; nome: string };
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const brIso = (iso: string) => iso.split('-').reverse().join('/');
function dataBr(t: string) {
  const m = t.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const dt = new Date(iso + 'T12:00:00Z');
  return isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso;
}
function iniciarCadastro(d: Dados): Res {
  d.cad = {}; delete d.hier; delete d.filtro;
  return { etapa: 'CAD_NOME', dados: d, resposta: `📝 *Pré-cadastro do colaborador*\n\nDigite o *nome completo* do colaborador:${RODAPE}` };
}
function opcoesNivel(d: Dados, nivel: 'unidade' | 'setor' | 'cargo'): Item[] {
  const h = d.hier ?? {};
  if (nivel === 'unidade') return h.unidades ?? [];
  if (d.cad.livre) return (nivel === 'setor' ? h.setores : h.cargos) ?? [];
  const u = (h.unidades ?? []).find((x: any) => x.codigo === d.cad.unidade?.codigo);
  if (nivel === 'setor') return u?.setores ?? [];
  return u?.setores?.find((x: any) => x.codigo === d.cad.setor?.codigo)?.cargos ?? [];
}
function pedirNivel(d: Dados, nivel: 'unidade' | 'setor' | 'cargo'): Res {
  const lista = opcoesNivel(d, nivel).map((x) => ({ codigo: x.codigo, nome: x.nome }));
  const etapa = nivel === 'unidade' ? 'CAD_UNIDADE' : nivel === 'setor' ? 'CAD_SETOR' : 'CAD_CARGO';
  const rot = { unidade: '🏢 Unidade', setor: '📂 Setor', cargo: '💼 Cargo' }[nivel];
  delete d.filtro;
  if (!d.cad.livre && !lista.length) {
    d.cad[nivel === 'cargo' ? 'setor' : 'unidade'] = undefined;
    return { ...pedirNivel(d, nivel === 'cargo' ? 'setor' : 'unidade'), resposta: `Não há ${nivel === 'cargo' ? 'cargos ativos neste setor' : 'setores ativos nesta unidade'}. Escolha outra opção.\n\n` + pedirNivel(d, nivel === 'cargo' ? 'setor' : 'unidade').resposta };
  }
  const mostra = lista.slice(0, MAX_OP);
  const mais = lista.length > MAX_OP ? `\n\n_Mostrando ${MAX_OP} de ${lista.length}. Digite parte do nome para buscar._` : '';
  const instr = d.cad.livre
    ? (lista.length ? `Digite o *número* de uma opção, parte do *nome* para buscar, ou o nome de um(a) novo(a) ${nivel}:` : `Digite o *nome* do(a) ${nivel}:`)
    : `Digite o *número* da opção ou parte do *nome* para buscar:`;
  return { etapa, dados: d, resposta: `${rot} do colaborador\n\n${mostra.length ? menu(mostra.map((x) => titulo(x.nome))) + mais + '\n\n' : ''}${instr}${RODAPE}` };
}
const MAX_OP = 10;
const ROT = { unidade: '🏢 Unidade', setor: '📂 Setor', cargo: '💼 Cargo' } as const;
const pedirAdmissao = (d: Dados): Res => ({ etapa: 'CAD_ADMISSAO', dados: d, resposta: `📆 Digite a *data de admissão* do colaborador (real ou pretendida) no formato DD/MM/AAAA:${RODAPE}` });
function aplicarNivel(d: Dados, nivel: 'unidade' | 'setor' | 'cargo', ref: { codigo?: string; nome?: string }): Res {
  d.cad[nivel] = ref;
  if (nivel === 'unidade') { d.cad.setor = undefined; d.cad.cargo = undefined; return pedirNivel(d, 'setor'); }
  if (nivel === 'setor') { d.cad.cargo = undefined; return pedirNivel(d, 'cargo'); }
  return confirmarCad(d);
}
// ---- Confirmação da lotação atual (empresa da carteira, cadastro ativo) ----
const pedirConfLot = (d: Dados): Res => ({ etapa: 'LOT_CONF', dados: d, resposta: `👤 Colaborador: *${titulo(d.colaboradorNome)}*\n\n📌 *Confira a lotação atual no SOC:*\n${lotacao(d) || '_(sem lotação informada)_'}\n\nOs riscos e exames do ASO seguem esta lotação.\n\n*1* - Confirmar lotação\n*2* - Alterar lotação${RODAPE}` });
const menuTipos = (d: Dados, prefixo = ''): Res => { d.tipos = TIPOS_ATIVO; return { etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `${prefixo}👤 Colaborador: *${titulo(d.colaboradorNome)}*${lotacao(d) ? `\n${lotacao(d)}` : ''}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` }; };
function confirmarLot(d: Dados): Res {
  const c = d.cad;
  return { etapa: 'LOT_SALVAR', dados: d, resposta: `Confira a *nova lotação*:\n\n🏢 Unidade: *${titulo(c.unidade.nome)}*\n📂 Setor: *${titulo(c.setor.nome)}*\n💼 Cargo: *${titulo(c.cargo.nome)}*\n\nAo confirmar, a lotação será atualizada no SOC e os exames seguirão os riscos da nova função.\n\n*1* - Confirmar e atualizar\n*2* - Escolher novamente${RODAPE}` };
}
function confirmarCad(d: Dados): Res {
  if (d.cad?.alterando) return confirmarLot(d);
  const c = d.cad; c.corrigindo = false;
  const sexo = c.sexo === 'FEMININO' ? '♀️ Sexo: Feminino' : '♂️ Sexo: Masculino';
  return { etapa: 'CAD_CONFIRMAR', dados: d, resposta: `Confira o pré-cadastro:\n\n👤 Nome: *${titulo(c.nome)}*\n🪪 CPF: ${d.cpf}\n🎂 Nascimento: ${brIso(c.nascimento)}\n${sexo}\n📆 Admissão: ${brIso(c.admissao)}\n🏢 Unidade: *${titulo(c.unidade.nome)}*\n📂 Setor: *${titulo(c.setor.nome)}*\n💼 Cargo: *${titulo(c.cargo.nome)}*\n\n*1* - Confirmar pré-cadastro\n*2* - Corrigir dados${RODAPE}` };
}
const menuCorrigir = (d: Dados): Res => ({ etapa: 'CAD_CORRIGIR', dados: d, resposta: `✏️ *O que você deseja corrigir?*\n\n*1* - Nome\n*2* - Data de nascimento\n*3* - Sexo\n*4* - Data de admissão\n*5* - Unidade / Setor / Cargo\n*6* - Voltar à confirmação${RODAPE}` });

// ---- SOCNET: pedido de exames de assessoria parceira direcionado à PreverMed (busca só pelo CPF) ----
const TIPO_SOCNET_LABEL: Record<string, string> = { Consulta: 'Consulta Ocupacional' };
async function tentarSocnet(d: Dados): Promise<Res | null> {
  const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'socnet', cpf: d.cpf });
  const p = ok ? (data?.pedidos ?? [])[0] : null;
  if (!p) {
    const guia = ok ? data?.guias?.[0] : null;
    if (!guia) return null;
    d.externo = true; d.guiaSocnet = guia.numero;
    return { etapa: 'EXT_OFERTA', dados: d, resposta: `📋 Localizamos a *guia SOCNET ${guia.numero}* para este CPF.\n\nExames: ${listaExames(guia.exames ?? [])}\n\nEnvie o kit para a equipe conferir antes de confirmar o atendimento.\n\n*1* - Continuar e enviar a guia\n*2* - Conferir e digitar o CPF novamente${RODAPE}` };
  }
  d.socnet = { sequencialFicha: p.sequencialFicha, empresa: p.empresa, assessoria: p.assessoria };
  d.colaboradorNome = p.funcionario?.nome ?? '';
  d.tipoExame = p.tipoExame ?? 'Periódico'; d.tipoLabel = TIPO_SOCNET_LABEL[d.tipoExame] ?? d.tipoExame;
  d.exames = [...(p.exames ?? [])]; d.examesBase = [...d.exames];
  if (p.empresa?.nome) d.empresaNome = p.empresa.nome;
  const u = await pedirUnidade(d);
  return { ...u, resposta: `✅ *Localizamos a autorização de exames para este colaborador!*\n\n👤 *${titulo(d.colaboradorNome)}*\n📋 Tipo de exame: *${d.tipoLabel}*\n🏢 Empresa: *${titulo(d.empresaNome)}*\n\n🩺 *Exames autorizados no pedido:*\n${listaExames(d.exames)}\n\n${u.resposta}` };
}

async function processar(ctx: Ctx, etapa: string, d: Dados, texto: string, nome?: string, arquivo?: { nome?: string; tipo: string; base64: string }): Promise<Res> {
  const t = texto.trim();
  switch (etapa) {
    case 'TERMO': {
      if (t !== '1') return { etapa, dados: d, resposta: `Para continuar, digite *1* (Li e concordo) ou *0* para cancelar.` };
      const { data: dup } = await ctx.admin.from('soc_agendamentos').select('protocolo, data_agendada, hora_agendada, unidade_id')
        .eq('colaborador_cpf', d.cpf).gte('data_agendada', new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10))
        .in('status', ['agendado_soc', 'aguardando_aprovacao', 'solicitado']).order('data_agendada').limit(1);
      if (dup?.length) {
        const a = dup[0]; const loc = (d.unidades ?? []).find((u: any) => u.id === a.unidade_id)?.nome;
        return { semVolta: true, etapa: 'FINALIZADO', dados: {}, resposta: `🚫 *Não foi possível concluir o agendamento*\n\nEste colaborador já possui um agendamento:\n\n🔖 Protocolo: *${a.protocolo}*\n📅 Data: *${brIso(a.data_agendada)}* às *${String(a.hora_agendada).slice(0, 5)}*${loc ? `\n📍 Local: *${nomeLocal(loc)}*` : ''}\n\nPara trocar data, horário, unidade ou cancelar, fale com nossa equipe ou acesse o Portal PreverMed:\n${PORTAL}\n\nSe precisar de outro agendamento, digite *1*.` };
      }
      d.termoAceito = new Date().toISOString();
      return pedirCnpj(d);
    }
    case 'AGUARDANDO_CNPJ': {
      const cnpj = so(t);
      if (cnpj.length !== 14) return { etapa, dados: d, resposta: `Não reconheci um CNPJ. Digite os *14 números* do CNPJ da empresa:${RODAPE}` };
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'empresa', cnpj });
      if (!ok) return { etapa, dados: d, resposta: `Não consegui consultar agora. Tente digitar o CNPJ novamente em instantes.${RODAPE}` };
      const empresas = (data?.empresas ?? []) as { soc_code: string; razao_social: string; cidade?: string; podeCriar?: boolean }[];
      if (!empresas.length) {
        if (!data?.externa?.razao_social) return { etapa, dados: d, resposta: `Não conseguimos identificar esse CNPJ. Confira o número e digite novamente, ou fale com nosso atendimento.${RODAPE}` };
        // Fora da carteira: segue pelo CPF (pedido SOCNET ou guia de parceiro)
        d.cnpj = cnpj; d.empresaNome = data.externa.razao_social; d.externo = true; d.livre = true; delete d.socCode;
        return { etapa: 'AGUARDANDO_CPF', dados: d, resposta: `🏢 Empresa identificada: *${titulo(d.empresaNome)}*\n\nAgora digite o *CPF* do colaborador:${RODAPE}` };
      }
      delete d.externo;
      d.cnpj = cnpj;
      if (empresas.length === 1) { d.socCode = empresas[0].soc_code; d.empresaNome = empresas[0].razao_social; d.livre = !!empresas[0].podeCriar; return pedirCpf(d); }
      d.empresas = empresas.map((e) => ({ socCode: e.soc_code, nome: e.razao_social, cidade: e.cidade, livre: !!e.podeCriar }));
      return { etapa: 'ESCOLHENDO_EMPRESA', dados: d, resposta: `Encontramos mais de uma empresa com esse CNPJ. Qual delas?\n\n${menu(d.empresas.map((e: any) => `${titulo(e.nome)}${e.cidade ? ` (${titulo(e.cidade)})` : ''}`))}${RODAPE}` };
    }
    case 'ESCOLHENDO_EMPRESA': {
      const i = escolha(t, d.empresas.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      d.socCode = d.empresas[i].socCode; d.empresaNome = d.empresas[i].nome; d.livre = !!d.empresas[i].livre; delete d.empresas;
      return pedirCpf(d);
    }
    case 'AGUARDANDO_CPF': {
      const cpf = so(t);
      if (!cpfValido(cpf)) return { etapa, dados: d, resposta: `CPF inválido. Digite os *11 números* do CPF do colaborador:${RODAPE}` };
      if (d.externo) {
        d.cpf = cpf;
        const s = await tentarSocnet(d);
        if (s) return s;
        return { etapa: 'EXT_OFERTA', dados: d, resposta: `ℹ️ Não localizamos *pedido de exames* nem *guia de encaminhamento* para este CPF no SOC.\n\nSolicite à empresa/assessoria a abertura do *pedido de exames* no SOC direcionado à PreverMed, ou envie a *guia de encaminhamento / kit de atendimento* para a equipe lançar o atendimento.\n\n*1* - Continuar e enviar a guia/kit\n*2* - Conferir e digitar o CPF novamente${RODAPE}` };
      }
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'funcionario', cnpj: d.cnpj, socCode: d.socCode, cpf });
      if (!ok || data?.indisponivel) return { etapa, dados: d, resposta: `Não consegui consultar o cadastro agora. Digite o CPF novamente em instantes.${RODAPE}` };
      d.cpf = cpf;
      if (!data?.encontrado) {
        // Blindagem: empresa da carteira nunca consulta pedidos SOCNET de outras empresas pelo CPF
        return { etapa: 'CAD_OFERTA', dados: d, resposta: `ℹ️ Não localizamos cadastro para este CPF nesta empresa.\n\nDeseja realizar o pré-cadastro agora para prosseguir com o agendamento?\n\n*1* - Sim, realizar pré-cadastro\n*2* - Digitar outro CPF${RODAPE}` };
      }
      d.colaboradorNome = data.funcionario?.nome ?? '';
      d.lotUnidade = data.funcionario?.unidade ?? ''; d.lotSetor = data.funcionario?.setor ?? ''; d.lotCargo = data.funcionario?.cargo ?? '';
      d.inativo = !!data.inativo;
      if (!d.inativo) return pedirConfLot(d);
      // Parceiras/Pontual: reaproveita o cadastro inativo (volta como Pendente no SOC)
      if (d.livre) return { etapa: 'REATIVAR_CONF', dados: d, resposta: `👤 Colaborador: *${titulo(d.colaboradorNome)}*\n\nEncontramos o cadastro deste colaborador:\n${lotacao(d) || '_(sem dados informados)_'}\n\nO cargo, o setor e a unidade continuam os mesmos?\n\n*1* - Sim, estão corretos\n*2* - Não, corrigir${RODAPE}` };
      d.tipos = d.inativo ? ['Demissional', 'Novo vínculo (pré-cadastro)'] : TIPOS_ATIVO;
      const aviso = d.inativo ? '\n\n⚠️ O cadastro deste colaborador está *inativo*.' : '';
      return { etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `👤 Colaborador: *${titulo(d.colaboradorNome)}*${lotacao(d) ? `\n${lotacao(d)}` : ''}${aviso}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` };
    }
    case 'REATIVAR_CONF': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* se os dados estão corretos ou *2* para corrigir.${RODAPE}` };
      if (i === 1) {
        const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'hierarquia', cnpj: d.cnpj, socCode: d.socCode });
        if (!ok || data?.indisponivel) return { etapa, dados: d, resposta: `Não consegui consultar a estrutura da empresa agora. Digite *2* novamente em instantes ou *1* para manter os dados.${RODAPE}` };
        d.cad = { alterando: true, reativar: true, livre: true }; d.hier = data;
        return pedirNivel(d, 'unidade');
      }
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'reativar', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf });
      if (!ok || !data?.ok) return { etapa, dados: d, resposta: `Não foi possível atualizar o cadastro: ${data?.error ?? 'erro inesperado'}\n\n*1* - Tentar novamente\n*2* - Corrigir dados${RODAPE}` };
      d.inativo = false;
      d.lotUnidade = data.funcionario?.unidade ?? d.lotUnidade; d.lotSetor = data.funcionario?.setor ?? d.lotSetor; d.lotCargo = data.funcionario?.cargo ?? d.lotCargo;
      return { ...menuTipos(d), semVolta: true };
    }
    case 'LOT_CONF': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para alterar a lotação.${RODAPE}` };
      if (i === 0) return menuTipos(d);
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'hierarquia', cnpj: d.cnpj, socCode: d.socCode });
      if (!ok || data?.indisponivel) return { etapa, dados: d, resposta: `Não consegui consultar a estrutura da empresa agora. Digite *2* novamente em instantes ou *1* para manter a lotação.${RODAPE}` };
      d.cad = { alterando: true, livre: !!data.podeCriar }; d.hier = data;
      if (!d.cad.livre && !data.unidades?.length) return portal('Esta empresa não possui unidades, setores e cargos ativos para alteração de lotação.');
      return pedirNivel(d, 'unidade');
    }
    case 'LOT_SALVAR': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para escolher novamente.${RODAPE}` };
      const c = d.cad;
      if (i === 1) { c.unidade = undefined; c.setor = undefined; c.cargo = undefined; return pedirNivel(d, 'unidade'); }
      const refEnvio = (r: { codigo?: string; nome?: string }) => r.codigo ? { codigo: r.codigo } : { nome: r.nome };
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: c.reativar ? 'reativar' : 'alterarLotacao', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf, unidade: refEnvio(c.unidade), setor: refEnvio(c.setor), cargo: refEnvio(c.cargo) });
      if (!ok || !data?.ok) return { etapa, dados: d, resposta: `Não foi possível atualizar a lotação: ${data?.error ?? 'erro inesperado'}\n\n*1* - Tentar novamente\n*2* - Escolher novamente${RODAPE}` };
      const antes = `${d.lotUnidade || '-'} / ${d.lotSetor || '-'} / ${d.lotCargo || '-'}`;
      d.lotUnidade = c.unidade.nome; d.lotSetor = c.setor.nome; d.lotCargo = c.cargo.nome;
      d.lotAlterada = `LOTAÇÃO ATUALIZADA NO SOC VIA AGENDAMENTO — DE: ${antes} — PARA: ${d.lotUnidade} / ${d.lotSetor} / ${d.lotCargo}`.toUpperCase();
      const reat = !!c.reativar;
      if (reat) { d.inativo = false; delete d.lotAlterada; }
      delete d.cad; delete d.hier;
      return { ...menuTipos(d, reat ? '✅ Cadastro atualizado!\n\n' : '✅ Lotação atualizada no SOC!\n\n'), semVolta: true };
    }
    case 'EXT_OFERTA': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para continuar ou *2* para digitar o CPF novamente.${RODAPE}` };
      if (i === 1) return { etapa: 'AGUARDANDO_CPF', dados: d, resposta: `Digite o *CPF* do colaborador:${RODAPE}` };
      return { etapa: 'EXT_NOME', dados: d, resposta: `Digite o *nome completo* do colaborador:${RODAPE}` };
    }
    case 'EXT_NOME': {
      const n = t.replace(/\s+/g, ' ');
      if (n.length < 5 || !n.includes(' ') || /\d/.test(n) || n.length > 120) return { etapa, dados: d, resposta: `Digite o *nome completo* do colaborador (nome e sobrenome, sem números):${RODAPE}` };
      d.colaboradorNome = n.toUpperCase();
      d.tipos = TIPOS_CADASTRO.filter((x) => x !== 'Retorno ao Trabalho');
      return { etapa: 'EXT_TIPO', dados: d, resposta: `Qual o tipo de exame indicado na guia?\n\n${menu(d.tipos)}${RODAPE}` };
    }
    case 'EXT_TIPO': {
      const i = escolha(t, d.tipos.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      const tipo = d.tipos[i];
      d.tipoExame = TIPO_SISTEMA[tipo] ?? tipo; d.tipoLabel = tipo; d.tiposAnt = d.tipos; delete d.tipos;
      d.exames = []; d.examesBase = [];
      return pedirExtras(d);
    }
    case 'CAD_OFERTA': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para realizar o pré-cadastro ou *2* para digitar outro CPF.${RODAPE}` };
      if (i === 1) return { etapa: 'AGUARDANDO_CPF', dados: d, resposta: `Digite o *CPF* do colaborador:${RODAPE}` };
      return iniciarCadastro(d);
    }
    case 'CAD_NOME': {
      const n = t.replace(/\s+/g, ' ');
      if (n.length < 5 || !n.includes(' ') || /\d/.test(n) || n.length > 120) return { etapa, dados: d, resposta: `Digite o *nome completo* do colaborador (nome e sobrenome, sem números):${RODAPE}` };
      d.cad.nome = n.toUpperCase();
      if (d.cad.corrigindo) return confirmarCad(d);
      return { etapa: 'CAD_NASC', dados: d, resposta: `🎂 Digite a *data de nascimento* (DD/MM/AAAA):${RODAPE}` };
    }
    case 'CAD_NASC': {
      const iso = dataBr(t);
      const idade = iso ? (Date.now() - new Date(iso).getTime()) / (365.25 * 864e5) : 0;
      if (!iso || idade < 14 || idade > 100) return { etapa, dados: d, resposta: `Data inválida. Digite a *data de nascimento* no formato DD/MM/AAAA:${RODAPE}` };
      d.cad.nascimento = iso;
      if (d.cad.corrigindo) return confirmarCad(d);
      return { etapa: 'CAD_SEXO', dados: d, resposta: `Sexo do colaborador:\n\n*1* - ♂️ Masculino\n*2* - ♀️ Feminino${RODAPE}` };
    }
    case 'CAD_SEXO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para Masculino ou *2* para Feminino.${RODAPE}` };
      d.cad.sexo = i === 0 ? 'MASCULINO' : 'FEMININO';
      if (d.cad.corrigindo) return confirmarCad(d);
      return pedirAdmissao(d);
    }
    case 'CAD_ADMISSAO': {
      const iso = dataBr(t);
      if (!iso || iso < d.cad.nascimento || new Date(iso).getTime() > Date.now() + 180 * 864e5) return { etapa, dados: d, resposta: `Data inválida. Digite a *data de admissão* (real ou pretendida) no formato DD/MM/AAAA:${RODAPE}` };
      d.cad.admissao = iso;
      if (d.cad.corrigindo && d.hier) return confirmarCad(d);
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'hierarquia', cnpj: d.cnpj, socCode: d.socCode });
      if (!ok || data?.indisponivel) return portal('Não consegui consultar a estrutura (unidades, setores e cargos) da empresa agora.');
      d.cad.livre = !!data.podeCriar;
      d.hier = data;
      if (!d.cad.livre && !data.unidades?.length) return portal('Esta empresa ainda não possui unidades, setores e cargos ativos para o pré-cadastro.');
      return pedirNivel(d, 'unidade');
    }
    case 'CAD_UNIDADE': case 'CAD_SETOR': case 'CAD_CARGO': {
      const nivel = etapa === 'CAD_UNIDADE' ? 'unidade' : etapa === 'CAD_SETOR' ? 'setor' : 'cargo';
      const lista = opcoesNivel(d, nivel);
      const vis: Item[] = d.filtro ?? lista.slice(0, MAX_OP);
      const nomeNivel = { unidade: 'unidade', setor: 'setor', cargo: 'cargo' }[nivel];
      if (/^\d+$/.test(t)) {
        const i = escolha(t, vis.length);
        if (i < 0) return { etapa, dados: d, resposta: `Esse número não está na lista. Digite o *número* de uma opção ou parte do *nome* para buscar.${RODAPE}` };
        delete d.filtro;
        return aplicarNivel(d, nivel, { codigo: vis[i].codigo, nome: vis[i].nome });
      }
      const q = semAcento(t);
      if (q.length < 2) return { etapa, dados: d, resposta: `Digite pelo menos *2 letras* do nome para buscar.${RODAPE}` };
      const exato = lista.filter((x) => semAcento(x.nome) === q);
      const achados = exato.length ? exato : lista.filter((x) => semAcento(x.nome).includes(q));
      if (achados.length === 1) {
        d.pend = { nivel, ref: { codigo: achados[0].codigo, nome: achados[0].nome } };
        return { etapa: 'CAD_CONF_NIVEL', dados: d, resposta: `Encontramos ${nivel === 'unidade' ? 'a' : 'o'} ${nomeNivel}:\n\n${ROT[nivel]}: *${titulo(achados[0].nome)}*\n\n*1* - Sim, confirmar\n*2* - Buscar novamente${RODAPE}` };
      }
      if (achados.length > 1) {
        d.filtro = achados.slice(0, MAX_OP);
        const mais = achados.length > MAX_OP ? `\n\n_Encontrei ${achados.length} opções; mostrando ${MAX_OP}. Digite mais letras do nome para refinar._` : '';
        return { etapa, dados: d, resposta: `Encontrei estas opções:\n\n${menu(d.filtro.map((x: Item) => titulo(x.nome)))}${mais}\n\nDigite o *número* da opção correta.${RODAPE}` };
      }
      if (d.cad.livre && t.length <= 130) {
        d.pend = { nivel, ref: { nome: t.toUpperCase() } };
        return { etapa: 'CAD_CONF_NIVEL', dados: d, resposta: `Não há ${nomeNivel} com esse nome. Deseja cadastrar ${nivel === 'unidade' ? 'a nova' : 'o novo'} ${nomeNivel}:\n\n${ROT[nivel]}: *${titulo(t)}*\n\n*1* - Sim, confirmar\n*2* - Buscar novamente${RODAPE}` };
      }
      return { etapa, dados: d, resposta: `❌ Não encontramos ${nivel === 'unidade' ? 'essa unidade' : nivel === 'setor' ? 'esse setor vinculado à unidade selecionada' : 'esse cargo vinculado ao setor selecionado'}. Digite o *número* da lista ou outra parte do *nome*.${RODAPE}` };
    }
    case 'CAD_CONF_NIVEL': {
      const i = escolha(t, 2);
      const p = d.pend;
      if (!p) return pedirNivel(d, 'unidade');
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para buscar novamente.${RODAPE}` };
      delete d.pend; delete d.filtro;
      if (i === 1) return pedirNivel(d, p.nivel);
      return aplicarNivel(d, p.nivel, p.ref);
    }
    case 'CAD_CORRIGIR': {
      const i = t === '0' ? -2 : escolha(t, 5);
      if (i === -2) return confirmarCad(d);
      if (i < 0) return menuCorrigir(d);
      d.cad.corrigindo = true;
      if (i === 0) return { etapa: 'CAD_NOME', dados: d, resposta: `Digite o *nome completo* correto:${RODAPE}` };
      if (i === 1) return { etapa: 'CAD_NASC', dados: d, resposta: `🎂 Digite a *data de nascimento* correta (DD/MM/AAAA):${RODAPE}` };
      if (i === 2) return { etapa: 'CAD_SEXO', dados: d, resposta: `Sexo do colaborador:\n\n*1* - ♂️ Masculino\n*2* - ♀️ Feminino${RODAPE}` };
      if (i === 3) return pedirAdmissao(d);
      d.cad.unidade = undefined; d.cad.setor = undefined; d.cad.cargo = undefined;
      return pedirNivel(d, 'unidade');
    }
    case 'CAD_CONFIRMAR': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para corrigir.${RODAPE}` };
      if (i === 1) return menuCorrigir(d);
      const c = d.cad;
      const refEnvio = (r: { codigo?: string; nome?: string }) => r.codigo ? { codigo: r.codigo } : { nome: r.nome };
      const { ok, data } = await chamar('soc-agenda-lookup', {
        acao: 'cadastrar', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf, nome: c.nome, dataNascimento: c.nascimento, dataAdmissao: c.admissao, sexo: c.sexo,
        unidade: refEnvio(c.unidade), setor: refEnvio(c.setor), cargo: refEnvio(c.cargo),
      });
      if (!ok || !data?.ok) return { etapa, dados: d, resposta: `Não foi possível concluir o pré-cadastro: ${data?.error ?? 'erro inesperado'}\n\n*1* - Tentar novamente\n*2* - Corrigir dados${RODAPE}` };
      d.colaboradorNome = c.nome; d.lotUnidade = c.unidade.nome; d.lotSetor = c.setor.nome; d.lotCargo = c.cargo.nome;
      d.inativo = false; delete d.hier; delete d.cad;
      d.tipos = TIPOS_CADASTRO;
      return { semVolta: true, etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `✅ Pré-cadastro realizado!\n\n👤 Colaborador: *${titulo(d.colaboradorNome)}*\n${lotacao(d)}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` };
    }
    case 'ESCOLHENDO_TIPO': {
      const i = escolha(t, d.tipos.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      const tipo = d.tipos[i];
      if (tipo.startsWith('Novo vínculo')) return iniciarCadastro(d);
      if (tipo === 'Retorno ao Trabalho') return portal('O Retorno ao Trabalho exige motivo, documentos e aprovação da nossa equipe de saúde.');
      const ex = await chamar('soc-agenda-lookup', { acao: 'exames', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf });
      if (!ex.ok || ex.data?.indisponivel) return { etapa, dados: d, resposta: `Não consegui consultar os exames do PCMSO agora. Digite o número do tipo de exame novamente em instantes.${RODAPE}` };
      d.tipoExame = TIPO_SISTEMA[tipo] ?? tipo; d.tipoLabel = tipo; d.tiposAnt = d.tipos; delete d.tipos;
      const todos = (ex.data?.exames ?? []) as any[];
      // Pontual/Consulta não têm coluna própria no PCMSO: mostra o que se aplica ao periódico
      const chave = d.tipoExame in (todos[0]?.tipos ?? {}) ? d.tipoExame : 'Periódico';
      d.exames = [...new Set(todos.filter((e) => e.tipos?.[chave]).map((e) => e.nome as string))].slice(0, 40);
      if (tipo === 'Monitoração Pontual') d.exames = d.exames.filter((e: string) => !ehClinico(e));
      d.examesBase = [...d.exames];
      // Empresas de Gestão/Uso precisam ter PCMSO; sem exames = risco de ASO errado → validação técnica
      if (!d.livre && !d.examesBase.length && !['Monitoração Pontual', 'Consulta Ocupacional'].includes(tipo)) return bloqueioPcmso(d);
      if (tipo === 'Mudança de Risco') {
        return { etapa: 'CONFIRMANDO_LOTACAO', dados: d, resposta: `⚠️ Para *Mudança de Risco*, a nova lotação (setor/cargo) precisa estar atualizada no SOC *antes* do atendimento.\n\nA lotação já foi atualizada?\n\n*1* - Sim\n*2* - Não${RODAPE}` };
      }
      return pedirExtras(d);
    }
    case 'PCMSO_BLOQUEIO': {
      const i = escolha(t, 3);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1*, *2* ou *3*.${RODAPE}` };
      if (i === 0) {
        const prot = await registrar(ctx, 'analise_pcmso', d);
        return { semVolta: true, etapa: 'FINALIZADO', dados: {}, resposta: `✅ *Solicitação de análise registrada!*\n\n🔖 Protocolo: *${prot}*\n\nNossa equipe técnica já foi avisada e retornará por este número após validar o PCMSO do cargo *${titulo(d.lotCargo || '-')}*.\n\nSe precisar de outro atendimento, digite *1*.` };
      }
      if (i === 1) {
        const prot = await registrar(ctx, 'atendimento_humano', d, undefined, { motivo: 'PCMSO sem exames para o cargo' });
        return { semVolta: true, etapa: 'FINALIZADO', dados: {}, resposta: `👩‍💼 Pedido de atendimento registrado (protocolo *${prot}*).\n\nUm atendente da PreverMed vai continuar o atendimento por este número em breve.\n\nSe precisar de outro atendimento, digite *1*.` };
      }
      return pedirConfLot(d);
    }
    case 'CONFIRMANDO_LOTACAO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para Sim ou *2* para Não.${RODAPE}` };
      if (i === 1) return portal('Atualize primeiro a nova lotação do colaborador e depois retorne para agendar.');
      d.mudancaRisco = 'Mudança de Risco: lotação informada como atualizada no SOC';
      return pedirExtras(d);
    }
    case 'PERGUNTANDO_EXTRAS': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para Não ou *2* para Sim.${RODAPE}` };
      if (i === 0) return confExames(d);
      return menuExtras(d);
    }
    case 'ADICIONANDO_EXAMES': {
      const ops = extrasDe(d);
      const partes = t.split(/[,;\n]+|\s+e\s+/i).map((s) => s.trim()).filter(Boolean);
      const novos: string[] = [];
      let termo = '';
      for (const p of partes) {
        if (/^[\d\s]+$/.test(p)) {
          for (const n of p.split(/\s+/)) {
            const x = Number(n) - 1;
            if (x < 0 || x >= ops.length) return { etapa, dados: d, resposta: `O número *${n}* não está na lista. Digite números de 1 a ${ops.length} (ex: *1, 2*) ou parte do nome do exame.${RODAPE}` };
            novos.push(ops[x]);
          }
        } else if (!termo) termo = p;
      }
      if (novos.length) adicionar(d, novos);
      if (termo) return buscarExame(d, termo);
      if (!novos.length) return menuExtras(d);
      return confExames(d);
    }
    case 'EXAME_BUSCA': {
      const ach: string[] = d.achados ?? [];
      const i = escolha(t, ach.length === 1 ? 2 : ach.length);
      if (i < 0) {
        if (/^\d+$/.test(t)) return { etapa, dados: d, resposta: `Digite um número da lista ou parte do nome para buscar novamente.${RODAPE}` };
        return buscarExame(d, t);
      }
      if (ach.length === 1 && i === 1) { delete d.achados; return { etapa: 'ADICIONANDO_EXAMES', dados: d, resposta: `Digite parte do nome do exame que deseja buscar (ex: _raio_, _glicemia_):${RODAPE}` }; }
      adicionar(d, [ach[i]]); delete d.achados;
      return confExames(d, `✅ *${nomeExame(ach[i])}* adicionado.\n\n`);
    }
    case 'CONF_EXAMES': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para alterar a lista.${RODAPE}` };
      if (i === 1) return menuAlterar(d);
      if (!d.exames?.length) return { ...menuExtras(d), resposta: `Selecione pelo menos um exame para este atendimento.\n\n${menuExtras(d).resposta}` };
      return pedirUnidade(d);
    }
    case 'ALTERAR_EXAMES': {
      const i = escolha(t, 2);
      if (i < 0) return menuAlterar(d);
      if (i === 0) return menuExtras(d);
      if (i === 1) {
        const ad = adicionais(d);
        if (!ad.length) return { ...menuAlterar(d), resposta: `Não há exames adicionais para remover.\n\n${menuAlterar(d).resposta}` };
        return { etapa: 'REMOVER_EXAME', dados: d, resposta: `Qual exame deseja remover?\n\n${menu(ad.map(nomeExame))}${RODAPE}` };
      }
      return menuAlterar(d);
    }
    case 'REMOVER_EXAME': {
      const ad = adicionais(d);
      const i = escolha(t, ad.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite o *número* do exame a remover.${RODAPE}` };
      d.exames = (d.exames ?? []).filter((e: string) => e !== ad[i]);
      return confExames(d, `🗑️ *${nomeExame(ad[i])}* removido.\n\n`);
    }
    case 'ESCOLHENDO_UNIDADE': {
      const i = escolha(t, d.unidades.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da unidade.${RODAPE}` };
      d.unidade = d.unidades[i];
      return pedirDatas(d);
    }
    case 'ESCOLHENDO_DATA': {
      const i = escolha(t, d.datas.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da data.${RODAPE}` };
      d.data = d.datas[i];
      const todas = d.horarios[d.data] as string[];
      const lab = (d.exames ?? []).some((e: string) => LAB.test(semAcento(e)));
      const pref = todas.filter((h) => (lab ? h <= '10:00' : h >= '10:30'));
      const base = (pref.length >= 4 ? pref : todas).slice().sort();
      const horas = base.length <= 4 ? base : [0, 1, 2, 3].map((k) => base[Math.round((k * (base.length - 1)) / 3)]);
      d.horas = horas;
      return { etapa: 'ESCOLHENDO_HORARIO', dados: d, resposta: `🕐 Horários em *${d.data}*:\n\n${menu(horas)}${RODAPE}` };
    }
    case 'ESCOLHENDO_HORARIO': {
      const i = escolha(t, d.horas.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* do horário.${RODAPE}` };
      d.hora = d.horas[i]; delete d.horarios; delete d.datas;
      return d.obsFeita ? resumo(d) : pedirObs(d);
    }
    case 'OBSERVACOES': {
      if (arquivo) return { etapa, dados: d, resposta: `Primeiro a observação 🙂 Digite o texto, ou *1* para pular. O arquivo você envia no próximo passo.${RODAPE}` };
      if (t !== '1') {
        if (t.length < 2) return { etapa, dados: d, resposta: `Digite sua observação, ou *1* para pular.${RODAPE}` };
        d.obs = t.slice(0, 900);
      }
      d.obsFeita = true;
      return pedirAnexo(d);
    }
    case 'ANEXO': {
      if (arquivo) return receberAnexo(etapa, d, arquivo);
      if (t === '1' && d.externo && !d.socnet && !listaAnexos(d).length) return { etapa, dados: d, resposta: `📎 Para este atendimento a *guia/autorização de exames* é obrigatória. Envie a foto ou o PDF agora.${RODAPE}` };
      if (t === '1') return resumo(d);
      if (t === '[midia]') return { etapa, dados: d, resposta: `Recebi o arquivo, mas não consegui abri-lo 😕 Tente enviar novamente como *foto* ou *PDF* (até 5 MB), ou digite *1* para continuar sem anexo.${RODAPE}` };
      return { etapa, dados: d, resposta: `Envie a foto ou o PDF agora, ou digite *1* para continuar sem anexo.${RODAPE}` };
    }
    case 'ANEXO_OK': {
      if (arquivo) return receberAnexo(etapa, d, arquivo);
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para continuar ou *2* para enviar outro documento.${RODAPE}` };
      if (i === 1) return { etapa: 'ANEXO', dados: d, resposta: `Envie o próximo arquivo ou foto agora (os anteriores serão mantidos), ou digite *1* para continuar.${RODAPE}` };
      return resumo(d);
    }
    case 'ERRO_CONF': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para escolher outra data ou *2* para um novo agendamento.${RODAPE}` };
      if (i === 0) return pedirDatas(d);
      return { ...boasVindas(nome), semVolta: true };
    }
    case 'CONFIRMANDO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para escolher outra data.${RODAPE}` };
      if (i === 1) return pedirDatas(d);
      d.termoAceito = new Date().toISOString();
      const { ok, data } = await chamar('soc-agenda-solicitar', {
        unidadeId: d.unidade.id, empresaNome: d.empresaNome, empresaCnpj: d.cnpj, codigoEmpresaSoc: d.socnet || d.externo ? undefined : d.socCode,
        origem: d.socnet ? 'socnet' : d.externo ? 'externo' : 'cliente', sequencialFicha: d.socnet?.sequencialFicha,
        colaboradorNome: d.colaboradorNome, colaboradorCpf: d.cpf, tipoExame: d.tipoExame,
        data: isoDe(d.data), hora: d.hora, exames: d.exames ?? [], mudancaRisco: [d.lotAlterada, d.mudancaRisco].filter(Boolean).join(' · ') || undefined,
        observacoes: d.obs || undefined, examesAdicionais: adicionais(d), solicitadoPor: `WHATSAPP${nome ? ` POR ${nome}` : ''}`,
        documentos: listaAnexos(d).map((a: any) => ({ ...a, tipoDocumento: 'Anexo WhatsApp' })),
      });
      if (!ok) {
        let det = '';
        if (String(data?.error ?? '').includes('já tem agendamento')) {
          const { data: a } = await ctx.admin.from('soc_agendamentos').select('protocolo, data_agendada, hora_agendada, unidade_id, soc_agenda_unidades(nome)')
            .eq('colaborador_cpf', d.cpf).eq('data_agendada', isoDe(d.data)).in('status', ['agendado_soc', 'aguardando_aprovacao', 'solicitado']).limit(1).maybeSingle();
          if (a) det = `\n\n🔖 Protocolo: *${a.protocolo}*\n📅 Data: *${brIso(a.data_agendada)}* às *${String(a.hora_agendada).slice(0, 5)}*\n📍 Local: *${nomeLocal((a as any).soc_agenda_unidades?.nome)}*`;
        }
        return { etapa: 'ERRO_CONF', dados: d, resposta: `⚠️ ${det ? 'Este colaborador já possui um agendamento nesta data:' : `Não foi possível concluir: ${data?.error ?? 'erro inesperado'}`}${det}\n\nO que deseja fazer?\n*1* - Escolher outra data para este colaborador\n*2* - Novo agendamento (outro colaborador)${RODAPE}` };
      }
      await registrar(ctx, 'agendamento', d, data.protocolo, { data: d.data, hora: d.hora, local: d.unidade.nome, termoAceito: d.termoAceito });
      const mesmaEmpresa = { cnpj: d.cnpj, empresaNome: d.empresaNome, socCode: d.socCode, externo: d.externo, livre: d.livre, termoAceito: d.termoAceito };
      return { semVolta: true, etapa: 'FINALIZADO', dados: { protocolo: data.protocolo, mesmaEmpresa }, resposta:
        `✅ *Agendamento registrado com sucesso!*\n\n🔖 Protocolo: *${data.protocolo}*\n\n${blocoAgendamento(d, true)}${data.pendenteEquipe ? `\n\n📌 Nossa equipe vai conferir ${d.externo && !d.socnet ? 'a guia enviada' : 'o pedido'} e confirmar a reserva na agenda. Se houver qualquer pendência, entraremos em contato por este número.` : ''}\n\n🪪 Levar um *documento de identificação com foto* no dia do atendimento.\n\nℹ️ *Atenção:* este é um *pré-agendamento*, feito para agilizar a abertura da ficha na recepção. O horário agendado é uma previsão de chegada do colaborador e *não garante atendimento exatamente no horário marcado*.\n\nPrecisa de outro agendamento?\n*1* - Nova empresa\n*2* - Outro colaborador de *${titulo(d.empresaNome)}*` };
    }
    default:
      return boasVindas(nome);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = Deno.env.get('WHATSAPP_BOT_TOKEN');
    if (!token || req.headers.get('x-bot-token') !== token) return json({ error: 'Não autorizado' }, 401);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos', campos: parsed.error.flatten().fieldErrors }, 400);
    const { telefone, texto, nome, arquivo } = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: sessao } = await admin.from('whatsapp_sessoes').select('etapa, dados_sessao, updated_at').eq('telefone', telefone).maybeSingle();
    const expirada = !sessao || Date.now() - new Date(sessao.updated_at).getTime() > EXPIRA_MS;
    const cmd = texto.trim().toLowerCase();
    const reiniciar = !arquivo && ['menu', 'sair', 'encerrar', 'recomeçar', 'recomecar'].includes(cmd);
    const voltar = !arquivo && ['0', 'v', 'voltar'].includes(cmd);
    const etapa = expirada || reiniciar || sessao!.etapa === 'FINALIZADO' ? 'INICIO' : sessao!.etapa;
    const dIn: Dados = etapa === 'INICIO' ? {} : { ...((sessao!.dados_sessao as Dados) ?? {}) };
    const hist: { e: string; r: string; d: Dados }[] = Array.isArray(dIn.hist) ? dIn.hist : [];
    const ult: string | undefined = dIn.ult;
    delete dIn.hist; delete dIn.ult;
    const ctx: Ctx = { admin, telefone, nome };

    let r: Res;
    // "Sair"/"encerrar" a qualquer momento, ou "0" na primeira mensagem (não há o que recomeçar) → encerra
    const naAbertura = !expirada && ['TERMO', 'AGUARDANDO_CNPJ'].includes(sessao?.etapa ?? '');
    const mesma = !expirada && sessao?.etapa === 'FINALIZADO' && cmd === '2' ? (sessao.dados_sessao as Dados)?.mesmaEmpresa : null;
    if (mesma?.cnpj) {
      // Outro colaborador da mesma empresa: pula CNPJ
      r = await pedirCpf({ ...mesma });
    } else if (reiniciar && sessao && sessao.etapa !== 'FINALIZADO' && (['sair', 'encerrar'].includes(cmd) || naAbertura)) {
      r = { etapa: 'FINALIZADO', dados: {}, resposta: 'Atendimento encerrado. Quando quiser, é só enviar *1*. 👋' };
    } else if (voltar && etapa !== 'INICIO') {
      const prev = hist.pop();
      if (prev) {
        const dd = prev.d;
        if (!dd.hier && dIn.hier) dd.hier = dIn.hier;
        if (dIn.anexo && ['ANEXO_OK', 'CONFIRMANDO'].includes(prev.e)) dd.anexo = dIn.anexo;
        r = { etapa: prev.e, dados: dd, resposta: `↩️ Voltando à etapa anterior.\n\n${prev.r}` };
      } else r = { etapa, dados: dIn, resposta: `Não há etapa anterior para voltar.${ult ? `\n\n${ult}` : ''}` };
    } else {
      // "Foto" da etapa atual para o V (sem o arquivo e sem a estrutura da empresa, que são grandes)
      const { anexo: _a, hier: _h, ...leve } = dIn;
      const snap = structuredClone(leve);
      try { r = await processar(ctx, etapa, dIn, texto, nome, arquivo); }
      catch (e) { console.error('whatsapp-agendamento', e); r = { ...boasVindas(nome), resposta: 'Tivemos uma instabilidade. Vamos recomeçar: digite *1*.' }; }
      if (r.semVolta) hist.length = 0;
      else if (r.etapa !== etapa && etapa !== 'INICIO' && ult) hist.push({ e: etapa, r: ult, d: snap });
    }
    if (r.etapa !== 'FINALIZADO') { r.dados.hist = hist.slice(-15); r.dados.ult = r.resposta; }

    await admin.from('whatsapp_sessoes').upsert({ telefone, nome: nome ?? null, etapa: r.etapa, dados_sessao: r.dados, updated_at: new Date().toISOString() }, { onConflict: 'telefone' });
    return json({ resposta: r.resposta, etapa: r.etapa });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
