
-- 1) Urgência em OS
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS urgente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_urgencia text;

-- 2) Novos campos em visitas
ALTER TABLE public.os_visitas
  ADD COLUMN IF NOT EXISTS urgente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_urgencia text,
  ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES public.servicos_os(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custo_real numeric(10,2) NOT NULL DEFAULT 0;

-- 3) Converter tipo_visita enum -> text e migrar valores
ALTER TABLE public.os_visitas ALTER COLUMN tipo_visita DROP DEFAULT;
ALTER TABLE public.os_visitas ALTER COLUMN tipo_visita TYPE text USING tipo_visita::text;
ALTER TABLE public.os_visitas ALTER COLUMN tipo_visita SET DEFAULT 'Visita Técnica';

UPDATE public.os_visitas SET tipo_visita = 'Visita Técnica' WHERE tipo_visita IN ('Avaliação','Inspeção');
UPDATE public.os_visitas SET tipo_visita = 'Medições' WHERE tipo_visita = 'Coleta';

-- 4) Trigger para auto atualizar status da OS conforme serviços
CREATE OR REPLACE FUNCTION public.sync_os_status_from_servicos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_id uuid;
  v_total int;
  v_encerrados int;
  v_nao_iniciados int;
  v_novo_status text;
  v_status_atual text;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);
  IF v_ordem_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'Encerrado'),
         COUNT(*) FILTER (WHERE status = 'Não iniciado')
    INTO v_total, v_encerrados, v_nao_iniciados
    FROM public.servicos_os WHERE ordem_id = v_ordem_id;

  IF v_total = 0 THEN RETURN NEW; END IF;

  IF v_encerrados = v_total THEN
    v_novo_status := 'Encerrado';
  ELSIF v_nao_iniciados = v_total THEN
    v_novo_status := 'Não iniciado';
  ELSE
    v_novo_status := 'Em andamento';
  END IF;

  SELECT status_os INTO v_status_atual FROM public.ordens_servico WHERE id = v_ordem_id;
  IF v_status_atual IS DISTINCT FROM v_novo_status THEN
    UPDATE public.ordens_servico SET status_os = v_novo_status, updated_at = now() WHERE id = v_ordem_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_os_status ON public.servicos_os;
CREATE TRIGGER trg_sync_os_status
AFTER INSERT OR UPDATE OF status OR DELETE ON public.servicos_os
FOR EACH ROW EXECUTE FUNCTION public.sync_os_status_from_servicos();
