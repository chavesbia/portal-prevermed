CREATE TABLE public.acrescimos_funcao_solicitacoes (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade not null,
    unidade_id uuid references public.company_units(id) on delete cascade,
    solicitante_nome text not null,
    data_solicitacao_cliente date not null,
    observacao text,
    created_by uuid references auth.users(id) default auth.uid(),
    created_at timestamptz default now(),
    realizado boolean default false,
    realizado_por uuid references public.profissionais(id),
    realizado_em timestamptz,
    valor_total_calculado numeric
);

CREATE TABLE public.acrescimos_funcao_cargos (
    id uuid primary key default gen_random_uuid(),
    solicitacao_id uuid references public.acrescimos_funcao_solicitacoes(id) on delete cascade not null,
    setor text not null,
    cargo text not null
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acrescimos_funcao_solicitacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acrescimos_funcao_cargos TO authenticated;
GRANT ALL ON public.acrescimos_funcao_solicitacoes TO service_role;
GRANT ALL ON public.acrescimos_funcao_cargos TO service_role;

ALTER TABLE public.acrescimos_funcao_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acrescimos_funcao_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select" ON public.acrescimos_funcao_solicitacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON public.acrescimos_funcao_solicitacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON public.acrescimos_funcao_solicitacoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select" ON public.acrescimos_funcao_cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON public.acrescimos_funcao_cargos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON public.acrescimos_funcao_cargos FOR UPDATE TO authenticated USING (true);