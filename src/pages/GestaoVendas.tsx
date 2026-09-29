import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useVendas, Venda } from '@/hooks/useVendas';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { VendasDashboard } from '@/components/vendas/VendasDashboard';
import { VendasList } from '@/components/vendas/VendasList';
import { VendasComissoes } from '@/components/vendas/VendasComissoes';
import { VendasImportacao } from '@/components/vendas/VendasImportacao';
import { VENDEDOR_FATURAMENTO } from '@/lib/vendas/skywork';

export const SEM_VENDEDOR = '__sem__';

const mesAtual = () => new Date().toISOString().slice(0, 7);
const nomeMes = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  const s = new Date(y, mm - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function GestaoVendas() {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useModulePermissions();
  const canEdit = hasPermission('/gestao-vendas', 'edit');
  const canApprove = hasPermission('/gestao-vendas', 'approve' as any);
  const { data: todas = [], isLoading } = useVendas();
  // Vendedor Faturamento e vendas sem vendedor são 100% desconsiderados no módulo
  const vendas = useMemo(() => todas.filter(v => !!v.vendedor && v.vendedor !== VENDEDOR_FATURAMENTO), [todas]);

  const tab = params.get('tab') || 'dashboard';
  const mes = params.get('mes') || mesAtual();
  const emitente = params.get('emitente') || 'all';
  const vendedor = params.get('vendedor') || 'all';
  const q = params.get('q') || '';

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (!v || v === 'all') p.delete(k); else p.set(k, v);
    if (k !== 'page') p.delete('page');
    setParams(p, { replace: true });
  };

  const meses = useMemo(() => {
    const s = new Set(vendas.map(v => v.data_venda?.slice(0, 7)).filter(Boolean) as string[]);
    s.add(mesAtual());
    return Array.from(s).sort().reverse();
  }, [vendas]);
  const emitentes = useMemo(() => {
    const m = new Map<string, string>();
    vendas.forEach(v => m.set(v.emitente_cnpj, v.emitente_nome || v.emitente_cnpj));
    return Array.from(m.entries());
  }, [vendas]);
  const vendedores = useMemo(() =>
    Array.from(new Set(vendas.map(v => v.vendedor).filter(Boolean) as string[])).sort(), [vendas]);

  const filtradas: Venda[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    return vendas.filter(v => {
      if (mes !== 'todos' && v.data_venda?.slice(0, 7) !== mes) return false;
      if (emitente !== 'all' && v.emitente_cnpj !== emitente) return false;
      if (vendedor === SEM_VENDEDOR ? !!v.vendedor : vendedor !== 'all' && !(v.vendedores || []).includes(vendedor)) return false;
      if (s && !`${v.numero_venda} ${v.cliente_nome} ${v.cliente_cnpj} ${v.fatura} ${v.nfse}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [vendas, mes, emitente, vendedor, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Vendas</h1>
        <p className="text-muted-foreground">Vendas do Skywork, vendedores e fechamento de comissões</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={mes} onValueChange={v => setParam('mes', v)}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo o período</SelectItem>
            {meses.map(m => <SelectItem key={m} value={m}>{nomeMes(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={emitente} onValueChange={v => setParam('emitente', v)}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Emitente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os CNPJs emitentes</SelectItem>
            {emitentes.map(([c, n]) => <SelectItem key={c} value={c}>{c} — {n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vendedor} onValueChange={v => setParam('vendedor', v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            <SelectItem value={SEM_VENDEDOR}>Sem vendedor</SelectItem>
            {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-[260px]" placeholder="Buscar venda, cliente, fatura, NFS-e" value={q} onChange={e => setParam('q', e.target.value)} />
      </div>

      <Tabs value={tab} onValueChange={v => setParam('tab', v)}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          {canEdit && <TabsTrigger value="importacao">Importação</TabsTrigger>}
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <TabsContent value="dashboard" className="mt-6"><VendasDashboard vendas={filtradas} historico={vendas} /></TabsContent>
            <TabsContent value="vendas" className="mt-6">
              <VendasList vendas={filtradas} situacao={params.get('situacao') || 'Concluído'} onSituacao={v => setParam('situacao', v)} page={Number(params.get('page') || 1)} onPage={p => setParam('page', String(p))} />
            </TabsContent>
            <TabsContent value="comissoes" className="mt-6"><VendasComissoes vendas={filtradas} canEdit={canEdit} canApprove={canApprove} /></TabsContent>
            {canEdit && <TabsContent value="importacao" className="mt-6"><VendasImportacao /></TabsContent>}
          </>
        )}
      </Tabs>
    </div>
  );
}
