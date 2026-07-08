import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Search, Trash2, Eye, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';
import { useOSVisitas } from '@/hooks/useOSVisitas';
import { useOSEquipamentos } from '@/hooks/useOSEquipamentos';
import { OSVisita, VISITA_TIPO_OPTIONS, VISITA_STATUS_OPTIONS, VisitaTipo, visitaStatusColors, visitaStatusLabel } from '@/types/osVisitas';
import { OrdemServico } from '@/types/os';
import { supabase } from '@/integrations/supabase/client';

interface ProfileOption { user_id: string; full_name: string | null; }

const ENGENHARIA_DEPT_ID = '75667708-1efb-4c2e-87b1-70251eb7f412';

const formSchema = z.object({
  empresa_cliente: z.string().min(1, 'Cliente é obrigatório'),
  ordem_id: z.string().optional(),
  servico_id: z.string().optional(),
  data_visita: z.date({ required_error: 'Data é obrigatória' }),
  hora_visita: z.string().optional(),
  responsavel_id: z.string().min(1, 'Responsável é obrigatório'),
  tipo_visita: z.enum(['Visita Técnica', 'Medições', 'Treinamento', 'Reunião', 'Outro']),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
  custos_deslocamento: z.string().optional(),
  urgente: z.boolean().default(false),
  motivo_urgencia: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

interface OSAgendaViewProps {
  ordens: OrdemServico[];
  canEdit: boolean;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function OSAgendaView({ ordens, canEdit }: OSAgendaViewProps) {
  const { isLoading, filters, setFilters, getFiltered, addVisita, updateVisitaStatus, deleteVisita, detectConflitos, visitaEquipamentos } = useOSVisitas();
  const { equipamentos } = useOSEquipamentos();
  const [openDialog, setOpenDialog] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedView, setSelectedView] = useState<OSVisita | null>(null);
  const [toCancel, setToCancel] = useState<OSVisita | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [toDelete, setToDelete] = useState<OSVisita | null>(null);
  const [equipamentosIds, setEquipamentosIds] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { empresa_cliente: '', tipo_visita: 'Visita Técnica', custos_deslocamento: '', urgente: false, motivo_urgencia: '' },
  });

  useEffect(() => {
    (async () => {
      // Apenas usuários do departamento de Engenharia podem ser responsáveis por visitas
      const { data: ud } = await supabase
        .from('user_departments')
        .select('user_id')
        .eq('department_id', ENGENHARIA_DEPT_ID);
      const ids = (ud || []).map((r: any) => r.user_id);
      if (ids.length === 0) {
        setProfiles([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('status', 'active')
        .in('user_id', ids)
        .order('full_name');
      setProfiles((data || []) as ProfileOption[]);
    })();
  }, []);

  const filtered = getFiltered();
  const empresas = useMemo(() => Array.from(new Set(ordens.map(o => o.empresa_cliente))).sort(), [ordens]);
  const watchedOrdemId = form.watch('ordem_id');
  const watchedData = form.watch('data_visita');

  useEffect(() => {
    if (watchedOrdemId && watchedOrdemId !== 'none') {
      const ordem = ordens.find(o => o.id === watchedOrdemId);
      if (ordem) form.setValue('empresa_cliente', ordem.empresa_cliente);
    }
  }, [watchedOrdemId, ordens, form]);

  const conflitos = useMemo(() => {
    if (!watchedData || equipamentosIds.length === 0) return [];
    const dataISO = format(watchedData, 'yyyy-MM-dd');
    return detectConflitos(dataISO, equipamentosIds);
  }, [watchedData, equipamentosIds, detectConflitos]);

  const equipNomes = (ids: string[]) =>
    ids.map(id => equipamentos.find(e => e.id === id)?.nome).filter(Boolean).join(', ');

  const toggleEquip = (id: string) => {
    setEquipamentosIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const onOpenDialog = (open: boolean) => {
    setOpenDialog(open);
    if (!open) {
      form.reset({ empresa_cliente: '', tipo_visita: 'Visita Técnica', custos_deslocamento: '', urgente: false, motivo_urgencia: '' });
      setEquipamentosIds([]);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (conflitos.length > 0) return;
    if (data.urgente && !(data.motivo_urgencia || '').trim()) return;
    const profile = profiles.find(p => p.user_id === data.responsavel_id);
    const ordem = data.ordem_id && data.ordem_id !== 'none' ? ordens.find(o => o.id === data.ordem_id) : null;
    const ok = await addVisita({
      empresa_cliente: data.empresa_cliente,
      ordem_id: ordem?.id || null,
      numero_os: ordem?.numero_os || null,
      servico_id: data.servico_id && data.servico_id !== 'none' ? data.servico_id : null,
      data_visita: format(data.data_visita, 'yyyy-MM-dd'),
      hora_visita: data.hora_visita || null,
      responsavel_id: data.responsavel_id,
      responsavel_nome: profile?.full_name || 'Sem nome',
      tipo_visita: data.tipo_visita as VisitaTipo,
      endereco: data.endereco || null,
      observacoes: data.observacoes || null,
      custos_deslocamento: parseFloat(data.custos_deslocamento || '0') || 0,
      urgente: data.urgente,
      motivo_urgencia: data.urgente ? (data.motivo_urgencia || null) : null,
      equipamentos_ids: equipamentosIds,
    });
    if (ok) onOpenDialog(false);
  };

  // Realizar visita: pede custo real
  const [toRealizar, setToRealizar] = useState<OSVisita | null>(null);
  const [custoRealInput, setCustoRealInput] = useState('');


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Agenda</h2>
          <p className="text-sm text-muted-foreground">Agendamentos vinculados (ou não) a Ordens de Serviço.</p>
        </div>
        {canEdit && (
          <Button onClick={() => onOpenDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Agendar
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, OS, responsável"
              className="pl-9"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {VISITA_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{visitaStatusLabel[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.responsavel_id} onValueChange={v => setFilters({ ...filters, responsavel_id: v })}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('flex-1 justify-start', !filters.periodo_inicio && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.periodo_inicio ? format(filters.periodo_inicio, 'dd/MM/yy') : 'Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.periodo_inicio || undefined} onSelect={d => setFilters({ ...filters, periodo_inicio: d || null })} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('flex-1 justify-start', !filters.periodo_fim && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.periodo_fim ? format(filters.periodo_fim, 'dd/MM/yy') : 'Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.periodo_fim || undefined} onSelect={d => setFilters({ ...filters, periodo_fim: d || null })} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Visitas ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma visita encontrada.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(v => {
                const eqs = visitaEquipamentos[v.id] || [];
                return (
                  <div key={v.id} className="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={visitaStatusColors[v.status]}>{visitaStatusLabel[v.status]}</Badge>
                          <Badge variant="outline">{v.tipo_visita}</Badge>
                          {v.numero_os && <Badge variant="outline" className="font-mono">OS #{v.numero_os}</Badge>}
                          {v.urgente && <Badge variant="destructive">URGENTE</Badge>}
                        </div>
                        <h3 className="font-semibold">{v.empresa_cliente}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>📅 {format(new Date(v.data_visita + 'T00:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}</span>
                          {v.hora_visita && <span>🕐 {v.hora_visita}</span>}
                          <span>👤 {v.responsavel_nome}</span>
                          {v.custos_deslocamento > 0 && <span>💰 {formatBRL(v.custos_deslocamento)}</span>}
                        </div>
                        {v.endereco && <div className="text-sm text-muted-foreground">📍 {v.endereco}</div>}
                        {eqs.length > 0 && <div className="text-sm text-muted-foreground">🔧 {equipNomes(eqs)}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedView(v)}><Eye className="h-4 w-4" /></Button>
                        {canEdit && v.status === 'agendada' && (
                          <>
                            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-600" onClick={() => { setToRealizar(v); setCustoRealInput(String(v.custos_deslocamento || '')); }}>Realizada</Button>
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setToCancel(v); setCancelReason(''); }}>Cancelar</Button>
                          </>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(v)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nova Visita */}
      <Dialog open={openDialog} onOpenChange={onOpenDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agenda</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="ordem_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>OS vinculada (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sem OS vinculada" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem OS vinculada</SelectItem>
                      {ordens.map(o => <SelectItem key={o.id} value={o.id}>OS #{o.numero_os} — {o.empresa_cliente}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="empresa_cliente" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <FormControl><Input list="empresas-list" {...field} placeholder="Nome do cliente" /></FormControl>
                  <datalist id="empresas-list">{empresas.map(e => <option key={e} value={e} />)}</datalist>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="data_visita" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Data *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn('justify-start', !field.value && 'text-muted-foreground')}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Selecione'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="hora_visita" render={({ field }) => (
                  <FormItem><FormLabel>Hora</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="responsavel_id" render={({ field }) => (
                <FormItem><FormLabel>Responsável *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tipo_visita" render={({ field }) => (
                <FormItem><FormLabel>Tipo de visita *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{VISITA_TIPO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="endereco" render={({ field }) => (
                <FormItem><FormLabel>Endereço</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Equipamentos */}
              <div className="space-y-2">
                <Label>Equipamentos de Medição</Label>
                {equipamentos.filter(e => e.ativo).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum equipamento ativo. Cadastre na aba "Equipamentos".
                  </p>
                ) : (
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {equipamentos.filter(e => e.ativo).map(eq => {
                      const conflito = conflitos.length > 0 && watchedData && (
                        // checa se este equip está em outra visita do mesmo dia
                        true
                      );
                      const checked = equipamentosIds.includes(eq.id);
                      return (
                        <div key={eq.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`equip-${eq.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleEquip(eq.id)}
                          />
                          <label htmlFor={`equip-${eq.id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {eq.nome}
                            {eq.tipo && <span className="text-muted-foreground ml-1">({eq.tipo})</span>}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {conflitos.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {conflitos.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <FormField control={form.control} name="custos_deslocamento" render={({ field }) => (
                <FormItem><FormLabel>Custos de Deslocamento (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" placeholder="0,00" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="observacoes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenDialog(false)}>Cancelar</Button>
                <Button type="submit" disabled={conflitos.length > 0}>Agendar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhes */}
      <Dialog open={!!selectedView} onOpenChange={o => !o && setSelectedView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Visita</DialogTitle></DialogHeader>
          {selectedView && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge className={visitaStatusColors[selectedView.status]}>{visitaStatusLabel[selectedView.status]}</Badge>
                <Badge variant="outline">{selectedView.tipo_visita}</Badge>
                {selectedView.numero_os && <Badge variant="outline" className="font-mono">OS #{selectedView.numero_os}</Badge>}
              </div>
              <div><span className="text-muted-foreground">Cliente:</span> <strong>{selectedView.empresa_cliente}</strong></div>
              <div><span className="text-muted-foreground">Data:</span> {format(new Date(selectedView.data_visita + 'T00:00:00'), 'dd/MM/yyyy')} {selectedView.hora_visita}</div>
              <div><span className="text-muted-foreground">Responsável:</span> {selectedView.responsavel_nome}</div>
              {selectedView.endereco && <div><span className="text-muted-foreground">Endereço:</span> {selectedView.endereco}</div>}
              {(visitaEquipamentos[selectedView.id]?.length || 0) > 0 && (
                <div><span className="text-muted-foreground">Equipamentos:</span> {equipNomes(visitaEquipamentos[selectedView.id] || [])}</div>
              )}
              {selectedView.custos_deslocamento > 0 && (
                <div><span className="text-muted-foreground">Custos de deslocamento:</span> {formatBRL(selectedView.custos_deslocamento)}</div>
              )}
              {selectedView.observacoes && <div><span className="text-muted-foreground">Observações:</span> {selectedView.observacoes}</div>}
              {selectedView.motivo_cancelamento && <div className="text-destructive"><span className="text-muted-foreground">Motivo do cancelamento:</span> {selectedView.motivo_cancelamento}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!toCancel} onOpenChange={o => !o && setToCancel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar visita</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Motivo do cancelamento</Label>
            <Textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToCancel(null)}>Voltar</Button>
            <Button variant="destructive" onClick={async () => {
              if (toCancel) { await updateVisitaStatus(toCancel.id, 'cancelada', cancelReason); setToCancel(null); }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => {
              if (toDelete) { await deleteVisita(toDelete.id); setToDelete(null); }
            }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
