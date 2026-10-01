import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Percent, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { RegraComissao, setRegrasComissao } from '@/lib/vendas/skywork';
import { auditVendas } from '@/lib/vendas/audit';

const db = supabase as any;
const pct = (n: number) => `${(Number(n) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function useComissaoRegras() {
  return useQuery({
    queryKey: ['vendas-comissao-regras'],
    queryFn: async () => {
      const { data, error } = await db.from('vendas_comissao_regras').select('*').order('vigencia_inicio', { ascending: false });
      if (error) throw error;
      const r = (data || []) as (RegraComissao & { id: string })[];
      setRegrasComissao(r);
      return r;
    },
  });
}

export function ComissaoRegrasDialog({ canApprove }: { canApprove: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: regras = [] } = useComissaoRegras();
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState('');
  const [novo, setNovo] = useState('3');
  const [renov, setRenov] = useState('1');
  const hoje = new Date().toISOString().slice(0, 10);
  const atual = regras.find(r => r.vigencia_inicio <= hoje);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['vendas-comissao-regras'] }); qc.invalidateQueries(); };

  const salvar = async () => {
    const n = Number(novo.replace(',', '.')), r = Number(renov.replace(',', '.'));
    if (!inicio || isNaN(n) || isNaN(r)) return toast({ title: 'Preencha data e percentuais', variant: 'destructive' });
    if (inicio <= hoje) return toast({ title: 'A vigência deve começar a partir de amanhã', description: 'Assim o passado não é alterado.', variant: 'destructive' });
    const { error } = await db.from('vendas_comissao_regras').insert({ vigencia_inicio: inicio, taxa_novo: n / 100, taxa_renovacao: r / 100, created_by: user?.id });
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    await auditVendas?.('comissao_regra_criada', { vigencia_inicio: inicio, taxa_novo: n, taxa_renovacao: r } as any);
    toast({ title: 'Nova regra cadastrada' });
    setInicio('');
    refresh();
  };

  const excluir = async (id: string) => {
    const { error } = await db.from('vendas_comissao_regras').delete().eq('id', id);
    if (error) return toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Percent className="h-4 w-4 mr-2" />
        Percentuais{atual ? `: Novo ${pct(atual.taxa_novo)} · Renovação ${pct(atual.taxa_renovacao)}` : ''}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Percentuais de comissão</DialogTitle>
            <DialogDescription>Cada venda usa o percentual vigente na data da venda. Mudanças valem só a partir da data escolhida.</DialogDescription>
          </DialogHeader>
          <div className="border rounded-md divide-y text-sm">
            {regras.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2">
                <span>{r.vigencia_inicio <= '2000-01-01' ? 'Desde o início' : `A partir de ${format(parseISO(r.vigencia_inicio), 'dd/MM/yyyy')}`}</span>
                <span className="whitespace-nowrap">Novo {pct(r.taxa_novo)} · Renovação {pct(r.taxa_renovacao)}</span>
                {canApprove && r.vigencia_inicio > hoje
                  ? <Button size="icon" variant="ghost" onClick={() => excluir(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  : <span className="w-9" />}
              </div>
            ))}
          </div>
          {canApprove && (
            <div className="grid grid-cols-3 gap-2 items-end">
              <label className="text-xs space-y-1">A partir de<Input type="date" min={hoje} value={inicio} onChange={e => setInicio(e.target.value)} /></label>
              <label className="text-xs space-y-1">Novo (%)<Input value={novo} onChange={e => setNovo(e.target.value)} /></label>
              <label className="text-xs space-y-1">Renovação (%)<Input value={renov} onChange={e => setRenov(e.target.value)} /></label>
              <Button className="col-span-3" onClick={salvar}>Adicionar regra</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
