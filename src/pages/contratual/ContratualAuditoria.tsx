import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity } from 'lucide-react';
import { formatDateBR } from '@/lib/contractual/format';
import { toast } from 'sonner';

const TIPO_TONE: Record<string, string> = {
  contrato_criado: 'bg-blue-100 text-blue-800',
  contrato_editado: 'bg-amber-100 text-amber-800',
  pdf_gerado: 'bg-slate-100 text-slate-700',
  autentique_enviado: 'bg-indigo-100 text-indigo-800',
  vigencia_atualizada: 'bg-orange-100 text-orange-800',
};

function tipoTone(t: string) {
  if (TIPO_TONE[t]) return TIPO_TONE[t];
  if (t.includes('assin')) return 'bg-emerald-100 text-emerald-800';
  if (t.includes('venc') || t.includes('reject')) return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export default function ContratualAuditoria() {
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState(false);

  const { data: eventos = [], isLoading, refetch } = useQuery({
    queryKey: ['contract-eventos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_eventos')
        .select('id, tipo, descricao, created_at, contrato_id, performed_by, contrato:contract_contratos(numero_contrato, cliente:contract_clientes(razao_social))')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = eventos.filter((e: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.tipo?.toLowerCase().includes(s) ||
      e.descricao?.toLowerCase().includes(s) ||
      e.contrato?.numero_contrato?.toLowerCase().includes(s) ||
      e.contrato?.cliente?.razao_social?.toLowerCase().includes(s)
    );
  });

  async function rodarRecalculo() {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('contract_recalc_vigencia');
      if (error) throw error;
      toast.success(`Recálculo executado: ${(data as any)?.contratos_atualizados ?? 0} contratos atualizados`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Falha ao executar recálculo');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar por evento, descrição, contrato ou empresa…"
          className="max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={rodarRecalculo} disabled={running} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          Rodar recálculo agora
        </Button>
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Cron diário: 06:00 BRT
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Data/Hora</TableHead>
                  <TableHead className="w-44">Evento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum evento encontrado.</TableCell></TableRow>
                )}
                {filtered.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDateBR(e.created_at)} {new Date(e.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={tipoTone(e.tipo)}>{e.tipo}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.contrato?.numero_contrato || '—'}</TableCell>
                    <TableCell className="text-sm">{e.contrato?.cliente?.razao_social || '—'}</TableCell>
                    <TableCell className="text-sm">{e.descricao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
