// Robô de agendamento via WhatsApp (n8n/Evolution). Guarda a etapa da conversa por telefone
// e reaproveita as mesmas funções da página pública (consulta, horários e gravação com as regras da Agenda).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  telefone: z.string().regex(/^\d{8,15}$/),
  texto: z.string().max(1000).default(''),
  nome: z.string().max(120).optional(),
});

const EXPIRA_MS = 2 * 60 * 60 * 1000;
const PORTAL = 'https://portal.prevermed.com.br/agendamento';
const TIPOS_ATIVO = ['Periódico', 'Demissional', 'Mudança de Risco', 'Retorno ao Trabalho'];
const RODAPE = '\n\n_Digite *0* a qualquer momento para recomeçar._';

type Dados = Record<string, any>;
type Res = { resposta: string; etapa: string; dados: Dados };

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
  resposta: `Olá${nome ? `, ${titulo(nome.split(' ')[0])}` : ''}! 👋\n\nSeja bem-vindo(a) à central de Agendamento da *PreverMed Medicina Ocupacional*.\n\nPara iniciarmos, digite o *CNPJ* da empresa (apenas números ou com pontuação):`,
});

const portal = (motivo: string): Res => ({
  etapa: 'FINALIZADO', dados: {},
  resposta: `${motivo}\n\nEsse agendamento precisa ser feito pelo portal, onde é possível enviar os dados e documentos necessários:\n${PORTAL}\n\nSe precisar, digite *Oi* para iniciar um novo atendimento.`,
});

async function pedirCpf(d: Dados): Promise<Res> {
  return { etapa: 'AGUARDANDO_CPF', dados: d, resposta: `✅ Empresa: *${titulo(d.empresaNome)}*\n\nAgora digite o *CPF* do colaborador:${RODAPE}` };
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
  const datas = Object.keys(porData).sort((a, b) => isoDe(a).localeCompare(isoDe(b))).slice(0, 8);
  if (!datas.length) {
    const motivo = data?.indisponiveis?.[0]?.motivo;
    return { etapa: 'ESCOLHENDO_UNIDADE', dados: d, resposta: `Não há horários livres nessa unidade nos próximos dias${motivo ? ` (${motivo})` : ''}.\n\nEscolha outra unidade:\n${menu(d.unidades.map((u: any) => titulo(u.nome)))}${RODAPE}` };
  }
  d.horarios = Object.fromEntries(datas.map((k) => [k, porData[k].map((h) => h.hora)]));
  d.datas = datas;
  const aviso = data?.regrasExames ? `\n\nℹ️ ${typeof data.regrasExames === 'string' ? data.regrasExames : ''}`.trimEnd() : '';
  return { etapa: 'ESCOLHENDO_DATA', dados: d, resposta: `📅 Datas disponíveis em *${titulo(d.unidade.nome)}*:\n\n${menu(datas)}${aviso}${RODAPE}` };
}

async function processar(etapa: string, d: Dados, texto: string, nome?: string): Promise<Res> {
  const t = texto.trim();
  switch (etapa) {
    case 'AGUARDANDO_CNPJ': {
      const cnpj = so(t);
      if (cnpj.length !== 14) return { etapa, dados: d, resposta: `Não reconheci um CNPJ. Digite os *14 números* do CNPJ da empresa:${RODAPE}` };
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'empresa', cnpj });
      if (!ok) return { etapa, dados: d, resposta: `Não consegui consultar agora. Tente digitar o CNPJ novamente em instantes.${RODAPE}` };
      const empresas = (data?.empresas ?? []) as { soc_code: string; razao_social: string; cidade?: string }[];
      if (!empresas.length) return { etapa, dados: d, resposta: `Não encontramos esse CNPJ entre os clientes ativos da PreverMed. Confira o número e digite novamente, ou fale com nosso atendimento.${RODAPE}` };
      d.cnpj = cnpj;
      if (empresas.length === 1) { d.socCode = empresas[0].soc_code; d.empresaNome = empresas[0].razao_social; return pedirCpf(d); }
      d.empresas = empresas.map((e) => ({ socCode: e.soc_code, nome: e.razao_social, cidade: e.cidade }));
      return { etapa: 'ESCOLHENDO_EMPRESA', dados: d, resposta: `Encontramos mais de uma empresa com esse CNPJ. Qual delas?\n\n${menu(d.empresas.map((e: any) => `${titulo(e.nome)}${e.cidade ? ` (${titulo(e.cidade)})` : ''}`))}${RODAPE}` };
    }
    case 'ESCOLHENDO_EMPRESA': {
      const i = escolha(t, d.empresas.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      d.socCode = d.empresas[i].socCode; d.empresaNome = d.empresas[i].nome; delete d.empresas;
      return pedirCpf(d);
    }
    case 'AGUARDANDO_CPF': {
      const cpf = so(t);
      if (!cpfValido(cpf)) return { etapa, dados: d, resposta: `CPF inválido. Digite os *11 números* do CPF do colaborador:${RODAPE}` };
      const { ok, data } = await chamar('soc-agenda-lookup', { acao: 'funcionario', cnpj: d.cnpj, socCode: d.socCode, cpf });
      if (!ok || data?.indisponivel) return { etapa, dados: d, resposta: `Não consegui consultar o cadastro agora. Digite o CPF novamente em instantes.${RODAPE}` };
      d.cpf = cpf;
      if (!data?.encontrado) return portal('Não encontramos esse colaborador cadastrado nesta empresa (por exemplo, nova admissão).');
      d.colaboradorNome = data.funcionario?.nome ?? '';
      d.inativo = !!data.inativo;
      d.tipos = d.inativo ? ['Demissional', 'Admissional (nova admissão)'] : TIPOS_ATIVO;
      const aviso = d.inativo ? '\n\n⚠️ O cadastro deste colaborador está *inativo*.' : '';
      return { etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `👤 Colaborador: *${titulo(d.colaboradorNome)}*${aviso}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` };
    }
    case 'ESCOLHENDO_TIPO': {
      const i = escolha(t, d.tipos.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      const tipo = d.tipos[i];
      if (tipo.startsWith('Admissional')) return portal('Para colaborador com cadastro inativo, a nova admissão precisa ser registrada antes do agendamento.');
      if (tipo === 'Retorno ao Trabalho') return portal('O Retorno ao Trabalho exige motivo, documentos e aprovação da nossa equipe de saúde.');
      d.tipoExame = tipo; delete d.tipos;
      const ex = await chamar('soc-agenda-lookup', { acao: 'exames', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf });
      d.exames = ((ex.data?.exames ?? []) as any[]).filter((e) => e.tipos?.[tipo]).map((e) => e.nome).slice(0, 40);
      if (tipo === 'Mudança de Risco') {
        return { etapa: 'CONFIRMANDO_LOTACAO', dados: d, resposta: `⚠️ Para *Mudança de Risco*, a nova lotação (setor/cargo) precisa estar atualizada no SOC *antes* do atendimento.\n\nA lotação já foi atualizada?\n\n*1* - Sim\n*2* - Não${RODAPE}` };
      }
      return pedirUnidade(d);
    }
    case 'CONFIRMANDO_LOTACAO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para Sim ou *2* para Não.${RODAPE}` };
      if (i === 1) return portal('Atualize primeiro a nova lotação do colaborador e depois retorne para agendar.');
      d.mudancaRisco = 'Mudança de Risco: lotação informada como atualizada no SOC';
      return pedirUnidade(d);
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
      const horas = (d.horarios[d.data] as string[]).slice(0, 20);
      d.horas = horas;
      return { etapa: 'ESCOLHENDO_HORARIO', dados: d, resposta: `🕐 Horários em *${d.data}*:\n\n${menu(horas)}${RODAPE}` };
    }
    case 'ESCOLHENDO_HORARIO': {
      const i = escolha(t, d.horas.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* do horário.${RODAPE}` };
      d.hora = d.horas[i]; delete d.horarios; delete d.datas;
      return { etapa: 'CONFIRMANDO', dados: d, resposta:
        `Confira os dados do agendamento:\n\n🏢 Empresa: *${titulo(d.empresaNome)}*\n👤 Colaborador: *${titulo(d.colaboradorNome)}*\n🩺 Exame: *${d.tipoExame}*\n📍 Unidade: *${titulo(d.unidade.nome)}*\n📅 Data: *${d.data}* às *${d.hora}*\n\n*1* - Confirmar\n*2* - Escolher outra data${RODAPE}` };
    }
    case 'CONFIRMANDO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para escolher outra data.${RODAPE}` };
      if (i === 1) return pedirDatas(d);
      const { ok, data } = await chamar('soc-agenda-solicitar', {
        unidadeId: d.unidade.id, empresaNome: d.empresaNome, empresaCnpj: d.cnpj, codigoEmpresaSoc: d.socCode,
        colaboradorNome: d.colaboradorNome, colaboradorCpf: d.cpf, tipoExame: d.tipoExame,
        data: isoDe(d.data), hora: d.hora, exames: d.exames ?? [], mudancaRisco: d.mudancaRisco,
        observacoes: `Solicitado via WhatsApp${nome ? ` por ${nome}` : ''}`,
      });
      if (!ok) return { etapa: 'ESCOLHENDO_UNIDADE', dados: d, resposta: `Não foi possível concluir: ${data?.error ?? 'erro inesperado'}\n\nEscolha a unidade para ver outros horários:\n${menu(d.unidades.map((u: any) => titulo(u.nome)))}${RODAPE}` };
      return { etapa: 'FINALIZADO', dados: { protocolo: data.protocolo }, resposta:
        `✅ Agendamento registrado!\n\nProtocolo: *${data.protocolo}*\n📅 ${d.data} às ${d.hora} — ${titulo(d.unidade.nome)}\n\nLeve um documento com foto. Se precisar de outro agendamento, digite *Oi*.` };
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
    const { telefone, texto, nome } = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: sessao } = await admin.from('whatsapp_sessoes').select('etapa, dados_sessao, updated_at').eq('telefone', telefone).maybeSingle();
    const expirada = !sessao || Date.now() - new Date(sessao.updated_at).getTime() > EXPIRA_MS;
    const reiniciar = ['0', 'menu', 'sair', 'recomeçar', 'recomecar'].includes(texto.trim().toLowerCase());
    const etapa = expirada || reiniciar || sessao!.etapa === 'FINALIZADO' ? 'INICIO' : sessao!.etapa;

    let r: Res;
    try { r = await processar(etapa, expirada || reiniciar ? {} : (sessao!.dados_sessao as Dados) ?? {}, texto, nome); }
    catch (e) { console.error('whatsapp-agendamento', e); r = { ...boasVindas(nome), resposta: 'Tivemos uma instabilidade. Vamos recomeçar: digite o *CNPJ* da empresa.' }; }

    await admin.from('whatsapp_sessoes').upsert({ telefone, nome: nome ?? null, etapa: r.etapa, dados_sessao: r.dados, updated_at: new Date().toISOString() }, { onConflict: 'telefone' });
    return json({ resposta: r.resposta, etapa: r.etapa });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
