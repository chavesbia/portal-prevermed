ALTER TABLE public.soc_exames_pendentes ADD COLUMN IF NOT EXISTS funcionario_codigo text;
UPDATE public.soc_exames_pendentes e SET funcionario_codigo = p.funcionario->>'codigo'
FROM public.soc_pedidos_socnet p WHERE p.sequencial_ficha = e.sequencial_ficha AND e.funcionario_codigo IS NULL;