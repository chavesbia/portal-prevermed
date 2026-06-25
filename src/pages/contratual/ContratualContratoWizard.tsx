import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, ArrowRight, FileSignature } from 'lucide-react';
import { buildPlaceholderValues, placeholdersManuais, renderTemplate } from '@/lib/contractual/render';
import { generateAndUploadPdf } from '@/lib/contractual/pdf';
import { useContractPlaceholders } from '@/hooks/useContractPlaceholders';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: (id: string) => void;
}

export function ContratualContratoWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [clienteId, setClienteId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [versionId, setVersionId] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({
    numero_proposta: '', valor_mensal: '', qtd_vidas: '', valor_excedente: '',
    dia_cobranca: '', multa: '', juros: '', vigencia_meses: '12',
    indice_reajuste: 'IPCA', prazo_aviso: '', valor_km: '',
    data_emissao: today,
    data_assinatura: '',
    data_inicio: today,
    rep_nome: '', rep_cpf: '', rep_email: '',
    testemunha1_nome: '', testemunha1_cpf: '', testemunha1_email: '',
    testemunha2_nome: '', testemunha2_cpf: '', testemunha2_email: '',
    prevermed_nome: '', prevermed_cpf: '', prevermed_email: '',
  });
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  const { data: placeholders = [] } = useContractPlaceholders(true);

  useEffect(() => {
    if (!open) {
      setStep(1); setClienteId(''); setTemplateId(''); setVersionId('');
      setManualValues({});
    }
  }, [open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const { data: clientes = [] } = useQuery({
    queryKey: ['contract-clientes-min'],
    queryFn: async () => {
      const { data } = await supabase.from('contract_clientes').select('id, razao_social, cnpj').order('razao_social');
      return data || [];
    }, enabled: open,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['contract-templates-min'],
    queryFn: async () => {
      const { data } = await supabase.from('contract_templates').select('id, nome, versao_atual, current_version_id').eq('ativo', true).order('nome');
      return data || [];
    }, enabled: open,
  });

  const { data: cliente } = useQuery({
    queryKey: ['contract-cliente', clienteId],
    queryFn: async () => {
      const { data } = await supabase.from('contract_clientes').select('*').eq('id', clienteId).maybeSingle();
      return data;
    }, enabled: !!clienteId,
  });

  const { data: version } = useQuery({
    queryKey: ['contract-version', versionId],
    queryFn: async () => {
      const { data } = await supabase.from('contract_template_versions').select('*').eq('id', versionId).maybeSingle();
      return data;
    }, enabled: !!versionId,
  });

  useEffect(() => {
    if (templateId) {
      const t = templates.find((x: any) => x.id === templateId);
      if (t?.current_version_id) setVersionId(t.current_version_id);
    }
  }, [templateId, templates]);

  useEffect(() => {
    if (cliente && !form.rep_nome) {
      set('rep_nome', cliente.representante_legal || '');
      set('rep_cpf', cliente.cpf_representante || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  // Placeholders sem origem mapeada que aparecem no template ativo
  const manuaisPendentes = useMemo(() => {
    if (!version?.conteudo_html) return [];
    const usados = new Set<string>();
    String(version.conteudo_html).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, k) => { usados.add(k); return _m; });
    return placeholdersManuais(placeholders).filter(p => usados.has(p.chave));
  }, [version, placeholders]);

  const previewHtml = useMemo(() => {
    if (!cliente || !version) return '';
    const dataFim = form.data_inicio && form.vigencia_meses
      ? new Date(new Date(form.data_inicio + 'T00:00:00').getTime() + Number(form.vigencia_meses) * 30 * 86400000).toISOString().slice(0, 10)
      : null;
    const values = buildPlaceholderValues(placeholders, {
      cliente,
      contrato: { ...form, data_fim: dataFim },
      manual: manualValues,
    });
    return renderTemplate(version.conteudo_html, values);
  }, [cliente, version, form, placeholders, manualValues]);

  const canGoStep2 = !!clienteId && !!templateId && !!versionId;
  const canGoStep3 = canGoStep2 && !!form.data_emissao && !!form.data_inicio && !!form.vigencia_meses;

  const confirmar = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        cliente_id: clienteId,
        template_id: templateId,
        template_version_id: versionId,
        status: 'rascunho',
        data_emissao: form.data_emissao || null,
        data_assinatura: form.data_assinatura || null,
        data_inicio: form.data_inicio,
        vigencia_meses: Number(form.vigencia_meses) || 12,
        numero_proposta: form.numero_proposta || null,
        valor_mensal: form.valor_mensal ? Number(form.valor_mensal) : null,
        qtd_vidas: form.qtd_vidas ? Number(form.qtd_vidas) : null,
        valor_excedente: form.valor_excedente ? Number(form.valor_excedente) : null,
        dia_cobranca: form.dia_cobranca ? Number(form.dia_cobranca) : null,
        multa: form.multa ? Number(form.multa) : null,
        juros: form.juros ? Number(form.juros) : null,
        indice_reajuste: form.indice_reajuste || null,
        prazo_aviso: form.prazo_aviso ? Number(form.prazo_aviso) : null,
        valor_km: form.valor_km ? Number(form.valor_km) : null,
        rep_nome: form.rep_nome || null, rep_cpf: form.rep_cpf || null,
        testemunha1_nome: form.testemunha1_nome || null, testemunha1_cpf: form.testemunha1_cpf || null,
        testemunha2_nome: form.testemunha2_nome || null, testemunha2_cpf: form.testemunha2_cpf || null,
        html_final: previewHtml,
        created_by: user?.id, updated_by: user?.id,
      };
      const { data: ctr, error } = await supabase.from('contract_contratos').insert(payload).select().single();
      if (error) throw error;

      const signers = [
        { tipo: 'representante', nome: form.rep_nome, cpf: form.rep_cpf },
        { tipo: 'testemunha_1', nome: form.testemunha1_nome, cpf: form.testemunha1_cpf },
        { tipo: 'testemunha_2', nome: form.testemunha2_nome, cpf: form.testemunha2_cpf },
      ].filter(s => s.nome);
      if (signers.length) {
        await supabase.from('contract_assinaturas').insert(signers.map(s => ({ contrato_id: ctr.id, ...s, tipo: s.tipo as any })));
      }

      try {
        const path = await generateAndUploadPdf({
          contratoId: ctr.id, numero: ctr.numero_contrato, html: previewHtml,
        });
        await supabase.from('contract_contratos').update({ pdf_url: path }).eq('id', ctr.id);
      } catch (pdfErr: any) {
        console.error('PDF error', pdfErr);
        toast.warning('Contrato criado mas houve falha ao gerar o PDF. Você pode gerar novamente na tela do contrato.');
      }

      await supabase.from('contract_eventos').insert({
        contrato_id: ctr.id, tipo: 'criado',
        descricao: `Contrato ${ctr.numero_contrato} criado`,
        performed_by: user?.id,
      });

      toast.success(`Contrato ${ctr.numero_contrato} criado`);
      onCreated(ctr.id);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar contrato');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato — passo {step} de 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente…" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Modelo de contrato *</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} (v{t.versao_atual})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Apenas modelos ativos. A versão atual é congelada no momento da geração.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Datas do contrato</h4>
              <div className="grid grid-cols-3 gap-3">
                <F label="Data de emissão *" type="date" v={form.data_emissao} on={v => set('data_emissao', v)} />
                <F label="Data de assinatura" type="date" v={form.data_assinatura} on={v => set('data_assinatura', v)} />
                <F label="Início da vigência *" type="date" v={form.data_inicio} on={v => set('data_inicio', v)} />
              </div>
            </div>

            <div className="pt-3 border-t">
              <h4 className="text-sm font-medium mb-2">Dados comerciais</h4>
              <div className="grid grid-cols-3 gap-3">
                <F label="Nº Proposta" v={form.numero_proposta} on={v => set('numero_proposta', v)} />
                <F label="Vigência (meses) *" type="number" v={form.vigencia_meses} on={v => set('vigencia_meses', v)} />
                <F label="Índice de reajuste" v={form.indice_reajuste} on={v => set('indice_reajuste', v)} />
                <F label="Valor mensal (R$)" type="number" v={form.valor_mensal} on={v => set('valor_mensal', v)} />
                <F label="Qtd. vidas" type="number" v={form.qtd_vidas} on={v => set('qtd_vidas', v)} />
                <F label="Valor vida excedente (R$)" type="number" v={form.valor_excedente} on={v => set('valor_excedente', v)} />
                <F label="Dia cobrança" type="number" v={form.dia_cobranca} on={v => set('dia_cobranca', v)} />
                <F label="Multa (%)" type="number" v={form.multa} on={v => set('multa', v)} />
                <F label="Juros (%)" type="number" v={form.juros} on={v => set('juros', v)} />
                <F label="Prazo aviso prévio (dias)" type="number" v={form.prazo_aviso} on={v => set('prazo_aviso', v)} />
                <F label="Valor KM rodado (R$)" type="number" v={form.valor_km} on={v => set('valor_km', v)} />
              </div>
            </div>

            <div className="pt-3 border-t">
              <h4 className="text-sm font-medium mb-2">Assinantes</h4>
              <div className="grid grid-cols-2 gap-3">
                <F label="Representante legal" v={form.rep_nome} on={v => set('rep_nome', v)} />
                <F label="CPF representante" v={form.rep_cpf} on={v => set('rep_cpf', v)} />
                <F label="Testemunha 1" v={form.testemunha1_nome} on={v => set('testemunha1_nome', v)} />
                <F label="CPF testemunha 1" v={form.testemunha1_cpf} on={v => set('testemunha1_cpf', v)} />
                <F label="Testemunha 2" v={form.testemunha2_nome} on={v => set('testemunha2_nome', v)} />
                <F label="CPF testemunha 2" v={form.testemunha2_cpf} on={v => set('testemunha2_cpf', v)} />
              </div>
            </div>

            {manuaisPendentes.length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-medium mb-1">Campos personalizados</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Estes placeholders aparecem no modelo mas não possuem origem mapeada. Preencha manualmente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {manuaisPendentes.map(p => (
                    <div key={p.id} className="space-y-1">
                      <Label className="text-xs">
                        {p.label} <code className="text-[10px] text-muted-foreground">{`{{${p.chave}}}`}</code>
                      </Label>
                      <Input
                        value={manualValues[p.chave] || ''}
                        onChange={e => setManualValues(v => ({ ...v, [p.chave]: e.target.value }))}
                        placeholder={p.descricao || ''}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pré-visualização do contrato. Confirme para gerar o PDF.</p>
            <div className="border rounded-lg bg-white p-6 prose prose-sm max-w-none max-h-[60vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 && (
            <Button onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={confirmar} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSignature className="h-4 w-4 mr-1" />}
              Confirmar e gerar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, v, on, type = 'text' }: { label: string; v: any; on: (s: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v || ''} onChange={e => on(e.target.value)} />
    </div>
  );
}
