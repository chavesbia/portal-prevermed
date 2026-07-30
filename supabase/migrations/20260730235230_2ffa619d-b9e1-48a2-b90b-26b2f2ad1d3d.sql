DO $$
DECLARE
  r RECORD;
  v_prof_id uuid;
  v_conselho_id uuid;
  v_categoria text;
BEGIN
  FOR r IN
    SELECT id, nome, conselho, numero_registro, especialidade, email, ativo
    FROM public.responsaveis_tecnicos
    WHERE profissional_id IS NULL
      AND id IN (
        '986142e5-5bac-4d15-afee-aa9bf5e42b76',
        '9e36d424-e7f5-4452-8642-2a1e8a59c94e',
        'fb3b7335-dac2-4b4c-b443-682d7495e7d9',
        'e249355e-bc34-471c-8484-bd49c49404c1'
      )
  LOOP
    SELECT c.id INTO v_conselho_id FROM public.conselhos_classe c WHERE c.sigla = r.conselho;

    v_categoria := CASE r.conselho
      WHEN 'CRM' THEN 'Médico'
      WHEN 'CREA' THEN 'Engenheiro de Segurança'
      ELSE 'Técnico de Segurança'
    END;

    -- 1) cria o profissional SEM a flag, para o trigger de sincronizacao nao criar um RT duplicado
    INSERT INTO public.profissionais
      (nome, tipo, categoria, conselho_id, numero_conselho, email, especialidade, ativo, pode_ser_responsavel_tecnico)
    VALUES
      (r.nome, 'interno', v_categoria, v_conselho_id, r.numero_registro,
       NULLIF(btrim(COALESCE(r.email, '')), ''), NULLIF(btrim(COALESCE(r.especialidade, '')), ''),
       COALESCE(r.ativo, true), false)
    RETURNING id INTO v_prof_id;

    -- 2) vincula o RT JA EXISTENTE (mesmo id) ao novo profissional
    UPDATE public.responsaveis_tecnicos SET profissional_id = v_prof_id, updated_at = now() WHERE id = r.id;

    -- 3) agora ativa a flag: o trigger encontra o RT ja vinculado e apenas atualiza
    UPDATE public.profissionais SET pode_ser_responsavel_tecnico = true WHERE id = v_prof_id;
  END LOOP;
END $$;