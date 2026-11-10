// Agenda Inteligente (Laboratório V2): extrai dados de guia/texto livre e simula a resposta do robô. Não grava agendamento.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({
  texto: z.string().max(20000).optional().default(''),
  arquivo: z.object({ nome: z.string().max(200), mime: z.string().max(100), base64: z.string().max(8_000_000) }).optional(),
});

const LIVRES = ['0002', '0004', '0010'];
const CAMPOS = ['cnpj', 'razao_social', 'cpf', 'nome', 'data_nascimento', 'sexo', 'tipo_exame', 'unidade_empresa', 'setor', 'cargo', 'unidade_atendimento', 'data_preferida', 'periodo_preferido'] as const;
const s = { type: ['string', 'null'] };
const schema = {
  type: 'object', additionalProperties: false,
  required: [...CAMPOS, 'exames', 'observacoes'],
  properties: {
    ...Object.fromEntries(CAMPOS.map((c) => [c, s])),
    exames: { type: 'array', items: { type: 'string' } },
    observacoes: s,
  },
};

const INSTR = `Você extrai dados de pedidos de exame ocupacional (guias SOC, encaminhamentos, mensagens de WhatsApp em bloco) para a clínica PreverMed.
Regras: devolva null para tudo que NÃO estiver escrito; nunca invente nem deduza. CNPJ e CPF só com dígitos. Datas em AAAA-MM-DD.
sexo: "M" ou "F". tipo_exame: um de Admissional, Periódico, Demissional, Retorno ao Trabalho, Mudança de Risco, Monitoração Pontual, Consulta.
unidade_empresa/setor/cargo = lotação do colaborador na empresa cliente. unidade_atendimento = Lapa ou Osasco (clínica onde quer ser atendido).
exames = lista de exames solicitados, como escritos. observacoes = algo relevante e ambíguo (ou null).`;

const ROTULO: Record<string, string> = {
  cnpj: 'CNPJ da empresa', cpf: 'CPF do colaborador', nome: 'nome completo do colaborador', data_nascimento: 'data de nascimento',
  sexo: 'sexo', tipo_exame: 'tipo de exame', unidade_empresa: 'unidade da empresa', setor: 'setor', cargo: 'cargo',
  unidade_atendimento: 'unidade de atendimento (Lapa ou Osasco)', data_preferida: 'data de preferência', razao_social: 'razão social',
};

const gs = { type: 'STRING', nullable: true };
const gSchema = {
  type: 'OBJECT',
  required: [...CAMPOS, 'exames', 'observacoes'],
  properties: { ...Object.fromEntries(CAMPOS.map((c) => [c, gs])), exames: { type: 'ARRAY', items: { type: 'STRING' } }, observacoes: gs },
};

// Leitura via Google Gemini (chave própria GOOGLE_API_KEY) — não consome créditos do workspace.
async function extrair(texto: string, arquivo?: z.infer<typeof Body>['arquivo']) {
  const key = Deno.env.get('GOOGLE_API_KEY');
  if (!key) throw Object.assign(new Error('Chave do Gemini não configurada.'), { status: 500 });
  const parts: unknown[] = [{ text: texto ? `Mensagem do agendador:\n${texto}` : 'Extraia os dados do documento anexo (leia todas as páginas).' }];
  if (arquivo) parts.push({ inline_data: { mime_type: arquivo.mime, data: arquivo.base64 } });
  const req = JSON.stringify({
    systemInstruction: { parts: [{ text: INSTR }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: gSchema, temperature: 0 },
  });
  // Plano gratuito oscila (503/429): tenta modelos alternativos antes de desistir.
  const modelos = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let r!: Response; let t = '';
  for (const m of modelos) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: req,
    });
    t = await r.text();
    if (r.ok || ![429, 500, 503, 404].includes(r.status)) break;
  }
  if (!r.ok) {
    let msg = 'Falha na leitura inteligente.';
    try { msg = JSON.parse(t)?.error?.message ?? msg; } catch { /* */ }
    if (r.status === 429) msg = 'Limite gratuito do Gemini atingido no momento, aguarde um minuto.';
    if (r.status === 503) msg = 'O Gemini está sobrecarregado agora, tente de novo em instantes.';
    if (r.status === 400 || r.status === 403) msg = `Gemini recusou a chamada: ${msg}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  const out = JSON.parse(t)?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!out.trim()) throw new Error('A leitura não retornou dados (documento recusado ou ilegível).');
  return JSON.parse(out);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace(/^Bearer /, ''));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: 'Não autenticado' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: master } = await admin.rpc('has_role', { _user_id: uid, _role: 'adm_master' });
    if (!master) {
      await admin.rpc('log_unauthorized_access', { _resource: 'agenda-inteligente-lab', _source: 'edge', _method: 'POST', _details: {} }).catch(() => null);
      return json({ error: 'Laboratório restrito ao ADM Master' }, 403);
    }
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Dados inválidos' }, 400);
    const { texto, arquivo } = parsed.data;
    if (!texto.trim() && !arquivo) return json({ error: 'Cole um texto ou anexe uma guia.' }, 400);

    const dados = await extrair(texto, arquivo);
    for (const k of ['cpf', 'cnpj']) if (dados[k]) dados[k] = String(dados[k]).replace(/\D/g, '') || null;

    // Confronto com a carteira
    let empresa: Record<string, unknown> | null = null;
    let empresas: Record<string, unknown>[] = [];
    if (dados.cnpj) {
      const { data } = await admin.from('companies').select('soc_code, razao_social, subgrupo, subgrupo_codigo')
        .eq('cnpj', String(dados.cnpj).replace(/\D/g, '')).eq('is_active', true);
      empresas = data ?? []; empresa = empresas[0] ?? null;
    }
    const livre = empresa ? LIVRES.includes(String(empresa.subgrupo_codigo ?? '')) : null;

    const essenciais = ['cnpj', 'cpf', 'nome', 'tipo_exame', 'unidade_atendimento', 'data_preferida'];
    const lotacao = ['unidade_empresa', 'setor', 'cargo'];
    const faltando = essenciais.filter((c) => !dados[c]);
    const lotFaltando = lotacao.filter((c) => !dados[c]);
    const cadastro = ['data_nascimento', 'sexo'].filter((c) => !dados[c]);

    const alertas: string[] = [];
    if (dados.cnpj && !empresa) alertas.push('CNPJ fora da carteira: seguiria pelo CPF (SOCNET/externo), exigindo pedido no SOC ou guia.');
    if (empresas.length > 1) alertas.push(`${empresas.length} empresas ativas com este CNPJ: o robô pediria para escolher.`);
    if (empresa && !livre && lotFaltando.length) alertas.push('Empresa de subgrupo restrito (laudos nossos): unidade/setor/cargo inexistentes viram solicitação para a Engenharia, sem reservar horário.');
    if (dados.tipo_exame === 'Retorno ao Trabalho') alertas.push('Retorno ao Trabalho: primeiro motivo + documentos (protocolo RET-), Saúde aprova, depois escolhe data e horário.');
    if (dados.exames?.length) alertas.push('Exames da guia serão confrontados com o PCMSO: exames a mais são aceitos; exames a menos nunca (o PCMSO é o piso).');

    const pedir = [...faltando, ...(cadastro.includes('sexo') ? ['sexo'] : [])].map((c) => ROTULO[c]);
    const lista = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0];
    let resposta = arquivo ? 'Recebi a guia e alguns dados já foram identificados. ' : 'Alguns dados já foram identificados. ';
    if (pedir.length) resposta += `Mas não encontrei: ${lista(pedir)}. Poderia me informar, por favor?`;
    else resposta += 'Já tenho o necessário! Vou conferir no SOC e te mostrar os horários disponíveis.';
    if (dados.tipo_exame === 'Retorno ao Trabalho') resposta += '\n\nComo é Retorno ao Trabalho, antes da data vou precisar da Alta Médica para análise da nossa equipe de Saúde.';

    await admin.from('audit_log').insert({ user_id: uid, action_type: 'agenda_inteligente_teste', object_type: 'agenda_lab', details: { origem: arquivo ? 'arquivo' : 'texto', faltando } }).then(() => null, () => null);

    return json({ dados, empresa: empresa ? { ...empresa, livre } : null, faltando: faltando.map((c) => ROTULO[c]), lotacaoFaltando: lotFaltando.map((c) => ROTULO[c]), alertas, resposta });
  } catch (e) {
    const status = (e as { status?: number }).status;
    return json({ error: e instanceof Error ? e.message : 'Erro' }, status && status >= 400 && status < 600 ? status : 500);
  }
});
