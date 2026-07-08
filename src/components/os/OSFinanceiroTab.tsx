import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, TrendingUp, Save } from 'lucide-react';
import { OrdemServico } from '@/types/os';
import { useOSCustos } from '@/hooks/useOSCustos';
import { updateOSFinanceiro } from '@/hooks/useOSFinanceiro';
import { toast } from '@/hooks/use-toast';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  ordem: OrdemServico;
  canEdit: boolean;
}

export function OSFinanceiroTab({ ordem, canEdit }: Props) {
  const { totalCustos } = useOSCustos(ordem.id);
  const [receita, setReceita] = useState<string>(ordem.receita_prevista?.toString() || '');
  const [orcamento, setOrcamento] = useState<string>(ordem.orcamento_custo?.toString() || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReceita(ordem.receita_prevista?.toString() || '');
    setOrcamento(ordem.orcamento_custo?.toString() || '');
  }, [ordem.id, ordem.receita_prevista, ordem.orcamento_custo]);

  const receitaNum = Number(receita) || 0;
  const orcamentoNum = Number(orcamento) || 0;
  const margem = receitaNum - totalCustos;
  const margemPct = receitaNum > 0 ? (margem / receitaNum) * 100 : null;
  const estourado = orcamentoNum > 0 && totalCustos > orcamentoNum;

  const save = async () => {
    setSaving(true);
    try {
      await updateOSFinanceiro(ordem.id, {
        receita_prevista: receita ? Number(receita) : null,
        orcamento_custo: orcamento ? Number(orcamento) : null,
      });
      toast({ title: 'Dados financeiros atualizados' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Receita prevista</div>
          <div className="text-lg font-semibold">{brl(receitaNum)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Custo total</div>
          <div className="text-lg font-semibold">{brl(totalCustos)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Margem</div>
          <div className={`text-lg font-semibold flex items-center gap-1 ${margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {margem < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {brl(margem)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Margem %</div>
          <div className={`text-lg font-semibold ${margemPct !== null && margemPct < 0 ? 'text-red-600' : ''}`}>
            {margemPct !== null ? `${margemPct.toFixed(1)}%` : '—'}
          </div>
        </Card>
      </div>

      {estourado && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Custo total ({brl(totalCustos)}) ultrapassou o orçamento previsto ({brl(orcamentoNum)}).
        </div>
      )}
      {receitaNum > 0 && margem < 0 && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Margem negativa — o custo já supera a receita prevista.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Receita prevista (R$)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={receita}
            onChange={(e) => setReceita(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-1">
          <Label>Orçamento de custo (R$)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        A receita prevista pode vir de um contrato ou proposta vinculada. Os custos são somados automaticamente
        dos lançamentos da aba "Custos".
      </div>
    </div>
  );
}
