import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, AlertCircle, Plus } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OrdemServico, ServicoOS, ConselhoProfissional } from '@/types/os';
import { useResponsaveisTecnicos, useTiposLaudo, useLaudos } from '@/hooks/useOSData';
import { useConselhosClasse } from '@/hooks/useConselhosClasse';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico;
  servico: ServicoOS;
  onFinalized: () => void;
}

export function OSFinalizarServicoDialog({ open, onOpenChange, ordem, servico, onFinalized }: Props) {
  const { user, profile } = useAuth();
  const { responsaveis, add: addResp } = useResponsaveisTecnicos();
  const { tiposLaudo } = useTiposLaudo();
  const { add: addLaudo } = useLaudos();
  const { conselhos, add: addConselho } = useConselhosClasse();

  const [form, setForm] = useState({
    tipoLaudoId: '',
    responsavelTecnicoId: '',
    possuiVigencia: true,
    dataValidade: null as Date | null,
    justificativaSemVigencia: '',
    observacoes: '',
  });

  const [showNovoResp, setShowNovoResp] = useState(false);
  const [novoResp, setNovoResp] = useState({ nome: '', conselho: 'CREA' as string, numero_registro: '', especialidade: '', email: '' });
  const [showNovoConselho, setShowNovoConselho] = useState(false);
  const [novoConselhoSigla, setNovoConselhoSigla] = useState('');
  const [novoConselhoDesc, setNovoConselhoDesc] = useState('');

  const tipoSelecionado = useMemo(() => tiposLaudo.find(t => t.id === form.tipoLaudoId), [tiposLaudo, form.tipoLaudoId]);

  const respFiltrados = useMemo(() => {
    if (!tipoSelecionado) return responsaveis.filter(r => r.ativo);
    return responsaveis.filter(r => r.ativo && tipoSelecionado.conselhos_permitidos.includes(r.conselho));
  }, [responsaveis, tipoSelecionado]);

  const handleTipoChange = (tipoId: string) => {
    const tipo = tiposLaudo.find(t => t.id === tipoId);
    setForm(prev => ({
      ...prev,
      tipoLaudoId: tipoId,
      possuiVigencia: tipo?.exige_vigencia ?? true,
      dataValidade: tipo?.prazo_vigencia_padrao ? addDays(new Date(), tipo.prazo_vigencia_padrao) : null,
      responsavelTecnicoId: '',
    }));
  };

  const handleAddResp = async () => {
    if (!novoResp.nome || !novoResp.numero_registro) {
      toast({ title: 'Atenção', description: 'Preencha nome e registro.', variant: 'destructive' });
      return;
    }
    await addResp({ ...novoResp, ativo: true } as any);
    setShowNovoResp(false);
    setNovoResp({ nome: '', conselho: 'CREA', numero_registro: '', especialidade: '', email: '' });
  };

  const handleFinalizar = async () => {
    if (!form.tipoLaudoId) { toast({ title: 'Atenção', description: 'Selecione o tipo de laudo.', variant: 'destructive' }); return; }
    if (!form.responsavelTecnicoId) { toast({ title: 'Atenção', description: 'Selecione o responsável técnico.', variant: 'destructive' }); return; }
    if (form.possuiVigencia && !form.dataValidade) { toast({ title: 'Atenção', description: 'Informe a data de validade.', variant: 'destructive' }); return; }
    if (!form.possuiVigencia && !form.justificativaSemVigencia.trim()) { toast({ title: 'Atenção', description: 'Informe a justificativa.', variant: 'destructive' }); return; }

    const tipo = tiposLaudo.find(t => t.id === form.tipoLaudoId)!;
    const resp = responsaveis.find(r => r.id === form.responsavelTecnicoId)!;

    // Update service status to 'Concluído' with conclusion date
    const { error: svcErr } = await supabase
      .from('servicos_os')
      .update({ status: 'Concluído', data_conclusao: new Date().toISOString().split('T')[0] } as any)
      .eq('id', servico.id);
    if (svcErr) { toast({ title: 'Erro', description: 'Erro ao finalizar serviço.', variant: 'destructive' }); return; }

    // Create laudo
    await addLaudo({
      ordem_id: ordem.id,
      servico_id: servico.id,
      tipo_laudo_id: form.tipoLaudoId,
      responsavel_tecnico_id: form.responsavelTecnicoId,
      numero_os: ordem.numero_os,
      empresa_cliente: ordem.empresa_cliente,
      tipo_servico: servico.tipo,
      tipo_laudo_nome: tipo.nome,
      responsavel_tecnico_nome: resp.nome,
      responsavel_tecnico_registro: `${resp.conselho} ${resp.numero_registro}`,
      data_emissao: new Date().toISOString().split('T')[0],
      possui_vigencia: form.possuiVigencia,
      data_validade: form.possuiVigencia && form.dataValidade ? format(form.dataValidade, 'yyyy-MM-dd') : null,
      justificativa_sem_vigencia: !form.possuiVigencia ? form.justificativaSemVigencia : null,
      observacoes: form.observacoes || null,
      created_by: user?.id || null,
    } as any);

    // Add history entry
    await supabase.from('historico_os').insert({
      ordem_id: ordem.id,
      user_id: user?.id || null,
      user_name: profile?.full_name || 'Sistema',
      acao: 'Finalização de Serviço',
      comentario: `Serviço ${servico.tipo} finalizado com laudo ${tipo.nome}. RT: ${resp.nome} (${resp.conselho} ${resp.numero_registro})`,
      status_anterior: servico.status,
      status_novo: 'Concluído',
      servico_afetado: servico.tipo,
    });

    // Check if all services are completed -> auto-close OS
    const { data: allSvcs } = await supabase.from('servicos_os').select('status').eq('ordem_id', ordem.id);
    if (allSvcs && allSvcs.every(s => s.status === 'Concluído')) {
      await supabase.from('ordens_servico').update({ status_os: 'Encerrado', updated_by: user?.id || null } as any).eq('id', ordem.id);
      await supabase.from('historico_os').insert({
        ordem_id: ordem.id,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Encerramento Automático',
        comentario: 'Todos os serviços foram concluídos. OS encerrada automaticamente.',
        status_anterior: ordem.status_os,
        status_novo: 'Encerrado',
      });
      toast({ title: 'OS Encerrada', description: 'Todos os serviços concluídos. OS encerrada automaticamente.' });
    }

    // Reset form
    setForm({ tipoLaudoId: '', responsavelTecnicoId: '', possuiVigencia: true, dataValidade: null, justificativaSemVigencia: '', observacoes: '' });
    onOpenChange(false);
    onFinalized();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Serviço com Laudo</DialogTitle>
          <DialogDescription>
            OS {ordem.numero_os} — {ordem.empresa_cliente}<br />
            Serviço: <strong>{servico.tipo}</strong> ({servico.tipo_os})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Registro obrigatório de laudo</p>
              <p className="text-muted-foreground">Para finalizar, informe os dados do laudo emitido, incluindo responsável técnico e vigência.</p>
            </div>
          </div>

          {/* Tipo de Laudo */}
          <div className="space-y-2">
            <Label>Tipo de Laudo *</Label>
            <Select value={form.tipoLaudoId} onValueChange={handleTipoChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de laudo" /></SelectTrigger>
              <SelectContent>
                {tiposLaudo.filter(t => t.ativo).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}{t.exige_vigencia && <span className="text-xs text-muted-foreground ml-2">(exige vigência)</span>}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipoSelecionado && <p className="text-xs text-muted-foreground">{tipoSelecionado.descricao}</p>}
          </div>

          {/* Responsável Técnico */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Responsável Técnico *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowNovoResp(!showNovoResp)}><Plus className="h-4 w-4 mr-1" />Novo</Button>
            </div>
            {!showNovoResp ? (
              <>
                <Select value={form.responsavelTecnicoId} onValueChange={v => setForm({ ...form, responsavelTecnicoId: v })} disabled={!form.tipoLaudoId}>
                  <SelectTrigger><SelectValue placeholder={!form.tipoLaudoId ? 'Selecione primeiro o tipo de laudo' : 'Selecione o responsável'} /></SelectTrigger>
                  <SelectContent>
                    {respFiltrados.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">Nenhum responsável disponível</div>
                    ) : respFiltrados.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2"><span>{r.nome}</span><Badge variant="outline" className="text-xs">{r.conselho} {r.numero_registro}</Badge></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tipoSelecionado && respFiltrados.length === 0 && (
                  <p className="text-xs text-destructive">Cadastre um responsável com conselho {tipoSelecionado.conselhos_permitidos.join(' ou ')}</p>
                )}
              </>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                <div className="space-y-2"><Label>Nome *</Label><Input value={novoResp.nome} onChange={e => setNovoResp({ ...novoResp, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Conselho *</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowNovoConselho(v => !v)}>
                        <Plus className="h-3 w-3 mr-1" />Novo conselho
                      </Button>
                    </div>
                    {!showNovoConselho ? (
                      <Select value={novoResp.conselho} onValueChange={v => setNovoResp({ ...novoResp, conselho: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{conselhos.map(c => <SelectItem key={c.id} value={c.sigla}>{c.sigla}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2 rounded-md border p-2 bg-background">
                        <Input placeholder="Sigla (ex: MTE)" value={novoConselhoSigla} onChange={e => setNovoConselhoSigla(e.target.value.toUpperCase())} className="h-8" />
                        <Input placeholder="Descrição (opcional)" value={novoConselhoDesc} onChange={e => setNovoConselhoDesc(e.target.value)} className="h-8" />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => { setShowNovoConselho(false); setNovoConselhoSigla(''); setNovoConselhoDesc(''); }}>Cancelar</Button>
                          <Button type="button" size="sm" className="h-7 text-xs flex-1" onClick={async () => {
                            if (!novoConselhoSigla.trim()) { toast({ title: 'Atenção', description: 'Informe a sigla.', variant: 'destructive' }); return; }
                            const c = await addConselho(novoConselhoSigla, novoConselhoDesc);
                            if (c) { setNovoResp({ ...novoResp, conselho: c.sigla }); setShowNovoConselho(false); setNovoConselhoSigla(''); setNovoConselhoDesc(''); }
                          }}>Salvar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2"><Label>Registro *</Label><Input value={novoResp.numero_registro} onChange={e => setNovoResp({ ...novoResp, numero_registro: e.target.value })} /></div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNovoResp(false)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={handleAddResp}>Adicionar</Button>
                </div>
              </div>
            )}
          </div>

          {/* Vigência */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="vigencia" checked={form.possuiVigencia} onCheckedChange={c => setForm({ ...form, possuiVigencia: c as boolean, dataValidade: c ? form.dataValidade : null, justificativaSemVigencia: c ? '' : form.justificativaSemVigencia })} disabled={tipoSelecionado?.exige_vigencia} />
              <Label htmlFor="vigencia" className={cn(tipoSelecionado?.exige_vigencia && 'text-muted-foreground')}>
                Este laudo possui vigência
                {tipoSelecionado?.exige_vigencia && <span className="text-xs ml-2">(obrigatório)</span>}
              </Label>
            </div>
            {form.possuiVigencia ? (
              <div className="space-y-2">
                <Label>Data de Validade *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.dataValidade && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.dataValidade ? format(form.dataValidade, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.dataValidade || undefined} onSelect={d => setForm({ ...form, dataValidade: d || null })} disabled={d => d < new Date()} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Justificativa *</Label>
                <Textarea value={form.justificativaSemVigencia} onChange={e => setForm({ ...form, justificativaSemVigencia: e.target.value })} placeholder="Ex: Sem prazo legal aplicável" rows={2} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleFinalizar}>Finalizar Serviço</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
