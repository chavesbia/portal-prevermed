CREATE TABLE public.os_correcao_retroativa_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL UNIQUE REFERENCES public.servicos_os(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL,
  faltava_executor boolean NOT NULL,
  faltava_laudo boolean NOT NULL,
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_correcao_retroativa_itens TO authenticated;
GRANT ALL ON public.os_correcao_retroativa_itens TO service_role;
ALTER TABLE public.os_correcao_retroativa_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Correcao retroativa view" ON public.os_correcao_retroativa_itens FOR SELECT TO authenticated
USING (is_adm_master() OR can_view_module_route(auth.uid(), '/gestao-os/correcao-retroativa'));

-- Snapshot fixo do grupo identificado na varredura
INSERT INTO public.os_correcao_retroativa_itens (servico_id, ordem_id, faltava_executor, faltava_laudo)
SELECT s.id, s.ordem_id, s.responsavel_id IS NULL,
       NOT EXISTS (SELECT 1 FROM public.laudos l WHERE l.servico_id = s.id)
FROM public.servicos_os s
WHERE s.status = 'Encerrado'
  AND (s.responsavel_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.laudos l WHERE l.servico_id = s.id));

INSERT INTO public.modules (name, description, icon, route, is_active)
SELECT 'Correção Retroativa de OS', 'Preenchimento pontual de executor/laudo em serviços encerrados', 'Wrench', '/gestao-os/correcao-retroativa', true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE route = '/gestao-os/correcao-retroativa');

INSERT INTO public.department_modules (department_id, module_id)
SELECT dm.department_id, m2.id FROM public.department_modules dm
JOIN public.modules m1 ON m1.id = dm.module_id AND m1.route = '/gestao-os'
CROSS JOIN public.modules m2
WHERE m2.route = '/gestao-os/correcao-retroativa'
  AND NOT EXISTS (SELECT 1 FROM public.department_modules x WHERE x.module_id = m2.id AND x.department_id = dm.department_id);

CREATE OR REPLACE FUNCTION public.correcao_retroativa_listar()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os/correcao-retroativa')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM os_correcao_retroativa_itens),
    'resolvidos', (SELECT count(*) FROM os_correcao_retroativa_itens WHERE resolvido_em IS NOT NULL),
    'itens', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'numero_os', x->>'tipo') FROM (
      SELECT jsonb_build_object(
        'id', i.id, 'servico_id', s.id, 'ordem_id', o.id, 'numero_os', o.numero_os,
        'empresa', o.empresa_cliente, 'tipo', s.tipo, 'status_servico', s.status, 'status_os', o.status_os,
        'data_conclusao', s.data_conclusao,
        'precisa_executor', i.faltava_executor AND s.responsavel_id IS NULL,
        'precisa_laudo', i.faltava_laudo AND NOT EXISTS (SELECT 1 FROM laudos l WHERE l.servico_id = s.id),
        'responsavel_id', s.responsavel_id
      ) x
      FROM os_correcao_retroativa_itens i
      JOIN servicos_os s ON s.id = i.servico_id
      JOIN ordens_servico o ON o.id = s.ordem_id
      WHERE i.resolvido_em IS NULL) q), '[]'::jsonb),
    'profissionais', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome) ORDER BY nome) FROM profissionais WHERE ativo AND COALESCE(pode_ser_executor, true)), '[]'::jsonb),
    'responsaveis', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'conselho', conselho, 'registro', numero_registro) ORDER BY nome) FROM responsaveis_tecnicos WHERE ativo), '[]'::jsonb),
    'tipos_laudo', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'exige_vigencia', exige_vigencia) ORDER BY nome) FROM tipos_laudo WHERE ativo), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.correcao_retroativa_salvar(_item_id uuid, _responsavel_id uuid, _laudo jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it os_correcao_retroativa_itens; s servicos_os; o ordens_servico; rt responsaveis_tecnicos; tl tipos_laudo;
  _uname text; ok_exec boolean; ok_laudo boolean;
BEGIN
  IF NOT (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os/correcao-retroativa')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO it FROM os_correcao_retroativa_itens WHERE id = _item_id AND resolvido_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado ou já resolvido'; END IF;
  SELECT * INTO s FROM servicos_os WHERE id = it.servico_id;
  SELECT * INTO o FROM ordens_servico WHERE id = s.ordem_id;
  SELECT full_name INTO _uname FROM profiles WHERE user_id = auth.uid();

  IF it.faltava_executor AND s.responsavel_id IS NULL AND _responsavel_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profissionais WHERE id = _responsavel_id) THEN RAISE EXCEPTION 'Executor inválido'; END IF;
    -- somente responsavel_id; status do serviço/OS não é tocado
    UPDATE servicos_os SET responsavel_id = _responsavel_id WHERE id = s.id;
  END IF;

  IF it.faltava_laudo AND _laudo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM laudos WHERE servico_id = s.id) THEN
    SELECT * INTO tl FROM tipos_laudo WHERE id = (_laudo->>'tipo_laudo_id')::uuid;
    SELECT * INTO rt FROM responsaveis_tecnicos WHERE id = (_laudo->>'responsavel_tecnico_id')::uuid;
    IF tl.id IS NULL OR rt.id IS NULL OR COALESCE(_laudo->>'data_emissao','') = '' OR COALESCE(_laudo->>'data_validade','') = '' THEN
      RAISE EXCEPTION 'Preencha tipo, responsável técnico, data de emissão e data de validade do laudo';
    END IF;
    INSERT INTO laudos (ordem_id, servico_id, tipo_laudo_id, responsavel_tecnico_id, numero_os, empresa_cliente,
      tipo_servico, tipo_laudo_nome, responsavel_tecnico_nome, responsavel_tecnico_registro, data_emissao,
      possui_vigencia, data_validade, company_id, unidade_id, origem, created_by, observacoes)
    VALUES (o.id, s.id, tl.id, rt.id, o.numero_os, o.empresa_cliente, s.tipo, tl.nome, rt.nome,
      COALESCE(rt.conselho,'') || ' ' || COALESCE(rt.numero_registro,''), (_laudo->>'data_emissao')::date,
      true, (_laudo->>'data_validade')::date, o.company_id, o.unidade_id, 'gerado_por_os', auth.uid(),
      'Registrado via Correção Retroativa');
    INSERT INTO historico_os (ordem_id, user_id, user_name, acao, comentario, servico_afetado)
    VALUES (o.id, auth.uid(), _uname, 'Correção Retroativa', 'Laudo vinculado retroativamente: ' || tl.nome, s.tipo);
  END IF;

  SELECT * INTO s FROM servicos_os WHERE id = it.servico_id;
  ok_exec := NOT it.faltava_executor OR s.responsavel_id IS NOT NULL;
  ok_laudo := NOT it.faltava_laudo OR EXISTS (SELECT 1 FROM laudos WHERE servico_id = s.id);
  IF ok_exec AND ok_laudo THEN
    UPDATE os_correcao_retroativa_itens SET resolvido_em = now(), resolvido_por = auth.uid() WHERE id = it.id;
  END IF;
  RETURN jsonb_build_object('resolvido', ok_exec AND ok_laudo);
END $$;

REVOKE ALL ON FUNCTION public.correcao_retroativa_listar() FROM public, anon;
REVOKE ALL ON FUNCTION public.correcao_retroativa_salvar(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.correcao_retroativa_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.correcao_retroativa_salvar(uuid, uuid, jsonb) TO authenticated;