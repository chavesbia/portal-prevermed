import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSlaStatus, getSlaColor, getSlaLabel, getGuiaStatus, getGuiaStatusColor, getGuiaStatusLabel, getGuiaStatusLabelShort } from "@/lib/guias/sla";
import { isPrestadorInterno, getOrigemAgendamento, getStatusPrestador, toTitleCase } from "@/lib/guias/blocklist";
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

type GuiaWithGestao = {
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
  guia_gestao: {
    compareceu_status: string;
    atendimento_lancado: string;
    aso_anexado: string;
    sla_final?: string | null;
  } | {
    compareceu_status: string;
    atendimento_lancado: string;
    aso_anexado: string;
    sla_final?: string | null;
  }[] | null;
};

function getGestao(guia_gestao: GuiaWithGestao["guia_gestao"]) {
  if (!guia_gestao) return null;
  if (Array.isArray(guia_gestao)) return guia_gestao[0] ?? null;
  return guia_gestao;
}

interface GuiasListProps {
  readOnly?: boolean;
  injectedFilters?: Partial<GuiaFiltersState> | null;
  onFiltersConsumed?: () => void;
}

const PAGE_SIZE = 50;

type SortField = "data_guia" | "guia_codigo" | "empresa_nome" | "prestador_nome" | "funcionario_nome" | "data_agendamento" | "sla" | "statusGuia";
type SortDir = "asc" | "desc";

function StatusIcon({ status, field, compareceu }: { status: string; field?: "compareceu" | "atend" | "aso"; compareceu?: string }) {
  // Não compareceu: ícone de bloqueio para todos os campos
  if (compareceu === "NAO_COMPARECEU") {
    if (field === "compareceu") return <Ban className="h-4 w-4 text-destructive" />;
    // Atend e ASO não se aplicam
    if (field === "atend" || field === "aso") return <Ban className="h-4 w-4 text-muted-foreground" />;
  }

  // ASO pendente quando atendimento já lançado
  if (field === "aso" && (status === "NAO" || status === "NAO_INFORMADO") && compareceu && compareceu !== "NAO_COMPARECEU" && compareceu !== "NAO_INFORMADO") {
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }

  if (status === "SIM" || status === "COMPARECEU") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "NAO" || status === "NAO_COMPARECEU") return <XIcon className="h-4 w-4 text-destructive" />;
  if (status === "PARCIAL") return <span className="text-xs text-orange-500 font-medium">PAR</span>;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function TruncatedCell({ text, maxW = "max-w-[180px]" }: { text: string | null; maxW?: string }) {
  const display = text || "—";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`block truncate ${maxW} text-xs`}>{display}</span>
        </TooltipTrigger>
        {text && text.length > 20 && (
          <TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export default function GuiasList({ readOnly = false, injectedFilters, onFiltersConsumed }: GuiasListProps) {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  // Restore persisted state from sessionStorage
  const persistedState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("guias-list-state");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  }, []);

  const [search, setSearch] = useState(persistedState?.search ?? "");
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
  const [sortField, setSortField] = useState<SortField>(persistedState?.sortField ?? "data_guia");
  const [sortDir, setSortDir] = useState<SortDir>(persistedState?.sortDir ?? "desc");
  const [drawerGuia, setDrawerGuia] = useState<GuiaWithGestao | null>(null);

  // Persist state to sessionStorage on changes
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

  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("data");
      return data?.map((f: any) => f.data) ?? [];
    },
  });

  const { data: guiasRaw, isLoading } = useQuery({
    queryKey: ["guias", search],
    queryFn: async () => {
      const BATCH = 1000;
      let allData: GuiaWithGestao[] = [];
      let from = 0;

      while (true) {
        let query = supabase
          .from("guias")
          .select("id, guia_codigo, data_guia, empresa_nome, prestador_nome, funcionario_nome, funcionario_cpf, tipo_exame, atendido_texto, data_agendamento, hora_agendamento, situacao, solicitante_nome, unidade_nome, guia_gestao(compareceu_status, atendimento_lancado, aso_anexado, sla_final)")
          .order("data_guia", { ascending: false })
          .range(from, from + BATCH - 1);

        if (search) {
          query = query.or(
            `guia_codigo.ilike.%${search}%,funcionario_nome.ilike.%${search}%,funcionario_cpf.ilike.%${search}%,empresa_nome.ilike.%${search}%,prestador_nome.ilike.%${search}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data as unknown as GuiaWithGestao[]);
        if (data.length < BATCH) break;
        from += BATCH;
      }

      return allData.filter((g) => !isPrestadorInterno(g.prestador_nome));
    },
  });

  const { data: examesList } = useQuery({
    queryKey: ["exames-list"],
    queryFn: async () => {
      const { data } = await supabase.from("guia_exames").select("exame_nome");
      return [...new Set(data?.map((e: any) => e.exame_nome).filter(Boolean) as string[])].sort();
    },
  });

  const empresas = useMemo(() => [...new Set(guiasRaw?.map((g) => g.empresa_nome).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const prestadores = useMemo(() => [...new Set(guiasRaw?.map((g) => g.prestador_nome).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const tiposExame = useMemo(() => [...new Set(guiasRaw?.map((g) => g.tipo_exame).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const situacoes = useMemo(() => [...new Set(guiasRaw?.map((g) => g.situacao).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const unidades = useMemo(() => [...new Set(guiasRaw?.map((g) => g.unidade_nome).filter(Boolean) as string[])].sort(), [guiasRaw]);

  const guias = useMemo(() => {
    if (!guiasRaw) return [];
    let result = guiasRaw.filter((g) => {
      const f = filters;
      if (f.dataGuiaInicio && g.data_guia && new Date(g.data_guia + "T00:00:00") < f.dataGuiaInicio) return false;
      if (f.dataGuiaFim && g.data_guia && new Date(g.data_guia + "T00:00:00") > f.dataGuiaFim) return false;
      if (f.dataAgendamentoInicio && g.data_agendamento && new Date(g.data_agendamento + "T00:00:00") < f.dataAgendamentoInicio) return false;
      if (f.dataAgendamentoFim && g.data_agendamento && new Date(g.data_agendamento + "T00:00:00") > f.dataAgendamentoFim) return false;
      if (f.semAgendamento) {
        const semData = !g.data_agendamento;
        const semHora = !g.hora_agendamento || g.hora_agendamento === "00:00";
        if (!(semData && semHora)) return false;
      }
      if (f.empresas.length > 0 && !f.empresas.includes(g.empresa_nome ?? "")) return false;
      if (f.prestadores.length > 0 && !f.prestadores.includes(g.prestador_nome ?? "")) return false;
      if (f.tipoExame && g.tipo_exame !== f.tipoExame) return false;
      if (f.situacao && g.situacao !== f.situacao) return false;
      if (f.unidade && g.unidade_nome !== f.unidade) return false;
      if (f.atendido) {
        const isAtendido = g.atendido_texto?.toUpperCase() === "SIM";
        if (f.atendido === "SIM" && !isAtendido) return false;
        if (f.atendido === "NAO" && isAtendido) return false;
      }
      const gestao = getGestao(g.guia_gestao);
      const comp = gestao?.compareceu_status ?? "NAO_INFORMADO";
      if (f.compareceu && comp !== f.compareceu) return false;
      if (f.atendimentoLancado && (gestao?.atendimento_lancado ?? "NAO_INFORMADO") !== f.atendimentoLancado) return false;
      if (f.asoAnexado && (gestao?.aso_anexado ?? "NAO_INFORMADO") !== f.asoAnexado) return false;
      if (f.sla) {
        const dataBase = g.data_agendamento ?? g.data_guia;
        const sla = getSlaStatus(dataBase, gestao?.atendimento_lancado ?? "NAO_INFORMADO", feriados ?? [], gestao?.sla_final);
        if (sla !== f.sla) return false;
      }
      if (f.statusGuia) {
        const status = getGuiaStatus(comp, gestao?.atendimento_lancado ?? "NAO_INFORMADO", gestao?.aso_anexado ?? "NAO_INFORMADO");
        if (status !== f.statusGuia) return false;
      }
      if (f.origemAgendamento) {
        const origem = getOrigemAgendamento(g.solicitante_nome);
        if (origem !== f.origemAgendamento) return false;
      }
      if (f.statusPrestador) {
        const sp = getStatusPrestador(g.prestador_nome);
        if (sp !== f.statusPrestador) return false;
      }
      return true;
    });

    const slaOrder = { EM_DIA: 0, ATENCAO: 1, ATRASADO: 2 };
    const statusOrder = { PENDENTE: 0, INICIADA: 1, EM_ANDAMENTO: 2, FINALIZADA: 3 };

    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === "sla") {
        const gA = getGestao(a.guia_gestao);
        const gB = getGestao(b.guia_gestao);
        valA = slaOrder[getSlaStatus(a.data_agendamento ?? a.data_guia, gA?.atendimento_lancado ?? "NAO_INFORMADO", feriados ?? [], gA?.sla_final)] ?? 0;
        valB = slaOrder[getSlaStatus(b.data_agendamento ?? b.data_guia, gB?.atendimento_lancado ?? "NAO_INFORMADO", feriados ?? [], gB?.sla_final)] ?? 0;
      } else if (sortField === "statusGuia") {
        const gA = getGestao(a.guia_gestao);
        const gB = getGestao(b.guia_gestao);
        valA = statusOrder[getGuiaStatus(gA?.compareceu_status ?? "NAO_INFORMADO", gA?.atendimento_lancado ?? "NAO_INFORMADO", gA?.aso_anexado ?? "NAO_INFORMADO")] ?? 0;
        valB = statusOrder[getGuiaStatus(gB?.compareceu_status ?? "NAO_INFORMADO", gB?.atendimento_lancado ?? "NAO_INFORMADO", gB?.aso_anexado ?? "NAO_INFORMADO")] ?? 0;
      } else {
        valA = (a as any)[sortField] ?? "";
        valB = (b as any)[sortField] ?? "";
      }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [guiasRaw, filters, feriados, sortField, sortDir]);

  const totalPages = Math.ceil((guias?.length ?? 0) / PAGE_SIZE);
  const pagedGuias = guias.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const displayName = profile?.full_name ?? user?.email ?? "";

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field: "compareceu_status" | "atendimento_lancado" | "aso_anexado"; value: string }) => {
      const codes = Array.from(selected);
      for (const code of codes) {
        const guia = guias?.find((g) => g.guia_codigo === code);
        const gestao = getGestao(guia?.guia_gestao ?? null);
        const oldValue = gestao?.[field] ?? "NAO_INFORMADO";
        await supabase.from("guia_gestao").update({ [field]: value, updated_by: user?.id }).eq("guia_codigo", code);
        await supabase.from("guia_audit_log").insert({ user_id: user?.id, user_name: displayName, guia_codigo: code, campo: field, valor_antigo: oldValue, valor_novo: value });
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
    if (pagedGuias && selected.size === pagedGuias.length) setSelected(new Set());
    else setSelected(new Set(pagedGuias?.map((g) => g.guia_codigo) ?? []));
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
        empresas={empresas}
        prestadores={prestadores}
        tiposExame={tiposExame}
        situacoes={situacoes}
        unidades={unidades}
        exames={examesList}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0); }}
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
        <span>{guias.length} guias encontradas</span>
        <div className="flex items-center gap-2">
          <span>Página {totalPages > 0 ? page + 1 : 0} de {totalPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden flex-1 relative">
          <div className="overflow-auto max-h-[calc(100vh-340px)]" style={{ overscrollBehaviorX: "contain" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  {canEdit && (
                    <th className="sticky left-0 z-30 bg-muted/95 w-10 px-3 py-2 border-r border-border">
                      <Checkbox checked={pagedGuias?.length ? selected.size === pagedGuias.length : false} onCheckedChange={toggleAll} />
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
                  <SortHeader field="statusGuia" className="min-w-[90px]">Status</SortHeader>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">Comp.</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">Atend.</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[50px]">ASO</th>
                  <th className="h-10 px-3 text-center text-xs font-medium text-muted-foreground whitespace-nowrap w-10"></th>
                </tr>
              </thead>
              <tbody>
                {pagedGuias.map((guia) => {
                  const gestao = getGestao(guia.guia_gestao);
                  const atendLancado = gestao?.atendimento_lancado ?? "NAO_INFORMADO";
                  const dataBase = guia.data_agendamento ?? guia.data_guia;
                  const sla = getSlaStatus(dataBase, atendLancado, feriados ?? [], gestao?.sla_final);
                  const origem = getOrigemAgendamento(guia.solicitante_nome);
                  const comp = gestao?.compareceu_status ?? "NAO_INFORMADO";
                  const guiaStatus = getGuiaStatus(comp, atendLancado, gestao?.aso_anexado ?? "NAO_INFORMADO");

                  return (
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
                        <Link to={`/guias/${guia.guia_codigo}`} className="text-primary hover:underline font-mono text-xs font-medium">
                          {guia.guia_codigo}
                        </Link>
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
                        <Badge variant={origem === "CLIENTE" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {origem === "CLIENTE" ? "Cliente" : "PreverMed"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] px-1.5 py-0 ${getSlaColor(sla)}`}>{getSlaLabel(sla)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] px-1.5 py-0 whitespace-nowrap ${getGuiaStatusColor(guiaStatus)}`}>{getGuiaStatusLabelShort(guiaStatus)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center"><StatusIcon status={comp} field="compareceu" compareceu={comp} /></td>
                      <td className="px-3 py-2 text-center"><StatusIcon status={atendLancado} field="atend" compareceu={comp} /></td>
                      <td className="px-3 py-2 text-center"><StatusIcon status={gestao?.aso_anexado ?? "NAO_INFORMADO"} field="aso" compareceu={comp} /></td>
                      <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDrawerGuia(guia)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {pagedGuias.length === 0 && (
                  <tr>
                    <td colSpan={16} className="text-center py-12 text-muted-foreground">
                      Nenhuma guia encontrada.
                    </td>
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
          {drawerGuia && <GuiaDrawerContent guia={drawerGuia} feriados={feriados ?? []} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GuiaDrawerContent({ guia, feriados }: { guia: GuiaWithGestao; feriados: string[] }) {
  const gestao = getGestao(guia.guia_gestao);
  const comp = gestao?.compareceu_status ?? "NAO_INFORMADO";
  const atend = gestao?.atendimento_lancado ?? "NAO_INFORMADO";
  const aso = gestao?.aso_anexado ?? "NAO_INFORMADO";
  const sla = getSlaStatus(guia.data_agendamento ?? guia.data_guia, atend, feriados, gestao?.sla_final);
  const guiaStatus = getGuiaStatus(comp, atend, aso);
  const origem = getOrigemAgendamento(guia.solicitante_nome);
  const statusPrest = getStatusPrestador(guia.prestador_nome);

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
          <Badge className={`text-xs ${getSlaColor(sla)}`}>SLA: {getSlaLabel(sla)}</Badge>
          <Badge className={`text-xs ${getGuiaStatusColor(guiaStatus)}`}>{getGuiaStatusLabel(guiaStatus)}</Badge>
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
           <Field label="Status Prestador" value={statusPrest === "SEM PRESTADOR" ? "Sem prestador" : "Com prestador"} />
           <Field label="Agendamento" value={guia.data_agendamento ? `${format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yyyy")} ${guia.hora_agendamento ?? ""}` : null} />
           <Field label="Origem Agendamento" value={origem === "CLIENTE" ? "Cliente" : "PreverMed"} />
           <Field label="Solicitante" value={toTitleCase(guia.solicitante_nome)} />
        </div>

        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold mb-2">Gestão Operacional</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Compareceu</p>
              <StatusIcon status={comp} field="compareceu" compareceu={comp} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Atend. Lançado</p>
              <StatusIcon status={atend} field="atend" compareceu={comp} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">ASO</p>
              <StatusIcon status={aso} field="aso" compareceu={comp} />
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
