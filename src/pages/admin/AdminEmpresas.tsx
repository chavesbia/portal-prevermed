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
import { Loader2, RefreshCw, Building2, ChevronDown, Search, AlertTriangle, Network } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

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
  pessoa_fisica_sem_cnpj: "Sem CNPJ",
};

// Todas as pendências passam a ser tratadas como informativas (amarelo),
// pois representam registros do SOC sem CNPJ que não bloqueiam a operação.
const INFO_REASONS = new Set([
  "pessoa_fisica_sem_cnpj",
  "sem_cnpj",
  "socnet_sem_cnpj",
  "sem_codigo",
]);



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
  const { isAdmMaster } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [socnetEnabled, setSocnetEnabled] = useState(false);
  const [savingSocnet, setSavingSocnet] = useState(false);

  const loadSocnetFlag = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "socnet_sync_enabled")
      .maybeSingle();
    const v = data?.value;
    setSocnetEnabled(v === true || String(v ?? "").toLowerCase() === "true");
  }, []);

  const toggleSocnet = async (next: boolean) => {
    setSavingSocnet(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "socnet_sync_enabled", value: next as any, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSavingSocnet(false);
    if (error) {
      toast.error("Não foi possível atualizar: " + error.message);
      return;
    }
    setSocnetEnabled(next);
    toast.success(next ? "Sincronização SOCNET ativada" : "Sincronização SOCNET desativada");
  };

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

  useEffect(() => { loadLogs(); loadSocnetFlag(); }, [loadLogs, loadSocnetFlag]);


  // Companies list
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [search, setSearch] = useState("");
  const [ufFilter, setUfFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

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
        {
          const p = data.principal ?? {};
          const sn = data.socnet ?? {};
          const totalIns = (p.inserted ?? data.inserted ?? 0) + (sn.inserted ?? 0);
          const totalUpd = (p.updated ?? data.updated ?? 0) + (sn.updated ?? 0);
          toast.success(
            `Sync concluído: ${totalIns} inseridas, ${totalUpd} atualizadas` +
            (sn.total !== undefined ? ` (SOCNET: ${sn.inserted ?? 0} novas, ${sn.updated ?? 0} atualizadas de ${sn.total})` : '')
          );
        }
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

      {isAdmMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Sincronização de Parceiros SOCNET
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="socnet-toggle" className="text-sm font-medium">
                {socnetEnabled ? "Ativada" : "Desativada"}
              </Label>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Quando ativada, a próxima sincronização também trará empresas parceiras da rede SOCNET
                (marcadas com <code>is_socnet = true</code>). Mantenha desativada para focar apenas nos
                clientes diretos da PreverMed. Somente ADM Master pode alterar esta configuração.
              </p>
            </div>
            <Switch
              id="socnet-toggle"
              checked={socnetEnabled}
              disabled={savingSocnet}
              onCheckedChange={toggleSocnet}
            />
          </CardContent>
        </Card>
      )}



      {(() => {
        const lastWithSkipped = logs.find((l) => Array.isArray(l.skipped) && l.skipped.length > 0);
        if (!lastWithSkipped) return null;
        const list = (lastWithSkipped.skipped as SkippedRow[]) || [];
        const grouped = list.reduce<Record<string, SkippedRow[]>>((acc, r) => {
          let k = r.reason || "outro";
          if (k === "pessoa_fisica_sem_cnpj" || k === "socnet_sem_cnpj") k = "sem_cnpj";
          (acc[k] ||= []).push(r);
          return acc;
        }, {});
        const errorCount = list.filter((r) => !INFO_REASONS.has(r.reason || "")).length;
        const infoCount = list.length - errorCount;
        const cardTone = errorCount > 0 ? "border-destructive/50 bg-destructive/5" : "border-amber-500/50 bg-amber-500/5";
        const titleTone = errorCount > 0 ? "text-destructive" : "text-amber-700 dark:text-amber-500";
        return (
          <Card className={cardTone}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${titleTone}`}>
                <AlertTriangle className="h-5 w-5" />
                Empresas Não Sincronizadas
                <span className="text-sm font-normal">
                  ({lastWithSkipped.skipped_count ?? list.length}
                  {infoCount > 0 && errorCount > 0 ? ` — ${errorCount} alerta(s), ${infoCount} informativo(s)` : ""})
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Registros presentes no retorno do SOC porém sem CNPJ. Itens em amarelo são
                informativos (ex.: clientes Pessoa Física, sem CNPJ aplicável). Itens em
                vermelho indicam dados a corrigir no próprio SOC.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(grouped).map(([reason, rows]) => {
                const isInfo = INFO_REASONS.has(reason);
                return (
                <div key={reason} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isInfo ? "outline" : "destructive"}
                      className={isInfo ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400" : ""}
                    >
                      {REASON_LABEL[reason] || reason}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{rows.length} registro(s)</span>
                  </div>
                  <div className="border rounded-md max-h-64 overflow-auto bg-background">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-24">Cód. SOC</TableHead>
                          <TableHead>Razão Social</TableHead>
                          <TableHead className="w-44">CNPJ</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 200).map((r, i) => (
                          <TableRow key={`${reason}-${i}`}>
                            <TableCell className="font-mono text-xs">{r.soc_code || "—"}</TableCell>
                            <TableCell className="text-sm">{r.razao_social || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.cnpj || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.motivo || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {rows.length > 200 && (
                      <p className="text-xs text-muted-foreground p-2 text-center border-t">
                        Mostrando 200 de {rows.length}.
                      </p>
                    )}
                  </div>
                </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}


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
                  {filtered.map((c) => (
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
              <p className="text-xs text-muted-foreground p-2 text-center border-t">
                {filtered.length.toLocaleString("pt-BR")} empresa(s) listada(s).
              </p>

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
