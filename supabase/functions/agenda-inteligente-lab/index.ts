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
  unidade_atendimento: 'unidade de atendimento (Lapa ou Osasco)', data_preferida: 'dia de preferência',
};

async function extrair(texto: string, arquivo?: z.infer<typeof Body>['arquivo']) {
  const content: unknown[] = [{ type: 'input_text', text: texto ? `Mensagem do agendador:\n${texto}` : 'Extraia os dados do documento anexo.' }];
  if (arquivo) {
    const url = `data:${arquivo.mime};base64,${arquivo.base64}`;
    content.push(arquivo.mime === 'application/pdf'
      ? { type: 'input_file', filename: arquivo.nome, file_data: url }
      : { type: 'input_image', image_url: url });
  }
  const r = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': Deno.env.get('LOVABLE_API_KEY')!, 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra', stream: true, store: false, instructions: INSTR,
      reasoning: { effort: 'low' },
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'extracao', strict: true, schema } },
    }),
  });
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => '');
    let msg = 'Falha na leitura inteligente.';
    try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg; } catch { /* */ }
    if (r.status === 402) msg = 'Créditos de IA esgotados no workspace.';
    if (r.status === 429) msg = 'Muitas leituras seguidas, aguarde um minuto.';
    throw Object.assign(new Error(msg), { status: r.status });
  }
  const reader = r.body.getReader(); const dec = new TextDecoder();
  let buf = '', out = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split('\n'); buf = linhas.pop() ?? '';
    for (const l of linhas) {
      if (!l.startsWith('data:')) continue;
      const d = l.slice(5).trim(); if (!d || d === '[DONE]') continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === 'response.output_text.delta') out += ev.delta;
        if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(ev.response?.error?.message ?? ev.message ?? 'Falha na leitura.');
      } catch (e) { if (e instanceof Error && !(e instanceof SyntaxError)) throw e; }
    }
  }
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

    const lidos = Object.entries(dados).filter(([k, v]) => k !== 'observacoes' && k !== 'exames' && v).map(([k]) => ROTULO[k] ?? k);
    const pedir = faltando.map((c) => ROTULO[c]);
    let resposta = '';
    if (lidos.length) resposta += `Já identifiquei: ${lidos.join(', ')}${dados.exames?.length ? ` e ${dados.exames.length} exame(s)` : ''}.\n\n`;
    if (pedir.length) resposta += `Para continuar, preciso só de:\n${pedir.map((p, i) => `${i + 1}️⃣ ${p}`).join('\n')}`;
    else resposta += 'Tenho o necessário. Vou conferir unidade, setor e cargo no SOC e mostrar os horários disponíveis.';
    if (cadastro.length) resposta += `\n\n(Se o colaborador não existir no SOC, também vou pedir: ${cadastro.map((c) => ROTULO[c]).join(', ')}.)`;

    await admin.from('audit_log').insert({ user_id: uid, action_type: 'agenda_inteligente_teste', object_type: 'agenda_lab', details: { origem: arquivo ? 'arquivo' : 'texto', faltando } }).then(() => null, () => null);

    return json({ dados, empresa: empresa ? { ...empresa, livre } : null, faltando: faltando.map((c) => ROTULO[c]), lotacaoFaltando: lotFaltando.map((c) => ROTULO[c]), alertas, resposta });
  } catch (e) {
    const status = (e as { status?: number }).status;
    return json({ error: e instanceof Error ? e.message : 'Erro' }, status && status >= 400 && status < 600 ? status : 500);
  }
});
