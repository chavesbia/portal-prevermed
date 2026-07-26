-- 1. Novas colunas em profissionais
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS pode_ser_responsavel_tecnico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS especialidade text;

-- 2. MTE como conselho ativo
INSERT INTO public.conselhos_classe (sigla, descricao, ativo, is_default)
SELECT 'MTE', 'Ministério do Trabalho e Emprego (registro profissional)', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.conselhos_classe WHERE upper(sigla) = 'MTE');

UPDATE public.conselhos_classe SET ativo = true WHERE upper(sigla) = 'MTE' AND ativo = false;

-- 3. Vínculo em responsaveis_tecnicos
ALTER TABLE public.responsaveis_tecnicos
  ADD COLUMN IF NOT EXISTS profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_responsaveis_tecnicos_profissional
  ON public.responsaveis_tecnicos (profissional_id) WHERE profissional_id IS NOT NULL;

-- 4. Sincronização automática
CREATE OR REPLACE FUNCTION public.sync_responsavel_tecnico_from_profissional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sigla text;
  v_rt_id uuid;
  v_elegivel boolean;
BEGIN
  SELECT sigla INTO v_sigla FROM public.conselhos_classe WHERE id = NEW.conselho_id;

  v_elegivel := COALESCE(NEW.pode_ser_responsavel_tecnico, false)
                AND COALESCE(NEW.ativo, false)
                AND v_sigla IS NOT NULL
                AND COALESCE(btrim(NEW.numero_conselho), '') <> '';

  SELECT id INTO v_rt_id FROM public.responsaveis_tecnicos WHERE profissional_id = NEW.id;

  IF v_elegivel THEN
    IF v_rt_id IS NULL THEN
      INSERT INTO public.responsaveis_tecnicos
        (nome, conselho, numero_registro, especialidade, email, ativo, profissional_id)
      VALUES (
        NEW.nome,
        v_sigla,
        btrim(NEW.numero_conselho),
        COALESCE(NULLIF(btrim(NEW.especialidade), ''), NEW.categoria, ''),
        COALESCE(NEW.email, ''),
        true,
        NEW.id
      );
    ELSE
      UPDATE public.responsaveis_tecnicos
      SET nome = NEW.nome,
          conselho = v_sigla,
          numero_registro = btrim(NEW.numero_conselho),
          especialidade = COALESCE(NULLIF(btrim(NEW.especialidade), ''), NEW.categoria, ''),
          email = COALESCE(NEW.email, ''),
          ativo = true,
          updated_at = now()
      WHERE id = v_rt_id;
    END IF;
  ELSIF v_rt_id IS NOT NULL THEN
    -- Nunca apaga: apenas inativa (preserva laudos existentes)
    UPDATE public.responsaveis_tecnicos
    SET ativo = false, updated_at = now()
    WHERE id = v_rt_id AND ativo = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_responsavel_tecnico ON public.profissionais;
CREATE TRIGGER trg_sync_responsavel_tecnico
AFTER INSERT OR UPDATE OF nome, email, categoria, especialidade, conselho_id, numero_conselho, ativo, pode_ser_responsavel_tecnico
ON public.profissionais
FOR EACH ROW EXECUTE FUNCTION public.sync_responsavel_tecnico_from_profissional();

-- 5. Caso existente: Eliseu Silva
UPDATE public.responsaveis_tecnicos rt
SET profissional_id = p.id, updated_at = now()
FROM public.profissionais p
WHERE lower(btrim(p.nome)) = 'eliseu silva'
  AND rt.profissional_id IS NULL
  AND rt.nome ILIKE '%Eliseu%';

UPDATE public.profissionais p
SET pode_ser_responsavel_tecnico = true,
    conselho_id = (SELECT id FROM public.conselhos_classe WHERE upper(sigla) = 'OUTRO' LIMIT 1),
    numero_conselho = '49011775830',
    especialidade = 'Técnico em Segurança do Trabalho',
    email = COALESCE(NULLIF(btrim(p.email), ''), 'engenharia@prevermed.com.br')
WHERE lower(btrim(p.nome)) = 'eliseu silva';