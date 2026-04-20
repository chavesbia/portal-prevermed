import { useState, useEffect, useMemo, useRef } from "react";
import { formatDateBR } from "@/lib/utils";
import { useASOAtendimentos, ASOFilters } from "@/hooks/useASOData";
import { useFeriados } from "@/hooks/useFeriados";
import { calcSLA, SLAResult } from "@/lib/aso/sla";
import { supabase } from "@/integrations/supabase/client";
import { classifyExame, parseExamesTexto } from "@/lib/aso/examClassifier";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Eye, Filter, X, FlaskConical, AlertTriangle, Info } from "lucide-react";
import { StickyScrollTable } from "@/components/ui/sticky-scroll-table";
import ASOWorkflowDrawer from "@/components/aso/ASOWorkflowDrawer";

const STATUS_LABELS: Record<string, string> = {
  importado: "Importado",
  em_triagem: "Inicial",
  aguardando_exames: "Exames Pendentes",
  pronto_assinatura_medica: "Assinatura",
  em_escaneamento: "Liberação",
  liberado: "Liberado",
  liberado_faturamento: "Faturamento",
  fechado: "Fechado",
  finalizado: "Finalizado",
};

const STATUS_COLORS: Record<string, string> = {
  importado: "bg-slate-100 text-slate-700",
  em_triagem: "bg-blue-100 text-blue-700",
  aguardando_exames: "bg-orange-100 text-orange-700",
  pronto_assinatura_medica: "bg-purple-100 text-purple-700",
  em_escaneamento: "bg-yellow-100 text-yellow-700",
  liberado: "bg-green-100 text-green-700",
  liberado_faturamento: "bg-emerald-100 text-emerald-700",
  fechado: "bg-indigo-100 text-indigo-700",
  finalizado: "bg-gray-200 text-gray-600",
};

function cleanAgenda(agenda: string | null): string {
  if (!agenda) return "—";
  const upper = agenda.toUpperCase();
  if (upper.includes("OSASCO")) return "Osasco";
  if (upper.includes("LAPA")) return "Lapa";
  return agenda;
}

type Atendimento = NonNullable<ReturnType<typeof useASOAtendimentos>["data"]>[number];

// Exam data per atendimento
interface ExameInfo {
  atendimento_id: string;
  nome_exame: string;
}

const STORAGE_KEY = "aso-listagem-filters-v1";

interface PersistedFilters {
  filters: ASOFilters;
  exameFilter: string[];
  semExamesFilter: boolean;
  semComplementaresFilter: boolean;
}

function loadPersistedFilters(): PersistedFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { filters: {}, exameFilter: [], semExamesFilter: false, semComplementaresFilter: false };
}

export default function ASOListagem() {
  const persisted = useMemo(() => loadPersistedFilters(), []);
  const [filters, setFilters] = useState<ASOFilters>(persisted.filters);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Atendimento | null>(null);
  const [exameFilter, setExameFilter] = useState<string[]>(persisted.exameFilter);
  const [exameSearch, setExameSearch] = useState("");
  const [exameNames, setExameNames] = useState<string[]>([]);
  const [allExameData, setAllExameData] = useState<ExameInfo[]>([]);
  const [filteredIds, setFilteredIds] = useState<Set<string> | null>(null);
  const [semExamesFilter, setSemExamesFilter] = useState(persisted.semExamesFilter);
  const [semComplementaresFilter, setSemComplementaresFilter] = useState(persisted.semComplementaresFilter);
  const { data: atendimentos, isLoading, refetch } = useASOAtendimentos(filters);
  const { data: feriados } = useFeriados();

  // Persist filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ filters, exameFilter, semExamesFilter, semComplementaresFilter })
      );
    } catch {}
  }, [filters, exameFilter, semExamesFilter, semComplementaresFilter]);

  // Load all exam data for filtering
  useEffect(() => {
    supabase
      .from("aso_exames_atendimento")
      .select("nome_exame, atendimento_id")
      .then(({ data }) => {
        if (data) {
          setAllExameData(data);
          // Normalize names: treat "Avaliação clínica ocupacional" variants as "Exame Clínico"
          const normalized = data.map(d => {
            const tipo = classifyExame(d.nome_exame);
            return tipo === "clinico" ? "Exame Clínico" : d.nome_exame;
          });
          const unique = [...new Set(normalized)].sort();
          setExameNames(unique);
        }
      });
  }, []);

  const effectiveExamesByAtendimento = useMemo(() => {
    const linkedByAtendimento = new Map<string, string[]>();

    for (const exame of allExameData) {
      if (!linkedByAtendimento.has(exame.atendimento_id)) {
        linkedByAtendimento.set(exame.atendimento_id, []);
      }

      linkedByAtendimento.get(exame.atendimento_id)!.push(exame.nome_exame);
    }

    const result = new Map<string, string[]>();

    for (const atendimento of atendimentos || []) {
      const linkedExames = linkedByAtendimento.get(atendimento.id) || [];

      if (linkedExames.length > 0) {
        result.set(atendimento.id, linkedExames);
        continue;
      }

      const parsedExames = parseExamesTexto(atendimento.exames_texto).map(exame => exame.nome_exame);
      result.set(atendimento.id, parsedExames);
    }

    return result;
  }, [allExameData, atendimentos]);

  // Derived sets for filtering
  const idsComExames = useMemo(
    () => new Set([...effectiveExamesByAtendimento.entries()]
      .filter(([, nomes]) => nomes.length > 0)
      .map(([id]) => id)),
    [effectiveExamesByAtendimento]
  );

  // IDs that have ONLY clinical exams (no complementar/imediato)
  const idsApenasClinicos = useMemo(
    () => new Set([...effectiveExamesByAtendimento.entries()]
      .filter(([, nomes]) => nomes.length > 0 && nomes.every(nome => classifyExame(nome) === "clinico"))
      .map(([id]) => id)),
    [effectiveExamesByAtendimento]
  );

  // When exam filter changes, fetch matching atendimento IDs (using normalized names)
  useEffect(() => {
    if (exameFilter.length === 0) {
      setFilteredIds(null);
      return;
    }
    // Match exames considering normalization
    const matchingIds = new Set<string>();
    for (const d of allExameData) {
      const tipo = classifyExame(d.nome_exame);
      const normalizedName = tipo === "clinico" ? "Exame Clínico" : d.nome_exame;
      if (exameFilter.includes(normalizedName)) {
        matchingIds.add(d.atendimento_id);
      }
    }
    setFilteredIds(matchingIds);
  }, [exameFilter, allExameData]);

  const ACTIVE_STATUSES = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];

  const getSLA = (a: Atendimento): SLAResult | null => {
    if (!ACTIVE_STATUSES.includes(a.status)) return null;
    return calcSLA(a.data_atendimento, feriados || []);
  };

  let displayedAtendimentos = filteredIds
    ? atendimentos?.filter(a => filteredIds.has(a.id))
    : atendimentos;

  // Filter: sem exames nenhum (really no exams at all)
  if (semExamesFilter && displayedAtendimentos) {
    displayedAtendimentos = displayedAtendimentos.filter(a => !idsComExames.has(a.id));
  }

  // Filter: sem exames complementares (only clinical exams)
  if (semComplementaresFilter && displayedAtendimentos) {
    displayedAtendimentos = displayedAtendimentos.filter(a => idsApenasClinicos.has(a.id));
  }

  const filteredExameNames = exameSearch
    ? exameNames.filter(n => n.toLowerCase().includes(exameSearch.toLowerCase()))
    : exameNames;

  const activeFilterCount = exameFilter.length + (semExamesFilter ? 1 : 0) + (semComplementaresFilter ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, empresa..."
            className="pl-9"
            value={filters.search || ""}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.agenda || "all"} onValueChange={(v) => setFilters(f => ({ ...f, agenda: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="Lapa">Lapa</SelectItem>
            <SelectItem value="Osasco">Osasco</SelectItem>
          </SelectContent>
        </Select>

        {/* Exam filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={activeFilterCount > 0 ? "border-primary" : ""}>
              <FlaskConical className="h-4 w-4 mr-1" />
              Exames
              {activeFilterCount > 0 && (
                <Badge className="ml-1 text-[10px] h-4 px-1">{activeFilterCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-3" align="start">
            <div className="space-y-2">
              {/* Sem exames filter */}
              <label className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-muted/50 px-1 rounded font-medium text-red-600">
                <Checkbox
                  checked={semExamesFilter}
                  onCheckedChange={(checked) => { setSemExamesFilter(!!checked); if (checked) setSemComplementaresFilter(false); }}
                />
                <AlertTriangle className="h-3 w-3" />
                Sem exames cadastrados
              </label>
              {/* Sem complementares filter */}
              <label className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-muted/50 px-1 rounded font-medium text-amber-600">
                <Checkbox
                  checked={semComplementaresFilter}
                  onCheckedChange={(checked) => { setSemComplementaresFilter(!!checked); if (checked) setSemExamesFilter(false); }}
                />
                <Info className="h-3 w-3" />
                Sem exames complementares
              </label>
              <div className="border-t my-1" />
              <Input
                placeholder="Buscar exame..."
                value={exameSearch}
                onChange={(e) => setExameSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {filteredExameNames.map(name => (
                  <label key={name} className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-muted/50 px-1 rounded">
                    <Checkbox
                      checked={exameFilter.includes(name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setExameFilter(prev => [...prev, name]);
                        } else {
                          setExameFilter(prev => prev.filter(n => n !== name));
                        }
                      }}
                    />
                    {name}
                  </label>
                ))}
                {filteredExameNames.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum exame encontrado</p>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setExameFilter([]); setSemExamesFilter(false); setSemComplementaresFilter(false); }}>
                  Limpar seleção
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filtros
        </Button>
        {(Object.keys(filters).length > 0 || activeFilterCount > 0) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setExameFilter([]); setSemExamesFilter(false); setSemComplementaresFilter(false); }}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Data de</Label>
            <Input type="date" value={filters.data_de || ""} onChange={(e) => setFilters(f => ({ ...f, data_de: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Data até</Label>
            <Input type="date" value={filters.data_ate || ""} onChange={(e) => setFilters(f => ({ ...f, data_ate: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Médico</Label>
            <Input placeholder="Nome do médico" value={filters.medico || ""} onChange={(e) => setFilters(f => ({ ...f, medico: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Tipo Prontuário</Label>
            <Select value={filters.tipo_prontuario || "all"} onValueChange={(v) => setFilters(f => ({ ...f, tipo_prontuario: v === "all" ? undefined : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="fisico">Físico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {isLoading ? "Carregando..." : `${displayedAtendimentos?.length ?? 0} atendimentos encontrados`}
      </p>

      <StickyScrollTable topOffset={56}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 sticky left-0 bg-background z-10"></TableHead>
              <TableHead className="sticky left-10 bg-background z-10 min-w-[130px]">Funcionário</TableHead>
              <TableHead className="min-w-[90px]">Data</TableHead>
              <TableHead className="min-w-[60px]">Hora</TableHead>
              <TableHead className="min-w-[140px]">Empresa</TableHead>
              <TableHead className="min-w-[80px]">Unidade</TableHead>
              <TableHead className="min-w-[100px]">Tipo ASO</TableHead>
              <TableHead className="min-w-[80px]">Prontuário</TableHead>
              <TableHead className="min-w-[70px]">SOCNET</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="min-w-[80px]">Exames</TableHead>
              <TableHead className="min-w-[70px]">SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAtendimentos?.map((a) => {
              const temExames = idsComExames.has(a.id);
              const apenasClinicos = idsApenasClinicos.has(a.id);
              return (
                <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelected(a); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate sticky left-10 bg-background z-10 font-medium">{a.funcionario || "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateBR(a.data_atendimento)}</TableCell>
                  <TableCell className="text-xs">{a.hora_inicial || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{a.empresa || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{cleanAgenda(a.agenda)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{a.tipo_compromisso || "—"}</TableCell>
                  <TableCell>
                    {a.tipo_prontuario ? (
                      <Badge variant="secondary" className="text-xs capitalize">{a.tipo_prontuario}</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {a.base_socnet ? (
                      <Badge className="text-xs bg-blue-100 text-blue-700">SIM</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[a.status] || ""}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.status === "importado" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : !temExames ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">Sem exames</Badge>
                          </TooltipTrigger>
                          <TooltipContent><p>Nenhum exame identificado neste prontuário</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : apenasClinicos ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">Só clínico</Badge>
                          </TooltipTrigger>
                          <TooltipContent><p>Apenas Exame Clínico — recepção pode liberar diretamente</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">Com exames</Badge>
                          </TooltipTrigger>
                          <TooltipContent><p>Possui exames complementares além do clínico</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const sla = getSLA(a);
                      if (!sla) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={`text-xs ${sla.bgColor} ${sla.color}`}>
                                {sla.emoji} {sla.diasUteis}d
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{sla.label} — {sla.diasUteis} dia(s) útil(eis)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
            })}
            {(!displayedAtendimentos || displayedAtendimentos.length === 0) && !isLoading && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nenhum atendimento encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </StickyScrollTable>

      <ASOWorkflowDrawer
        atendimento={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={() => refetch()}
      />
    </div>
  );
}
