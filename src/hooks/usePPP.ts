import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PPPAnexo, PPPPeriodo, PPPSolicitacao } from '@/types/os';

const BUCKET = 'ppp-anexos';

export interface PPPFileInput {
  file: File;
  tipo_documento: string;
}

export function usePPP() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['ppp-solicitacoes'];

  const { data: solicitacoes = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ppp_solicitacoes')
        .select('*, companies(razao_social), ppp_periodos(*), ppp_anexos(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        company_name: item.companies?.razao_social,
        periodos: item.ppp_periodos || [],
        anexos: item.ppp_anexos || [],
      })) as PPPSolicitacao[];
    },
  });

  const uploadFiles = async (solicitacaoId: string, files: PPPFileInput[]) => {
    for (const item of files) {
      const extension = item.file.name.split('.').pop() || 'bin';
      const path = `${solicitacaoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, item.file, {
        contentType: item.file.type || undefined,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await (supabase as any).from('ppp_anexos').insert({
        solicitacao_id: solicitacaoId,
        tipo_documento: item.tipo_documento,
        arquivo_url: path,
        nome_arquivo: item.file.name,
        created_by: user?.id || null,
      });
      if (insertError) throw insertError;
    }
  };

  const createSolicitacao = useMutation({
    mutationFn: async (payload: {
      solicitacao: Omit<PPPSolicitacao, 'id' | 'numero' | 'created_at' | 'created_by' | 'realizado' | 'realizado_por_user_id' | 'realizado_por_nome' | 'realizado_em' | 'valor_calculado' | 'company_name' | 'periodos' | 'anexos'>;
      periodos: PPPPeriodo[];
      files: PPPFileInput[];
    }) => {
      const { data, error: insertError } = await (supabase as any)
        .from('ppp_solicitacoes')
        .insert({ ...payload.solicitacao, created_by: user?.id || null })
        .select()
        .single();
      if (insertError) throw insertError;
      const periodRows = payload.periodos.map(periodo => ({ ...periodo, solicitacao_id: data.id }));
      const { error: periodsError } = await (supabase as any).from('ppp_periodos').insert(periodRows);
      if (periodsError) throw periodsError;
      await uploadFiles(data.id, payload.files);
      return data;
    },
    onSuccess: () => {
      toast.success('Solicitação de PPP criada com sucesso');
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: any) => toast.error(`Erro ao criar solicitação: ${err.message}`),
  });

  const updateSolicitacao = useMutation({
    mutationFn: async (payload: {
      id: string;
      solicitacao: Partial<Pick<PPPSolicitacao, 'company_id' | 'solicitante_nome' | 'funcionario_nome' | 'funcionario_cpf' | 'observacao'>>;
      periodos: PPPPeriodo[];
      files: PPPFileInput[];
    }) => {
      const { error: updateError } = await (supabase as any)
        .from('ppp_solicitacoes').update(payload.solicitacao).eq('id', payload.id);
      if (updateError) throw updateError;
      const { error: deleteError } = await (supabase as any).from('ppp_periodos').delete().eq('solicitacao_id', payload.id);
      if (deleteError) throw deleteError;
      const periodRows = payload.periodos.map(periodo => ({ ...periodo, solicitacao_id: payload.id }));
      const { error: periodsError } = await (supabase as any).from('ppp_periodos').insert(periodRows);
      if (periodsError) throw periodsError;
      await uploadFiles(payload.id, payload.files);
    },
    onSuccess: () => {
      toast.success('Solicitação de PPP atualizada com sucesso');
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: any) => toast.error(`Erro ao atualizar solicitação: ${err.message}`),
  });

  const deleteSolicitacao = useMutation({
    mutationFn: async (id: string) => {
      const { data, error: deleteError } = await (supabase as any)
        .from('ppp_solicitacoes').delete().eq('id', id).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Você não tem permissão para excluir esta solicitação.');
      return id;
    },
    onSuccess: (id) => {
      toast.success('Solicitação excluída com sucesso');
      qc.setQueryData(queryKey, (old: PPPSolicitacao[] | undefined) => old?.filter(item => item.id !== id) || []);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: any) => toast.error(`Erro ao excluir solicitação: ${err.message}`),
  });

  const markAsRealizado = useMutation({
    mutationFn: async ({ id, company_id }: { id: string; company_id: string }) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id || null;
      let nomeUsuario = authData.user?.email || 'Usuário';
      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
        if (profile?.full_name) nomeUsuario = profile.full_name;
      }
      const { data: pricingData, error: pricingError } = await (supabase as any)
        .from('company_pricing_items').select('valor_produto_pontual')
        .eq('company_id', company_id).or('soc_product_code.eq.5,soc_product_code.eq.000000005').maybeSingle();
      if (pricingError) console.error('Erro ao buscar preço do PPP:', pricingError);
      const value = pricingData?.valor_produto_pontual ?? null;
      const { error: updateError } = await (supabase as any).from('ppp_solicitacoes').update({
        realizado: true,
        realizado_por_user_id: userId,
        realizado_por_nome: nomeUsuario,
        realizado_em: new Date().toISOString(),
        valor_calculado: value,
      }).eq('id', id);
      if (updateError) throw updateError;
      return value;
    },
    onSuccess: (value) => {
      if (value === null) toast.warning('PPP realizado, mas não há preço cadastrado para o código 5. O valor ficou em branco.');
      else toast.success('PPP marcado como realizado e valor calculado.');
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: any) => toast.error(`Erro ao marcar como realizado: ${err.message}`),
  });

  const getSignedUrl = async (anexo: PPPAnexo) => {
    const { data, error: urlError } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.arquivo_url, 3600);
    if (urlError) {
      toast.error('Não foi possível gerar o link do anexo.');
      return null;
    }
    return data.signedUrl;
  };

  return { solicitacoes, isLoading, error, createSolicitacao, updateSolicitacao, deleteSolicitacao, markAsRealizado, getSignedUrl };
}
