import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2, CheckCircle2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OSRow {
  id: string;
  numero_os: string;
  empresa_cliente: string | null;
  data_emissao: string | null;
  data_registro: string | null;
  status_os: string | null;
}

function formatDate(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function AdminOSSemEmpresa() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [picks, setPicks] = useState<Record<string, string | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-os-sem-empresa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, numero_os, empresa_cliente, data_emissao, data_registro, status_os')
        .is('company_id', null)
        .order('data_emissao', { ascending: false, nullsFirst: false })
        .order('data_registro', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OSRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.numero_os || '').toLowerCase().includes(q) ||
        (r.empresa_cliente || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleSave = async (os: OSRow) => {
    const companyId = picks[os.id];
    if (!companyId) return;
    setSavingId(os.id);
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ company_id: companyId })
        .eq('id', os.id);
      if (error) throw error;

      // Propaga para os laudos daquela OS que ainda estão sem empresa
      const { error: laudoError } = await supabase
        .from('laudos')
        .update({ company_id: companyId })
        .eq('ordem_id', os.id)
        .is('company_id', null);
      if (laudoError) throw laudoError;

      toast.success(`OS ${os.numero_os} vinculada à empresa.`);
      setPicks((p) => {
        const next = { ...p };
        delete next[os.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-os-sem-empresa'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível vincular a empresa.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OS sem empresa vinculada</h1>
        <p className="text-muted-foreground">
          Ordens de Serviço antigas cadastradas com o nome digitado à mão. Ao vincular a empresa,
          a OS e seus laudos passam a aparecer no Painel do Cliente.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Pendentes de vínculo
              {!isLoading && <Badge variant="outline">{rows.length}</Badge>}
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nº da OS ou empresa…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              {rows.length === 0
                ? 'Todas as Ordens de Serviço estão vinculadas a uma empresa.'
                : 'Nenhuma OS encontrada para esta busca.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((os) => (
                <div key={os.id} className="rounded-md border p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">OS {os.numero_os}</span>
                    {os.status_os && (
                      <Badge variant="outline" className="text-xs">{os.status_os}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Emissão: {formatDate(os.data_emissao ?? os.data_registro)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground break-words">
                    Nome digitado: <span className="text-foreground">{os.empresa_cliente || '—'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                    <div className="flex-1 min-w-0">
                      <CompanySelector
                        value={picks[os.id] ?? null}
                        onChange={(companyId) =>
                          setPicks((p) => ({ ...p, [os.id]: companyId }))
                        }
                        legacyLabel={os.empresa_cliente}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(os)}
                      disabled={!picks[os.id] || savingId === os.id}
                      className="sm:w-32"
                    >
                      {savingId === os.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Vincular'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
