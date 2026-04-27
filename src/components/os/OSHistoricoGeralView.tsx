import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Search } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import { supabase } from '@/integrations/supabase/client';
import { OrdemServico, HistoricoOS, statusOSColors } from '@/types/os';

interface OSHistoricoGeralViewProps {
  ordens: OrdemServico[];
}

export function OSHistoricoGeralView({ ordens }: OSHistoricoGeralViewProps) {
  const [historico, setHistorico] = useState<HistoricoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    supabase
      .from('historico_os')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setHistorico((data || []) as HistoricoOS[]);
        setLoading(false);
      });
  }, []);

  const ordensMap = useMemo(() => {
    const m = new Map<string, OrdemServico>();
    ordens.forEach(o => m.set(o.id, o));
    return m;
  }, [ordens]);

  const filtered = historico.filter(h => {
    if (!search) return true;
    const s = search.toLowerCase();
    const ordem = ordensMap.get(h.ordem_id);
    return (
      (h.user_name || '').toLowerCase().includes(s) ||
      h.acao.toLowerCase().includes(s) ||
      (ordem?.numero_os || '').toLowerCase().includes(s) ||
      (ordem?.empresa_cliente || '').toLowerCase().includes(s)
    );
  });

  const getInitials = (name?: string | null) =>
    (name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Histórico de Movimentações</h2>
        <p className="text-sm text-muted-foreground">Linha do tempo consolidada de todas as OS.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por OS, cliente, usuário ou ação" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Movimentações ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(h => {
                const ordem = ordensMap.get(h.ordem_id);
                return (
                  <div key={h.id} className="flex gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(h.user_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      {ordem && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">OS #{ordem.numero_os}</Badge>
                          <span className="text-sm text-muted-foreground">{ordem.empresa_cliente}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{h.user_name || 'Sistema'}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <p className="font-medium text-sm">{h.acao}</p>
                      {h.comentario && <p className="text-sm text-muted-foreground">{h.comentario}</p>}
                      {h.status_anterior && h.status_novo && h.status_anterior !== h.status_novo && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge className={`text-xs ${statusOSColors[h.status_anterior] || 'bg-muted'}`}>{h.status_anterior}</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge className={`text-xs ${statusOSColors[h.status_novo] || 'bg-muted'}`}>{h.status_novo}</Badge>
                        </div>
                      )}
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
