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
import { Separator } from '@/components/ui/separator';
import { Calendar as CalendarIcon, AlertCircle, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OrdemServico, ServicoOS } from '@/types/os';
import { useResponsaveisTecnicos, useTiposLaudo, useLaudos } from '@/hooks/useOSData';
import { useConselhosClasse } from '@/hooks/useConselhosClasse';
import { useOSCustos } from '@/hooks/useOSCustos';
import { OS_CUSTO_TIPO_OPTIONS, OSCustoTipo } from '@/types/osCustos';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { UnitSelector } from '@/components/shared/UnitSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico;
  servico: ServicoOS;
  onFinalized: () => void;
}

type CustoLinha = {
  tipo: OSCustoTipo;
  descricao: string;
  valor: string;
  fornecedor: string;
};

const CUSTO_VAZIO: CustoLinha = { tipo: 'deslocamento', descricao: '', valor: '', fornecedor: '' };

export function OSFinalizarServicoDialog({ open, onOpenChange, ordem, servico, onFinalized }: Props) {
  const { user, profile } = useAuth();
  const { responsaveis, refresh: refreshResponsaveis } = useResponsaveisTecnicos();
  const { tiposLaudo } = useTiposLaudo();
  const { add: addLaudo } = useLaudos();

  const { addCusto } = useOSCustos(ordem.id);

  const [form, setForm] = useState({
    tipoLaudoId: '',
    responsavelTecnicoId: '',
    possuiVigencia: true,
    dataValidade: null as Date | null,
    justificativaSemVigencia: '',
    observacoes: '',
    possuiArt: false,
    artNumero: '',
    artValidade: null as Date | null,
    artFile: null as File | null,
  });
  const [unidadeId, setUnidadeId] = useState<string | null>((ordem as any).unidade_id ?? null);
  const [custos, setCustos] = useState<CustoLinha[]>([]);
  const [saving, setSaving] = useState(false);

  const [profDialogOpen, setProfDialogOpen] = useState(false);


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
      // Sugere vigência sempre que o tipo tiver prazo padrão (mesmo quando não é obrigatória)
      possuiVigencia: tipo?.exige_vigencia || !!tipo?.prazo_vigencia_padrao || prev.possuiVigencia,
      dataValidade: tipo?.prazo_vigencia_padrao ? addDays(new Date(), tipo.prazo_vigencia_padrao) : prev.dataValidade,
      responsavelTecnicoId: '',
    }));
  };




  const addCustoLinha = () => setCustos(prev => [...prev, { ...CUSTO_VAZIO }]);
  const updCustoLinha = (i: number, patch: Partial<CustoLinha>) => setCustos(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const rmCustoLinha = (i: number) => setCustos(prev => prev.filter((_, idx) => idx !== i));

  const uploadArtFile = async (): Promise<string | null> => {
    if (!form.artFile) return null;
    const ext = form.artFile.name.split('.').pop() || 'bin';
    const path = `${ordem.id}/art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('os-anexos').upload(path, form.artFile, {
      contentType: form.artFile.type || undefined,
      upsert: false,
    });
    if (error) throw error;
    // Also register in os_anexos as ART for the anexos tab visibility
    await (supabase as any).from('os_anexos').insert({
      ordem_id: ordem.id,
      servico_os_id: servico.id,
      categoria: 'ART',
      nome: form.artFile.name,
      descricao: `ART ${form.artNumero || ''}`.trim(),
      storage_path: path,
      mime_type: form.artFile.type || null,
      tamanho_bytes: form.artFile.size,
      data_vencimento: form.artValidade ? format(form.artValidade, 'yyyy-MM-dd') : null,
      created_by: user?.id || null,
    });
    return path;
  };

  const handleFinalizar = async () => {
    // Validações
    if (!form.tipoLaudoId) { toast({ title: 'Atenção', description: 'Selecione o tipo de laudo.', variant: 'destructive' }); return; }
    if (!unidadeId) { toast({ title: 'Atenção', description: 'Selecione a unidade', variant: 'destructive' }); return; }
    if (!form.responsavelTecnicoId) { toast({ title: 'Atenção', description: 'Selecione o responsável técnico.', variant: 'destructive' }); return; }
    if (tipoSelecionado?.exige_vigencia && !form.possuiVigencia) {
      toast({ title: 'Atenção', description: `${tipoSelecionado.nome} exige vigência obrigatória.`, variant: 'destructive' }); return;
    }
    if (form.possuiVigencia && !form.dataValidade) { toast({ title: 'Atenção', description: 'Informe a data de validade.', variant: 'destructive' }); return; }
    if (!form.possuiVigencia && !form.justificativaSemVigencia.trim()) { toast({ title: 'Atenção', description: 'Informe a justificativa.', variant: 'destructive' }); return; }
    if (form.possuiArt) {
      if (!form.artNumero.trim()) { toast({ title: 'Atenção', description: 'Informe o número da ART.', variant: 'destructive' }); return; }
      if (!form.artValidade) { toast({ title: 'Atenção', description: 'Informe a validade da ART.', variant: 'destructive' }); return; }
    }
    for (let i = 0; i < custos.length; i++) {
      const c = custos[i];
      if (!c.descricao.trim() || !c.valor || Number(c.valor) <= 0) {
        toast({ title: 'Atenção', description: `Custo #${i + 1}: preencha descrição e valor.`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const tipo = tiposLaudo.find(t => t.id === form.tipoLaudoId)!;
      const resp = responsaveis.find(r => r.id === form.responsavelTecnicoId)!;

      // Upload ART file if provided
      let artPath: string | null = null;
      if (form.possuiArt && form.artFile) {
        artPath = await uploadArtFile();
      }

      // Encerrar serviço
      const { error: svcErr } = await supabase
        .from('servicos_os')
        .update({ status: 'Encerrado', data_conclusao: new Date().toISOString().split('T')[0] } as any)
        .eq('id', servico.id);
      if (svcErr) throw svcErr;

      // Confirmar/atualizar unidade na OS
      if (unidadeId && unidadeId !== ((ordem as any).unidade_id ?? null)) {
        const { error: unidErr } = await (supabase as any)
          .from('ordens_servico')
          .update({ unidade_id: unidadeId })
          .eq('id', ordem.id);
        if (unidErr) throw unidErr;
      }


      // Registrar laudo (auto-popula tabela de Laudos)
      await addLaudo({
        ordem_id: ordem.id,
        servico_id: servico.id,
        tipo_laudo_id: form.tipoLaudoId,
        responsavel_tecnico_id: form.responsavelTecnicoId,
        numero_os: ordem.numero_os,
        empresa_cliente: ordem.empresa_cliente,
        company_id: (ordem as any).company_id ?? null,
        unidade_id: unidadeId,
        tipo_servico: servico.tipo,
        tipo_laudo_nome: tipo.nome,
        responsavel_tecnico_nome: resp.nome,
        responsavel_tecnico_registro: `${resp.conselho} ${resp.numero_registro}`,
        data_emissao: new Date().toISOString().split('T')[0],
        possui_vigencia: form.possuiVigencia,
        data_validade: form.possuiVigencia && form.dataValidade ? format(form.dataValidade, 'yyyy-MM-dd') : null,
        justificativa_sem_vigencia: !form.possuiVigencia ? form.justificativaSemVigencia : null,
        observacoes: form.observacoes || null,
        possui_art: form.possuiArt,
        art_numero: form.possuiArt ? form.artNumero : null,
        art_validade: form.possuiArt && form.artValidade ? format(form.artValidade, 'yyyy-MM-dd') : null,
        art_anexo_url: artPath,
        created_by: user?.id || null,
      } as any);

      // Lançar custos reais
      const hoje = new Date().toISOString().split('T')[0];
      for (const c of custos) {
        await addCusto({
          ordem_id: ordem.id,
          servico_os_id: servico.id,
          tipo: c.tipo,
          descricao: c.descricao,
          valor: Number(c.valor),
          data: hoje,
          fornecedor: c.fornecedor || null,
        });
      }
      // Se possui ART, lança custo automático de ART (opcional — só se número informado e não já lançado como custo separado)
      // Nota: intencionalmente NÃO criamos custo automático de ART; usuário adiciona se aplicável.

      // Histórico
      await supabase.from('historico_os').insert({
        ordem_id: ordem.id,
        user_id: user?.id || null,
        user_name: profile?.full_name || 'Sistema',
        acao: 'Finalização de Serviço',
        comentario: `Serviço ${servico.tipo} finalizado. Laudo: ${tipo.nome}. RT: ${resp.nome} (${resp.conselho} ${resp.numero_registro})${form.possuiArt ? ` — ART ${form.artNumero}` : ''}${custos.length ? ` — ${custos.length} custo(s) real(is) registrado(s)` : ''}.`,
        status_anterior: servico.status,
        status_novo: 'Encerrado',
        servico_afetado: servico.tipo,
      });

      toast({ title: 'Serviço encerrado', description: 'Laudo, ART e custos registrados.' });

      // Reset
      setForm({ tipoLaudoId: '', responsavelTecnicoId: '', possuiVigencia: true, dataValidade: null, justificativaSemVigencia: '', observacoes: '', possuiArt: false, artNumero: '', artValidade: null, artFile: null });
      setCustos([]);
      onOpenChange(false);
      onFinalized();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao finalizar serviço.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Serviço</DialogTitle>
          <DialogDescription>
            OS {ordem.numero_os} — {ordem.empresa_cliente}<br />
            Serviço: <strong>{servico.tipo}</strong> ({servico.tipo_os})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Registro obrigatório de laudo, ART (se aplicável) e custos reais</p>
              <p className="text-muted-foreground">Para encerrar o serviço, informe os dados do laudo emitido, ART quando houver, e os custos reais incorridos.</p>
            </div>
          </div>

          {/* ==================== LAUDO ==================== */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Laudo Técnico
            </h4>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <UnitSelector
                companyId={(ordem as any).company_id ?? null}
                value={unidadeId}
                onChange={(id) => setUnidadeId(id)}
              />
              <p className="text-xs text-muted-foreground">
                Confirme a unidade onde o serviço foi executado. Ela será gravada na OS e no laudo.
              </p>
            </div>


            <div className="space-y-2">
              <Label>Tipo de Laudo *</Label>
              <Select value={form.tipoLaudoId} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo de laudo" /></SelectTrigger>
                <SelectContent>
                  {tiposLaudo.filter(t => t.ativo).map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}{t.exige_vigencia && <span className="text-xs text-muted-foreground ml-2">(exige vigência)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipoSelecionado && <p className="text-xs text-muted-foreground">{tipoSelecionado.descricao}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Responsável Técnico *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setProfDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />Novo
                </Button>
              </div>
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
              <ProfissionalFormDialog
                open={profDialogOpen}
                onOpenChange={setProfDialogOpen}
                defaultPodeRT
                onSaved={async () => { await refreshResponsaveis(); }}
              />
            </div>


            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vigencia"
                  checked={form.possuiVigencia}
                  onCheckedChange={c => setForm({ ...form, possuiVigencia: c as boolean, dataValidade: c ? form.dataValidade : null, justificativaSemVigencia: c ? '' : form.justificativaSemVigencia })}
                  disabled={tipoSelecionado?.exige_vigencia}
                />
                <Label htmlFor="vigencia" className={cn(tipoSelecionado?.exige_vigencia && 'text-muted-foreground')}>
                  Este laudo possui vigência
                  {tipoSelecionado?.exige_vigencia && <span className="text-xs ml-2 text-destructive">(obrigatório para {tipoSelecionado.nome})</span>}
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
              <Label>Observações do Laudo</Label>
              <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional" rows={2} />
            </div>
          </div>

          <Separator />

          {/* ==================== ART ==================== */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> ART (Anotação de Responsabilidade Técnica)
            </h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="possui-art"
                checked={form.possuiArt}
                onCheckedChange={c => setForm({ ...form, possuiArt: c as boolean })}
              />
              <Label htmlFor="possui-art">Este serviço possui ART emitida</Label>
            </div>
            {form.possuiArt && (
              <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nº da ART *</Label>
                    <Input value={form.artNumero} onChange={e => setForm({ ...form, artNumero: e.target.value })} placeholder="Ex: 2026-1234567" />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade da ART *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.artValidade && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.artValidade ? format(form.artValidade, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.artValidade || undefined} onSelect={d => setForm({ ...form, artValidade: d || null })} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" />Anexo da ART (PDF/Imagem)</Label>
                  <Input type="file" accept="application/pdf,image/*" onChange={e => setForm({ ...form, artFile: e.target.files?.[0] || null })} />
                  {form.artFile && <p className="text-xs text-muted-foreground">{form.artFile.name}</p>}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ==================== CUSTOS REAIS ==================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Custos Reais do Serviço
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addCustoLinha}>
                <Plus className="h-4 w-4 mr-1" />Adicionar custo
              </Button>
            </div>
            {custos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum custo lançado. Adicione deslocamento, alimentação, aluguel de equipamento, profissionais externos, análises químicas, etc.
              </p>
            ) : (
              <div className="space-y-3">
                {custos.map((c, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-md bg-muted/30">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={c.tipo} onValueChange={(v) => updCustoLinha(i, { tipo: v as OSCustoTipo })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OS_CUSTO_TIPO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Descrição *</Label>
                      <Input className="h-9" value={c.descricao} onChange={e => updCustoLinha(i, { descricao: e.target.value })} placeholder="Ex: Combustível SP → Campinas" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Valor (R$) *</Label>
                      <Input className="h-9" type="number" step="0.01" min="0" value={c.valor} onChange={e => updCustoLinha(i, { valor: e.target.value })} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Fornecedor</Label>
                      <Input className="h-9" value={c.fornecedor} onChange={e => updCustoLinha(i, { fornecedor: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => rmCustoLinha(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleFinalizar} disabled={saving}>{saving ? 'Salvando...' : 'Encerrar Serviço'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
