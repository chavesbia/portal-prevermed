CREATE OR REPLACE FUNCTION public.contract_recalc_vigencia()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rec RECORD;
  novo_status text;
  dias int;
  total_updated int := 0;
  total_notif int := 0;
BEGIN
  FOR rec IN
    SELECT id, numero_contrato, status, data_fim, created_by, cliente_id
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

    IF novo_status IS DISTINCT FROM rec.status::text THEN
      UPDATE public.contract_contratos
        SET status = novo_status::contract_status, updated_at = now()
        WHERE id = rec.id;

      INSERT INTO public.contract_eventos (contrato_id, tipo, descricao, detalhes)
      VALUES (
        rec.id,
        'vigencia_atualizada',
        format('Status alterado de %s para %s (faltam %s dias)', rec.status, novo_status, dias),
        jsonb_build_object('dias_restantes', dias, 'data_fim', rec.data_fim)
      );

      total_updated := total_updated + 1;

      IF rec.created_by IS NOT NULL AND novo_status IN ('vencendo_60','vencendo_30','vencendo_15','vencido') THEN
        INSERT INTO public.notifications (user_id, notification_type, title, content, related_id, related_type)
        VALUES (
          rec.created_by,
          'contract_vigencia'::notification_type,
          CASE WHEN novo_status = 'vencido'
               THEN format('Contrato %s VENCIDO', rec.numero_contrato)
               ELSE format('Contrato %s — %s dias para vencer', rec.numero_contrato, dias) END,
          format('O contrato %s precisa de atenção (status: %s)', rec.numero_contrato, novo_status),
          rec.id,
          'contract_contratos'
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
$function$;