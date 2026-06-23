-- Phase 4: Vigência recalculation + audit view

-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: recalculates vigência status for all contracts and creates notifications
CREATE OR REPLACE FUNCTION public.contract_recalc_vigencia()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  novo_status text;
  dias int;
  total_updated int := 0;
  total_notif int := 0;
BEGIN
  FOR rec IN
    SELECT id, numero_contrato, status, data_fim, responsavel_id, cliente_id
    FROM public.contract_contratos
    WHERE status IN ('ativo','assinado','vencendo_60','vencendo_30','vencendo_15','parcialmente_assinado')
      AND data_fim IS NOT NULL
  LOOP
    dias := (rec.data_fim - CURRENT_DATE);

    IF dias < 0 THEN novo_status := 'vencido';
    ELSIF dias <= 15 THEN novo_status := 'vencendo_15';
    ELSIF dias <= 30 THEN novo_status := 'vencendo_30';
    ELSIF dias <= 60 THEN novo_status := 'vencendo_60';
    ELSE novo_status := 'ativo';
    END IF;

    -- Only act on transitions (avoid spam)
    IF novo_status IS DISTINCT FROM rec.status THEN
      UPDATE public.contract_contratos
        SET status = novo_status, updated_at = now()
        WHERE id = rec.id;

      INSERT INTO public.contract_eventos (contrato_id, tipo, descricao, detalhes)
      VALUES (
        rec.id,
        'vigencia_atualizada',
        format('Status alterado de %s para %s (faltam %s dias)', rec.status, novo_status, dias),
        jsonb_build_object('dias_restantes', dias, 'data_fim', rec.data_fim)
      );

      total_updated := total_updated + 1;

      -- Notify responsável on critical transitions
      IF rec.responsavel_id IS NOT NULL AND novo_status IN ('vencendo_60','vencendo_30','vencendo_15','vencido') THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_url, metadata)
        VALUES (
          rec.responsavel_id,
          'contract_vigencia',
          CASE WHEN novo_status = 'vencido'
               THEN format('Contrato %s VENCIDO', rec.numero_contrato)
               ELSE format('Contrato %s — %s dias para vencer', rec.numero_contrato, dias) END,
          format('O contrato %s precisa de atenção (status: %s)', rec.numero_contrato, novo_status),
          format('/gestao-contratual?tab=contratos&id=%s', rec.id),
          jsonb_build_object('contrato_id', rec.id, 'status', novo_status, 'dias', dias)
        );
        total_notif := total_notif + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ran_at', now(),
    'contratos_atualizados', total_updated,
    'notificacoes_enviadas', total_notif
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contract_recalc_vigencia() TO authenticated, service_role;