import { useEffect, useMemo, useState } from 'react';
import { useResponsaveisTecnicos } from '@/hooks/useOSData';

import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, RotateCcw, Plus, Trash2, Lock, AlertTriangle } from 'lucide-react';
import { TIPO_OS_OPTIONS, TIPO_SERVICO_OPTIONS, StatusServico, TipoOS } from '@/types/os';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { UnitSelector } from '@/components/shared/UnitSelector';


const servicoSchema = z.object({
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  tipoOS: z.enum(['Novo', 'Revisão']),
});

const formSchema = z.object({
  numeroOS: z.string().min(1, 'Número da OS é obrigatório'),
  companyId: z.string().uuid({ message: 'Selecione uma empresa cadastrada' }),
  unidadeId: z.string().uuid().optional().nullable(),
  empresaCliente: z.string().min(1),
  contatoCliente: z.string().optional(),
  emissor: z.string().min(1, 'Usuário emissor não identificado'),
  dataEmissao: z.date({ required_error: 'Data de emissão é obrigatória' }),
  prazoEntrega: z.date().optional().nullable(),
  urgente: z.boolean().default(false),
  motivoUrgencia: z.string().optional(),
  observacoes: z.string().optional(),
  servicos: z.array(servicoSchema).min(1, 'Adicione pelo menos um serviço'),
}).refine((v) => !v.urgente || (v.motivoUrgencia && v.motivoUrgencia.trim().length > 0), {
  path: ['motivoUrgencia'], message: 'Informe o motivo da urgência',
});

type FormData = z.infer<typeof formSchema>;

interface OSNovaViewProps {
  onSubmit: (data: any) => Promise<boolean>;
  responsaveis: string[];
  embedded?: boolean;
  onDone?: () => void;
}

interface ExistingOS {
  id: string;
  numero_os: string;
  empresa_cliente: string | null;
  status_os: string | null;
}

export function OSNovaView({ onSubmit, embedded, onDone }: OSNovaViewProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { responsaveis } = useResponsaveisTecnicos();
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<ExistingOS | null>(null);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [addingServico, setAddingServico] = useState(false);

  const responsaveisAtivos = useMemo(() => responsaveis.filter(r => r.ativo), [responsaveis]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numeroOS: '', companyId: undefined as any, unidadeId: null, empresaCliente: '', contatoCliente: '', emissor: '',
      dataEmissao: new Date(), prazoEntrega: null,
      urgente: false, motivoUrgencia: '',
      observacoes: '', servicos: [{ tipo: '', tipoOS: 'Novo' }],
    },
  });

  // Emissor = usuário logado (somente leitura)
  useEffect(() => {
    const nome = (profile?.full_name || '').trim();
    if (nome) form.setValue('emissor', nome);
  }, [profile?.full_name]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'servicos' });
  const urgente = form.watch('urgente');
  const numeroOS = form.watch('numeroOS');


  const findExisting = async (numero: string): Promise<ExistingOS | null> => {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, empresa_cliente, status_os')
      .eq('numero_os', numero.trim())
      .limit(1);
    if (error) return null;
    return ((data || [])[0] as ExistingOS) || null;
  };

  // Verificação em tempo real (debounce) enquanto digita
  useEffect(() => {
    const numero = (numeroOS || '').trim();
    if (!numero) { setDuplicate(null); return; }
    let active = true;
    const t = setTimeout(async () => {
      const found = await findExisting(numero);
      if (active) setDuplicate(found);
    }, 500);
    return () => { active = false; clearTimeout(t); };
  }, [numeroOS]);

  const handleSubmit = async (data: FormData) => {
    setSubmitting(true);
    const existing = await findExisting(data.numeroOS);
    if (existing) {
      setDuplicate(existing);
      setDupDialogOpen(true);
      setSubmitting(false);
      return;
    }
    const dataEmissaoStr = format(data.dataEmissao, 'yyyy-MM-dd');
    const ok = await onSubmit({
      numero_os: data.numeroOS,
      company_id: data.companyId,
      unidade_id: data.unidadeId || null,
      empresa_cliente: data.empresaCliente,
      contato_cliente: data.contatoCliente,
      responsavel_atual: data.emissor,
      status_os: 'Não iniciado',
      data_registro: dataEmissaoStr,
      data_emissao: dataEmissaoStr,
      prazo_acordado: data.prazoEntrega ? format(data.prazoEntrega, 'yyyy-MM-dd') : null,
      urgente: data.urgente,
      motivo_urgencia: data.urgente ? (data.motivoUrgencia || null) : null,
      observacoes: data.observacoes,
      servicos: data.servicos.map(s => ({
        tipo: s.tipo,
        tipo_os: s.tipoOS as TipoOS,
        status: 'Não iniciado' as StatusServico,
      })),
    });
    if (ok) {
      form.reset();
      onDone?.();
    }
    setSubmitting(false);
  };

  const handleAbrirExistente = async () => {
    if (!duplicate) return;
    setAddingServico(true);
    try {
      const servicos = form.getValues('servicos').filter(s => s.tipo);
      if (servicos.length > 0) {
        const { error } = await supabase.from('servicos_os').insert(
          servicos.map(s => ({
            ordem_id: duplicate.id,
            tipo: s.tipo,
            tipo_os: s.tipoOS,
            status: 'Não iniciado',
          })) as any,
        );
        if (error) throw error;
        await supabase.from('historico_os').insert({
          ordem_id: duplicate.id,
          user_id: profile?.user_id || null,
          user_name: profile?.full_name || 'Sistema',
          acao: 'Inclusão de Serviço',
          comentario: `Serviço(s) adicionado(s) à OS existente: ${servicos.map(s => s.tipo).join(', ')}`,
        } as any);
        toast.success('Serviço(s) adicionado(s) à OS existente.');
      }
      setDupDialogOpen(false);
      form.reset();
      onDone?.();
      navigate(`/gestao-os?os=${duplicate.id}`);
    } catch (e: any) {
      toast.error('Erro ao adicionar serviço: ' + (e.message || ''));
    } finally {
      setAddingServico(false);
    }
  };


  const content = (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField control={form.control} name="numeroOS" render={({ field }) => (
              <FormItem>
                <FormLabel>Número da OS</FormLabel>
                <FormControl><Input placeholder="Ex: 11250" {...field} /></FormControl>
                {duplicate && (
                  <p className="text-xs text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Já existe uma OS #{duplicate.numero_os} cadastrada{duplicate.empresa_cliente ? ` para ${duplicate.empresa_cliente}` : ''}.</span>
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="companyId" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Empresa Cliente</FormLabel>
                <FormControl>
                  <CompanySelector
                    value={field.value}
                    onChange={(id, company) => {
                      field.onChange(id ?? undefined);
                      form.setValue('empresaCliente', company?.razao_social || '', { shouldValidate: true });
                      form.setValue('unidadeId', null);
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Selecione uma empresa cadastrada. Se a empresa não aparecer na lista, ela precisa ser cadastrada no SOC primeiro.
                </p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="unidadeId" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Unidade (opcional)</FormLabel>
                <FormControl>
                  <UnitSelector
                    companyId={form.watch('companyId')}
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Se ainda não souber a unidade, deixe em branco — a Engenharia confirmará na finalização do serviço.
                </p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contatoCliente" render={({ field }) => (
              <FormItem><FormLabel>Contato do Cliente</FormLabel><FormControl><Input placeholder="Nome do contato" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="emissor" render={({ field }) => (
              <FormItem>
                <FormLabel>Usuário Emissor</FormLabel>
                <FormControl>
                  <Input value={field.value || ''} readOnly disabled />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente com o usuário logado no Portal.
                </p>
                <FormMessage />
              </FormItem>
            )} />


            <FormField control={form.control} name="dataEmissao" render={({ field }) => (
              <FormItem><FormLabel>Data de Emissão</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl>
                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                </PopoverContent></Popover><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="prazoEntrega" render={({ field }) => (
              <FormItem><FormLabel>Prazo de Entrega</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl>
                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} initialFocus />
                </PopoverContent></Popover><FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Urgência */}
          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <FormField control={form.control} name="urgente" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="!mt-0 cursor-pointer">Marcar como Urgente</FormLabel>
              </FormItem>
            )} />
            {urgente && (
              <FormField control={form.control} name="motivoUrgencia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da urgência</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Descreva o motivo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </div>

          {/* Serviços */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Serviços</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ tipo: '', tipoOS: 'Novo' })}>
                <Plus className="mr-2 h-4 w-4" />Adicionar Serviço
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap gap-4 items-end p-4 border rounded-lg bg-muted/30">
                <FormField control={form.control} name={`servicos.${index}.tipo`} render={({ field }) => (
                  <FormItem className="flex-1 min-w-[150px]"><FormLabel>Tipo de Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>{TIPO_SERVICO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`servicos.${index}.tipoOS`} render={({ field }) => (
                  <FormItem className="flex-1 min-w-[130px]"><FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{TIPO_OS_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              O status de cada serviço será definido pela área técnica após a criação da OS. O status da OS é atualizado automaticamente.
            </p>
          </div>

          <FormField control={form.control} name="observacoes" render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações... Se a unidade ainda não estiver cadastrada no SOC, anote aqui o nome e o endereço da unidade."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Dica: unidade não encontrada na lista? Anote aqui o nome e o endereço para a Engenharia confirmar depois.
              </p>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => form.reset()}><RotateCcw className="mr-2 h-4 w-4" />Limpar</Button>
            <Button type="submit" disabled={submitting}><Save className="mr-2 h-4 w-4" />{submitting ? 'Salvando...' : 'Salvar OS'}</Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>OS #{duplicate?.numero_os} já existe</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma Ordem de Serviço com este número
              {duplicate?.empresa_cliente ? ` (${duplicate.empresa_cliente})` : ''}
              {duplicate?.status_os ? ` — status: ${duplicate.status_os}` : ''}.
              Não é possível criar uma OS duplicada. Você pode abrir a OS existente e adicionar
              o(s) serviço(s) informados neste formulário a ela, ou cancelar e digitar outro número.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleAbrirExistente(); }} disabled={addingServico}>
              {addingServico ? 'Adicionando…' : 'Abrir OS existente e adicionar serviço'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Ordem de Serviço</CardTitle>
        <CardDescription>Cadastre uma nova OS no sistema</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
