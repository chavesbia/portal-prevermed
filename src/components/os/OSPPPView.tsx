import { useMemo, useState } from 'react';
import { useSignedUrls } from '@/lib/storage/signedUrls';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle, Clock, Edit, Eye, FileDown, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePPP, type PPPFileInput } from '@/hooks/usePPP';
import type { PPPPeriodo, PPPSolicitacao } from '@/types/os';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EMPTY_PERIOD: PPPPeriodo = { data_inicio: '', data_fim: '' };
const emptyForm = () => ({ company_id: '', solicitante_nome: '', funcionario_nome: '', funcionario_cpf: '', observacao: '', periodos: [{ ...EMPTY_PERIOD }], files: [] as PPPFileInput[] });
const money = (value: number | null) => value === null ? '-' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function OSPPPView({ canEdit }: { canEdit: boolean }) {
  const { solicitacoes, isLoading, error, createSolicitacao, updateSolicitacao, deleteSolicitacao, markAsRealizado, getSignedUrl } = usePPP();
  const { isAdmMaster, profile, user } = useAuth();
  const previewUrls = useSignedUrls('ppp-anexos', solicitacoes.flatMap((item) => (item.anexos || []).map((anexo) => anexo.arquivo_url)));

  const visualizarAnexo = (path: string) => {
    const url = previewUrls[path];
    if (url) window.open(url, '_blank');
  };

  const baixarAnexo = async (anexo: NonNullable<PPPSolicitacao['anexos']>[number]) => {
    const url = await getSignedUrl(anexo);
    if (url) window.open(url, '_blank');
  };
  const [formOpen, setFormOpen] = useState(false);
  const [realizarOpen, setRealizarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<PPPSolicitacao | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filters, setFilters] = useState({ dataInicial: '', dataFinal: '', companyId: '', status: 'todos' });
  const [reportRange, setReportRange] = useState({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });

  const filtradas = useMemo(() => solicitacoes.filter(item => {
    if (filters.companyId && item.company_id !== filters.companyId) return false;
    if (filters.status === 'pendente' && item.realizado) return false;
    if (filters.status === 'realizado' && !item.realizado) return false;
    const dates = item.periodos || [];
    if (filters.dataInicial && !dates.some(period => period.data_fim >= filters.dataInicial)) return false;
    if (filters.dataFinal && !dates.some(period => period.data_inicio <= filters.dataFinal)) return false;
    return true;
  }), [solicitacoes, filters]);

  const resetForm = () => setFormData(emptyForm());
  const openNew = () => { setSelected(null); setIsEditing(false); resetForm(); setFormOpen(true); };
  const openEdit = (item: PPPSolicitacao) => {
    setSelected(item); setIsEditing(true);
    setFormData({ company_id: item.company_id, solicitante_nome: item.solicitante_nome, funcionario_nome: item.funcionario_nome, funcionario_cpf: item.funcionario_cpf, observacao: item.observacao || '', periodos: item.periodos?.map(({ data_inicio, data_fim }) => ({ data_inicio, data_fim })) || [{ ...EMPTY_PERIOD }], files: [] });
    setFormOpen(true);
  };
  const addPeriod = () => setFormData(prev => ({ ...prev, periodos: [...prev.periodos, { ...EMPTY_PERIOD }] }));
  const removePeriod = (index: number) => setFormData(prev => ({ ...prev, periodos: prev.periodos.filter((_, i) => i !== index) }));
  const updatePeriod = (index: number, field: keyof PPPPeriodo, value: string) => setFormData(prev => ({ ...prev, periodos: prev.periodos.map((p, i) => i === index ? { ...p, [field]: value } : p) }));
  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).map(file => ({ file, tipo_documento: 'Outro' }));
    setFormData(prev => ({ ...prev, files: [...prev.files, ...files] }));
    event.target.value = '';
  };
  const updateFileType = (index: number, value: string) => setFormData(prev => ({ ...prev, files: prev.files.map((file, i) => i === index ? { ...file, tipo_documento: value } : file) }));
  const removeFile = (index: number) => setFormData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));

  const submit = async () => {
    const validPeriods = formData.periodos.length > 0 && formData.periodos.every(p => p.data_inicio && p.data_fim && p.data_fim >= p.data_inicio);
    if (!formData.company_id || !formData.solicitante_nome.trim() || !formData.funcionario_nome.trim() || !formData.funcionario_cpf.trim() || !validPeriods) { toast.error('Preencha a empresa, os dados do funcionário e períodos válidos.'); return; }
    const payload = { company_id: formData.company_id, solicitante_nome: formData.solicitante_nome.trim(), funcionario_nome: formData.funcionario_nome.trim(), funcionario_cpf: formData.funcionario_cpf.trim(), observacao: formData.observacao.trim() || null };
    if (isEditing && selected) await updateSolicitacao.mutateAsync({ id: selected.id, solicitacao: payload, periodos: formData.periodos, files: formData.files });
    else await createSolicitacao.mutateAsync({ solicitacao: payload, periodos: formData.periodos, files: formData.files });
    setFormOpen(false);
  };
  const exportReport = () => {
    if (!reportRange.from || !reportRange.to) { toast.error('Selecione um período válido.'); return; }
    const rows = solicitacoes.filter(item => item.realizado && item.realizado_em && isWithinInterval(parseISO(item.realizado_em), { start: reportRange.from, end: reportRange.to }));
    if (!rows.length) { toast.info('Nenhuma solicitação realizada no período.'); return; }
    const headers = ['Nº', 'Empresa', 'Funcionário', 'CPF', 'Períodos', 'Solicitante', 'Data Realização', 'Realizado Por'];
    if (isAdmMaster) headers.push('Valor Calculado');
    const csvRows = rows.map(item => { const row = [item.numero || '', item.company_name || '', item.funcionario_nome, item.funcionario_cpf, (item.periodos || []).map(p => `${p.data_inicio} a ${p.data_fim}`).join(' | '), item.solicitante_nome, format(parseISO(item.realizado_em as string), 'dd/MM/yyyy HH:mm'), item.realizado_por_nome || '']; if (isAdmMaster) row.push(item.valor_calculado?.toString() || ''); return row; });
    const csv = [headers, ...csvRows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = `relatorio_ppp_${format(reportRange.from, 'ddMMyyyy')}_${format(reportRange.to, 'ddMMyyyy')}.csv`; link.click(); URL.revokeObjectURL(url); setExportOpen(false);
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="flex h-64 flex-col items-center justify-center gap-3 text-destructive">Erro ao carregar solicitações de PPP<Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button></div>;
  const busy = createSolicitacao.isPending || updateSolicitacao.isPending;

  return <div className="w-full max-w-full space-y-6 overflow-hidden px-1">
    <div className="flex flex-wrap items-center justify-between gap-4"><Button variant="outline" size="sm" onClick={() => setExportOpen(true)}><FileDown className="mr-2 h-4 w-4" />Gerar Relatório do Período</Button>{canEdit && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Solicitação PPP</Button>}</div>
    <Card><CardContent className="p-4"><div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-1"><Label className="text-xs">Data inicial</Label><Input type="date" value={filters.dataInicial} onChange={e => setFilters(prev => ({ ...prev, dataInicial: e.target.value }))} /></div><div className="space-y-1"><Label className="text-xs">Data final</Label><Input type="date" value={filters.dataFinal} onChange={e => setFilters(prev => ({ ...prev, dataFinal: e.target.value }))} /></div><div className="space-y-1"><Label className="text-xs">Empresa</Label><CompanySelector value={filters.companyId} onChange={id => setFilters(prev => ({ ...prev, companyId: id || '' }))} /></div><div className="space-y-1"><Label className="text-xs">Status</Label><Select value={filters.status} onValueChange={status => setFilters(prev => ({ ...prev, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="realizado">Realizado</SelectItem></SelectContent></Select></div></div></CardContent></Card>
    <Card className="overflow-hidden"><CardHeader><CardTitle>Solicitações de PPP</CardTitle></CardHeader><CardContent className="p-0 sm:p-6"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Empresa</TableHead><TableHead>Funcionário</TableHead><TableHead>CPF</TableHead><TableHead>Períodos</TableHead><TableHead>Status</TableHead><TableHead>Anexos</TableHead>{isAdmMaster && <TableHead>Valor</TableHead>}<TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{filtradas.length === 0 ? <TableRow><TableCell colSpan={isAdmMaster ? 9 : 8} className="py-8 text-center text-muted-foreground">Nenhuma solicitação encontrada</TableCell></TableRow> : filtradas.map(item => <TableRow key={item.id}><TableCell className="font-mono text-xs">{item.numero || '—'}</TableCell><TableCell className="max-w-[220px] truncate font-medium">{item.company_name}</TableCell><TableCell>{item.funcionario_nome}</TableCell><TableCell className="whitespace-nowrap">{item.funcionario_cpf}</TableCell><TableCell><TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="secondary">{item.periodos?.length || 0} período(s)</Badge></TooltipTrigger><TooltipContent>{(item.periodos || []).map(p => <div key={`${p.data_inicio}-${p.data_fim}`}>{format(parseISO(p.data_inicio), 'dd/MM/yyyy')} a {format(parseISO(p.data_fim), 'dd/MM/yyyy')}</div>)}</TooltipContent></Tooltip></TooltipProvider></TableCell><TableCell>{item.realizado ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700"><CheckCircle className="mr-1 h-3 w-3" />Realizado</Badge> : <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-600"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>}</TableCell><TableCell><div className="flex gap-1">{(item.anexos || []).map((anexo) => <div key={anexo.id || anexo.arquivo_url} className="flex items-center gap-1"><Button variant="ghost" size="icon" title={`Visualizar ${anexo.nome_arquivo}`} aria-label={`Visualizar ${anexo.nome_arquivo}`} onClick={() => visualizarAnexo(anexo.arquivo_url)} disabled={!previewUrls[anexo.arquivo_url]}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={`Baixar ${anexo.nome_arquivo}`} aria-label={`Baixar ${anexo.nome_arquivo}`} onClick={() => baixarAnexo(anexo)}><FileDown className="h-4 w-4" /></Button></div>)}{!(item.anexos || []).length && <span className="text-muted-foreground">—</span>}</div></TableCell>{isAdmMaster && <TableCell>{money(item.valor_calculado)}</TableCell>}<TableCell><div className="flex justify-end gap-1">{!item.realizado && canEdit && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" aria-label="Marcar como Realizado" onClick={() => { setSelected(item); setRealizarOpen(true); }}><CheckCircle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Marcar como Realizado</TooltipContent></Tooltip></TooltipProvider>}{(isAdmMaster || (!item.realizado && canEdit)) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Editar" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>}{isAdmMaster && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir solicitação?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita e removerá os períodos e anexos vinculados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteSolicitacao.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{isEditing ? 'Editar Solicitação de PPP' : 'Nova Solicitação de PPP'}</DialogTitle><DialogDescription>Registre os dados do funcionário, períodos e documentos.</DialogDescription></DialogHeader><div className="grid gap-5 py-4"><div className="space-y-2"><Label>Empresa *</Label><CompanySelector value={formData.company_id} onChange={id => setFormData(prev => ({ ...prev, company_id: id || '' }))} /></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Solicitante *</Label><Input value={formData.solicitante_nome} onChange={e => setFormData(prev => ({ ...prev, solicitante_nome: e.target.value }))} /></div><div className="space-y-2"><Label>CPF do Funcionário *</Label><Input value={formData.funcionario_cpf} onChange={e => setFormData(prev => ({ ...prev, funcionario_cpf: e.target.value }))} /></div><div className="space-y-2 md:col-span-2"><Label>Nome completo do Funcionário *</Label><Input value={formData.funcionario_nome} onChange={e => setFormData(prev => ({ ...prev, funcionario_nome: e.target.value }))} /></div></div><div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-base font-semibold">Períodos *</Label><Button type="button" variant="outline" size="sm" onClick={addPeriod}><Plus className="mr-2 h-4 w-4" />Adicionar Período</Button></div>{formData.periodos.map((period, index) => <div key={index} className="flex items-end gap-3 rounded-md border bg-muted/30 p-3"><div className="flex-1 space-y-2"><Label>Início</Label><Input type="date" value={period.data_inicio} onChange={e => updatePeriod(index, 'data_inicio', e.target.value)} /></div><div className="flex-1 space-y-2"><Label>Fim</Label><Input type="date" value={period.data_fim} onChange={e => updatePeriod(index, 'data_fim', e.target.value)} /></div>{formData.periodos.length > 1 && <Button variant="ghost" size="icon" onClick={() => removePeriod(index)}><X className="h-4 w-4" /></Button>}</div>)}</div><div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-base font-semibold">Anexos</Label><div><Input id="ppp-files" type="file" multiple className="hidden" onChange={addFiles} /><Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('ppp-files')?.click()}><Plus className="mr-2 h-4 w-4" />Adicionar Anexo</Button></div></div>{formData.files.map((item, index) => <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 rounded-md border p-3"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span><Select value={item.tipo_documento} onValueChange={value => updateFileType(index, value)}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Formulário PPP">Formulário PPP</SelectItem><SelectItem value="Laudo">Laudo</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" onClick={() => removeFile(index)}><X className="h-4 w-4" /></Button></div>)}</div><div className="space-y-2"><Label>Observação</Label><Textarea value={formData.observacao} onChange={e => setFormData(prev => ({ ...prev, observacao: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditing ? 'Salvar Alterações' : 'Salvar Solicitação'}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={realizarOpen} onOpenChange={setRealizarOpen}><DialogContent><DialogHeader><DialogTitle>Marcar como Realizado</DialogTitle><DialogDescription>O registro será feito automaticamente em seu nome, com data e hora atuais. Se não houver preço cadastrado para o PPP, a realização continuará sem valor.</DialogDescription></DialogHeader><div className="space-y-2 py-4 text-sm"><div><span className="text-muted-foreground">Realizado por: </span><span className="font-medium">{profile?.full_name || user?.email}</span></div><div><span className="text-muted-foreground">Data/hora: </span><span className="font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span></div></div><DialogFooter><Button variant="outline" onClick={() => setRealizarOpen(false)}>Cancelar</Button><Button disabled={markAsRealizado.isPending} onClick={async () => { if (!selected) return; await markAsRealizado.mutateAsync({ id: selected.id, company_id: selected.company_id }); setRealizarOpen(false); setSelected(null); }}>Confirmar e Calcular</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={exportOpen} onOpenChange={setExportOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Exportar Relatório de PPP</DialogTitle><DialogDescription>Selecione o período de realização para gerar o CSV.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-4 py-4">{(['from', 'to'] as const).map(key => <div key={key} className="space-y-2"><Label>{key === 'from' ? 'Data Inicial' : 'Data Final'}</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><Calendar className="mr-2 h-4 w-4" />{format(reportRange[key], 'dd/MM/yyyy')}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={reportRange[key]} onSelect={date => date && setReportRange(prev => ({ ...prev, [key]: date }))} initialFocus /></PopoverContent></Popover></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setExportOpen(false)}>Cancelar</Button><Button onClick={exportReport}><FileDown className="mr-2 h-4 w-4" />Gerar CSV</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
