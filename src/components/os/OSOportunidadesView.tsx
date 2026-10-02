import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const CHECKLIST_CATEGORIAS = [
  'Laudos / Programas',
  'Treinamentos NR',
  'Medições ambientais',
  'Ergonomia',
  'EPIs / EPCs',
  'Exames / PCMSO',
  'Outros',
];

export interface OSChecklist {
  id: string;
  visita_id: string;
  ordem_id: string | null;
  numero_os: string | null;
  empresa_cliente: string;
  categorias: string[];
  oportunidades: string | null;
  observacao: string | null;
  created_by_nome: string | null;
  created_at: string;
}

export function useOSChecklists() {
  return useQuery({
    queryKey: ['os-visita-checklist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_visita_checklist')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OSChecklist[];
    },
  });
}

export function ChecklistResumo({ c }: { c: OSChecklist }) {
  return (
    <div className="space-y-2 text-sm">
      {c.categorias.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.categorias.map(cat => <Badge key={cat} className="whitespace-nowrap">{cat}</Badge>)}
        </div>
      )}
      {c.oportunidades && <div><span className="text-muted-foreground">Oportunidades: </span>{c.oportunidades}</div>}
      {c.observacao && <div><span className="text-muted-foreground">Observado na visita: </span>{c.observacao}</div>}
      <div className="text-xs text-muted-foreground">
        {c.created_by_nome || '—'} · {format(parseISO(c.created_at), 'dd/MM/yyyy HH:mm')}
      </div>
    </div>
  );
}

export function OSOportunidadesView() {
  const { data = [], isLoading } = useOSChecklists();
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data
      .filter(c => c.categorias.length > 0 || (c.oportunidades || '').trim())
      .filter(c => !q || [c.empresa_cliente, c.numero_os, c.oportunidades, c.observacao, c.categorias.join(' ')]
        .some(v => (v || '').toLowerCase().includes(q)));
  }, [data, busca]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle>Oportunidades das visitas técnicas</CardTitle>
        <Input className="max-w-xs" placeholder="Buscar empresa, OS, item..." value={busca} onChange={e => setBusca(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <div className="py-8 text-center text-muted-foreground">Carregando…</div>
          : lista.length === 0 ? <div className="py-8 text-center text-muted-foreground">Nenhuma oportunidade registrada.</div>
          : lista.map(c => (
            <div key={c.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.empresa_cliente}</span>
                {c.numero_os && <Badge variant="outline" className="font-mono whitespace-nowrap">OS #{c.numero_os}</Badge>}
              </div>
              <ChecklistResumo c={c} />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
