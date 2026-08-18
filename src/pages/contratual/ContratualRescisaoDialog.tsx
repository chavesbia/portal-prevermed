import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatBRL, formatDateBR } from '@/lib/contractual/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCompanyId?: string;
  initialContratoId?: string;
  onSuccess?: () => void;
}

const MOTIVOS = [
  { value: 'insatisfacao', label: 'Insatisfação' },
  { value: 'preco', label: 'Preço' },
  { value: 'encerramento_atividades', label: 'Encerramento de Atividades' },
  { value: 'transferencia_cnpj', label: 'Transferência de CNPJ' },
  { value: 'mudanca_estrategica', label: 'Mudança Estratégica' },
  { value: 'alteracao_endereco', label: 'Alteração de Endereço' },
  { value: 'outro', label: 'Outro' },
];

export function ContratualRescisaoDialog({ open, onOpenChange, initialCompanyId, initialContratoId, onSuccess }: Props) {
  const { user } = useAuth() as any;
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId || null);
  const [contratoId, setContratoId] = useState<string | null>(initialContratoId || null);
  const [isManual, setIsManual] = useState(!initialContratoId);
  const [contratos, setContratos] = useState<any[]>([]);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    numero_contrato_manual: '',
    vigencia_inicio_manual: '',
    vigencia_fim_manual: '',
    qtd_vidas_manual: '',
    valor_mensal_manual: '',
    solicitante_nome: '',
    solicitante_cargo: '',
    solicitante_whatsapp: '',
    solicitante_email: '',
    motivo: '',
    motivo_descricao: '',
    valor_fat_1: '',
    valor_fat_2: '',
    valor_fat_3: '',
    data_prevista_inativacao: '',
    data_real_inativacao: '',
    data_prevista_ultimo_faturamento: '',
    clinica_destino: '',
  });

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setCompanyId(initialCompanyId || null);
      setContratoId(initialContratoId || null);
      setIsManual(!initialContratoId);
      setAnexoUrl(null);
      setFormData({
        numero_contrato_manual: '',
        vigencia_inicio_manual: '',
        vigencia_fim_manual: '',
        qtd_vidas_manual: '',
        valor_mensal_manual: '',
        solicitante_nome: '',
        solicitante_cargo: '',
        solicitante_whatsapp: '',
        solicitante_email: '',
        motivo: '',
        motivo_descricao: '',
        valor_fat_1: '',
        valor_fat_2: '',
        valor_fat_3: '',
        data_prevista_inativacao: '',
        data_real_inativacao: '',
        data_prevista_ultimo_faturamento: '',
        clinica_destino: '',
      });
    }
  }, [open, initialCompanyId, initialContratoId]);

  // Load contracts for selected company
  useEffect(() => {
    if (companyId && !initialContratoId) {
      supabase.from('contract_contratos')
        .select('id, numero_contrato, data_inicio, data_fim, qtd_vidas, valor_mensal')
        .eq('company_id', companyId)
        .neq('status', 'cancelado')
        .order('created_at', { ascending: false })
        .then(({ data }) => setContratos(data || []));
    } else if (!companyId) {
      setContratos([]);
    }
  }, [companyId, initialContratoId]);

  const handleUploadAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('contract-rescisoes').upload(path, file);
      if (error) throw error;
      setAnexoUrl(path);
      toast.success('Anexo enviado com sucesso');
    } catch (e: any) {
      toast.error('Erro ao enviar anexo: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!companyId) return toast.error('Selecione a empresa');
    if (!isManual && !contratoId) return toast.error('Selecione o contrato');
    if (!formData.motivo) return toast.error('Selecione o motivo da rescisão');

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        company_id: companyId,
        contrato_id: isManual ? null : contratoId,
        solicitante_nome: formData.solicitante_nome || null,
        solicitante_cargo: formData.solicitante_cargo || null,
        solicitante_whatsapp: formData.solicitante_whatsapp || null,
        solicitante_email: formData.solicitante_email || null,
        motivo: formData.motivo,
        motivo_descricao: formData.motivo_descricao || null,
        valor_fat_1: formData.valor_fat_1 ? parseFloat(formData.valor_fat_1) : null,
        valor_fat_2: formData.valor_fat_2 ? parseFloat(formData.valor_fat_2) : null,
        valor_fat_3: formData.valor_fat_3 ? parseFloat(formData.valor_fat_3) : null,
        data_prevista_inativacao: formData.data_prevista_inativacao || null,
        data_real_inativacao: formData.data_real_inativacao || null,
        data_prevista_ultimo_faturamento: formData.data_prevista_ultimo_faturamento || null,
        clinica_destino: formData.clinica_destino || null,
        anexo_url: anexoUrl,
        created_by: user?.id,
      };

      if (isManual) {
        payload.numero_contrato_manual = formData.numero_contrato_manual || null;
        payload.vigencia_inicio_manual = formData.vigencia_inicio_manual || null;
        payload.vigencia_fim_manual = formData.vigencia_fim_manual || null;
        payload.qtd_vidas_manual = formData.qtd_vidas_manual ? parseInt(formData.qtd_vidas_manual) : null;
        payload.valor_mensal_manual = formData.valor_mensal_manual ? parseFloat(formData.valor_mensal_manual) : null;
      }

      const { error } = await supabase.from('contract_rescisoes').insert(payload);
      if (error) throw error;

      toast.success('Rescisão registrada com sucesso');
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedContrato = contratos.find(c => c.id === contratoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Rescisão Contratual</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Empresa</Label>
            <CompanySelector
              value={companyId}
              onChange={(id) => { setCompanyId(id); setContratoId(null); }}
              disabled={!!initialCompanyId}
            />
          </div>

          <div className="space-y-2 md:col-span-2 border p-3 rounded-md bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="manual"
                checked={isManual}
                onCheckedChange={(checked) => { setIsManual(!!checked); if (checked) setContratoId(null); }}
                disabled={!!initialContratoId}
              />
              <Label htmlFor="manual" className="cursor-pointer">Contrato não está no sistema (preenchimento manual)</Label>
            </div>

            {!isManual && (
              <div className="space-y-2">
                <Label>Selecionar Contrato</Label>
                <Select value={contratoId || ''} onValueChange={setContratoId} disabled={!!initialContratoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um contrato ativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contratos.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero_contrato} ({formatDateBR(c.data_inicio)} - {formatDateBR(c.data_fim)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedContrato && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1 px-1">
                    <span>Vidas: {selectedContrato.qtd_vidas}</span>
                    <span>Valor: {formatBRL(selectedContrato.valor_mensal)}</span>
                  </div>
                )}
              </div>
            )}

            {isManual && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Número do Contrato</Label>
                  <Input
                    value={formData.numero_contrato_manual}
                    onChange={e => setFormData({ ...formData, numero_contrato_manual: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Início Vigência</Label>
                  <Input
                    type="date"
                    value={formData.vigencia_inicio_manual}
                    onChange={e => setFormData({ ...formData, vigencia_inicio_manual: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim Vigência</Label>
                  <Input
                    type="date"
                    value={formData.vigencia_fim_manual}
                    onChange={e => setFormData({ ...formData, vigencia_fim_manual: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qtd. Vidas</Label>
                  <Input
                    type="number"
                    value={formData.qtd_vidas_manual}
                    onChange={e => setFormData({ ...formData, qtd_vidas_manual: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Mensal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor_mensal_manual}
                    onChange={e => setFormData({ ...formData, valor_mensal_manual: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 border-t pt-4 mt-2">
            <h4 className="font-medium text-sm mb-3">Dados do Solicitante</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={formData.solicitante_nome}
                  onChange={e => setFormData({ ...formData, solicitante_nome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Input
                  value={formData.solicitante_cargo}
                  onChange={e => setFormData({ ...formData, solicitante_cargo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  value={formData.solicitante_whatsapp}
                  onChange={e => setFormData({ ...formData, solicitante_whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={formData.solicitante_email}
                  onChange={e => setFormData({ ...formData, solicitante_email: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Motivo e Faturamento</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Motivo Principal</Label>
                <Select value={formData.motivo} onValueChange={v => setFormData({ ...formData, motivo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Descrição do Motivo</Label>
                <Textarea
                  value={formData.motivo_descricao}
                  onChange={e => setFormData({ ...formData, motivo_descricao: e.target.value })}
                  placeholder="Detalhe os motivos da saída..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Último Faturamento (M)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_fat_1}
                  onChange={e => setFormData({ ...formData, valor_fat_1: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Penúltimo (M-1)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_fat_2}
                  onChange={e => setFormData({ ...formData, valor_fat_2: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Antepenúltimo (M-2)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_fat_3}
                  onChange={e => setFormData({ ...formData, valor_fat_3: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Clínica de Destino</Label>
                <Input
                  value={formData.clinica_destino}
                  onChange={e => setFormData({ ...formData, clinica_destino: e.target.value })}
                  placeholder="Se migrou, para qual clínica?"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <h4 className="font-medium text-sm mb-3">Prazos e Documentação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data Prevista Inativação</Label>
                <Input
                  type="date"
                  value={formData.data_prevista_inativacao}
                  onChange={e => setFormData({ ...formData, data_prevista_inativacao: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-blue-600 font-semibold">Data REAL Inativação (Confirmação)</Label>
                <Input
                  type="date"
                  value={formData.data_real_inativacao}
                  onChange={e => setFormData({ ...formData, data_real_inativacao: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground italic">Ao preencher este campo, o contrato e a rescisão serão finalizados.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Previsão Último Faturamento</Label>
                <Input
                  type="date"
                  value={formData.data_prevista_ultimo_faturamento}
                  onChange={e => setFormData({ ...formData, data_prevista_ultimo_faturamento: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Anexar Carta de Solicitação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    className="hidden"
                    id="anexo-input"
                    onChange={handleUploadAnexo}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  {!anexoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs gap-2"
                      onClick={() => document.getElementById('anexo-input')?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Escolher arquivo
                    </Button>
                  ) : (
                    <div className="flex-1 flex items-center justify-between border rounded px-2 py-1 bg-green-50">
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <FileText className="h-4 w-4" />
                        Arquivo anexado
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAnexoUrl(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || uploading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar Rescisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
