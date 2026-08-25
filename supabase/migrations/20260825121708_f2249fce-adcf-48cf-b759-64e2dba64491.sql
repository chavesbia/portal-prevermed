DROP POLICY IF EXISTS "Authenticated users can delete cargos" ON public.acrescimos_funcao_cargos;

CREATE POLICY "ADM Master or edit of pending solicitacao can delete cargos"
ON public.acrescimos_funcao_cargos
FOR DELETE
TO authenticated
USING (
  public.is_adm_master()
  OR EXISTS (
    SELECT 1 FROM public.acrescimos_funcao_solicitacoes s
    WHERE s.id = acrescimos_funcao_cargos.solicitacao_id
      AND s.realizado = false
  )
);