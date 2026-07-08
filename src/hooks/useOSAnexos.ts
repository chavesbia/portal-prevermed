import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { OSAnexo, OSAnexoCategoria } from '@/types/osAnexos';

const BUCKET = 'os-anexos';

export function useOSAnexos(ordemId: string | null) {
  const { user } = useAuth();
  const [anexos, setAnexos] = useState<OSAnexo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnexos = useCallback(async () => {
    if (!ordemId) return;
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('os_anexos')
      .select('*')
      .eq('ordem_id', ordemId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Erro ao carregar anexos.', variant: 'destructive' });
    } else {
      setAnexos((data || []) as OSAnexo[]);
    }
    setIsLoading(false);
  }, [ordemId]);

  useEffect(() => { fetchAnexos(); }, [fetchAnexos]);

  const uploadAnexo = async (opts: {
    file: File;
    categoria: OSAnexoCategoria;
    descricao?: string;
    servico_os_id?: string | null;
    data_vencimento?: string | null;
  }) => {
    if (!ordemId) return false;
    try {
      const ext = opts.file.name.split('.').pop() || 'bin';
      const path = `${ordemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, opts.file, {
        contentType: opts.file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error: insErr } = await (supabase as any).from('os_anexos').insert({
        ordem_id: ordemId,
        servico_os_id: opts.servico_os_id || null,
        categoria: opts.categoria,
        nome: opts.file.name,
        descricao: opts.descricao || null,
        storage_path: path,
        mime_type: opts.file.type || null,
        tamanho_bytes: opts.file.size,
        data_vencimento: opts.data_vencimento || null,
        created_by: user?.id || null,
      });
      if (insErr) throw insErr;

      toast({ title: 'Anexo enviado', description: opts.file.name });
      await fetchAnexos();
      return true;
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro', description: 'Falha no upload: ' + (err.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const deleteAnexo = async (anexo: OSAnexo) => {
    try {
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
      const { error } = await (supabase as any).from('os_anexos').delete().eq('id', anexo.id);
      if (error) throw error;
      toast({ title: 'Anexo removido' });
      await fetchAnexos();
      return true;
    } catch (err: any) {
      toast({ title: 'Erro', description: 'Falha ao excluir: ' + (err.message || ''), variant: 'destructive' });
      return false;
    }
  };

  const getSignedUrl = async (anexo: OSAnexo): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.storage_path, 3600);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível gerar link.', variant: 'destructive' });
      return null;
    }
    return data.signedUrl;
  };

  return { anexos, isLoading, uploadAnexo, deleteAnexo, getSignedUrl, refetch: fetchAnexos };
}
