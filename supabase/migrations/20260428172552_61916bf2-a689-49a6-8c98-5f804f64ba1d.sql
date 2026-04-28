
-- 1) Reformular os_equipamentos: dropar e recriar com o modelo original
-- (a tabela tem apenas 1 registro de teste e a tabela de histórico se mantém via cascade)

-- Limpar histórico antigo já que vamos resetar equipamentos
DELETE FROM public.os_equipamento_historico;
DELETE FROM public.os_equipamentos;

-- Remover colunas obsoletas e adicionar novas
ALTER TABLE public.os_equipamentos DROP COLUMN IF EXISTS empresa_cliente;
ALTER TABLE public.os_equipamentos DROP COLUMN IF EXISTS localizacao;
ALTER TABLE public.os_equipamentos DROP COLUMN IF EXISTS status;

ALTER TABLE public.os_equipamentos ADD COLUMN IF NOT EXISTS fabricante text;
ALTER TABLE public.os_equipamentos ADD COLUMN IF NOT EXISTS data_ultima_calibracao date;
ALTER TABLE public.os_equipamentos ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Drop type antigo se houver
DROP TYPE IF EXISTS public.equipamento_status CASCADE;

-- 2) Custos de deslocamento em os_visitas
ALTER TABLE public.os_visitas
  ADD COLUMN IF NOT EXISTS custos_deslocamento numeric(10,2) NOT NULL DEFAULT 0;

-- 3) Tabela de junção visita <-> equipamento
CREATE TABLE IF NOT EXISTS public.os_visita_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.os_visitas(id) ON DELETE CASCADE,
  equipamento_id uuid NOT NULL REFERENCES public.os_equipamentos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visita_id, equipamento_id)
);

CREATE INDEX IF NOT EXISTS idx_os_visita_equipamentos_visita ON public.os_visita_equipamentos(visita_id);
CREATE INDEX IF NOT EXISTS idx_os_visita_equipamentos_equip ON public.os_visita_equipamentos(equipamento_id);

ALTER TABLE public.os_visita_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view os_visita_equipamentos"
  ON public.os_visita_equipamentos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Editors can insert os_visita_equipamentos"
  ON public.os_visita_equipamentos FOR INSERT TO authenticated
  WITH CHECK (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));

CREATE POLICY "Editors can delete os_visita_equipamentos"
  ON public.os_visita_equipamentos FOR DELETE TO authenticated
  USING (is_adm_master() OR can_edit_module_route(auth.uid(), '/gestao-os'));
