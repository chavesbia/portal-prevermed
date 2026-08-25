import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CompanySelector, type CompanyOption } from '@/components/shared/CompanySelector';
import { ModalidadeSelector } from '@/components/contratual/ModalidadeSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSuccess?: () => void;
}

const empty = {
  data_inicio: '',
  data_fim: '',
  qtd_vidas: '',
  valor_mensal: '',
  status: 'ativo',
  numero_original: '',
  multa: '',
  juros: '',
  indice_reajuste: '',
  prazo_aviso: '',
  renovacao_automatica: '',
  observacoes: '',
};

export function ContratualLegadoDialog({ open, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setCompanyId(null);
      setCompany(null);
      setPdfPath(null);
      setPdfName('');
    }
  }, [open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('contract-legados').upload(path, file, {
        contentType: file.type || 'application/pdf',
      });
      if (error) throw error;
      setPdfPath(path);
      setPdfName(file.name);
      toast.success('PDF anexado');
    } catch (err: any) {
      toast.error('Erro ao enviar PDF: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  /** Resolve (ou cria) o registro de cliente contratual da empresa selecionada. */
  const resolveCliente = async (opt: CompanyOption, userId?: string) => {
    const { data: existing, error: qErr } = await supabase
      .from('contract_clientes').select('id').eq('company_id', opt.id).maybeSingle();
    if (qErr) throw qErr;
    if (existing?.id) return existing.id;

    const { data: comp } = await supabase
      .from('companies')
      .select('cep, logradouro, numero, complemento, bairro, cidade, estado')
      .eq('id', opt.id).maybeSingle();
    const { data: contato } = await supabase
      .from('company_contacts')
      .select('telefone_1, email_1, created_at')
      .eq('company_id', opt.id)
      .order('created_at', { ascending: true }).limit(1).maybeSingle();

    const { data: created, error: iErr } = await supabase
      .from('contract_clientes')
      .insert({
        company_id: opt.id,
        razao_social: opt.razao_social,
        nome_fantasia: opt.nome_abreviado || null,
        cnpj: (opt.cnpj || '').replace(/\D/g, '') || null,
        cep: comp?.cep || null,
        logradouro: comp?.logradouro || null,
        numero: comp?.numero || null,
        complemento: comp?.complemento || null,
        bairro: comp?.bairro || null,
        cidade: comp?.cidade || null,
        estado: comp?.estado || null,
        telefone: contato?.telefone_1 || null,
        email: contato?.email_1 || null,
        created_by: userId, updated_by: userId,
      })
      .select('id').single();
    if (iErr) throw iErr;
    return created.id;
  };

  const salvar = async () => {
    if (!companyId || !company) return toast.error('Selecione a empresa');
    if (!form.data_inicio || !form.data_fim) return toast.error('Informe o início e o fim da vigência');
    if (new Date(form.data_fim) < new Date(form.data_inicio)) return toast.error('A data de fim deve ser posterior à de início');
    if (!form.qtd_vidas) return toast.error('Informe a quantidade de vidas');
    if (!form.valor_mensal) return toast.error('Informe o valor mensal');
    if (!pdfPath) return toast.error('Anexe o PDF assinado do contrato');

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const clienteId = await resolveCliente(company, user?.id);

      const inicio = new Date(form.data_inicio + 'T00:00:00');
      const fim = new Date(form.data_fim + 'T00:00:00');
      const meses = Math.max(
        1,
        Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)),
      );

      const obsExtra: string[] = [];
      if (form.renovacao_automatica) obsExtra.push(`Renovação automática: ${form.renovacao_automatica === 'sim' ? 'Sim' : 'Não'}`);
      const observacoes = [form.observacoes?.trim(), ...obsExtra].filter(Boolean).join('\n');

      const { data, error } = await supabase
        .from('contract_contratos')
        .insert({
          origem: 'legado',
          cliente_id: clienteId,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim,
          vigencia_meses: meses,
          qtd_vidas: Number(form.qtd_vidas),
          valor_mensal: Number(String(form.valor_mensal).replace(',', '.')),
          status: form.status,
          numero_original: form.numero_original?.trim() || null,
          multa: form.multa ? Number(String(form.multa).replace(',', '.')) : null,
          juros: form.juros ? Number(String(form.juros).replace(',', '.')) : null,
          indice_reajuste: form.indice_reajuste?.trim() || null,
          prazo_aviso: form.prazo_aviso ? Number(form.prazo_aviso) : null,
          observacoes: observacoes || null,
          pdf_url: pdfPath,
          created_by: user?.id, updated_by: user?.id,
        } as any)
        .select('id, numero_contrato')
        .single();
      if (error) throw error;

      await supabase.from('contract_eventos').insert({
        contrato_id: data.id,
        tipo: 'contrato_legado_registrado',
        descricao: `Contrato legado ${data.numero_contrato} registrado manualmente${form.numero_original ? ` (nº original: ${form.numero_original})` : ''}`,
      } as any);

      toast.success(`Contrato legado ${data.numero_contrato} cadastrado`);
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar contrato legado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Contrato Legado</DialogTitle>
          <DialogDescription>
            Registro de contrato já assinado fora do sistema, apenas para controle de vigência e consulta.
            Não passa pelo fluxo de assinatura eletrônica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <CompanySelector
              value={companyId}
              onChange={(id, opt) => { setCompanyId(id); setCompany(opt); }}
              excludeInternal
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Início da vigência *</Label>
              <Input type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim da vigência *</Label>
              <Input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade de vidas</Label>
              <Input type="number" min={0} value={form.qtd_vidas} onChange={e => set('qtd_vidas', e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor mensal (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_mensal} onChange={e => set('valor_mensal', e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Modalidade</Label>
              <ModalidadeSelector value={modalidadeId} onChange={setModalidadeId} />
            </div>
            <div className="space-y-1.5">
              <Label>Status inicial *</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>PDF assinado *</Label>
            {pdfPath ? (
              <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{pdfName}</span>
                <Button size="icon" variant="ghost" className="ml-auto h-7 w-7"
                  onClick={() => { setPdfPath(null); setPdfName(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando…' : 'Selecionar arquivo PDF do contrato assinado'}
                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground">Campos opcionais — apenas referência, sem cálculo automático.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Número original do contrato</Label>
              <Input value={form.numero_original} onChange={e => set('numero_original', e.target.value)} placeholder="Ex.: 2019/045" />
            </div>
            <div className="space-y-1.5">
              <Label>Índice de reajuste</Label>
              <Input value={form.indice_reajuste} onChange={e => set('indice_reajuste', e.target.value)} placeholder="Ex.: IPCA" />
            </div>
            <div className="space-y-1.5">
              <Label>Multa (%)</Label>
              <Input type="number" min={0} step="0.01" value={form.multa} onChange={e => set('multa', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Juros (%)</Label>
              <Input type="number" min={0} step="0.01" value={form.juros} onChange={e => set('juros', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de aviso prévio (dias)</Label>
              <Input type="number" min={0} value={form.prazo_aviso} onChange={e => set('prazo_aviso', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Renovação automática</Label>
              <Select value={form.renovacao_automatica} onValueChange={v => set('renovacao_automatica', v)}>
                <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações / Cláusulas especiais</Label>
            <Textarea rows={3} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || uploading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cadastrar contrato legado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
