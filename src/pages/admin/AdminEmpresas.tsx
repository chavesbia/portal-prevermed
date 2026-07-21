import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, RefreshCw, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type SyncLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  total: number;
  inserted: number;
  updated: number;
  error_count: number;
  status: string;
  error_message: string | null;
  errors: any;
  triggered_by: string | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "success") return "default";
  if (s === "partial") return "secondary";
  if (s === "running") return "outline";
  return "destructive";
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }) : "—";

const duration = (a: string, b: string | null) => {
  if (!b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
};

export default function AdminEmpresas() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("companies_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar histórico: " + error.message);
    else setLogs((data as SyncLog[]) || []);
    setLoadingLogs(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const sync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("soc-empresas-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Sync concluído: ${data.inserted} inseridas, ${data.updated} atualizadas`);
      } else {
        toast.error(data?.error || "Falha na sincronização");
      }
      await loadLogs();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar");
      await loadLogs();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Base Mestre de Empresas (SOC)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sincronização com SOC</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={sync} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar com SOC
          </Button>
          <Button variant="outline" onClick={loadLogs} disabled={loadingLogs}>
            {loadingLogs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Atualizar histórico
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de sincronizações</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && !loadingLogs ? (
            <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Inseridas</TableHead>
                  <TableHead className="text-right">Atualizadas</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => {
                  const open = openId === l.id;
                  const hasDetails = !!l.error_message || (Array.isArray(l.errors) && l.errors.length > 0);
                  return (
                    <>
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{fmtDate(l.started_at)}</TableCell>
                        <TableCell className="text-xs">{duration(l.started_at, l.finished_at)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{l.total}</TableCell>
                        <TableCell className="text-right text-green-600">{l.inserted}</TableCell>
                        <TableCell className="text-right text-blue-600">{l.updated}</TableCell>
                        <TableCell className="text-right text-destructive">{l.error_count}</TableCell>
                        <TableCell>
                          {hasDetails && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenId(open ? null : l.id)}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {open && hasDetails && (
                        <TableRow key={`${l.id}-details`}>
                          <TableCell colSpan={8} className="bg-muted/30">
                            {l.error_message && (
                              <p className="text-sm text-destructive mb-2">{l.error_message}</p>
                            )}
                            {Array.isArray(l.errors) && l.errors.length > 0 && (
                              <pre className="text-xs bg-background p-3 rounded max-h-64 overflow-auto">
                                {JSON.stringify(l.errors, null, 2)}
                              </pre>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
