CREATE TABLE IF NOT EXISTS public.tipos_servico_os (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE ON public.tipos_servico_os TO authenticated;
GRANT ALL ON public.tipos_servico_os TO service_role;

-- RLS
ALTER TABLE public.tipos_servico_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ver tipos de serviço"
    ON public.tipos_servico_os FOR SELECT
    TO authenticated
    USING (true);

-- Usando a função has_role que existe de acordo com a memória do projeto e o papel correto 'adm_master'
CREATE POLICY "Admins can manage"
    ON public.tipos_servico_os FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'adm_master'::user_role));

-- Dados iniciais
INSERT INTO public.tipos_servico_os (nome)
VALUES 
    ('PCMSO'), ('PGR'), ('LTCAT'), ('DRPS'), ('AET'), ('APR'), 
    ('INSALUBRIDADE'), ('PERICULOSIDADE'), ('CIPA'), ('TREINAMENTO'), 
    ('PPP'), ('PERICIA TÉCNICA'), ('PERICIA MÉDICA')
ON CONFLICT (nome) DO NOTHING;
