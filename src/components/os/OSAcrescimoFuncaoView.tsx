import { useState, useEffect } from 'react';
import { useAcrescimoFuncao } from '@/hooks/useAcrescimoFuncao';
import { AcrescimoFuncaoSolicitacao } from '@/types/os';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { UnitSelector } from '@/components/shared/UnitSelector';
import { Plus, Trash2, CheckCircle, Clock, FileDown, Loader2, Edit, Calendar } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

export function OSAcrescimoFuncaoView({ canEdit }: { canEdit: boolean }) {
  const { solicitacoes, isLoading, error, createSolicitacao, updateSolicitacao, deleteSolicitacao, markAsRealizado } = useAcrescimoFuncao();
  const { isAdmMaster, profile, user } = useAuth();
  
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [realizarOpen, setRealizarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<AcrescimoFuncaoSolicitacao | null>(null);
  
  // Report period state
  const [reportRange, setReportRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Form State
  const [formData, setFormData] = useState({
    company_id: '',
    unidade_id: '',
    solicitante_nome: '',
    data_solicitacao_cliente: format(new Date(), 'yyyy-MM-dd'),
    observacao: '',
    cargos: [{ setor: '', cargo: '' }]
  });

  const handleAddCargo = () => {
    setFormData(prev => ({
      ...prev,
      cargos: [...prev.cargos, { setor: '', cargo: '' }]
    }));
  };

  const handleRemoveCargo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      cargos: prev.cargos.filter((_, i) => i !== index)
    }));
  };

  const handleCargoChange = (index: number, field: 'setor' | 'cargo', value: string) => {
    const newCargos = [...formData.cargos];
    newCargos[index][field] = value;
    setFormData(prev => ({ ...prev, cargos: newCargos }));
  };

  const handleOpenNew = () => {
    setIsEditing(false);
    setSelectedSolicitacao(null);
    setFormData({
      company_id: '',
      unidade_id: '',
      solicitante_nome: '',
      data_solicitacao_cliente: format(new Date(), 'yyyy-MM-dd'),
      observacao: '',
      cargos: [{ setor: '', cargo: '' }]
    });
    setFormOpen(true);
  };

  const handleEdit = (s: AcrescimoFuncaoSolicitacao) => {
    setIsEditing(true);
    setSelectedSolicitacao(s);
    setFormData({
      company_id: s.company_id,
      unidade_id: s.unidade_id || '',
      solicitante_nome: s.solicitante_nome,
      data_solicitacao_cliente: s.data_solicitacao_cliente,
      observacao: s.observacao || '',
      cargos: s.cargos?.map(c => ({ setor: c.setor, cargo: c.cargo })) || [{ setor: '', cargo: '' }]
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.company_id || !formData.solicitante_nome || formData.cargos.some(c => !c.setor || !c.cargo)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      if (isEditing && selectedSolicitacao) {
        await updateSolicitacao.mutateAsync({
          id: selectedSolicitacao.id,
          solicitacao: {
            company_id: formData.company_id,
            unidade_id: formData.unidade_id || null,
            solicitante_nome: formData.solicitante_nome,
            data_solicitacao_cliente: formData.data_solicitacao_cliente,
            observacao: formData.observacao || null,
          },
          cargos: formData.cargos
        });
      } else {
        await createSolicitacao.mutateAsync({
          solicitacao: {
            company_id: formData.company_id,
            unidade_id: formData.unidade_id || null,
            solicitante_nome: formData.solicitante_nome,
            data_solicitacao_cliente: formData.data_solicitacao_cliente,
            observacao: formData.observacao || null,
          },
          cargos: formData.cargos
        });
      }
      setFormOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSolicitacao.mutateAsync(id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkRealizado = async () => {
    if (!selectedSolicitacao) return;
    try {
      await markAsRealizado.mutateAsync({
        id: selectedSolicitacao.id,
        company_id: selectedSolicitacao.company_id,
        num_cargos: selectedSolicitacao.cargos?.length || 0
      });
      setRealizarOpen(false);
      setSelectedSolicitacao(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportReport = () => {
    if (!reportRange.from || !reportRange.to) {
      toast.error("Selecione um período válido");
      return;
    }

    const data = solicitacoes.filter(s => 
      s.realizado && 
      s.realizado_em && 
      isWithinInterval(parseISO(s.realizado_em), { start: reportRange.from, end: reportRange.to })
    );

    if (data.length === 0) {
      toast.info('Nenhuma solicitação realizada encontrada no período selecionado');
      return;
    }

    const headers = ['Nº', 'Empresa', 'Unidade', 'Solicitante', 'Setor', 'Cargo', 'Data Realização', 'Realizado Por'];
    if (isAdmMaster) headers.push('Valor Calculado');

    const rows = data.flatMap(s => 
      (s.cargos || []).map(c => {
        const row = [
          s.numero || '',
          s.company_name || '',
          s.unidade_nome || '',
          s.solicitante_nome,
          c.setor,
          c.cargo,
          s.realizado_em ? format(parseISO(s.realizado_em), 'dd/MM/yyyy HH:mm') : '',
          s.realizado_por_nome || ''
        ];
        if (isAdmMaster) row.push(s.valor_total_calculado?.toString() || '');
        return row;
      })
    );

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_acrescimo_funcao_${format(reportRange.from, 'ddMMyyyy')}_${format(reportRange.to, 'ddMMyyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-destructive font-semibold">Erro ao carregar solicitações</div>
        <div className="text-sm text-muted-foreground">{(error as any).message || 'Erro desconhecido'}</div>
        <Button variant="outline" onClick={() => window.location.reload()}>Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden px-1">
      <div className="flex justify-between items-center gap-4 flex-wrap w-full">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            Gerar Relatório do Período
          </Button>
        </div>
        {canEdit && (
          <Button onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Solicitação
          </Button>
        )}
      </div>

      <Card className="w-full overflow-hidden border-none sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-2 sm:px-6">
          <CardTitle>Solicitações de Acréscimo de Função</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="rounded-md sm:border overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nº</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[200px]">Empresa / Unidade</TableHead>
                    <TableHead className="whitespace-nowrap">Solicitante</TableHead>
                    <TableHead className="whitespace-nowrap">Data Pedido</TableHead>
                    <TableHead className="whitespace-nowrap">Cargos</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    {isAdmMaster && <TableHead className="whitespace-nowrap">Valor</TableHead>}
                    <TableHead className="text-right whitespace-nowrap min-w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {solicitacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmMaster ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  solicitacoes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{s.numero || '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium truncate max-w-[250px]" title={s.company_name}>{s.company_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.unidade_nome || 'Matriz/Geral'}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.solicitante_nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(parseISO(s.data_solicitacao_cliente), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.cargos?.length || 0} cargo(s)</Badge>
                      </TableCell>
                      <TableCell>
                        {s.realizado ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Realizado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      {isAdmMaster && (
                        <TableCell className="whitespace-nowrap">
                          {s.valor_total_calculado ? (
                            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor_total_calculado)
                          ) : '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!s.realizado && canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 mr-2"
                              onClick={() => { setSelectedSolicitacao(s); setRealizarOpen(true); }}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Realizado
                            </Button>
                          )}
                          
                          {(isAdmMaster || (!s.realizado && canEdit)) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-primary" 
                              onClick={() => handleEdit(s)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {isAdmMaster && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Solicitação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. Isso removerá permanentemente a solicitação e seus cargos vinculados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {s.realizado && !isAdmMaster && (
                            <div className="text-[10px] text-muted-foreground italic truncate max-w-[100px]">
                              Realizado por {s.realizado_por_nome}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* Dialog Formulário (Novo/Edição) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Solicitação' : 'Nova Solicitação de Acréscimo'}</DialogTitle>
            <DialogDescription>Preencha os dados da solicitação do cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <CompanySelector 
                  value={formData.company_id} 
                  onChange={(id) => setFormData(prev => ({ ...prev, company_id: id || '', unidade_id: '' }))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <UnitSelector 
                  companyId={formData.company_id} 
                  value={formData.unidade_id} 
                  onChange={(id) => setFormData(prev => ({ ...prev, unidade_id: id || '' }))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Solicitante (no Cliente) *</Label>
                <Input 
                  value={formData.solicitante_nome} 
                  onChange={(e) => setFormData(prev => ({ ...prev, solicitante_nome: e.target.value }))} 
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Solicitação *</Label>
                <Input 
                  type="date" 
                  value={formData.data_solicitacao_cliente} 
                  onChange={(e) => setFormData(prev => ({ ...prev, data_solicitacao_cliente: e.target.value }))} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={formData.observacao} 
                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))} 
                placeholder="Detalhes adicionais..."
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Cargos Solicitados *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddCargo}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Cargo
                </Button>
              </div>
              <div className="space-y-3">
                {formData.cargos.map((cargo, index) => (
                  <div key={index} className="flex gap-3 items-end border p-3 rounded-md bg-muted/30">
                    <div className="flex-1 space-y-2">
                      <Label>Setor</Label>
                      <Input 
                        value={cargo.setor} 
                        onChange={(e) => handleCargoChange(index, 'setor', e.target.value)} 
                        placeholder="Ex: Produção"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label>Cargo</Label>
                      <Input 
                        value={cargo.cargo} 
                        onChange={(e) => handleCargoChange(index, 'cargo', e.target.value)} 
                        placeholder="Ex: Operador"
                      />
                    </div>
                    {formData.cargos.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveCargo(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createSolicitacao.isPending || updateSolicitacao.isPending}>
              {(createSolicitacao.isPending || updateSolicitacao.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Salvar Alterações' : 'Salvar Solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Marcar como Realizado */}
      <Dialog open={realizarOpen} onOpenChange={setRealizarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Realizado</DialogTitle>
            <DialogDescription>
              O registro será feito automaticamente em seu nome, com data e hora atuais.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm">
            <div><span className="text-muted-foreground">Realizado por: </span><span className="font-medium">{profile?.full_name || user?.email}</span></div>
            <div><span className="text-muted-foreground">Data/hora: </span><span className="font-medium">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRealizarOpen(false)}>Cancelar</Button>
            <Button onClick={handleMarkRealizado} disabled={markAsRealizado.isPending}>
              Confirmar e Calcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Relatório */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
            <DialogDescription>Selecione o período de realização para gerar o arquivo CSV.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {reportRange.from ? format(reportRange.from, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={reportRange.from}
                      onSelect={(date) => date && setReportRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {reportRange.to ? format(reportRange.to, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={reportRange.to}
                      onSelect={(date) => date && setReportRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancelar</Button>
            <Button onClick={handleExportReport}>
              <FileDown className="h-4 w-4 mr-2" />
              Gerar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}