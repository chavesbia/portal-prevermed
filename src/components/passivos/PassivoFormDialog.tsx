import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpsertPassivo, type Passivo } from '@/hooks/usePassivos';
import { STATUS_LABELS, TIPOS_PARCELAMENTO, onlyDigits, type PassivoStatus } from '@/lib/passivos/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Passivo | null;
}

export function PassivoFormDialog({ open, onOpenChange, initial }: Props) {
  const { toast } = useToast();
  const upsert = useUpsertPassivo();
  const [form, setForm] = useState<Partial<Passivo>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ?? {
        status: 'em_dia', parcelas_pagas: 0, parcelas_totais: 1, parcelas_em_atraso: 0, valor_mensal: 0,
      });
    }
  }, [open, initial]);

  const setF = (k: keyof Passivo, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    try {
      if (!form.cnpj || !form.empresa_nome || !form.numero_acordo || !form.tipo_parcelamento) {
        toast({ title: 'Campos obrigatórios', description: 'CNPJ, Empresa, Nº do acordo e Tipo são obrigatórios.', variant: 'destructive' });
        return;
      }
      await upsert.mutateAsync({ ...form, id: initial?.id, cnpj: onlyDigits(form.cnpj!) });
      toast({ title: initial ? 'Parcelamento atualizado' : 'Parcelamento criado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar parcelamento' : 'Novo parcelamento'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label>CNPJ *</Label>
            <Input value={form.cnpj ?? ''} onChange={e => setF('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="col-span-1">
            <Label>Empresa *</Label>
            <Input value={form.empresa_nome ?? ''} onChange={e => setF('empresa_nome', e.target.value)} />
          </div>
          <div>
            <Label>Nº do acordo *</Label>
            <Input value={form.numero_acordo ?? ''} onChange={e => setF('numero_acordo', e.target.value)} />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo_parcelamento ?? ''} onValueChange={v => setF('tipo_parcelamento', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_PARCELAMENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Parcelas pagas</Label>
            <Input type="number" min={0} value={form.parcelas_pagas ?? 0} onChange={e => setF('parcelas_pagas', parseInt(e.target.value || '0'))} />
          </div>
          <div>
            <Label>Parcelas totais</Label>
            <Input type="number" min={1} value={form.parcelas_totais ?? 1} onChange={e => setF('parcelas_totais', parseInt(e.target.value || '1'))} />
          </div>
          <div>
            <Label>Valor mensal (R$)</Label>
            <Input type="number" step="0.01" min={0} value={form.valor_mensal ?? 0} onChange={e => setF('valor_mensal', parseFloat(e.target.value || '0'))} />
          </div>
          <div>
            <Label>Dia do vencimento</Label>
            <Input type="number" min={1} max={31} value={form.dia_vencimento ?? ''} onChange={e => setF('dia_vencimento', e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? 'em_dia'} onValueChange={v => setF('status', v as PassivoStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Parcelas em atraso</Label>
            <Input type="number" min={0} value={form.parcelas_em_atraso ?? 0} onChange={e => setF('parcelas_em_atraso', parseInt(e.target.value || '0'))} />
          </div>
          <div className="col-span-2">
            <Label>Link de acesso</Label>
            <Input value={form.link_acesso ?? ''} onChange={e => setF('link_acesso', e.target.value)} placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <Label>Link da 2ª via</Label>
            <Input value={form.link_segunda_via ?? ''} onChange={e => setF('link_segunda_via', e.target.value)} placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes ?? ''} onChange={e => setF('observacoes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsert.isPending}>{upsert.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
