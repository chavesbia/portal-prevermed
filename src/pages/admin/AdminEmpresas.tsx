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
import { Loader2, RefreshCw, Building2, ChevronDown, Search, AlertTriangle } from "lucide-react";
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
  skipped: any;
  skipped_count: number;
  triggered_by: string | null;
};

type SkippedRow = {
  reason?: string;
  motivo?: string;
  soc_code?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
};

const REASON_LABEL: Record<string, string> = {
  socnet_sem_cnpj: "Parceiro SOCNET sem CNPJ",
  sem_cnpj: "Sem CNPJ",
  sem_codigo: "Sem código SOC",
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              Empresas sincronizadas{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({filtered.length}
                {filtered.length !== companies.length ? ` de ${companies.length}` : ""})
              </span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadCompanies} disabled={loadingCompanies}>
              {loadingCompanies ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Recarregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social, nome, CNPJ, código SOC ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas UFs</SelectItem>
                {ufOptions.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingCompanies ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma empresa encontrada.</p>
          ) : (
            <div className="border rounded-md max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-24">Cód. SOC</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-44">CNPJ</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="w-14">UF</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 1000).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.soc_code || "—"}</TableCell>
                      <TableCell className="font-medium">{c.razao_social || "—"}</TableCell>
                      <TableCell className="text-sm">{c.nome_abreviado || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtCnpj(c.cnpj)}</TableCell>
                      <TableCell className="text-sm">{c.cidade || "—"}</TableCell>
                      <TableCell className="text-sm">{c.estado || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "secondary"}>
                          {c.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 1000 && (
                <p className="text-xs text-muted-foreground p-2 text-center border-t">
                  Mostrando 1000 de {filtered.length} resultados. Refine a busca para ver mais.
                </p>
              )}
            </div>
          )}
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
