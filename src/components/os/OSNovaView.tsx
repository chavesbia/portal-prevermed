import { useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, RotateCcw, Plus, Trash2, Lock } from 'lucide-react';
import { TIPO_OS_OPTIONS, TIPO_SERVICO_OPTIONS, StatusServico, TipoOS } from '@/types/os';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CompanySelector } from '@/components/shared/CompanySelector';

const servicoSchema = z.object({
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  tipoOS: z.enum(['Novo', 'Revisão']),
});

const formSchema = z.object({
  numeroOS: z.string().min(1, 'Número da OS é obrigatório'),
  companyId: z.string().uuid({ message: 'Selecione uma empresa cadastrada' }),
  empresaCliente: z.string().min(1),
  contatoCliente: z.string().optional(),
  emissor: z.string().min(1),
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

export function OSNovaView({ onSubmit, embedded, onDone }: OSNovaViewProps) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const emissorNome = profile?.full_name || '';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numeroOS: '', companyId: undefined as any, empresaCliente: '', contatoCliente: '', emissor: emissorNome,
      dataEmissao: new Date(), prazoEntrega: null,
      urgente: false, motivoUrgencia: '',
      observacoes: '', servicos: [{ tipo: '', tipoOS: 'Novo' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'servicos' });
  const urgente = form.watch('urgente');

  const handleSubmit = async (data: FormData) => {
    setSubmitting(true);
    const dataEmissaoStr = format(data.dataEmissao, 'yyyy-MM-dd');
    const ok = await onSubmit({
      numero_os: data.numeroOS,
      company_id: data.companyId,
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

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <Card>
          <CardHeader>
            <CardTitle>Nova Ordem de Serviço</CardTitle>
            <CardDescription>Cadastre uma nova OS no sistema</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      );

  return (
    <Wrapper>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField control={form.control} name="numeroOS" render={({ field }) => (
              <FormItem><FormLabel>Número da OS</FormLabel><FormControl><Input placeholder="Ex: 11250" {...field} /></FormControl><FormMessage /></FormItem>
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
                    }}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Selecione uma empresa cadastrada. Se a empresa não aparecer na lista, ela precisa ser cadastrada no SOC primeiro.
                </p>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contatoCliente" render={({ field }) => (
              <FormItem><FormLabel>Contato do Cliente</FormLabel><FormControl><Input placeholder="Nome do contato" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="emissor" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1"><Lock className="h-3 w-3" />Emissor</FormLabel>
                <FormControl>
                  <Input readOnly disabled value={field.value || emissorNome} className="bg-muted" />
                </FormControl>
                <p className="text-xs text-muted-foreground">Preenchido automaticamente com o usuário logado.</p>
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
            <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Observações..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>
          )} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => form.reset()}><RotateCcw className="mr-2 h-4 w-4" />Limpar</Button>
            <Button type="submit" disabled={submitting}><Save className="mr-2 h-4 w-4" />{submitting ? 'Salvando...' : 'Salvar OS'}</Button>
          </div>
        </form>
      </Form>
    </Wrapper>
  );
}
