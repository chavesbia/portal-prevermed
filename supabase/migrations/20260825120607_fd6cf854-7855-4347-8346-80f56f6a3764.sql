DROP POLICY IF EXISTS "ADM Master can delete cargos" ON public.acrescimos_funcao_cargos;
CREATE POLICY "Authenticated users can delete cargos"
ON public.acrescimos_funcao_cargos
FOR DELETE TO authenticated
USING (true);