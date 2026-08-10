import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Clock, FileText, Search, Plus, Bell, Users, Pencil, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusVigencia, TipoLaudo, Laudo, ConselhoProfissional, CONSELHO_OPTIONS } from '@/types/os';
import { useResponsaveisTecnicos, useTiposLaudo, useLaudos, useConfiguracaoAlertas } from '@/hooks/useOSData';
import { useProfissionais } from '@/hooks/useProfissionais';
import { toast } from '@/hooks/use-toast';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { NovoLaudoManualDialog } from '@/components/os/NovoLaudoManualDialog';

export function OSGestaoVencimentosView() {
  const { responsaveis } = useResponsaveisTecnicos();
  const { profissionais } = useProfissionais();
  const { tiposLaudo, add: addTipo, update: updateTipo } = useTiposLaudo();
  const { laudos, refresh: refreshLaudos } = useLaudos();
  const { hasPermission } = useModulePermissions();
  const canCreateLaudo = hasPermission('/gestao-os', 'create');
  const [novoLaudoOpen, setNovoLaudoOpen] = useState(false);
  const { config: alertaConfig, update: updateAlerta } = useConfiguracaoAlertas();

  const [activeTab, setActiveTab] = useState('laudos');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroTipoLaudo, setFiltroTipoLaudo] = useState('all');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');


  // Tipo Laudo dialog
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<TipoLaudo | null>(null);
  const [tipoForm, setTipoForm] = useState({ nome: '', descricao: '', exige_vigencia: true, conselhos_permitidos: ['CREA'] as string[], prazo_vigencia_padrao: '' });

  // Alerta dialog
  const [alertaDialogOpen, setAlertaDialogOpen] = useState(false);
  const [alertaForm, setAlertaForm] = useState({ dias: '90,60,30' });

  const calcularStatusVigencia = (laudo: Laudo): StatusVigencia => {
    if (!laudo.possui_vigencia || !laudo.data_validade) return 'Sem vigência';
    const dias = differenceInDays(parseISO(laudo.data_validade), new Date());
    if (dias < 0) return 'Vencido';
    if (dias <= (alertaConfig?.dias_antecedencia?.[2] || 30)) return 'A vencer';
    return 'Vigente';
  };

  const laudosFiltrados = useMemo(() => {
    return laudos.filter(l => {
      if (filtroEmpresa && !l.empresa_cliente.toLowerCase().includes(filtroEmpresa.toLowerCase())) return false;
      if (filtroTipoLaudo !== 'all' && l.tipo_laudo_id !== filtroTipoLaudo) return false;
      if (filtroResponsavel !== 'all' && l.responsavel_tecnico_id !== filtroResponsavel) return false;
      if (filtroStatus !== 'all' && calcularStatusVigencia(l) !== filtroStatus) return false;
      return true;
    });
  }, [laudos, filtroEmpresa, filtroTipoLaudo, filtroResponsavel, filtroStatus, alertaConfig]);

  const stats = useMemo(() => ({
    total: laudos.length,
    vigentes: laudos.filter(l => calcularStatusVigencia(l) === 'Vigente').length,
    aVencer: laudos.filter(l => calcularStatusVigencia(l) === 'A vencer').length,
    vencidos: laudos.filter(l => calcularStatusVigencia(l) === 'Vencido').length,
    semVigencia: laudos.filter(l => calcularStatusVigencia(l) === 'Sem vigência').length,
  }), [laudos, alertaConfig]);

  const alertasProximos = useMemo(() => {
    return laudos
      .filter(l => l.possui_vigencia && l.data_validade)
      .map(l => ({ ...l, diasParaVencer: differenceInDays(parseISO(l.data_validade!), new Date()) }))
      .filter(l => l.diasParaVencer > 0 && l.diasParaVencer <= 90)
      .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
      .slice(0, 10);
  }, [laudos]);

  const getStatusBadge = (status: StatusVigencia) => {
    switch (status) {
      case 'Vigente': return <Badge className="bg-emerald-600/10 text-emerald-600"><CheckCircle className="h-3 w-3 mr-1" />Vigente</Badge>;
      case 'A vencer': return <Badge className="bg-yellow-500/10 text-yellow-600"><Clock className="h-3 w-3 mr-1" />A vencer</Badge>;
      case 'Vencido': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Vencido</Badge>;
      case 'Sem vigência': return <Badge variant="secondary">Sem vigência</Badge>;
    }
  };

  const responsaveisTecnicos = useMemo(
    () => profissionais.filter(p => p.pode_ser_responsavel_tecnico).sort((a, b) => a.nome.localeCompare(b.nome)),
    [profissionais],
  );




  const handleOpenTipoDialog = (tipo?: TipoLaudo) => {
    if (tipo) {
      setEditingTipo(tipo);
      setTipoForm({ nome: tipo.nome, descricao: tipo.descricao, exige_vigencia: tipo.exige_vigencia, conselhos_permitidos: tipo.conselhos_permitidos, prazo_vigencia_padrao: tipo.prazo_vigencia_padrao?.toString() || '' });
    } else {
      setEditingTipo(null);
      setTipoForm({ nome: '', descricao: '', exige_vigencia: true, conselhos_permitidos: ['CREA'], prazo_vigencia_padrao: '' });
    }
    setTipoDialogOpen(true);
  };

  const handleSaveTipo = async () => {
    if (!tipoForm.nome) {
      toast({ title: 'Atenção', description: 'Preencha o nome.', variant: 'destructive' });
      return;
    }
    const payload = { ...tipoForm, prazo_vigencia_padrao: tipoForm.prazo_vigencia_padrao ? parseInt(tipoForm.prazo_vigencia_padrao) : null };
    if (editingTipo) {
      await updateTipo(editingTipo.id, payload);
    } else {
      await addTipo({ ...payload, ativo: true } as any);
    }
    setTipoDialogOpen(false);
  };

  const handleSaveAlerta = async () => {
    const dias = alertaForm.dias.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    if (dias.length === 0) {
      toast({ title: 'Atenção', description: 'Informe pelo menos um prazo.', variant: 'destructive' });
      return;
    }
    await updateAlerta({ dias_antecedencia: dias.sort((a, b) => b - a), ativo: true });
    setAlertaDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-emerald-600" /><div><p className="text-2xl font-bold">{stats.vigentes}</p><p className="text-sm text-muted-foreground">Vigentes</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{stats.aVencer}</p><p className="text-sm text-muted-foreground">A Vencer</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{stats.vencidos}</p><p className="text-sm text-muted-foreground">Vencidos</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-muted-foreground" /><div><p className="text-2xl font-bold">{stats.semVigencia}</p><p className="text-sm text-muted-foreground">Sem Vigência</p></div></div></CardContent></Card>
      </div>

      {/* Alerts */}
      {alertasProximos.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-600"><Bell className="h-5 w-5" />Alertas de Vencimento Próximo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertasProximos.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <div>
                    <span className="font-medium">{a.tipo_laudo_nome}</span>
                    <span className="text-muted-foreground"> — {a.empresa_cliente}</span>
                    <span className="text-sm text-muted-foreground ml-2">(OS {a.numero_os})</span>
                  </div>
                  <Badge variant={a.diasParaVencer <= 30 ? 'destructive' : 'secondary'}>{a.diasParaVencer} dias</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="laudos"><FileText className="h-4 w-4 mr-1" />Laudos</TabsTrigger>
          <TabsTrigger value="responsaveis"><Users className="h-4 w-4 mr-1" />Responsáveis</TabsTrigger>
          <TabsTrigger value="tipos"><FileText className="h-4 w-4 mr-1" />Tipos de Laudo</TabsTrigger>
          <TabsTrigger value="alertas"><Bell className="h-4 w-4 mr-1" />Alertas</TabsTrigger>
        </TabsList>

        {/* Laudos Tab */}
        <TabsContent value="laudos" className="space-y-4 mt-4">
          {canCreateLaudo && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setNovoLaudoOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Laudo
              </Button>
            </div>
          )}
          <NovoLaudoManualDialog
            open={novoLaudoOpen}
            onOpenChange={setNovoLaudoOpen}
            onSaved={refreshLaudos}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empresa..." value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} className="pl-10" />
            </div>
            <Select value={filtroTipoLaudo} onValueChange={setFiltroTipoLaudo}>
              <SelectTrigger><SelectValue placeholder="Tipo de Laudo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tiposLaudo.filter(t => t.ativo).map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {responsaveis.filter(r => r.ativo).map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Vigente">Vigente</SelectItem>
                <SelectItem value="A vencer">A vencer</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Sem vigência">Sem vigência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo de Laudo</TableHead>
                  <TableHead className="hidden md:table-cell">Responsável Técnico</TableHead>
                  <TableHead className="hidden lg:table-cell">Emissão</TableHead>
                  <TableHead className="hidden lg:table-cell">Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laudosFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum laudo encontrado</TableCell></TableRow>
                ) : laudosFiltrados.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.numero_os}</TableCell>
                    <TableCell>{l.empresa_cliente}</TableCell>
                    <TableCell><Badge variant="outline">{l.tipo_laudo_nome}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm"><div>{l.responsavel_tecnico_nome}</div><div className="text-xs text-muted-foreground">{l.responsavel_tecnico_registro}</div></div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{format(parseISO(l.data_emissao), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="hidden lg:table-cell">{l.data_validade ? format(parseISO(l.data_validade), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</TableCell>
                    <TableCell>{getStatusBadge(calcularStatusVigencia(l))}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canEditLaudo && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingLaudo(l)} title="Editar laudo">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmMaster && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setLaudoParaExcluir(l)} title="Excluir laudo">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Dialog de edição de laudo */}
          <NovoLaudoManualDialog
            open={!!editingLaudo}
            onOpenChange={(o) => { if (!o) setEditingLaudo(null); }}
            laudo={editingLaudo}
            onSaved={refreshLaudos}
          />

          <AlertDialog open={!!laudoParaExcluir} onOpenChange={(o) => { if (!o) setLaudoParaExcluir(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir laudo</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este laudo? Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={excluindo} onClick={(e) => { e.preventDefault(); handleExcluirLaudo(); }}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>


        {/* Responsáveis Técnicos Tab */}
        <TabsContent value="responsaveis" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Responsáveis Técnicos</CardTitle>
              <CardDescription>
                Consulta somente leitura. Para cadastrar ou editar um Responsável Técnico, acesse Gerenciar Usuários → Profissionais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Conselho</TableHead><TableHead>Registro</TableHead><TableHead className="hidden md:table-cell">Especialidade</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {responsaveisTecnicos.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum responsável técnico cadastrado</TableCell></TableRow>
                    ) : responsaveisTecnicos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell>{p.conselho_sigla ? <Badge variant="outline">{p.conselho_sigla}</Badge> : '-'}</TableCell>
                        <TableCell>{p.numero_conselho || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{p.especialidade || p.categoria || '-'}</TableCell>
                        <TableCell><Badge variant={p.ativo ? 'default' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Tipos de Laudo Tab */}
        <TabsContent value="tipos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Tipos de Laudo</CardTitle><CardDescription>Configuração de vigência e conselhos</CardDescription></div>
              <Button onClick={() => handleOpenTipoDialog()}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Vigência</TableHead><TableHead className="hidden md:table-cell">Conselhos</TableHead><TableHead className="hidden md:table-cell">Prazo Padrão</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tiposLaudo.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>
                    ) : tiposLaudo.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.nome}</TableCell>
                        <TableCell>{t.exige_vigencia ? <Badge>Obrigatória</Badge> : <Badge variant="secondary">Opcional</Badge>}</TableCell>
                        <TableCell className="hidden md:table-cell">{t.conselhos_permitidos.join(', ')}</TableCell>
                        <TableCell className="hidden md:table-cell">{t.prazo_vigencia_padrao ? `${t.prazo_vigencia_padrao} dias` : '-'}</TableCell>
                        <TableCell><Badge variant={t.ativo ? 'default' : 'secondary'}>{t.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => handleOpenTipoDialog(t)}>Editar</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas Tab */}
        <TabsContent value="alertas" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Configuração de Alertas</CardTitle><CardDescription>Defina os prazos de antecedência para alertas de vencimento</CardDescription></div>
              <Button onClick={() => { setAlertaForm({ dias: alertaConfig?.dias_antecedencia?.join(', ') || '90, 60, 30' }); setAlertaDialogOpen(true); }}>Configurar</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">Prazos de Alerta Atuais</h4>
                  <div className="flex gap-2 flex-wrap">
                    {(alertaConfig?.dias_antecedencia || [90, 60, 30]).map(d => (
                      <Badge key={d} variant="outline" className="text-lg px-4 py-2">{d} dias</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Laudos com vencimento dentro destes prazos serão destacados como "A vencer".</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>



      {/* Dialog Tipo Laudo */}
      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTipo ? 'Editar' : 'Novo'} Tipo de Laudo</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={tipoForm.nome} onChange={e => setTipoForm({ ...tipoForm, nome: e.target.value })} placeholder="Ex: PGR" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={tipoForm.descricao} onChange={e => setTipoForm({ ...tipoForm, descricao: e.target.value })} rows={2} /></div>
            <div className="flex items-center space-x-2">
              <Checkbox id="exigeVigencia" checked={tipoForm.exige_vigencia} onCheckedChange={c => setTipoForm({ ...tipoForm, exige_vigencia: c as boolean })} />
              <Label htmlFor="exigeVigencia">Exige vigência obrigatória</Label>
            </div>
            <div className="space-y-2">
              <Label>Conselhos Permitidos</Label>
              <div className="flex gap-2 flex-wrap">
                {CONSELHO_OPTIONS.map(c => (
                  <div key={c} className="flex items-center space-x-1">
                    <Checkbox
                      checked={tipoForm.conselhos_permitidos.includes(c)}
                      onCheckedChange={checked => {
                        setTipoForm(prev => ({
                          ...prev,
                          conselhos_permitidos: checked
                            ? [...prev.conselhos_permitidos, c]
                            : prev.conselhos_permitidos.filter(x => x !== c),
                        }));
                      }}
                    />
                    <Label className="text-sm">{c}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label>Prazo Padrão (dias)</Label><Input type="number" value={tipoForm.prazo_vigencia_padrao} onChange={e => setTipoForm({ ...tipoForm, prazo_vigencia_padrao: e.target.value })} placeholder="Ex: 365" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTipo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Alertas */}
      <Dialog open={alertaDialogOpen} onOpenChange={setAlertaDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar Alertas de Vencimento</DialogTitle><DialogDescription>Informe os prazos de antecedência separados por vírgula</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Dias de Antecedência</Label><Input value={alertaForm.dias} onChange={e => setAlertaForm({ dias: e.target.value })} placeholder="90, 60, 30" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAlerta}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
