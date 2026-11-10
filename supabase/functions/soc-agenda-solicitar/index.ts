// Recebe a solicitação pública de agendamento, valida as regras da Agenda e grava no SOC
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { incluirAgendamentoSoc, situacaoSoc } from '../_shared/socAgendamento.ts';
import { salvarArquivo } from '../_shared/arquivos.ts';
import { emailAgenda } from '../_shared/agendaEmails.ts';
import { bloqueioExames, bloqueioUnidade, carregarRegras, contarDia, hojeSP, limiteDia } from '../_shared/agendaRegras.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Arquivo = z.object({
  nome: z.string().max(120),
  tipo: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  base64: z.string().max(7_000_000),
});
const Body = z.object({
  unidadeId: z.string().uuid().optional(),
  empresaNome: z.string().trim().min(2).max(200),
  empresaCnpj: z.string().regex(/^\d{14}$/),
  codigoEmpresaSoc: z.string().regex(/^\d{1,12}$/).optional(),
  // cliente = carteira PreverMed; socnet = pedido de assessoria parceira (Exporta 221785); externo = sem pedido, com guia
  origem: z.enum(['cliente', 'socnet', 'externo']).default('cliente'),
  sequencialFicha: z.string().regex(/^\d{1,15}$/).optional(),
  colaboradorNome: z.string().trim().min(3).max(200),
  colaboradorCpf: z.string().regex(/^\d{11}$/),
  tipoExame: z.enum(['Admissional', 'Periódico', 'Demissional', 'Retorno ao Trabalho', 'Mudança de Risco', 'Monitoração Pontual', 'Consulta', 'Consulta Assistencial']),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  observacoes: z.string().max(1000).optional(),
  mudancaRisco: z.string().max(800).optional(),
  motivoRetorno: z.string().trim().max(1000).optional(),
  exames: z.array(z.string().trim().min(2).max(80)).max(40).default([]),
  guia: Arquivo.optional(),
  tipoAnexo: z.string().trim().min(2).max(40).optional(),
  examesAdicionais: z.array(z.string().trim().min(2).max(80)).max(40).optional(),
  solicitadoPor: z.string().trim().max(120).optional(),
  documentos: z.array(Arquivo.extend({ tipoDocumento: z.string().trim().min(2).max(80) })).max(10).default([]),
  // Unidade/setor/cargo inexistente no SOC (empresa com laudos): pré-agenda travado até a Engenharia validar
  estruturaNova: z.object({
    unidade: z.string().trim().min(2).max(120), setor: z.string().trim().min(2).max(120), cargo: z.string().trim().min(2).max(120),
    atividades: z.string().trim().max(800).optional(),
    nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), sexo: z.enum(['MASCULINO', 'FEMININO']).optional(),
    admissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
  // Contato de quem agenda: exigido só quando há devolutiva da equipe (retorno/estrutura nova)
  solicitante: z.object({
    nome: z.string().trim().min(3).max(120), email: z.string().trim().email().max(160), celular: z.string().regex(/^\d{10,11}$/),
  }).optional(),
});

// Reconfere no SOC o pedido SOCNET (não confia no que veio da tela/robô)
async function pedidoSocnet(cpf: string, seq: string) {
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/soc-agenda-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_ANON_KEY')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
    body: JSON.stringify({ acao: 'socnet', cpf }),
  });
  const d = await r.json().catch(() => ({}));
  return ((d?.pedidos ?? []) as any[]).find((p) => p.sequencialFicha === seq) ?? null;
}

// Liberação vale 15 dias a partir da aprovação da Saúde
const VALIDADE_LIBERACAO_DIAS = 15;
async function retornoStatus(admin: any, cpf: string, codigoEmpresa: string) {
  const base = () => admin.from('soc_agendamentos').select('id, protocolo, aprovado_em')
    .eq('colaborador_cpf', cpf).eq('codigo_empresa_soc', codigoEmpresa).eq('tipo_exame', 'Retorno ao Trabalho').eq('fila_aprovacao', 'saude').is('data_agendada', null);
  const desde = new Date(Date.now() - VALIDADE_LIBERACAO_DIAS * 864e5).toISOString();
  const { data: lib } = await base().eq('status', 'documentacao_aprovada').gte('aprovado_em', desde).order('aprovado_em', { ascending: false }).limit(1).maybeSingle();
  const { data: pend } = await base().eq('aprovacao_status', 'pendente').limit(1).maybeSingle();
  return { liberado: lib ? { id: lib.id, protocolo: lib.protocolo } : null, pendente: pend ? { protocolo: pend.protocolo } : null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const raw = await req.json().catch(() => ({}));
    // Consulta da liberação do Retorno ao Trabalho (Modelo B): mesma resposta para página e robô
    if (raw?.acao === 'retornoStatus') {
      const cpf = String(raw.cpf ?? ''), soc = String(raw.codigoEmpresaSoc ?? '');
      if (!/^\d{11}$/.test(cpf) || !/^\d{1,12}$/.test(soc)) return json({ error: 'Dados inválidos' }, 400);
      const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      return json(await retornoStatus(adm, cpf, soc));
    }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: 'Dados inválidos', campos: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Empresa com laudos sem a estrutura no SOC: só abre chamado para a Engenharia, sem data/horário nem exames
    // (sem hierarquia não há grade de exames; psicossocial e exames com limite exigiriam reagendar depois)
    const eng = !!b.estruturaNova && b.origem === 'cliente';
    // Retorno ao Trabalho sem data = 1ª etapa (só documentação para a Saúde); com data = agendar após liberação
    const retDocs = b.tipoExame === 'Retorno ao Trabalho' && b.origem === 'cliente' && !b.data;
    let unid: { id: string; ativo: boolean; codigo_agenda: string } | null = null;
    if (!eng && !retDocs) {
      if (!b.unidadeId || !b.data || !b.hora) return json({ error: 'Escolha a unidade, a data e o horário.' }, 400);
      const { data: u } = await admin.from('soc_agenda_unidades').select('id, ativo, codigo_agenda').eq('id', b.unidadeId).maybeSingle();
      if (!u?.ativo) return json({ error: 'Unidade indisponível' }, 400);
      unid = u;
    }

    let empresaNome = '';
    let codigoEmpresa = b.codigoEmpresaSoc ?? null;
    let codFuncSocnet: string | undefined;
    let origemTxt = '';
    if (b.origem === 'cliente') {
      if (!b.codigoEmpresaSoc) return json({ error: 'Empresa inválida' }, 400);
      const { data: emp } = await admin.from('companies').select('razao_social')
        .eq('cnpj', b.empresaCnpj).eq('soc_code', b.codigoEmpresaSoc).eq('is_active', true).maybeSingle();
      if (!emp) return json({ error: 'Empresa não encontrada entre os clientes ativos' }, 400);
      empresaNome = emp.razao_social;
    } else if (b.origem === 'socnet') {
      if (!b.sequencialFicha) return json({ error: 'Pedido SOCNET não informado' }, 400);
      const p = await pedidoSocnet(b.colaboradorCpf, b.sequencialFicha);
      if (!p) return json({ error: 'Pedido SOCNET não localizado ou já concluído para este CPF.' }, 400);
      if (p.tipoExame && p.tipoExame !== b.tipoExame) return json({ error: 'Tipo de exame diferente do pedido SOCNET.' }, 400);
      b.exames = p.exames; b.colaboradorNome = p.funcionario?.nome ?? b.colaboradorNome;
      empresaNome = p.empresa?.nome ?? b.empresaNome;
      codigoEmpresa = p.empresa?.codigo ?? null; codFuncSocnet = p.funcionario?.codigo ?? undefined;
      origemTxt = `SOCNET: PEDIDO ${p.sequencialFicha} · EMPRESA ${p.empresa?.codigo ?? '-'} ${p.empresa?.nome ?? ''} · ASSESSORIA ${p.assessoria?.codigo ?? '-'} ${p.assessoria?.nome ?? ''}`.trim();
    } else {
      if (!b.guia && !b.documentos.length) return json({ error: 'Anexe a guia ou autorização de exames.' }, 400);
      if (!b.exames.length) return json({ error: 'Selecione os exames.' }, 400);
      empresaNome = b.empresaNome.toUpperCase();
      origemTxt = 'PARCEIRO/AVULSO SEM PEDIDO SOCNET — CONFERIR GUIA ANEXA';
    }
    const retorno = b.tipoExame === 'Retorno ao Trabalho' && b.origem !== 'socnet';
    if (retorno && b.origem !== 'cliente') return json({ error: 'Retorno ao Trabalho sem pedido SOCNET deve ser tratado com nossa equipe.' }, 400);
    let liberado: { id: string; protocolo: string } | null = null;
    if (retorno && !retDocs) {
      liberado = (await retornoStatus(admin, b.colaboradorCpf, codigoEmpresa!)).liberado;
      if (!liberado) return json({ error: 'Retorno ao Trabalho: envie primeiro o motivo e a documentação para análise da nossa equipe de Saúde. Após a aprovação, você escolhe o dia e o horário.' }, 400);
    }

    // Regras da Agenda conferidas no servidor (mesmas da tela)
    if (!eng && !retDocs) {
      const dataAg = b.data!, horaAg = b.hora!;
      if (dataAg <= hojeSP()) return json({ error: 'Escolha uma data a partir de amanhã.' }, 400);
      const regras = await carregarRegras(admin, b.unidadeId!);
      const bloqueio = bloqueioUnidade(regras, dataAg, horaAg) ?? bloqueioExames(regras, dataAg, horaAg, b.exames);
      if (bloqueio) return json({ error: `${bloqueio} Escolha outra data ou horário.` }, 400);
      const lim = limiteDia(regras, dataAg, b.tipoExame);
      if (lim !== null && (await contarDia(admin, b.unidadeId!, dataAg, b.tipoExame)) >= lim) {
        return json({ error: `Limite diário de ${b.tipoExame} atingido nesta data. Escolha outro dia.` }, 400);
      }
    }

    // Retorno ao Trabalho: motivo e documentos obrigatórios
    if (retDocs) {
      if (!b.motivoRetorno || b.motivoRetorno.length < 10) return json({ error: 'Explique brevemente o motivo do retorno ao trabalho.' }, 400);
      const { data: exig } = await admin.from('agenda_documentos_exigidos').select('nome').eq('tipo_exame', b.tipoExame).eq('obrigatorio', true);
      const enviados = new Set(b.documentos.map((d) => d.tipoDocumento));
      const faltam = (exig ?? []).map((e: any) => e.nome).filter((n: string) => !enviados.has(n));
      if (faltam.length) return json({ error: `Anexe: ${faltam.join(', ')}.` }, 400);
      if (!b.documentos.length) return json({ error: 'Anexe a documentação do retorno ao trabalho.' }, 400);
      // Mesmo arquivo em dois campos (ex.: Alta Médica = Decisão do INSS) não vale como documento distinto
      const vistos = new Set<string>();
      for (const d of b.documentos) { const k = `${d.base64.length}:${d.base64.slice(0, 2000)}:${d.base64.slice(-2000)}`; if (vistos.has(k)) return json({ error: 'O mesmo arquivo foi anexado em mais de um campo. Anexe cada documento separadamente.' }, 400); vistos.add(k); }
    }
    // Pela página (sem robô WhatsApp, que já tem o número) quem agenda precisa deixar contato quando há devolutiva
    if ((retDocs || (!!b.estruturaNova && b.origem === 'cliente')) && !b.solicitadoPor && !b.solicitante)
      return json({ error: 'Informe nome, e-mail e celular de quem está agendando para recebermos a devolutiva.' }, 400);

    // Cadastro inativo: só Demissional no vínculo existente; Admissional exige novo cadastro antes
    const sit = b.origem === 'cliente' ? await situacaoSoc(b.codigoEmpresaSoc!, b.colaboradorCpf) : null;
    if (sit?.inativo && b.tipoExame !== 'Demissional') {
      return json({ error: b.tipoExame === 'Admissional'
        ? 'Colaborador com cadastro inativo: registre a nova admissão antes de agendar.'
        : 'Não é possível agendar este tipo de exame para colaborador com cadastro inativo.' }, 400);
    }

    if (eng) {
      // Evita chamado duplicado da mesma estrutura para o mesmo colaborador
      const { data: dupEng } = await admin.from('soc_agendamentos').select('protocolo')
        .eq('colaborador_cpf', b.colaboradorCpf).eq('codigo_empresa_soc', codigoEmpresa!).eq('fila_aprovacao', 'engenharia')
        .eq('aprovacao_status', 'pendente').limit(1);
      if (dupEng?.length) return json({ error: `Já existe uma solicitação de estrutura em análise para este colaborador (protocolo ${dupEng[0].protocolo}).` }, 409);
    } else if (retDocs) {
      const st = await retornoStatus(admin, b.colaboradorCpf, codigoEmpresa!);
      if (st.pendente) return json({ error: `A documentação deste colaborador já está em análise pela Saúde (protocolo ${st.pendente.protocolo}).` }, 409);
      if (st.liberado) return json({ error: `A documentação deste colaborador já foi aprovada (protocolo ${st.liberado.protocolo}). Agora é só escolher o dia e o horário.` }, 409);
    } else {
      // Mesmo CPF pode ter exame em empresas diferentes no mesmo dia
      let qDup = admin.from('soc_agendamentos').select('id')
        .eq('colaborador_cpf', b.colaboradorCpf).eq('data_agendada', b.data!)
        .in('status', ['agendado_soc', 'aguardando_aprovacao']);
      qDup = codigoEmpresa ? qDup.eq('codigo_empresa_soc', codigoEmpresa) : qDup.eq('empresa_cnpj', b.empresaCnpj);
      const { data: dup } = await qDup.limit(1);
      if (dup?.length) return json({ error: 'Este colaborador já tem agendamento nesta data nesta empresa.' }, 409);
    }

    let guiaPath: string | null = null;
    const anexos: { tipo_documento: string; nome_arquivo: string; path: string }[] = [];
    try {
      if (b.guia) { guiaPath = await salvarArquivo(admin, b.data ?? hojeSP(), b.guia); anexos.push({ tipo_documento: b.tipoAnexo ?? 'Guia', nome_arquivo: b.guia.nome, path: guiaPath }); }
      for (const d of b.documentos) anexos.push({ tipo_documento: d.tipoDocumento, nome_arquivo: d.nome, path: await salvarArquivo(admin, b.data ?? hojeSP(), d) });
    } catch (e) { return json({ error: (e as Error).message }, 400); }
    const exames = eng ? [] : [...new Set(b.exames.map((e) => e.toUpperCase()))];

    const { data, error } = liberado ? await admin.from('soc_agendamentos').update({
      unidade_id: b.unidadeId, data_agendada: b.data, hora_agendada: b.hora, exames, status: 'solicitado',
    }).eq('id', liberado.id).eq('status', 'documentacao_aprovada').select('id, protocolo').single() : await admin.from('soc_agendamentos').insert({
      exames, guia_path: guiaPath, unidade_id: eng ? null : b.unidadeId,
      empresa_nome: empresaNome, empresa_cnpj: b.empresaCnpj, codigo_empresa_soc: codigoEmpresa,
      colaborador_nome: b.colaboradorNome.toUpperCase(), colaborador_cpf: b.colaboradorCpf,
      tipo_exame: b.tipoExame, data_agendada: eng ? null : b.data, hora_agendada: eng ? null : b.hora,
      observacoes: [origemTxt, b.mudancaRisco, b.observacoes, b.solicitadoPor && `Solicitado via ${b.solicitadoPor}`].filter(Boolean).join('\n') || null,
      motivo_retorno: retorno ? b.motivoRetorno : null,
      status: retDocs || eng ? 'aguardando_aprovacao' : 'solicitado',
      aprovacao_status: retDocs || eng ? 'pendente' : null,
      fila_aprovacao: eng ? 'engenharia' : 'saude',
      estrutura_solicitada: eng ? b.estruturaNova : null,
      solicitante: b.solicitante ?? null,
    }).select('id, protocolo').single();
    // Solicitação de estrutura usa protocolo próprio (INC-), separado dos agendamentos (AG-)
    if (!error && data && (eng || retDocs) && data.protocolo?.startsWith('AG-')) {
      const inc = (eng ? 'INC-' : 'RET-') + data.protocolo.slice(3);
      const { error: e2 } = await admin.from('soc_agendamentos').update({ protocolo: inc }).eq('id', data.id);
      if (!e2) data.protocolo = inc;
    }
    if (error) return json({ error: 'Não foi possível registrar' }, 500);
    if (anexos.length) await admin.from('soc_agendamento_anexos').insert(anexos.map((a) => ({ ...a, agendamento_id: data.id })));

    // Retorno ao Trabalho só vai para o SOC após aprovação da equipe de saúde
    if (retDocs || eng) {
      await emailAgenda(admin, data.id, eng ? 'agenda-estrutura-engenharia' : 'agenda-retorno-saude');
      return json({ protocolo: data.protocolo, agendadoSoc: false, aguardandoAprovacao: true, engenharia: eng, retornoDocs: retDocs });
    }
    // Sem pedido SOCNET não há cadastro no SOC: a equipe confere a guia e lança a reserva
    if (b.origem === 'externo' || !codigoEmpresa) {
      await emailAgenda(admin, data.id, 'agenda-protocolo-aberto');
      return json({ protocolo: data.protocolo, agendadoSoc: false, pendenteEquipe: true });
    }

    const soc = await incluirAgendamentoSoc({
      codigoEmpresa, cpf: b.colaboradorCpf, codigoAgenda: unid!.codigo_agenda,
      data: b.data!, hora: b.hora!, tipoExame: b.tipoExame,
      codigoFuncionarioSoc: codFuncSocnet ?? (sit?.inativo ? sit.codigo ?? undefined : undefined),
      detalhes: [
        `PROTOCOLO: ${data.protocolo}`,
        origemTxt,
        b.examesAdicionais ? `EXAMES ADICIONAIS: ${b.examesAdicionais.map((e) => e.toUpperCase()).join(', ') || 'NENHUM'}` : `EXAMES: ${exames.join(', ') || '-'}`,
        b.mudancaRisco ? `ATENÇÃO: ${b.mudancaRisco.toUpperCase()}` : '',
        b.observacoes?.trim() ? `OBSERVAÇÃO: ${b.observacoes.trim().toUpperCase()}` : '',
        anexos.length ? `ANEXO: SIM${anexos.length > 1 ? ` (${anexos.length} ARQUIVOS)` : ''} (VERIFICAR NO PORTAL)` : '',
        b.solicitadoPor ? `SOLICITADO VIA ${b.solicitadoPor.toUpperCase()}` : '',
      ].filter(Boolean).map((l) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()).join('\n\n'),
    });
    await admin.from('soc_agendamentos').update({
      status: soc.ok ? 'agendado_soc' : 'solicitado',
      soc_retorno: { codigoAgendamento: soc.codigoAgendamento ?? null, resposta: soc.resposta },
      soc_erro: soc.ok ? null : soc.erro,
    }).eq('id', data.id);
    await emailAgenda(admin, data.id, soc.ok ? 'agenda-confirmado' : 'agenda-protocolo-aberto');
    // SOCNET: se o SOC recusar a reserva na base da PreverMed, a solicitação fica para a equipe confirmar
    return json({ protocolo: data.protocolo, agendadoSoc: soc.ok, pendenteEquipe: !soc.ok && b.origem === 'socnet' });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
