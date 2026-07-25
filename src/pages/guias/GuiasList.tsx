import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSlaColor, getSlaLabel, getGuiaStatusColor, getGuiaStatusLabel, getGuiaStatusLabelShort, type SlaStatus, type GuiaStatusType } from "@/lib/guias/sla";
import { getOrigemAgendamento, getStatusPrestador, toTitleCase } from "@/lib/guias/blocklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { CheckSquare, ChevronLeft, ChevronRight, ArrowUpDown, Eye, Check, X as XIcon, Minus, Ban, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { GuiaFilters, emptyFilters, type GuiaFiltersState } from "@/components/guias/GuiaFilters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// Row returned by the listar_guias RPC (flat shape)
type GuiaRow = {
  id: string;
  guia_codigo: string;
  data_guia: string | null;
  empresa_nome: string | null;
  prestador_nome: string | null;
  funcionario_nome: string | null;
  funcionario_cpf: string | null;
  tipo_exame: string | null;
  atendido_texto: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  situacao: string | null;
  solicitante_nome: string | null;
  unidade_nome: string | null;
  compareceu: string;
  atendimento_lancado: string;
  aso_anexado: string;
  aguardando_aso: string;
  sla_final: string | null;
  sla: SlaStatus;
  status_guia: GuiaStatusType;
  origem: "CLIENTE" | "PREVERMED";
  status_prestador: "COM PRESTADOR" | "SEM PRESTADOR";
};

interface GuiasListProps {
  readOnly?: boolean;
  injectedFilters?: Partial<GuiaFiltersState> | null;
  onFiltersConsumed?: () => void;
}

const PAGE_SIZE = 50;

type SortField = "data_guia" | "guia_codigo" | "empresa_nome" | "prestador_nome" | "funcionario_nome" | "data_agendamento" | "sla" | "status_guia";
type SortDir = "asc" | "desc";

function StatusIcon({ status, field, compareceu }: { status: string; field?: "compareceu" | "atend" | "aso"; compareceu?: string }) {
  if (compareceu === "NAO_COMPARECEU") {
    if (field === "compareceu") return <Ban className="h-4 w-4 text-destructive" />;
    if (field === "atend" || field === "aso") return <Ban className="h-4 w-4 text-muted-foreground" />;
  }
  if (field === "aso" && (status === "NAO" || status === "NAO_INFORMADO") && compareceu && compareceu !== "NAO_COMPARECEU" && compareceu !== "NAO_INFORMADO") {
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
  if (status === "SIM" || status === "COMPARECEU") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "NAO" || status === "NAO_COMPARECEU") return <XIcon className="h-4 w-4 text-destructive" />;
  if (status === "PARCIAL") return <span className="text-xs text-orange-500 font-medium">PAR</span>;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

const AGUARDANDO_ASO_LABELS: Record<string, string> = { NAO_INFORMADO: "—", CONTATO_REALIZADO: "Contato realizado", RECEBIDO: "Recebido", NAO_RECEBIDO: "Não recebido" };
const AGUARDANDO_ASO_SHORT_LABELS: Record<string, string> = { NAO_INFORMADO: "—", CONTATO_REALIZADO: "Contato", RECEBIDO: "Recebido", NAO_RECEBIDO: "Não rec." };

function AguardandoAsoLabel({ status, compact = false }: { status: string; compact?: boolean }) {
  const label = compact ? (AGUARDANDO_ASO_SHORT_LABELS[status] ?? "—") : (AGUARDANDO_ASO_LABELS[status] ?? "—");
  const textClassName = compact ? "text-[11px] font-medium whitespace-nowrap" : "text-xs font-medium";
  if (status === "RECEBIDO") return <span className={`${textClassName} text-green-600`}>{label}</span>;
  if (status === "NAO_RECEBIDO") return <span className={`${textClassName} text-destructive`}>{label}</span>;
  if (status === "CONTATO_REALIZADO") return <span className={`${textClassName} text-orange-500`}>{label}</span>;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function TruncatedCell({ text, maxW = "max-w-[180px]" }: { text: string | null; maxW?: string }) {
  const display = text || "—";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span className={`block truncate ${maxW} text-xs`}>{display}</span></TooltipTrigger>
        {text && text.length > 20 && (<TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>)}
      </Tooltip>
    </TooltipProvider>
  );
}

function filtersToPayload(filters: GuiaFiltersState, search: string) {
  const fmtDate = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : null);
  return {
    search: search || null,
    dataGuiaInicio: fmtDate(filters.dataGuiaInicio),
    dataGuiaFim: fmtDate(filters.dataGuiaFim),
    dataAgendamentoInicio: fmtDate(filters.dataAgendamentoInicio),
    dataAgendamentoFim: fmtDate(filters.dataAgendamentoFim),
    semAgendamento: filters.semAgendamento || null,
    empresas: filters.empresas.length ? filters.empresas : null,
    prestadores: filters.prestadores.length ? filters.prestadores : null,
    tipoExame: filters.tipoExame || null,
    situacao: filters.situacao || null,
    unidade: filters.unidade || null,
    atendido: filters.atendido || null,
    sla: filters.sla || null,
    compareceu: filters.compareceu || null,
    atendimentoLancado: filters.atendimentoLancado || null,
    asoAnexado: filters.asoAnexado || null,
    aguardandoAso: filters.aguardandoAso || null,
    exame: filters.exame || null,
    origemAgendamento: filters.origemAgendamento || null,
    statusPrestador: filters.statusPrestador || null,
    statusGuia: filters.statusGuia || null,
  };
}

const SORT_FIELD_MAP: Record<string, SortField> = {
  statusGuia: "status_guia",
};

export default function GuiasList({ readOnly = false, injectedFilters, onFiltersConsumed }: GuiasListProps) {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const persistedState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("guias-list-state");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  }, []);

  const [search, setSearch] = useState(persistedState?.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GuiaFiltersState>(() => {
    if (persistedState?.filters) {
      const f = persistedState.filters;
      return {
        ...f,
        dataGuiaInicio: f.dataGuiaInicio ? new Date(f.dataGuiaInicio) : undefined,
        dataGuiaFim: f.dataGuiaFim ? new Date(f.dataGuiaFim) : undefined,
        dataAgendamentoInicio: f.dataAgendamentoInicio ? new Date(f.dataAgendamentoInicio) : undefined,
        dataAgendamentoFim: f.dataAgendamentoFim ? new Date(f.dataAgendamentoFim) : undefined,
      };
    }
    return { ...emptyFilters };
  });
  const [page, setPage] = useState(persistedState?.page ?? 0);
  const [sortField, setSortField] = useState<SortField>(
    SORT_FIELD_MAP[persistedState?.sortField] ?? (persistedState?.sortField ?? "data_guia"),
  );
  const [sortDir, setSortDir] = useState<SortDir>(persistedState?.sortDir ?? "desc");
  const [drawerGuia, setDrawerGuia] = useState<GuiaRow | null>(null);

  // Debounce search to avoid spamming the RPC on each keystroke
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const state = { search, filters, page, sortField, sortDir };
    sessionStorage.setItem("guias-list-state", JSON.stringify(state));
  }, [search, filters, page, sortField, sortDir]);

  const canEdit = !readOnly && isAdmin;

  useEffect(() => {
    if (injectedFilters) {
      setFilters({ ...emptyFilters, ...injectedFilters });
      setPage(0);
      onFiltersConsumed?.();
    }
  }, [injectedFilters, onFiltersConsumed]);

  // Filter dropdowns options (server-side aggregation, cached)
  const { data: filtersData } = useQuery({
    queryKey: ["guias-filtros"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("guias_filtros_disponiveis" as any);
      if (error) throw error;
      const d = (data ?? {}) as Record<string, string[]>;
      return {
        empresas: d.empresas ?? [],
        prestadores: d.prestadores ?? [],
        tipos_exame: d.tipos_exame ?? [],
        situacoes: d.situacoes ?? [],
        unidades: d.unidades ?? [],
        exames: d.exames ?? [],
      };
    },
  });

  // Main paginated query
  const filterPayload = useMemo(() => filtersToPayload(filters, debouncedSearch), [filters, debouncedSearch]);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["guias", filterPayload, sortField, sortDir, page],
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_guias" as any, {
        _filters: filterPayload as any,
        _sort_field: sortField,
        _sort_dir: sortDir,
        _page: page,
        _page_size: PAGE_SIZE,
      });
      if (error) throw error;
      const payload = (data ?? { rows: [], total: 0 }) as { rows: GuiaRow[]; total: number };
      return payload;
    },
  });

  const pagedGuias: GuiaRow[] = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Supplementary query: mark guias whose linked company is currently inactive
  const pageCodes = useMemo(() => pagedGuias.map((g) => g.guia_codigo), [pagedGuias]);
  const { data: inactiveSet } = useQuery({
    queryKey: ["guias-inactive-empresa", pageCodes],
    enabled: pageCodes.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guias")
        .select("guia_codigo, companies:company_id(is_active)")
        .in("guia_codigo", pageCodes);
      if (error) throw error;
      const s = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.companies && r.companies.is_active === false) s.add(r.guia_codigo);
      });
      return s;
    },
  });

  const displayName = profile?.full_name ?? user?.email ?? "";

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field: "compareceu_status" | "atendimento_lancado" | "aso_anexado"; value: string }) => {
      const codes = Array.from(selected);
      for (const code of codes) {
        const guia = pagedGuias.find((g) => g.guia_codigo === code);
        const oldValue =
          field === "compareceu_status" ? guia?.compareceu :
          field === "atendimento_lancado" ? guia?.atendimento_lancado :
          guia?.aso_anexado;
        const { error: updateError } = await supabase
          .from("guia_gestao")
          .update({ [field]: value, updated_by: user?.id })
          .eq("guia_codigo", code);
        if (updateError) throw updateError;
        const { error: auditError } = await supabase.from("guia_audit_log").insert({
          user_id: user?.id, user_name: displayName, guia_codigo: code, campo: field,
          valor_antigo: oldValue ?? "NAO_INFORMADO", valor_novo: value,
        });
        if (auditError) throw auditError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guias"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-guias"] });
      setSelected(new Set());
      toast({ title: "Atualizado!", description: `${selected.size} guias atualizadas.` });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleSelect = (code: string) => {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  };

  const toggleAll = () => {
    if (pagedGuias.length && selected.size === pagedGuias.length) setSelected(new Set());
    else setSelected(new Set(pagedGuias.map((g) => g.guia_codigo)));
  };

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(0);
  }, [sortField, sortDir]);

  const SortHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`h-10 px-3 text-left align-middle font-medium text-muted-foreground text-xs whitespace-nowrap cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-foreground" : "text-muted-foreground/40"}`} />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      <GuiaFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(0); }}
        empresas={filtersData?.empresas ?? []}
        prestadores={filtersData?.prestadores ?? []}
        tiposExame={filtersData?.tipos_exame ?? []}
        situacoes={filtersData?.situacoes ?? []}
        unidades={filtersData?.unidades ?? []}
        exames={filtersData?.exames ?? []}
        search={search}
        onSearchChange={(v) => setSearch(v)}
      />

      {canEdit && selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap py-2">
          <Badge variant="secondary">{selected.size} selecionadas</Badge>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Marcar como Compareceu para ${selected.size} guias?`)) bulkUpdate.mutate({ field: "compareceu_status", value: "COMPARECEU" }); }}>
            <CheckSquare className="h-4 w-4 mr-1" /> Compareceu
          </Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Marcar atendimento lançado para ${selected.size} guias?`)) bulkUpdate.mutate({ field: "atendimento_lancado", value: "SIM" }); }}>
            <CheckSquare className="h-4 w-4 mr-1" /> Atendimento
          </Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Marcar ASO anexado para ${selected.size} guias?`)) bulkUpdate.mutate({ field: "aso_anexado", value: "SIM" }); }}>
            <CheckSquare className="h-4 w-4 mr-1" /> ASO
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} guias encontradas</span>
        <div className="flex items-center gap-2">
          <span>Página {totalPages > 0 ? page + 1 : 0} de {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading && pagedGuias.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden flex-1 relative">
          <div className="overflow-auto max-h-[calc(100vh-340px)]" style={{ overscrollBehaviorX: "contain" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {canEdit && (
                    <th className="sticky left-0 z-30 bg-muted/95 w-10 px-3 py-2 border-r border-border">
                      <Checkbox checked={pagedGuias.length ? selected.size === pagedGuias.length : false} onCheckedChange={toggleAll} />
                    </th>
                  )}
                  <SortHeader field="data_guia" className={`sticky ${canEdit ? "left-10" : "left-0"} z-30 bg-muted/95 border-r border-border min-w-[80px]`}>Data</SortHeader>
                  <SortHeader field="guia_codigo" className="sticky z-30 bg-muted/95 border-r border-border min-w-[90px]">Código</SortHeader>
                  <SortHeader field="empresa_nome" className="sticky z-30 bg-muted/95 border-r border-border min-w-[140px]">Empresa</SortHeader>
                  <SortHeader field="prestador_nome" className="sticky z-30 bg-muted/95 border-r border-border min-w-[140px]">Prestador</SortHeader>
                  <SortHeader field="funcionario_nome" className="sticky z-30 bg-muted/95 min-w-[130px]">Funcionário</SortHeader>
                  <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">Tipo</th>
                  <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">Atendido</th>
                  <SortHeader field="data_agendamento" className="min-w-[110px]">Agendamento</SortHeader>
                  <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">Origem</th>
                  <SortHeader field="sla" className="min-w-[70px]">SLA</SortHeader>
                  <SortHeader field="status_guia" className="min-w-[90px]">Status</SortHeader>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">Comp.</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[90px]">Aguard. ASO</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">Atend.</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">ASO</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap w-10"></th>
                </tr>
              </thead>
              <tbody>
                {pagedGuias.map((guia) => (
                  <tr key={guia.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    {canEdit && (
                      <td className="sticky left-0 z-10 bg-background px-3 py-2 border-r border-border">
                        <Checkbox checked={selected.has(guia.guia_codigo)} onCheckedChange={() => toggleSelect(guia.guia_codigo)} />
                      </td>
                    )}
                    <td className={`sticky ${canEdit ? "left-10" : "left-0"} z-10 bg-background px-3 py-2 text-xs whitespace-nowrap border-r border-border`}>
                      {guia.data_guia ? format(new Date(guia.data_guia + "T00:00:00"), "dd/MM/yy") : "—"}
                    </td>
                    <td className="sticky z-10 bg-background px-3 py-2 border-r border-border">
                      <Link to={`/guias/${guia.guia_codigo}`} className="text-primary hover:underline font-mono text-xs font-medium">{guia.guia_codigo}</Link>
                    </td>
                    <td className="sticky z-10 bg-background px-3 py-2 border-r border-border">
                      <TruncatedCell text={toTitleCase(guia.empresa_nome)} maxW="max-w-[140px]" />
                    </td>
                    <td className="sticky z-10 bg-background px-3 py-2 border-r border-border">
                      <TruncatedCell text={toTitleCase(guia.prestador_nome)} maxW="max-w-[140px]" />
                    </td>
                    <td className="sticky z-10 bg-background px-3 py-2">
                      <TruncatedCell text={toTitleCase(guia.funcionario_nome)} maxW="max-w-[130px]" />
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{toTitleCase(guia.tipo_exame) ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{guia.atendido_texto ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {guia.data_agendamento ? format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yy") : "—"}
                      {guia.hora_agendamento && guia.hora_agendamento !== "00:00" ? ` ${guia.hora_agendamento}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={guia.origem === "CLIENTE" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {guia.origem === "CLIENTE" ? "Cliente" : "PreverMed"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge className={`text-[10px] px-1.5 py-0 ${getSlaColor(guia.sla)}`}>{getSlaLabel(guia.sla)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${getGuiaStatusColor(guia.status_guia)}`}>{getGuiaStatusLabelShort(guia.status_guia)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center"><StatusIcon status={guia.compareceu} field="compareceu" compareceu={guia.compareceu} /></td>
                    <td className="px-3 py-2 text-center"><AguardandoAsoLabel status={guia.aguardando_aso} compact /></td>
                    <td className="px-3 py-2 text-center"><StatusIcon status={guia.atendimento_lancado} field="atend" compareceu={guia.compareceu} /></td>
                    <td className="px-3 py-2 text-center"><StatusIcon status={guia.aso_anexado} field="aso" compareceu={guia.compareceu} /></td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDrawerGuia(guia)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {pagedGuias.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 17 : 16} className="text-center py-12 text-muted-foreground">Nenhuma guia encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="absolute top-0 right-0 bottom-0 w-4 pointer-events-none bg-gradient-to-l from-background/60 to-transparent" />
        </div>
      )}

      <Sheet open={!!drawerGuia} onOpenChange={(open) => !open && setDrawerGuia(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {drawerGuia && <GuiaDrawerContent guia={drawerGuia} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GuiaDrawerContent({ guia }: { guia: GuiaRow }) {
  const origem = guia.origem === "CLIENTE" ? "Cliente" : "PreverMed";
  const statusPrest = guia.status_prestador === "SEM PRESTADOR" ? "Sem prestador" : "Com prestador";

  const Field = ({ label, value }: { label: string; value: string | null }) => (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 flex-wrap">
          Guia {guia.guia_codigo}
          <Badge className={`text-xs ${getSlaColor(guia.sla)}`}>SLA: {getSlaLabel(guia.sla)}</Badge>
          <Badge className={`text-xs ${getGuiaStatusColor(guia.status_guia)}`}>{getGuiaStatusLabel(guia.status_guia)}</Badge>
        </SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-4">
         <div className="grid grid-cols-2 gap-3">
           <Field label="Data da Guia" value={guia.data_guia ? format(new Date(guia.data_guia + "T00:00:00"), "dd/MM/yyyy") : null} />
           <Field label="Tipo de Exame" value={toTitleCase(guia.tipo_exame)} />
           <Field label="Situação" value={toTitleCase(guia.situacao)} />
           <Field label="Atendido" value={guia.atendido_texto} />
           <Field label="Funcionário" value={toTitleCase(guia.funcionario_nome)} />
           <Field label="CPF" value={guia.funcionario_cpf} />
           <Field label="Empresa" value={toTitleCase(guia.empresa_nome)} />
           <Field label="Unidade" value={toTitleCase(guia.unidade_nome)} />
           <Field label="Prestador" value={toTitleCase(guia.prestador_nome)} />
           <Field label="Status Prestador" value={statusPrest} />
           <Field label="Agendamento" value={guia.data_agendamento ? `${format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yyyy")} ${guia.hora_agendamento ?? ""}` : null} />
           <Field label="Origem Agendamento" value={origem} />
           <Field label="Solicitante" value={toTitleCase(guia.solicitante_nome)} />
        </div>

        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold mb-2">Gestão Operacional</h4>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Compareceu</p>
              <StatusIcon status={guia.compareceu} field="compareceu" compareceu={guia.compareceu} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Aguard. ASO</p>
              <AguardandoAsoLabel status={guia.aguardando_aso} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Atend. Lançado</p>
              <StatusIcon status={guia.atendimento_lancado} field="atend" compareceu={guia.compareceu} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">ASO</p>
              <StatusIcon status={guia.aso_anexado} field="aso" compareceu={guia.compareceu} />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Link to={`/guias/${guia.guia_codigo}`}>
            <Button className="w-full">Ver detalhes completos</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
