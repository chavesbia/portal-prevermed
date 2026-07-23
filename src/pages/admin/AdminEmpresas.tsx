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
import { Loader2, RefreshCw, Building2, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Company = {
  id: string;
  soc_code: string | null;
  cnpj: string | null;
  nome_abreviado: string | null;
  razao_social: string | null;
  cidade: string | null;
  estado: string | null;
  is_active: boolean | null;
  synced_at: string | null;
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const fmtCnpj = (c: string | null) => {
  const d = onlyDigits(c || "");
  if (d.length !== 14) return c || "—";
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};

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

  // Companies list
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, soc_code, cnpj, nome_abreviado, razao_social, cidade, estado, is_active, synced_at")
      .order("razao_social", { ascending: true })
      .limit(5000);
    if (error) toast.error("Erro ao carregar empresas: " + error.message);
    else setCompanies((data as Company[]) || []);
    setLoadingCompanies(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const ufOptions = Array.from(new Set(companies.map((c) => c.estado).filter(Boolean))).sort() as string[];

  const filtered = companies.filter((c) => {
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    if (ufFilter !== "all" && c.estado !== ufFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const qDigits = onlyDigits(q);
      const hay = [
        c.razao_social, c.nome_abreviado, c.soc_code, c.cidade,
      ].map((v) => (v || "").toLowerCase()).join(" ");
      const cnpjDigits = onlyDigits(c.cnpj || "");
      if (!hay.includes(q) && !(qDigits && cnpjDigits.includes(qDigits))) return false;
    }
    return true;
  });

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
      await Promise.all([loadLogs(), loadCompanies()]);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar");
      await loadLogs();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
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
