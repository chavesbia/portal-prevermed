-- Status enum para parcelamentos
DO $$ BEGIN
  CREATE TYPE public.passivo_status AS ENUM ('em_dia','atrasado','encerrado','novo_acordo','suspenso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE public.passivos_parcelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  empresa_nome text NOT NULL,
  numero_acordo text NOT NULL,
  tipo_parcelamento text NOT NULL,
  parcelas_pagas integer NOT NULL DEFAULT 0 CHECK (parcelas_pagas >= 0),
  parcelas_totais integer NOT NULL CHECK (parcelas_totais > 0),
  valor_mensal numeric(14,2) NOT NULL DEFAULT 0,
  dia_vencimento integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  status public.passivo_status NOT NULL DEFAULT 'em_dia',
  parcelas_em_atraso integer NOT NULL DEFAULT 0 CHECK (parcelas_em_atraso >= 0),
  observacoes text,
  link_acesso text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Coluna gerada para parcelas restantes
ALTER TABLE public.passivos_parcelamentos
  ADD COLUMN parcelas_restantes integer GENERATED ALWAYS AS (GREATEST(parcelas_totais - parcelas_pagas, 0)) STORED;

CREATE INDEX idx_passivos_cnpj ON public.passivos_parcelamentos (cnpj);
CREATE INDEX idx_passivos_status ON public.passivos_parcelamentos (status);
CREATE INDEX idx_passivos_tipo ON public.passivos_parcelamentos (tipo_parcelamento);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passivos_parcelamentos TO authenticated;
GRANT ALL ON public.passivos_parcelamentos TO service_role;

-- RLS
ALTER TABLE public.passivos_parcelamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passivos: view com permissão"
ON public.passivos_parcelamentos FOR SELECT TO authenticated
USING (
  public.is_adm_master()
  OR EXISTS (
    SELECT 1 FROM public.get_user_accessible_modules(auth.uid()) gum
    WHERE gum.module_route = '/gestao-passivos'
  )
);

CREATE POLICY "Passivos: insert com permissão de edição"
ON public.passivos_parcelamentos FOR INSERT TO authenticated
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
);

CREATE POLICY "Passivos: update com permissão de edição"
ON public.passivos_parcelamentos FOR UPDATE TO authenticated
USING (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
)
WITH CHECK (
  public.is_adm_master()
  OR public.can_edit_module_route(auth.uid(), '/gestao-passivos')
);

CREATE POLICY "Passivos: delete apenas ADM Master"
ON public.passivos_parcelamentos FOR DELETE TO authenticated
USING (public.is_adm_master());

-- Trigger de updated_at
CREATE TRIGGER trg_passivos_updated_at
BEFORE UPDATE ON public.passivos_parcelamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registro do módulo + vínculo com Financeiro
WITH new_mod AS (
  INSERT INTO public.modules (name, description, icon, route, is_active, sort_order)
  VALUES ('Gestão de Passivos', 'Controle de parcelamentos tributários por CNPJ', 'DollarSign', '/gestao-passivos', true, 50)
  ON CONFLICT (name) DO UPDATE SET route = EXCLUDED.route, icon = EXCLUDED.icon, is_active = true
  RETURNING id
)
INSERT INTO public.department_modules (department_id, module_id)
SELECT 'c173df28-432e-4632-bf8b-c9fd3b8e780e', id FROM new_mod
ON CONFLICT DO NOTHING;