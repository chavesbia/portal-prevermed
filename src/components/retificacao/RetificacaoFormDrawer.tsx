import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Paperclip, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useRetificacaoAreas, useRetificacaoMotivos, useRetificacaoMedicos,
} from '@/hooks/useRetificacaoCatalog';
import type { SolicitacaoRow } from './RetificacaoList';
import { CompanySelector } from '@/components/shared/CompanySelector';

interface AnexoRow {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface FormValues {
  data_solicitacao: string;
  company_id: string;
  empresa: string;
  cnpj: string;
  unidade: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  area_id: string;
  motivo_id: string;
  descricao: string;
  data_retificacao: string;
  medico_examinador_id: string;
  responsavel_retificacao_id: string;
  observacoes: string;
}

const emptyValues: FormValues = {
  data_solicitacao: '',
  company_id: '',
  empresa: '', cnpj: '', unidade: '',
  colaborador_nome: '', colaborador_cpf: '',
  area_id: '', motivo_id: '', descricao: '',
  data_retificacao: '', medico_examinador_id: '',
  responsavel_retificacao_id: '', observacoes: '',
};

function toLocalInput(dt: string | null | undefined) {
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  solicitacao: SolicitacaoRow | null;
  readOnly?: boolean;
}

export function RetificacaoFormDrawer({ open, onOpenChange, solicitacao, readOnly }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: areas = [] } = useRetificacaoAreas();
  const { data: motivos = [] } = useRetificacaoMotivos();
  const { data: medicos = [] } = useRetificacaoMedicos();

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } =
    useForm<FormValues>({ defaultValues: emptyValues });

  const [savedId, setSavedId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Lista de usuários para responsável
  const { data: usuarios = [] } = useQuery({
    queryKey: ['active-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const currentId = solicitacao?.id || savedId;

  const { data: anexos = [], refetch: refetchAnexos } = useQuery({
    queryKey: ['retificacao-anexos', currentId],
    enabled: !!currentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aso_retificacao_anexos')
        .select('*')
        .eq('solicitacao_id', currentId!)
        .order('created_at');
      if (error) throw error;
      return (data || []) as AnexoRow[];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (solicitacao) {
      reset({
        data_solicitacao: toLocalInput(solicitacao.data_solicitacao),
        company_id: solicitacao.company_id || '',
        empresa: solicitacao.empresa || '',
        cnpj: solicitacao.cnpj || '',
        unidade: solicitacao.unidade || '',
        colaborador_nome: solicitacao.colaborador_nome || '',
        colaborador_cpf: solicitacao.colaborador_cpf || '',
        area_id: solicitacao.area_id || '',
        motivo_id: solicitacao.motivo_id || '',
        descricao: solicitacao.descricao || '',
        data_retificacao: solicitacao.data_retificacao || '',
        medico_examinador_id: solicitacao.medico_examinador_id || '',
        responsavel_retificacao_id: solicitacao.responsavel_retificacao_id || '',
        observacoes: solicitacao.observacoes || '',
      });
      setSavedId(null);
    } else {
      reset({ ...emptyValues, data_solicitacao: toLocalInput(new Date().toISOString()) });
      setSavedId(null);
    }
  }, [open, solicitacao, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    if (!values.company_id) {
      toast.error('Selecione uma empresa cadastrada. Se a empresa não aparecer na lista, ela precisa ser cadastrada no SOC primeiro.');
      return;
    }
    const payload: any = {
      data_solicitacao: values.data_solicitacao ? new Date(values.data_solicitacao).toISOString() : new Date().toISOString(),
      company_id: values.company_id,
      empresa: values.empresa.trim(),
      cnpj: values.cnpj.trim(),
      unidade: values.unidade.trim() || null,
      colaborador_nome: values.colaborador_nome.trim(),
      colaborador_cpf: values.colaborador_cpf.trim(),
      area_id: values.area_id || null,
      motivo_id: values.motivo_id || null,
      descricao: values.descricao.trim(),
      data_retificacao: values.data_retificacao || null,
      medico_examinador_id: values.medico_examinador_id || null,
      responsavel_retificacao_id: values.responsavel_retificacao_id || null,
      observacoes: values.observacoes.trim() || null,
    };

    if (solicitacao) {
      payload.updated_by = user.id;
      const { error } = await supabase
        .from('aso_retificacao_solicitacoes')
        .update(payload)
        .eq('id', solicitacao.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      toast.success('Solicitação atualizada.');
    } else {
      payload.created_by = user.id;
      payload.created_by_name = profile?.full_name || user.email;
      const { data, error } = await supabase
        .from('aso_retificacao_solicitacoes')
        .insert(payload)
        .select('id')
        .single();
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      setSavedId(data!.id);
      toast.success('Solicitação criada. Você pode adicionar anexos abaixo.');

      // Notificação push para o responsável pela retificação (estrutura preparada
      // para envio de e-mail futuro via email_pending).
      const autorNome = profile?.full_name || user.email || 'Alguém';
      const destinatarios = new Set<string>();
      if (values.responsavel_retificacao_id && values.responsavel_retificacao_id !== user.id) {
        destinatarios.add(values.responsavel_retificacao_id);
      }
      if (destinatarios.size > 0) {
        const rows = Array.from(destinatarios).map((uid) => ({
          user_id: uid,
          title: 'Nova solicitação de retificação de ASO',
          content: `${autorNome} criou uma solicitação para ${payload.colaborador_nome} (${payload.empresa}).`,
          notification_type: 'aso_retificacao' as const,
          related_id: data!.id,
          related_type: 'aso_retificacao',
          email_pending: true,
        }));
        await supabase.from('notifications').insert(rows);
      }
    }
    qc.invalidateQueries({ queryKey: ['retificacao-solicitacoes'] });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !currentId || !user) return;
    setUploadingFiles(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${currentId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('aso-retificacao-anexos')
          .upload(path, file, { contentType: file.type });
        if (upErr) { toast.error('Erro no upload: ' + upErr.message); continue; }
        const { error: dbErr } = await supabase
          .from('aso_retificacao_anexos')
          .insert({
            solicitacao_id: currentId,
            file_name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
          });
        if (dbErr) toast.error('Erro ao registrar anexo: ' + dbErr.message);
      }
      refetchAnexos();
      toast.success('Anexos adicionados.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveAnexo = async (a: AnexoRow) => {
    await supabase.storage.from('aso-retificacao-anexos').remove([a.file_path]);
    const { error } = await supabase.from('aso_retificacao_anexos').delete().eq('id', a.id);
    if (error) { toast.error('Erro ao remover anexo.'); return; }
    refetchAnexos();
  };

  const downloadAnexo = async (a: AnexoRow) => {
    const { data, error } = await supabase.storage
      .from('aso-retificacao-anexos')
      .createSignedUrl(a.file_path, 60);
    if (error || !data) { toast.error('Erro ao gerar link.'); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{solicitacao ? 'Editar Solicitação' : 'Nova Solicitação de Retificação'}</SheetTitle>
          <SheetDescription>Preencha os dados da retificação solicitada pelo cliente.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <fieldset disabled={readOnly} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Data da Solicitação</Label>
                <Input type="datetime-local" {...register('data_solicitacao', { required: true })} />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input {...register('unidade')} placeholder="Lapa, Osasco..." />
              </div>
              <div className="sm:col-span-2">
                <Label>Empresa *</Label>
                <CompanySelector
                  value={watch('company_id') || null}
                  onChange={(id, company) => {
                    setValue('company_id', id || '', { shouldValidate: true });
                    setValue('empresa', company?.razao_social || '');
                    setValue('cnpj', company?.cnpj || '');
                  }}
                  legacyLabel={!watch('company_id') && solicitacao?.empresa ? solicitacao.empresa : null}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione uma empresa cadastrada. Se a empresa não aparecer na lista, ela precisa ser cadastrada no SOC primeiro.
                </p>
              </div>
              <div>
                <Label>Nome do Colaborador *</Label>
                <Input {...register('colaborador_nome', { required: true })} />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input {...register('colaborador_cpf', { required: true })} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>Área envolvida</Label>
                <Select value={watch('area_id')} onValueChange={(v) => setValue('area_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo</Label>
                <Select value={watch('motivo_id')} onValueChange={(v) => setValue('motivo_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {motivos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da Retificação</Label>
                <Input type="date" {...register('data_retificacao')} />
              </div>
              <div>
                <Label>Médico Examinador</Label>
                <Select value={watch('medico_examinador_id')} onValueChange={(v) => setValue('medico_examinador_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {medicos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}{m.crm ? ` — ${m.crm}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Responsável pela Retificação</Label>
                <Select value={watch('responsavel_retificacao_id')} onValueChange={(v) => setValue('responsavel_retificacao_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione um usuário..." /></SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição da Retificação *</Label>
              <Textarea rows={3} {...register('descricao', { required: true })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} {...register('observacoes')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              {!readOnly && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {solicitacao ? 'Salvar Alterações' : 'Criar Solicitação'}
                </Button>
              )}
            </div>
          </fieldset>
        </form>

        {currentId && (
          <div className="mt-6 border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Anexos</h3>
              {!readOnly && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      {uploadingFiles ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Adicionar
                    </span>
                  </Button>
                </label>
              )}
            </div>
            {anexos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum anexo.</p>}
            <ul className="space-y-1">
              {anexos.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-2 p-2 border rounded-md">
                  <span className="text-sm truncate flex-1">{a.file_name}</span>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => downloadAnexo(a)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveAnexo(a)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
