
-- Fase 2: Novo modelo de Status e SLA
-- 1) Backfill: mapear status antigos para os novos
UPDATE public.ordens_servico
SET status_os = CASE
  WHEN status_os IN ('Em revisão interna','Aguardando assinatura','Aguardando cliente') THEN 'Em andamento'
  WHEN status_os IS NULL OR status_os = '' THEN 'Não iniciado'
  ELSE status_os
END;

UPDATE public.servicos_os
SET status = CASE
  WHEN status = 'Concluído' THEN 'Encerrado'
  WHEN status = 'Pendente' THEN 'Aguardando cliente'
  WHEN status IS NULL OR status = '' THEN 'Não iniciado'
  ELSE status
END;

-- 2) Trigger de propagação: recalcula status_os com base nos servicos_os
CREATE OR REPLACE FUNCTION public.propagar_status_os()
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
  v_atual_status text;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Encerrado'),
    COUNT(*) FILTER (WHERE status = 'Não iniciado')
  INTO v_total, v_encerrados, v_nao_iniciados
  FROM public.servicos_os
  WHERE ordem_id = v_ordem_id;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  IF v_encerrados = v_total THEN
    v_novo_status := 'Encerrado';
  ELSIF v_nao_iniciados = v_total THEN
    v_novo_status := 'Não iniciado';
  ELSE
    v_novo_status := 'Em andamento';
  END IF;

  SELECT status_os INTO v_atual_status FROM public.ordens_servico WHERE id = v_ordem_id;

  IF v_atual_status IS DISTINCT FROM v_novo_status THEN
    UPDATE public.ordens_servico
    SET status_os = v_novo_status,
        updated_at = now()
    WHERE id = v_ordem_id;

    INSERT INTO public.historico_os (ordem_id, user_name, acao, comentario, status_anterior, status_novo)
    VALUES (v_ordem_id, 'Sistema', 'Propagação Automática',
            'Status da OS recalculado a partir dos serviços.',
            v_atual_status, v_novo_status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_status_os ON public.servicos_os;
CREATE TRIGGER trg_propagar_status_os
AFTER INSERT OR UPDATE OF status OR DELETE ON public.servicos_os
FOR EACH ROW EXECUTE FUNCTION public.propagar_status_os();

-- 3) Recalcular status atual de todas as OS existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT ordem_id FROM public.servicos_os LOOP
    UPDATE public.ordens_servico o
    SET status_os = CASE
      WHEN (SELECT COUNT(*) FILTER (WHERE status='Encerrado') FROM public.servicos_os WHERE ordem_id=r.ordem_id)
         = (SELECT COUNT(*) FROM public.servicos_os WHERE ordem_id=r.ordem_id) THEN 'Encerrado'
      WHEN (SELECT COUNT(*) FILTER (WHERE status='Não iniciado') FROM public.servicos_os WHERE ordem_id=r.ordem_id)
         = (SELECT COUNT(*) FROM public.servicos_os WHERE ordem_id=r.ordem_id) THEN 'Não iniciado'
      ELSE 'Em andamento'
    END
    WHERE o.id = r.ordem_id;
  END LOOP;
END $$;
