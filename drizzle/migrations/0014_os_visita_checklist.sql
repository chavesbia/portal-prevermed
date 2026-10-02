ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'os_oportunidade';

CREATE TABLE public.os_visita_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL UNIQUE REFERENCES public.os_visitas(id) ON DELETE CASCADE,
  ordem_id uuid,
  numero_os text,
  empresa_cliente text NOT NULL,
  categorias text[] NOT NULL DEFAULT '{}',
  oportunidades text,
  observacao text,
  created_by uuid,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.os_visita_checklist TO authenticated;
GRANT ALL ON public.os_visita_checklist TO service_role;
ALTER TABLE public.os_visita_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver checklist" ON public.os_visita_checklist FOR SELECT TO authenticated
  USING (
    public.is_adm_master()
    OR public.can_view_module_route(auth.uid(), '/gestao-os')
    OR EXISTS (SELECT 1 FROM public.user_departments ud WHERE ud.user_id = auth.uid() AND ud.department_id = '8b148a7b-9edb-400c-a1e3-adbce2a69554')
  );
CREATE POLICY "criar checklist" ON public.os_visita_checklist FOR INSERT TO authenticated
  WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE OR REPLACE FUNCTION public.notify_os_oportunidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resumo text;
BEGIN
  IF coalesce(array_length(NEW.categorias, 1), 0) = 0 AND coalesce(trim(NEW.oportunidades), '') = '' THEN
    RETURN NEW;
  END IF;
  resumo := concat_ws(' — ', nullif(array_to_string(NEW.categorias, ', '), ''), nullif(trim(NEW.oportunidades), ''));
  INSERT INTO public.notifications (user_id, notification_type, title, content, related_id, related_type)
  SELECT DISTINCT ud.user_id, 'os_oportunidade'::public.notification_type,
    'Oportunidade identificada em visita técnica',
    left(concat(NEW.empresa_cliente, CASE WHEN NEW.numero_os IS NOT NULL THEN ' (OS #' || NEW.numero_os || ')' ELSE '' END, ': ', resumo), 900),
    NEW.id, 'os_oportunidade'
  FROM public.user_departments ud
  WHERE ud.department_id = '8b148a7b-9edb-400c-a1e3-adbce2a69554'
    AND ud.user_id IS DISTINCT FROM NEW.created_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_os_oportunidade AFTER INSERT ON public.os_visita_checklist
  FOR EACH ROW EXECUTE FUNCTION public.notify_os_oportunidade();