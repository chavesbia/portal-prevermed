import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, RotateCcw, Plus, Trash2, Lock } from 'lucide-react';
import { STATUS_OS_OPTIONS, STATUS_SERVICO_OPTIONS, TIPO_OS_OPTIONS, TIPO_SERVICO_OPTIONS, StatusOS, StatusServico, TipoOS } from '@/types/os';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const servicoSchema = z.object({
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  tipoOS: z.enum(['Novo', 'Revisão']),
  status: z.string().default('Não iniciado'),
});

const formSchema = z.object({
  numeroOS: z.string().min(1, 'Número da OS é obrigatório'),
  empresaCliente: z.string().min(1, 'Nome do cliente é obrigatório'),
  contatoCliente: z.string().optional(),
  responsavelAtual: z.string().min(1, 'Responsável é obrigatório'),
  statusOS: z.string().min(1, 'Status é obrigatório'),
  dataRegistro: z.date(),
  dataEmissao: z.date().optional().nullable(),
  prazoAcordado: z.date().optional().nullable(),
  observacoes: z.string().optional(),
  servicos: z.array(servicoSchema).min(1, 'Adicione pelo menos um serviço'),
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
      numeroOS: '', empresaCliente: '', contatoCliente: '', responsavelAtual: emissorNome,
      statusOS: 'Não iniciado', dataRegistro: new Date(), dataEmissao: null, prazoAcordado: null,
      observacoes: '', servicos: [{ tipo: '', tipoOS: 'Novo', status: 'Não iniciado' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'servicos' });

  const handleSubmit = async (data: FormData) => {
    setSubmitting(true);
    const ok = await onSubmit({
      numero_os: data.numeroOS,
      empresa_cliente: data.empresaCliente,
      contato_cliente: data.contatoCliente,
      responsavel_atual: data.responsavelAtual,
      status_os: data.statusOS as StatusOS,
      data_registro: format(data.dataRegistro, 'yyyy-MM-dd'),
      data_emissao: data.dataEmissao ? format(data.dataEmissao, 'yyyy-MM-dd') : null,
      prazo_acordado: data.prazoAcordado ? format(data.prazoAcordado, 'yyyy-MM-dd') : null,
      observacoes: data.observacoes,
      servicos: data.servicos.map(s => ({
        tipo: s.tipo,
        tipo_os: s.tipoOS as TipoOS,
        status: s.status as StatusServico,
      })),
    });
    if (ok) form.reset();
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Ordem de Serviço</CardTitle>
        <CardDescription>Cadastre uma nova OS no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField control={form.control} name="numeroOS" render={({ field }) => (
                <FormItem><FormLabel>Número da OS</FormLabel><FormControl><Input placeholder="Ex: 11250" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="empresaCliente" render={({ field }) => (
                <FormItem><FormLabel>Empresa Cliente</FormLabel><FormControl><Input placeholder="Nome da empresa" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="contatoCliente" render={({ field }) => (
                <FormItem><FormLabel>Contato do Cliente</FormLabel><FormControl><Input placeholder="Nome do contato" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="responsavelAtual" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  {responsaveis.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>{responsaveis.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="statusOS" render={({ field }) => (
                <FormItem><FormLabel>Status da OS</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{STATUS_OS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dataRegistro" render={({ field }) => (
                <FormItem><FormLabel>Data de Registro</FormLabel>
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
              <FormField control={form.control} name="prazoAcordado" render={({ field }) => (
                <FormItem><FormLabel>Prazo Acordado</FormLabel>
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

            {/* Serviços */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Serviços</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ tipo: '', tipoOS: 'Novo', status: 'Não iniciado' })}>
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
                  <FormField control={form.control} name={`servicos.${index}.status`} render={({ field }) => (
                    <FormItem className="flex-1 min-w-[150px]"><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{STATUS_SERVICO_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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
      </CardContent>
    </Card>
  );
}
