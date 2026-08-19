import { useState } from 'react';
import { useAcrescimoFuncao } from '@/hooks/useAcrescimoFuncao';
import { AcrescimoFuncaoSolicitacao } from '@/types/os';
import { useProfissionais } from '@/hooks/useProfissionais';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { UnitSelector } from '@/components/shared/UnitSelector';
import { Plus, Trash2, CheckCircle, Clock, FileDown, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function OSAcrescimoFuncaoView({ canEdit }: { canEdit: boolean }) {
  const { solicitacoes, isLoading, error, createSolicitacao, markAsRealizado } = useAcrescimoFuncao();
  const { profissionais } = useProfissionais();
  const { isAdmMaster } = useAuth();
  const [novoOpen, setNovoOpen] = useState(false);
  const [realizarOpen, setRealizarOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<AcrescimoFuncaoSolicitacao | null>(null);
  const [realizadoPor, setRealizadoPor] = useState('');

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

  const handleSubmit = async () => {
    if (!formData.company_id || !formData.solicitante_nome || formData.cargos.some(c => !c.setor || !c.cargo)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
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
      setNovoOpen(false);
      setFormData({
        company_id: '',
        unidade_id: '',
        solicitante_nome: '',
        data_solicitacao_cliente: format(new Date(), 'yyyy-MM-dd'),
        observacao: '',
        cargos: [{ setor: '', cargo: '' }]
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkRealizado = async () => {
    if (!selectedSolicitacao || !realizadoPor) return;
    try {
      await markAsRealizado.mutateAsync({
        id: selectedSolicitacao.id,
        realizado_por: realizadoPor,
        company_id: selectedSolicitacao.company_id,
        num_cargos: selectedSolicitacao.cargos?.length || 0
      });
      setRealizarOpen(false);
      setSelectedSolicitacao(null);
      setRealizadoPor('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportReport = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const data = solicitacoes.filter(s => 
      s.realizado && 
      s.realizado_em && 
      isWithinInterval(parseISO(s.realizado_em), { start, end })
    );

    if (data.length === 0) {
      toast.info('Nenhuma solicitação realizada encontrada no período atual');
      return;
    }

    const headers = ['Empresa', 'Unidade', 'Solicitante', 'Setor', 'Cargo', 'Data Realização', 'Realizado Por', 'Valor Calculado'];
    const rows = data.flatMap(s => 
      (s.cargos || []).map(c => [
        s.company_name || '',
        s.unidade_nome || '',
        s.solicitante_nome,
        c.setor,
        c.cargo,
        s.realizado_em ? format(parseISO(s.realizado_em), 'dd/MM/yyyy HH:mm') : '',
        s.realizado_por_nome || '',
        s.valor_total_calculado?.toString() || ''
      ])
    );

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_acrescimo_funcao_${format(now, 'MM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <FileDown className="h-4 w-4 mr-2" />
            Gerar Relatório do Período
          </Button>
        </div>
        {canEdit && (
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Solicitação
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Acréscimo de Função</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa / Unidade</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data Pedido</TableHead>
                  <TableHead>Cargos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solicitacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  solicitacoes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.company_name}</div>
                        <div className="text-xs text-muted-foreground">{s.unidade_nome || 'Matriz/Geral'}</div>
                      </TableCell>
                      <TableCell>{s.solicitante_nome}</TableCell>
                      <TableCell>{format(parseISO(s.data_solicitacao_cliente), 'dd/MM/yyyy')}</TableCell>
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
                      <TableCell>
                        {s.valor_total_calculado ? (
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor_total_calculado)
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {!s.realizado && canEdit && (
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox 
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSolicitacao(s);
                                  setRealizarOpen(true);
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">Marcar Realizado</span>
                          </div>
                        )}
                        {s.realizado && (
                          <div className="text-xs text-muted-foreground">
                            Por: {s.realizado_por_nome}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Nova Solicitação */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Acréscimo</DialogTitle>
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
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createSolicitacao.isPending}>
              {createSolicitacao.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Solicitação
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
              Selecione quem realizou o cadastro dos novos cargos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Realizado por *</Label>
              <Select value={realizadoPor} onValueChange={setRealizadoPor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.filter(p => p.ativo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRealizarOpen(false)}>Cancelar</Button>
            <Button onClick={handleMarkRealizado} disabled={!realizadoPor || markAsRealizado.isPending}>
              Confirmar e Calcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
