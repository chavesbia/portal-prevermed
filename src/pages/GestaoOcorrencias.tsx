import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarIcon,
  Check,
  CheckCircle2,
  Clock3,
  NotebookPen,
  Paperclip,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/integrations/supabase/types';

type OccurrenceTicketRow = {
  id: string;
  ticket_number: string;
  company_name: string;
  ticket_type: string;
  priority: string;
  status: string;
  due_at: string | null;
  updated_at: string;
};

type ProfileOption = {
  user_id: string;
  full_name: string;
  unit: string | null;
};

type OccurrencePriority = Database['public']['Enums']['occurrence_priority'];
type OccurrenceType = Database['public']['Enums']['occurrence_type'];
type OccurrenceContactOrigin = Database['public']['Enums']['occurrence_contact_origin'];
type OccurrenceSector = Database['public']['Enums']['occurrence_sector'];

const occurrenceFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Empresa é obrigatória').max(255, 'Máximo de 255 caracteres'),
  cnpj: z.string().trim().min(1, 'CNPJ é obrigatório').max(32, 'Máximo de 32 caracteres'),
  requesterName: z.string().trim().max(120, 'Máximo de 120 caracteres').optional(),
  requesterContact: z.string().trim().max(255, 'Máximo de 255 caracteres').optional(),
  contactOrigin: z.enum(['email', 'telefone', 'whatsapp', 'presencial', 'reuniao']),
  ticketType: z.enum(['reclamacao', 'solicitacao', 'duvida', 'sugestao', 'ocorrencia']),
  priority: z.enum(['baixa', 'media', 'alta', 'critica']),
  description: z.string().trim().min(1, 'Descrição é obrigatória').max(4000, 'Máximo de 4000 caracteres'),
  unit: z.string().trim().max(120, 'Máximo de 120 caracteres').optional(),
  involvedSectors: z.array(z.enum([
    'recepcao',
    'enfermagem',
    'medico',
    'liberacao',
    'faturamento',
    'comercial',
    'relacionamento',
    'financeiro',
    'engenharia',
    'operacional',
    'esocial',
    'credenciamento',
    'agendamento',
    'suporte',
  ])).default([]),
  principalAssigneeId: z.string().optional(),
  supportAssigneeIds: z.array(z.string()).default([]),
  dueMode: z.enum(['automatico', 'manual']),
  manualDueAt: z.date().nullable().optional(),
}).superRefine((values, ctx) => {
  if (values.dueMode === 'manual' && !values.manualDueAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['manualDueAt'],
      message: 'Informe o prazo manual.',
    });
  }
});

type OccurrenceFormData = z.infer<typeof occurrenceFormSchema>;

const contactOriginOptions: { value: OccurrenceContactOrigin; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'reuniao', label: 'Reunião' },
];

const typeOptions: { value: OccurrenceType; label: string }[] = [
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'solicitacao', label: 'Solicitação' },
  { value: 'duvida', label: 'Dúvida' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'ocorrencia', label: 'Ocorrência' },
];

const priorityOptions: { value: OccurrencePriority; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

const sectorOptions: { value: OccurrenceSector; label: string }[] = [
  { value: 'recepcao', label: 'Recepção' },
  { value: 'enfermagem', label: 'Enfermagem' },
  { value: 'medico', label: 'Médico' },
  { value: 'liberacao', label: 'Liberação' },
  { value: 'faturamento', label: 'Faturamento' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'relacionamento', label: 'Relacionamento' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'engenharia', label: 'Engenharia' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'esocial', label: 'eSocial' },
  { value: 'credenciamento', label: 'Credenciamento' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'suporte', label: 'Suporte' },
];

const dueModeOptions = [
  { value: 'automatico', label: 'Automático por prioridade' },
  { value: 'manual', label: 'Manual' },
] as const;

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  em_tratativa: 'Em tratativa',
  aguardando_retorno_interno: 'Aguardando retorno interno',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
  aguardando_validacao_cliente: 'Aguardando validação do cliente',
  concluido: 'Concluído',
  reaberto: 'Reaberto',
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export default function GestaoOcorrencias() {
  const { user, profile } = useAuth();
  const { hasPermission } = useModulePermissions();
  const [tickets, setTickets] = useState<OccurrenceTicketRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);

  const canCreate = hasPermission('/gestao-ocorrencias', 'create');
  const canManage = hasPermission('/gestao-ocorrencias/gestao', 'edit');

  const form = useForm<OccurrenceFormData>({
    resolver: zodResolver(occurrenceFormSchema),
    defaultValues: {
      companyName: '',
      cnpj: '',
      requesterName: profile?.full_name ?? '',
      requesterContact: profile?.contact_email ?? profile?.email ?? '',
      contactOrigin: 'email',
      ticketType: 'ocorrencia',
      priority: 'media',
      description: '',
      unit: profile?.unit ?? '',
      involvedSectors: [],
      principalAssigneeId: undefined,
      supportAssigneeIds: [],
      dueMode: 'automatico',
      manualDueAt: null,
    },
  });

  useEffect(() => {
    form.reset({
      companyName: '',
      cnpj: '',
      requesterName: profile?.full_name ?? '',
      requesterContact: profile?.contact_email ?? profile?.email ?? '',
      contactOrigin: 'email',
      ticketType: 'ocorrencia',
      priority: 'media',
      description: '',
      unit: profile?.unit ?? '',
      involvedSectors: [],
      principalAssigneeId: undefined,
      supportAssigneeIds: [],
      dueMode: 'automatico',
      manualDueAt: null,
    });
  }, [form, profile]);

  const loadTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('occurrence_tickets')
      .select('id, ticket_number, company_name, ticket_type, priority, status, due_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Erro ao carregar ocorrências:', error);
      setTickets([]);
      setLoading(false);
      return;
    }

    setTickets((data || []) as OccurrenceTicketRow[]);
    setLoading(false);
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, unit')
      .eq('status', 'active')
      .order('full_name');

    if (error) {
      console.error('Erro ao carregar responsáveis:', error);
      setProfiles([]);
      return;
    }

    setProfiles((data || []) as ProfileOption[]);
  };

  useEffect(() => {
    loadTickets();
    loadProfiles();
  }, []);

  const handleAttachmentSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = selectedFiles.filter((file) => {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: 'Arquivo excede o limite',
          description: `${file.name} ultrapassa 20MB e não foi adicionado.`,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    });

    setAttachments((current) => {
      const next = [...current];
      for (const file of validFiles) {
        const alreadyAdded = next.some((existing) => existing.name === file.name && existing.size === file.size);
        if (!alreadyAdded) next.push(file);
      }
      return next.slice(0, 10);
    });

    event.target.value = '';
  };

  const removeAttachment = (fileName: string) => {
    setAttachments((current) => current.filter((file) => file.name !== fileName));
  };

  const handleCreateTicket = async (values: OccurrenceFormData) => {
    if (!user) {
      toast({ title: 'Sessão inválida', description: 'Faça login novamente para abrir um chamado.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const ticketPayload: Database['public']['Tables']['occurrence_tickets']['Insert'] = {
        ticket_number: '',
        company_name: values.companyName.trim(),
        cnpj: values.cnpj.trim(),
        requester_name: values.requesterName?.trim() || null,
        requester_contact: values.requesterContact?.trim() || null,
        contact_origin: values.contactOrigin,
        ticket_type: values.ticketType,
        priority: values.priority,
        description: values.description.trim(),
        unit: values.unit?.trim() || null,
        involved_sectors: values.involvedSectors,
        primary_sector: values.involvedSectors[0] ?? null,
        status: 'aberto',
        created_by: user.id,
        updated_by: user.id,
        due_at: values.dueMode === 'manual' && values.manualDueAt ? values.manualDueAt.toISOString() : null,
      };

      const { data: ticket, error: ticketError } = await supabase
        .from('occurrence_tickets')
        .insert(ticketPayload)
        .select('id, ticket_number')
        .single();

      if (ticketError || !ticket) throw ticketError ?? new Error('Não foi possível criar o chamado.');

      const assigneeRows: Database['public']['Tables']['occurrence_ticket_assignees']['Insert'][] = [];

      if (values.principalAssigneeId) {
        assigneeRows.push({
          ticket_id: ticket.id,
          user_id: values.principalAssigneeId,
          assignment_role: 'principal',
          assigned_by: user.id,
          is_active: true,
        });
      }

      for (const supportUserId of values.supportAssigneeIds.filter((id) => id && id !== values.principalAssigneeId)) {
        assigneeRows.push({
          ticket_id: ticket.id,
          user_id: supportUserId,
          assignment_role: 'apoio',
          assigned_by: user.id,
          is_active: true,
        });
      }

      if (assigneeRows.length > 0) {
        const { error: assigneeError } = await supabase.from('occurrence_ticket_assignees').insert(assigneeRows);
        if (assigneeError) throw assigneeError;
      }

      if (values.involvedSectors.length > 0) {
        const sectorRows: Database['public']['Tables']['occurrence_ticket_sector_assignments']['Insert'][] = values.involvedSectors.map((sector) => ({
          ticket_id: ticket.id,
          sector,
          assigned_by: user.id,
          is_active: true,
        }));

        const { error: sectorError } = await supabase.from('occurrence_ticket_sector_assignments').insert(sectorRows);
        if (sectorError) throw sectorError;
      }

      if (attachments.length > 0) {
        const attachmentRows: Database['public']['Tables']['occurrence_attachments']['Insert'][] = [];

        for (const file of attachments) {
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${ticket.id}/${crypto.randomUUID()}-${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from('occurrence-attachments')
            .upload(path, file, { upsert: false });

          if (uploadError) throw uploadError;

          attachmentRows.push({
            ticket_id: ticket.id,
            file_name: file.name,
            file_path: path,
            file_url: path,
            file_size: file.size,
            content_type: file.type || null,
            uploaded_by: user.id,
          });
        }

        const { error: attachmentError } = await supabase.from('occurrence_attachments').insert(attachmentRows);
        if (attachmentError) throw attachmentError;
      }

      toast({
        title: 'Chamado criado',
        description: `O chamado ${ticket.ticket_number} foi aberto com sucesso.`,
      });

      form.reset({
        companyName: '',
        cnpj: '',
        requesterName: profile?.full_name ?? '',
        requesterContact: profile?.contact_email ?? profile?.email ?? '',
        contactOrigin: 'email',
        ticketType: 'ocorrencia',
        priority: 'media',
        description: '',
        unit: profile?.unit ?? '',
        involvedSectors: [],
        principalAssigneeId: undefined,
        supportAssigneeIds: [],
        dueMode: 'automatico',
        manualDueAt: null,
      });
      setAttachments([]);
      setShowCreateForm(false);
      loadTickets();
    } catch (error: any) {
      console.error('Erro ao criar ocorrência:', error);
      toast({
        title: 'Não foi possível abrir o chamado',
        description: error?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((ticket) => ['aberto', 'em_analise', 'em_tratativa', 'reaberto'].includes(ticket.status)).length;
    const waiting = tickets.filter((ticket) => ['aguardando_retorno_interno', 'aguardando_cliente', 'aguardando_validacao_cliente'].includes(ticket.status)).length;
    const done = tickets.filter((ticket) => ['resolvido', 'concluido'].includes(ticket.status)).length;

    return { total, open, waiting, done };
  }, [tickets]);

  const supportAssigneeIds = form.watch('supportAssigneeIds');
  const selectedSectors = form.watch('involvedSectors');
  const dueMode = form.watch('dueMode');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Ocorrências</h1>
          <p className="text-muted-foreground">
            Central de ocorrências, solicitações, reclamações e feedbacks do Relacionamento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadTickets} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          {canCreate && (
            <Button onClick={() => setShowCreateForm((current) => !current)}>
              {showCreateForm ? 'Fechar abertura' : 'Novo chamado'}
            </Button>
          )}
        </div>
      </div>

      {canCreate && showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Abertura de chamado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <NotebookPen className="h-4 w-4" />
              <AlertTitle>Cadastro inicial</AlertTitle>
              <AlertDescription>
                Empresa, CNPJ e descrição são obrigatórios. Os anexos são enviados junto da abertura do chamado.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateTicket)} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">Identificação</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem className="xl:col-span-2">
                        <FormLabel>Empresa *</FormLabel>
                        <FormControl><Input placeholder="Nome da empresa" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="cnpj" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <FormControl><Input placeholder="00.000.000/0000-00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <FormControl><Input placeholder="Ex: Lapa, Osasco" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="requesterName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do solicitante</FormLabel>
                        <FormControl><Input placeholder="Nome de quem entrou em contato" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="requesterContact" render={({ field }) => (
                      <FormItem className="md:col-span-2 xl:col-span-3">
                        <FormLabel>Contato</FormLabel>
                        <FormControl><Input placeholder="Telefone ou e-mail" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Origem e classificação</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <FormField control={form.control} name="contactOrigin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem do contato</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {contactOriginOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="ticketType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {typeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="priority" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {priorityOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="dueMode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {dueModeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {dueMode === 'manual' && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <FormField control={form.control} name="manualDueAt" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo manual</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                                >
                                  {field.value ? format(field.value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição detalhada *</FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder="Descreva a situação, o impacto e o contexto do chamado." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Setores envolvidos</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {sectorOptions.map((sector) => {
                      const checked = selectedSectors.includes(sector.value);
                      return (
                        <label key={sector.value} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const current = form.getValues('involvedSectors');
                              form.setValue(
                                'involvedSectors',
                                isChecked
                                  ? [...current, sector.value]
                                  : current.filter((value) => value !== sector.value),
                                { shouldValidate: true },
                              );
                            }}
                          />
                          <span>{sector.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Atribuição e direcionamento</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <FormField control={form.control} name="principalAssigneeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável principal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {profiles.map((person) => (
                              <SelectItem key={person.user_id} value={person.user_id}>{person.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-3">
                    <FormLabel>Equipe envolvida</FormLabel>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {profiles.map((person) => {
                        const checked = supportAssigneeIds.includes(person.user_id);
                        return (
                          <label key={person.user_id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                const current = form.getValues('supportAssigneeIds');
                                form.setValue(
                                  'supportAssigneeIds',
                                  isChecked
                                    ? [...current, person.user_id]
                                    : current.filter((value) => value !== person.user_id),
                                );
                              }}
                            />
                            <span>{person.full_name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormDescription>Selecione uma ou mais pessoas de apoio, se necessário.</FormDescription>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-base font-semibold">Anexos</h3>
                  <div className="rounded-md border border-dashed p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">Arquivos do chamado</p>
                        <p className="text-sm text-muted-foreground">Até 10 arquivos, com limite de 20MB por item.</p>
                      </div>
                      <label>
                        <input type="file" multiple className="hidden" onChange={handleAttachmentSelection} />
                        <Button type="button" variant="outline" asChild>
                          <span><Upload className="mr-2 h-4 w-4" />Adicionar anexos</span>
                        </Button>
                      </label>
                    </div>

                    {attachments.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {attachments.map((file) => (
                          <Badge key={`${file.name}-${file.size}`} variant="secondary" className="gap-2 py-1 pl-2 pr-1">
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="max-w-[220px] truncate">{file.name}</span>
                            <button type="button" onClick={() => removeAttachment(file.name)} className="rounded-full p-0.5 hover:bg-background/50">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setAttachments([]);
                    }}
                  >
                    Limpar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Salvando...' : 'Abrir chamado'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chamados carregados</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.total}</span>
            <NotebookPen className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Em andamento</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.open}</span>
            <Clock3 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aguardando retorno</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.waiting}</span>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos / concluídos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{summary.done}</span>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Fila inicial do módulo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Abertura de chamados disponível com cadastro completo, validação obrigatória e anexos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Visualização liberada</Badge>
            {canManage && <Badge>Gestão habilitada</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum chamado cadastrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                    <TableCell>{ticket.company_name}</TableCell>
                    <TableCell>{ticket.ticket_type}</TableCell>
                    <TableCell>{priorityLabels[ticket.priority] ?? ticket.priority}</TableCell>
                    <TableCell>{statusLabels[ticket.status] ?? ticket.status}</TableCell>
                    <TableCell>
                      {ticket.due_at
                        ? new Date(ticket.due_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}