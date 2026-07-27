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
import { Loader2, RefreshCw, Building2, ChevronDown, AlertTriangle, Network } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";



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
  sync_type: string | null;
};

type SkippedRow = {
  reason?: string;
  motivo?: string;
  soc_code?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
};

const SYNC_TYPE_LABEL: Record<string, string> = {
  empresas: "Empresas",
  unidades: "Unidades",
  contatos: "Contatos",
  preco: "Preço",
  responsaveis_pcmso: "Responsáveis PCMSO",
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
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "medium",
      })
    : "—";

const duration = (a: string, b: string | null) => {
  if (!b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
};

type SyncItem = {
  key: string;
  name: string;
  description: string;
  lastRun: string | null;
  loading: boolean;
  run: () => void | Promise<void>;
};

function SyncList({
  items, onRefresh, refreshing,
}: { items: SyncItem[]; onRefresh: () => void; refreshing: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sincronizações com SOC</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{it.name}</p>
                <p className="text-xs text-muted-foreground">{it.description}</p>
              </div>
              <div className="text-xs text-muted-foreground w-56 text-right">
                Última execução: <span className="font-medium text-foreground">{fmtDate(it.lastRun)}</span>
              </div>
              <Button size="sm" onClick={() => it.run()} disabled={it.loading}>
                {it.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sincronizar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminEmpresas() {
  const { isAdmMaster } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [socnetEnabled, setSocnetEnabled] = useState(false);
  const [savingSocnet, setSavingSocnet] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [lastUnitSync, setLastUnitSync] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [lastContactSync, setLastContactSync] = useState<string | null>(null);
  const [loadingPreco, setLoadingPreco] = useState(false);
  const [lastPrecoSync, setLastPrecoSync] = useState<string | null>(null);
  const [loadingPcmso, setLoadingPcmso] = useState(false);
  const [lastPcmsoSync, setLastPcmsoSync] = useState<string | null>(null);

  const loadLastPcmsoSync = useCallback(async () => {
    const { data } = await supabase
      .from("company_responsaveis_pcmso")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastPcmsoSync((data as any)?.synced_at ?? null);
  }, []);

  const syncPcmso = async () => {
    setLoadingPcmso(true);
    try {
      const { data, error } = await supabase.functions.invoke("soc-responsaveis-pcmso-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success(
          `Responsáveis PCMSO sincronizados: ${data.inserted ?? 0} registros gravados` +
          (data.skipped_count ? ` (${data.skipped_count} pulados — empresa não encontrada)` : "")
        );
      } else {
        toast.error(data?.error || "Falha na sincronização de responsáveis PCMSO");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar responsáveis PCMSO");
    } finally {
      setLoadingPcmso(false);
      loadLastPcmsoSync();
      loadLogs();
    }
  };


  const loadLastPrecoSync = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("preco_synced_at")
      .not("preco_synced_at", "is", null)
      .order("preco_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastPrecoSync((data as any)?.preco_synced_at ?? null);
  }, []);

  const syncPreco = async () => {
    setLoadingPreco(true);
    try {
      const { data, error } = await supabase.functions.invoke("soc-preco-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success(
          `Preço sincronizado: ${data.updated ?? 0} empresas atualizadas, ${data.pricing_items_upserted ?? 0} itens de preço gravados` +
          (data.skipped_count ? ` (${data.skipped_count} puladas — empresa não encontrada)` : "")
        );
      } else {
        toast.error(data?.error || "Falha na sincronização de preço");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar preço");
    } finally {
      setLoadingPreco(false);
      loadLastPrecoSync();
    }
  };


  const loadLastUnitSync = useCallback(async () => {
    const { data } = await supabase
      .from("company_units")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastUnitSync(data?.synced_at ?? null);
  }, []);

  const loadLastContactSync = useCallback(async () => {
    const { data } = await supabase
      .from("company_contacts")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastContactSync(data?.synced_at ?? null);
  }, []);

  const syncUnits = async () => {
    setLoadingUnits(true);
    try {
      const { data, error } = await supabase.functions.invoke("soc-unidades-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success(
          `Unidades sincronizadas: ${data.inserted ?? 0} inseridas, ${data.updated ?? 0} atualizadas` +
          (data.skipped_count ? ` (${data.skipped_count} puladas — empresa não encontrada)` : "")
        );
      } else {
        toast.error(data?.error || "Falha na sincronização de unidades");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar unidades");
    } finally {
      setLoadingUnits(false);
      loadLastUnitSync();
    }
  };

  const syncContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase.functions.invoke("soc-contatos-sync");
      if (error) throw error;
      if (data?.ok) {
        toast.success(
          `Contatos sincronizados: ${data.inserted ?? 0} inseridos, ${data.updated ?? 0} atualizados` +
          (data.skipped_count ? ` (${data.skipped_count} pulados — empresa não encontrada)` : "")
        );
      } else {
        toast.error(data?.error || "Falha na sincronização de contatos");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar contatos");
    } finally {
      setLoadingContacts(false);
      loadLastContactSync();
    }
  };


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

  useEffect(() => { loadLogs(); loadSocnetFlag(); loadLastUnitSync(); loadLastContactSync(); loadLastPrecoSync(); }, [loadLogs, loadSocnetFlag, loadLastUnitSync, loadLastContactSync, loadLastPrecoSync]);



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
      await loadLogs();
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
        <h1 className="text-2xl font-bold">Base de Dados</h1>
      </div>

      <SyncList
        items={[
          {
            key: "empresas",
            name: "Empresas (SOC)",
            description: "Base mestre de empresas com contrato direto.",
            lastRun: logs[0]?.finished_at || logs[0]?.started_at || null,
            loading,
            run: sync,
          },
          {
            key: "unidades",
            name: "Unidades das empresas",
            description: "Filiais/unidades ligadas às empresas (SOC).",
            lastRun: lastUnitSync,
            loading: loadingUnits,
            run: syncUnits,
          },
          {
            key: "contatos",
            name: "Contatos das Empresas",
            description: "Contatos (telefones e e-mails) de cada empresa cliente (SOC).",
            lastRun: lastContactSync,
            loading: loadingContacts,
            run: syncContacts,
          },
          {
            key: "preco",
            name: "Preço / Dados Comerciais",
            description: "Subgrupo, vidas ativas, classificação, inadimplência e data de assinatura (SOC).",
            lastRun: lastPrecoSync,
            loading: loadingPreco,
            run: syncPreco,
          },

        ]}
        onRefresh={loadLogs}
        refreshing={loadingLogs}
      />


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
                  <TableHead>Tipo</TableHead>
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
                        <TableCell>
                          <Badge variant="outline">
                            {SYNC_TYPE_LABEL[l.sync_type || "empresas"] || l.sync_type}
                          </Badge>
                        </TableCell>
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
                          <TableCell colSpan={9} className="bg-muted/30">
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
