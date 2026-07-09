import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, FileWarning, TrendingDown, RefreshCw, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OSKPICard } from '@/components/os/OSKPICard';
import { useOSAlertas, AlertaTipo } from '@/hooks/useOSAlertas';

const tipoLabel: Record<AlertaTipo, string> = {
  sla: 'SLA',
  servico_parado: 'Serviço parado',
  laudo_vencendo: 'Laudo vencendo',
  orcamento_estourado: 'Orçamento estourado',
};

const tipoIcon: Record<AlertaTipo, any> = {
  sla: Clock,
  servico_parado: AlertTriangle,
  laudo_vencendo: FileWarning,
  orcamento_estourado: TrendingDown,
};

const severidadeColor: Record<string, string> = {
  atencao: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  atrasado: 'bg-red-100 text-red-700 border-red-300',
};

export function OSAlertasView() {
  const { alertas, isLoading, refetch } = useOSAlertas();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');

  const filtered = useMemo(() => alertas.filter(a => {
    if (tipoFilter !== 'all' && a.tipo !== tipoFilter) return false;
    if (sevFilter !== 'all' && a.severidade !== sevFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!a.numero_os.includes(s) && !a.empresa_cliente.toLowerCase().includes(s)
        && !a.responsavel_atual.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [alertas, search, tipoFilter, sevFilter]);

  const stats = useMemo(() => ({
    total: alertas.length,
    atrasados: alertas.filter(a => a.severidade === 'atrasado').length,
    sla: alertas.filter(a => a.tipo === 'sla').length,
    laudos: alertas.filter(a => a.tipo === 'laudo_vencendo').length,
  }), [alertas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Alertas e Notificações</h2>
          <p className="text-sm text-muted-foreground">Painel consolidado de riscos operacionais e prazos críticos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <OSKPICard title="Total de alertas" value={stats.total} subtitle="Ativos no momento" icon={AlertTriangle} variant="warning" />
        <OSKPICard title="Críticos" value={stats.atrasados} subtitle="Já atrasados" icon={AlertTriangle} variant="destructive" />
        <OSKPICard title="SLA em risco" value={stats.sla} subtitle="Prazos próximos ou vencidos" icon={Clock} />
        <OSKPICard title="Laudos vencendo" value={stats.laudos} subtitle="Em até 30 dias" icon={FileWarning} />
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar OS, cliente, responsável" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(tipoLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sevFilter} onValueChange={setSevFilter}>
            <SelectTrigger><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as severidades</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="atrasado">Crítico / Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Alertas ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum alerta ativo. 🎉</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((a, i) => {
                const Icon = tipoIcon[a.tipo];
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50">
                    <div className={`rounded-md p-2 ${a.severidade === 'atrasado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={severidadeColor[a.severidade]}>
                          {a.severidade === 'atrasado' ? 'Crítico' : 'Atenção'}
                        </Badge>
                        <Badge variant="outline">{tipoLabel[a.tipo]}</Badge>
                        <span className="font-mono text-sm">OS #{a.numero_os}</span>
                        <span className="text-sm text-muted-foreground">— {a.empresa_cliente}</span>
                      </div>
                      <p className="text-sm mt-1">{a.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Emissor da OS: {a.responsavel_atual}
                        {a.referencia_data && ` · ${format(parseISO(a.referencia_data), 'dd/MM/yyyy')}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
