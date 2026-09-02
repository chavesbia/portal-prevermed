import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  contrato: any;
  onSuccess?: () => void;
}

export function ContratualLegadoEditDialog({ open, onOpenChange, contrato, onSuccess }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contrato) {
      setForm({
        numero_proposta: contrato.numero_proposta || '',
        valor_excedente: contrato.valor_excedente ?? '',
        data_inicio: contrato.data_inicio || '',
        data_fim: contrato.data_fim || '',
        qtd_vidas: contrato.qtd_vidas ?? '',
        valor_mensal: contrato.valor_mensal ?? '',
        status: contrato.status || 'ativo',
        numero_original: contrato.numero_original || '',
        indice_reajuste: contrato.indice_reajuste || '',
        multa: contrato.multa ?? '',
        juros: contrato.juros ?? '',
        prazo_aviso: contrato.prazo_aviso ?? '',
        observacoes: contrato.observacoes || '',
      });
    }
  }, [open, contrato]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const salvar = async () => {
    if (!form.numero_proposta?.trim()) return toast.error('Informe o número da proposta');
    if (!form.data_inicio || !form.data_fim) return toast.error('Informe o início e o fim da vigência');
    if (new Date(form.data_fim) < new Date(form.data_inicio)) return toast.error('A data de fim deve ser posterior à de início');
    if (!form.qtd_vidas) return toast.error('Informe a quantidade de vidas');
    if (!form.valor_mensal) return toast.error('Informe o valor mensal');

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const inicio = new Date(form.data_inicio + 'T00:00:00');
      const fim = new Date(form.data_fim + 'T00:00:00');
      const meses = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));

      const { error } = await supabase
        .from('contract_contratos')
        .update({
          numero_proposta: form.numero_proposta.trim(),
          valor_excedente: form.valor_excedente !== '' && form.valor_excedente != null ? Number(String(form.valor_excedente).replace(',', '.')) : null,
          data_inicio: form.data_inicio,
          data_fim: form.data_fim,
          vigencia_meses: meses,
          qtd_vidas: Number(form.qtd_vidas),
          valor_mensal: Number(String(form.valor_mensal).replace(',', '.')),
          status: form.status,
          numero_original: form.numero_original?.trim() || null,
          indice_reajuste: form.indice_reajuste?.trim() || null,
          multa: form.multa !== '' && form.multa != null ? Number(String(form.multa).replace(',', '.')) : null,
          juros: form.juros !== '' && form.juros != null ? Number(String(form.juros).replace(',', '.')) : null,
          prazo_aviso: form.prazo_aviso !== '' && form.prazo_aviso != null ? Number(form.prazo_aviso) : null,
          observacoes: form.observacoes?.trim() || null,
          updated_by: user?.id,
        } as any)
        .eq('id', contrato.id);
      if (error) throw error;

      await supabase.from('contract_eventos').insert({
        contrato_id: contrato.id,
        tipo: 'contrato_legado_editado',
        descricao: `Dados do contrato legado ${contrato.numero_contrato} atualizados manualmente`,
      } as any);

      toast.success('Dados atualizados');
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar dados — {contrato?.numero_contrato}</DialogTitle>
          <DialogDescription>
            Atualiza apenas os dados cadastrais do contrato legado. Nenhum PDF é gerado e nada é enviado para assinatura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Número da Proposta *</Label>
              <Input value={form.numero_proposta || ''} onChange={e => set('numero_proposta', e.target.value)} placeholder="Ex.: PROP-2026-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Início da vigência *</Label>
              <Input type="date" value={form.data_inicio || ''} onChange={e => set('data_inicio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim da vigência *</Label>
              <Input type="date" value={form.data_fim || ''} onChange={e => set('data_fim', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade de vidas *</Label>
              <Input type="number" min={0} value={form.qtd_vidas ?? ''} onChange={e => set('qtd_vidas', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor mensal (R$) *</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_mensal ?? ''} onChange={e => set('valor_mensal', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vida excedente (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_excedente ?? ''} onChange={e => set('valor_excedente', e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Número original do contrato</Label>
              <Input value={form.numero_original || ''} onChange={e => set('numero_original', e.target.value)} placeholder="Ex.: 2019/045" />
            </div>
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground">Campos opcionais — apenas referência, sem cálculo automático.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Índice de reajuste</Label>
              <Input value={form.indice_reajuste || ''} onChange={e => set('indice_reajuste', e.target.value)} placeholder="Ex.: IPCA" />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo de aviso prévio (dias)</Label>
              <Input type="number" min={0} value={form.prazo_aviso ?? ''} onChange={e => set('prazo_aviso', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Multa (%)</Label>
              <Input type="number" min={0} step="0.01" value={form.multa ?? ''} onChange={e => set('multa', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Juros (%)</Label>
              <Input type="number" min={0} step="0.01" value={form.juros ?? ''} onChange={e => set('juros', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações / Cláusulas especiais</Label>
            <Textarea rows={3} value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
