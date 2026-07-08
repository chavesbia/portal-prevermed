
CREATE TABLE public.profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'interno' CHECK (tipo IN ('interno','externo')),
  categoria text NOT NULL CHECK (categoria IN (
    'Médico','Psicólogo','Enfermeiro','Engenheiro de Segurança','Técnico de Segurança','Fonoaudiólogo','Fisioterapeuta','Outro'
  )),
  conselho_id uuid REFERENCES public.conselhos_classe(id) ON DELETE SET NULL,
  numero_conselho text,
  email text,
  telefone text,
  custo_padrao numeric(12,2),
  user_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profissionais_nome ON public.profissionais (lower(nome));
CREATE INDEX idx_profissionais_ativo ON public.profissionais (ativo);
CREATE INDEX idx_profissionais_user_id ON public.profissionais (user_id) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profissionais_select_authenticated"
ON public.profissionais FOR SELECT TO authenticated USING (true);

CREATE POLICY "profissionais_insert_editors"
ON public.profissionais FOR INSERT TO authenticated
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "profissionais_update_editors"
ON public.profissionais FOR UPDATE TO authenticated
USING (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'))
WITH CHECK (public.is_adm_master() OR public.can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "profissionais_delete_adm"
ON public.profissionais FOR DELETE TO authenticated
USING (public.is_adm_master());

CREATE TRIGGER trg_profissionais_updated_at
BEFORE UPDATE ON public.profissionais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.servicos_os
  ADD COLUMN responsavel_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL;

CREATE INDEX idx_servicos_os_responsavel ON public.servicos_os (responsavel_id);

CREATE OR REPLACE FUNCTION public.historico_responsavel_servico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_nome text;
  v_new_nome text;
BEGIN
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    SELECT nome INTO v_old_nome FROM public.profissionais WHERE id = OLD.responsavel_id;
    SELECT nome INTO v_new_nome FROM public.profissionais WHERE id = NEW.responsavel_id;

    INSERT INTO public.historico_os (ordem_id, user_name, acao, comentario, servico_afetado)
    VALUES (
      NEW.ordem_id,
      'Sistema',
      'Alteração de Responsável',
      format('Responsável do serviço alterado de %s para %s.',
             COALESCE(v_old_nome, '—'),
             COALESCE(v_new_nome, '—')),
      NEW.tipo
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historico_responsavel_servico ON public.servicos_os;
CREATE TRIGGER trg_historico_responsavel_servico
AFTER UPDATE OF responsavel_id ON public.servicos_os
FOR EACH ROW EXECUTE FUNCTION public.historico_responsavel_servico();
