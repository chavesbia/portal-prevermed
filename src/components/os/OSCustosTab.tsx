import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrdemServico } from '@/types/os';
import { useOSCustos } from '@/hooks/useOSCustos';
import { OSCustoTipo, OS_CUSTO_TIPO_LABEL, OS_CUSTO_TIPO_OPTIONS } from '@/types/osCustos';

const currency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  ordem: OrdemServico;
  canEdit: boolean;
}

export function OSCustosTab({ ordem, canEdit }: Props) {
  const { custos, isLoading, addCusto, deleteCusto, totalCustos } = useOSCustos(ordem.id);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'outros' as OSCustoTipo,
    descricao: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    fornecedor: '',
    servico_os_id: '' as string,
    observacoes: '',
  });

  const reset = () => setForm({
    tipo: 'outros', descricao: '', valor: '',
    data: format(new Date(), 'yyyy-MM-dd'), fornecedor: '',
    servico_os_id: '', observacoes: '',
  });

  const submit = async () => {
    if (!form.descricao.trim() || !form.valor) return;
    setSaving(true);
    const ok = await addCusto({
      ordem_id: ordem.id,
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: Number(form.valor.replace(',', '.')) || 0,
      data: form.data,
      fornecedor: form.fornecedor || null,
      servico_os_id: form.servico_os_id || null,
      observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (ok) { reset(); setShowForm(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Custos da OS</h4>
          <p className="text-xs text-muted-foreground">Lançamentos financeiros vinculados a esta ordem</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-primary">{currency(totalCustos)}</p>
          </div>
          {canEdit && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo custo
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v as OSCustoTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OS_CUSTO_TIPO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Pagamento profissional externo - Dr. Silva" />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={(e) => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            {ordem.servicos && ordem.servicos.length > 0 && (
              <div className="space-y-1 col-span-2">
                <Label>Serviço vinculado (opcional)</Label>
                <Select value={form.servico_os_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, servico_os_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Custo geral da OS —</SelectItem>
                    {ordem.servicos.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.tipo} ({s.tipo_os})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); setShowForm(false); }}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={saving || !form.descricao || !form.valor}>
              {saving ? 'Salvando...' : 'Lançar custo'}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
      ) : custos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          Nenhum custo lançado nesta OS.
        </div>
      ) : (
        <div className="space-y-2">
          {custos.map(c => {
            const servico = ordem.servicos?.find(s => s.id === c.servico_os_id);
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline">{OS_CUSTO_TIPO_LABEL[c.tipo]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(c.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      {servico && <Badge variant="secondary" className="text-xs">{servico.tipo}</Badge>}
                    </div>
                    <p className="font-medium text-sm">{c.descricao}</p>
                    {c.fornecedor && <p className="text-xs text-muted-foreground">Fornecedor: {c.fornecedor}</p>}
                    {c.observacoes && <p className="text-xs text-muted-foreground mt-1">{c.observacoes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{currency(Number(c.valor))}</p>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 mt-1 text-destructive"
                        onClick={() => { if (confirm('Remover este custo?')) deleteCusto(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
