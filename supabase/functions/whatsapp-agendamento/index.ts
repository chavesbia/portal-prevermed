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
  // Foto/PDF enviado no WhatsApp (Evolution com "Webhook Base64" ligado)
  arquivo: z.object({ nome: z.string().max(120).optional(), tipo: z.string().max(80), base64: z.string().max(7_000_000) }).optional(),
});

const EXPIRA_MS = 2 * 60 * 60 * 1000;
const PORTAL = 'https://portal.prevermed.com.br/agendamento';
const TIPOS_ATIVO = ['Periódico', 'Demissional', 'Mudança de Risco', 'Monitoração Pontual', 'Consulta Ocupacional', 'Retorno ao Trabalho'];
// Rótulo do WhatsApp → tipo gravado na Agenda
const TIPO_SISTEMA: Record<string, string> = { 'Consulta Ocupacional': 'Consulta' };
const EXTRAS = ['AUDIOMETRIA', 'ACUIDADE VISUAL', 'ELETROCARDIOGRAMA-ECG', 'ELETROENCEFALOGRAMA-EEG', 'ESPIROMETRIA', 'GLICEMIA DE JEJUM (GLICOSE)', 'HEMOGRAMA COMPLETO', 'EXAME TOXICOLÓGICO (QUERATINA)'];
const MIMES: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
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

function lotacao(d: Dados) {
  return [d.lotUnidade && `🏢 Unidade: *${titulo(d.lotUnidade)}*`, d.lotSetor && `📂 Setor: *${titulo(d.lotSetor)}*`, d.lotCargo && `💼 Cargo: *${titulo(d.lotCargo)}*`].filter(Boolean).join('\n');
}

function pedirExtras(d: Dados): Res {
  const lista = d.exames?.length ? d.exames.map((e: string) => `• ${titulo(e)}`).join('\n') : '_Não encontramos exames do PCMSO para este atendimento._';
  return { etapa: 'PERGUNTANDO_EXTRAS', dados: d, resposta: `🩺 Exames previstos no PCMSO para este atendimento:\n\n${lista}\n\nDeseja acrescentar algum exame complementar?\n\n*1* - Não, apenas os exames acima\n*2* - Sim, quero adicionar outros exames${RODAPE}` };
}

const pedirObs = (d: Dados): Res => ({ etapa: 'OBSERVACOES', dados: d, resposta: `📝 Deseja incluir alguma observação para a equipe de atendimento?\n(ex: restrição de horário, contato do gestor ou detalhes do colaborador)\n\nDigite sua observação, ou digite *1* para pular.${RODAPE}` });
const pedirAnexo = (d: Dados): Res => ({ etapa: 'ANEXO', dados: d, resposta: `📎 Deseja anexar a foto ou PDF da guia/pedido de exame ou de outro documento?\n\nEnvie o arquivo ou foto agora, ou digite *1* para continuar sem anexo.${RODAPE}` });

function resumo(d: Dados): Res {
  const ex = d.exames?.length ? d.exames.map((e: string) => titulo(e)).join(', ') : '-';
  return { etapa: 'CONFIRMANDO', dados: d, resposta:
    `Confira os dados do agendamento:\n\n🏢 Empresa: *${titulo(d.empresaNome)}*\n👤 Colaborador: *${titulo(d.colaboradorNome)}*\n${lotacao(d) ? lotacao(d) + '\n' : ''}🩺 Exame: *${d.tipoLabel ?? d.tipoExame}*\n🧪 Exames: ${ex}\n📍 Local: *${titulo(d.unidade.nome)}*\n📅 Data: *${d.data}* às *${d.hora}*\n📝 Observação: ${d.obs || '-'}\n📎 Anexo: ${d.anexo ? 'sim' : 'não'}\n\n*1* - Confirmar\n*2* - Escolher outra data${RODAPE}` };
}

async function processar(etapa: string, d: Dados, texto: string, nome?: string, arquivo?: { nome?: string; tipo: string; base64: string }): Promise<Res> {
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
      if (!data?.encontrado) {
        return { etapa: 'CAD_OFERTA', dados: d, resposta: `ℹ️ Não localizamos cadastro para este CPF nesta empresa.\n\nDeseja realizar o pré-cadastro agora para prosseguir com o agendamento?\n\n*1* - Sim, realizar pré-cadastro\n*2* - Digitar outro CPF${RODAPE}` };
      }
      d.colaboradorNome = data.funcionario?.nome ?? '';
      d.lotUnidade = data.funcionario?.unidade ?? ''; d.lotSetor = data.funcionario?.setor ?? ''; d.lotCargo = data.funcionario?.cargo ?? '';
      d.inativo = !!data.inativo;
      d.tipos = d.inativo ? ['Demissional', 'Novo vínculo (pré-cadastro)'] : TIPOS_ATIVO;
      const aviso = d.inativo ? '\n\n⚠️ O cadastro deste colaborador está *inativo*.' : '';
      return { etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `👤 Colaborador: *${titulo(d.colaboradorNome)}*${lotacao(d) ? `\n${lotacao(d)}` : ''}${aviso}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` };
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
      return { etapa: 'CAD_NASC', dados: d, resposta: `🎂 Digite a *data de nascimento* (DD/MM/AAAA):${RODAPE}` };
    }
    case 'CAD_NASC': {
      const iso = dataBr(t);
      const idade = iso ? (Date.now() - new Date(iso).getTime()) / (365.25 * 864e5) : 0;
      if (!iso || idade < 14 || idade > 100) return { etapa, dados: d, resposta: `Data inválida. Digite a *data de nascimento* no formato DD/MM/AAAA:${RODAPE}` };
      d.cad.nascimento = iso;
      return { etapa: 'CAD_SEXO', dados: d, resposta: `Sexo do colaborador:\n\n*1* - Masculino\n*2* - Feminino${RODAPE}` };
    }
    case 'CAD_SEXO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para Masculino ou *2* para Feminino.${RODAPE}` };
      d.cad.sexo = i === 0 ? 'MASCULINO' : 'FEMININO';
      return { etapa: 'CAD_ADMISSAO', dados: d, resposta: `📆 Digite a *data de admissão* do colaborador na empresa (DD/MM/AAAA):${RODAPE}` };
    }
    case 'CAD_ADMISSAO': {
      const iso = dataBr(t);
      if (!iso || iso < d.cad.nascimento || new Date(iso).getTime() > Date.now() + 180 * 864e5) return { etapa, dados: d, resposta: `Data inválida. Digite a *data de admissão* no formato DD/MM/AAAA:${RODAPE}` };
      d.cad.admissao = iso;
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
      const vis: Item[] = d.filtro ?? lista;
      const i = escolha(t, vis.length);
      let ref: { codigo?: string; nome?: string } | null = null;
      if (i >= 0 && so(t) === t) ref = { codigo: vis[i].codigo, nome: vis[i].nome };
      else {
        const q = semAcento(t);
        const exato = lista.find((x) => semAcento(x.nome) === q);
        const achados = lista.filter((x) => semAcento(x.nome).includes(q));
        if (exato) ref = exato;
        else if (q.length >= 2 && achados.length === 1) ref = achados[0];
        else if (q.length >= 2 && achados.length > 1) { d.filtro = achados.slice(0, 30); return { etapa, dados: d, resposta: `Encontrei estas opções:\n\n${menu(d.filtro.map((x: Item) => titulo(x.nome)))}\n\nDigite o *número* da opção.${RODAPE}` }; }
        else if (d.cad.livre && q.length >= 2 && t.length <= 130) ref = { nome: t.toUpperCase() };
      }
      if (!ref) return { etapa, dados: d, resposta: `Não encontrei essa opção. Digite o *número* ou parte do *nome*.${RODAPE}` };
      delete d.filtro;
      d.cad[nivel] = ref;
      if (nivel === 'unidade') return pedirNivel(d, 'setor');
      if (nivel === 'setor') return pedirNivel(d, 'cargo');
      return { etapa: 'CAD_CONFIRMAR', dados: d, resposta: `Confira o pré-cadastro:\n\n👤 Nome: *${titulo(d.cad.nome)}*\n🪪 CPF: ${d.cpf}\n🎂 Nascimento: ${brIso(d.cad.nascimento)}\n⚧ Sexo: ${titulo(d.cad.sexo)}\n📆 Admissão: ${brIso(d.cad.admissao)}\n🏢 Unidade: *${titulo(d.cad.unidade.nome)}*\n📂 Setor: *${titulo(d.cad.setor.nome)}*\n💼 Cargo: *${titulo(d.cad.cargo.nome)}*\n\n*1* - Confirmar pré-cadastro\n*2* - Corrigir dados${RODAPE}` };
    }
    case 'CAD_CONFIRMAR': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para corrigir.${RODAPE}` };
      if (i === 1) return iniciarCadastro(d);
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
      return { etapa: 'ESCOLHENDO_TIPO', dados: d, resposta: `✅ Pré-cadastro realizado!\n\n👤 Colaborador: *${titulo(d.colaboradorNome)}*\n${lotacao(d)}\n\nQual o tipo de exame?\n\n${menu(d.tipos)}${RODAPE}` };
    }
    case 'ESCOLHENDO_TIPO': {
      const i = escolha(t, d.tipos.length);
      if (i < 0) return { etapa, dados: d, resposta: `Digite apenas o *número* da opção.${RODAPE}` };
      const tipo = d.tipos[i];
      if (tipo.startsWith('Novo vínculo')) return iniciarCadastro(d);
      if (tipo === 'Retorno ao Trabalho') return portal('O Retorno ao Trabalho exige motivo, documentos e aprovação da nossa equipe de saúde.');
      d.tipoExame = TIPO_SISTEMA[tipo] ?? tipo; d.tipoLabel = tipo; delete d.tipos;
      const ex = await chamar('soc-agenda-lookup', { acao: 'exames', cnpj: d.cnpj, socCode: d.socCode, cpf: d.cpf });
      const todos = (ex.data?.exames ?? []) as any[];
      // Pontual/Consulta não têm coluna própria no PCMSO: mostra o que se aplica ao periódico
      const chave = d.tipoExame in (todos[0]?.tipos ?? {}) ? d.tipoExame : 'Periódico';
      d.exames = [...new Set(todos.filter((e) => e.tipos?.[chave]).map((e) => e.nome as string))].slice(0, 40);
      if (tipo === 'Mudança de Risco') {
        return { etapa: 'CONFIRMANDO_LOTACAO', dados: d, resposta: `⚠️ Para *Mudança de Risco*, a nova lotação (setor/cargo) precisa estar atualizada no SOC *antes* do atendimento.\n\nA lotação já foi atualizada?\n\n*1* - Sim\n*2* - Não${RODAPE}` };
      }
      return pedirExtras(d);
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
      if (i === 0) return pedirUnidade(d);
      return { etapa: 'ADICIONANDO_EXAMES', dados: d, resposta: `Escolha os exames complementares desejados:\n\n${menu(EXTRAS.map(titulo))}\n\nDigite os números desejados (ex: *1, 2*) ou escreva o nome do exame (ex: _Raio-X de Tórax OIT_).${RODAPE}` };
    }
    case 'ADICIONANDO_EXAMES': {
      const nums = t.split(/[\s,;e]+/).filter(Boolean);
      const porNumero = nums.every((n) => /^\d+$/.test(n));
      let novos: string[];
      if (porNumero) {
        const idx = nums.map((n) => Number(n) - 1);
        if (idx.some((x) => x < 0 || x >= EXTRAS.length)) return { etapa, dados: d, resposta: `Algum número não está na lista. Digite os números de 1 a ${EXTRAS.length} (ex: *1, 2*) ou o nome do exame.${RODAPE}` };
        novos = idx.map((x) => EXTRAS[x]);
      } else {
        if (t.length < 3 || t.length > 80) return { etapa, dados: d, resposta: `Escreva o nome do exame (entre 3 e 80 letras).${RODAPE}` };
        novos = [t.toUpperCase()];
      }
      d.exames = [...new Set([...(d.exames ?? []), ...novos])].slice(0, 40);
      const r = await pedirUnidade(d);
      return { ...r, resposta: `✅ Exames adicionados: ${novos.map(titulo).join(', ')}\n\n${r.resposta}` };
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
      if (arquivo) {
        const tipo = arquivo.tipo.split(';')[0].trim().toLowerCase();
        const ext = MIMES[tipo];
        if (!ext) return { etapa, dados: d, resposta: `Esse tipo de arquivo não é aceito. Envie *foto* (JPG/PNG) ou *PDF*, ou digite *1* para continuar sem anexo.${RODAPE}` };
        if (arquivo.base64.length > 6_800_000) return { etapa, dados: d, resposta: `Arquivo muito grande (máx. 5 MB). Envie outro, ou digite *1* para continuar sem anexo.${RODAPE}` };
        const nomeArq = (arquivo.nome?.replace(/[^\w.\- ]/g, '').slice(0, 100) || `whatsapp`).replace(/\.[^.]*$/, '') + `.${ext}`;
        d.anexo = { nome: nomeArq, tipo: tipo === 'image/jpg' ? 'image/jpeg' : tipo, base64: arquivo.base64.replace(/^data:[^,]+,/, '') };
        return resumo(d);
      }
      if (t === '1') return resumo(d);
      return { etapa, dados: d, resposta: `Envie a foto ou o PDF agora, ou digite *1* para continuar sem anexo.${RODAPE}` };
    }
    case 'CONFIRMANDO': {
      const i = escolha(t, 2);
      if (i < 0) return { etapa, dados: d, resposta: `Digite *1* para confirmar ou *2* para escolher outra data.${RODAPE}` };
      if (i === 1) return pedirDatas(d);
      const { ok, data } = await chamar('soc-agenda-solicitar', {
        unidadeId: d.unidade.id, empresaNome: d.empresaNome, empresaCnpj: d.cnpj, codigoEmpresaSoc: d.socCode,
        colaboradorNome: d.colaboradorNome, colaboradorCpf: d.cpf, tipoExame: d.tipoExame,
        data: isoDe(d.data), hora: d.hora, exames: d.exames ?? [], mudancaRisco: d.mudancaRisco,
        observacoes: [d.obs, `Solicitado via WhatsApp${nome ? ` por ${nome}` : ''}`].filter(Boolean).join('\n'),
        guia: d.anexo,
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
    const { telefone, texto, nome, arquivo } = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: sessao } = await admin.from('whatsapp_sessoes').select('etapa, dados_sessao, updated_at').eq('telefone', telefone).maybeSingle();
    const expirada = !sessao || Date.now() - new Date(sessao.updated_at).getTime() > EXPIRA_MS;
    const reiniciar = !arquivo && ['0', 'menu', 'sair', 'recomeçar', 'recomecar'].includes(texto.trim().toLowerCase());
    const etapa = expirada || reiniciar || sessao!.etapa === 'FINALIZADO' ? 'INICIO' : sessao!.etapa;

    let r: Res;
    try { r = await processar(etapa, expirada || reiniciar ? {} : (sessao!.dados_sessao as Dados) ?? {}, texto, nome, arquivo); }
    catch (e) { console.error('whatsapp-agendamento', e); r = { ...boasVindas(nome), resposta: 'Tivemos uma instabilidade. Vamos recomeçar: digite o *CNPJ* da empresa.' }; }

    await admin.from('whatsapp_sessoes').upsert({ telefone, nome: nome ?? null, etapa: r.etapa, dados_sessao: r.dados, updated_at: new Date().toISOString() }, { onConflict: 'telefone' });
    return json({ resposta: r.resposta, etapa: r.etapa });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
