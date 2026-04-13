import { useState } from "react";
import { formatDateBR } from "@/lib/utils";
import { useASOAtendimentos, ASOFilters } from "@/hooks/useASOData";
import { useFeriados } from "@/hooks/useFeriados";
import { calcSLA, SLAResult } from "@/lib/aso/sla";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Eye, Filter, X } from "lucide-react";
import ASOWorkflowDrawer from "@/components/aso/ASOWorkflowDrawer";

const STATUS_LABELS: Record<string, string> = {
  importado: "Importado",
  em_triagem: "Inicial",
  aguardando_exames: "Exames Pend.",
  pronto_assinatura_medica: "Assinatura",
  em_escaneamento: "Liberação",
  liberado: "Liberado",
  liberado_faturamento: "Faturamento",
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

export default function ASOListagem() {
  const [filters, setFilters] = useState<ASOFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Atendimento | null>(null);
  const { data: atendimentos, isLoading, refetch } = useASOAtendimentos(filters);
  const { data: feriados } = useFeriados();

  const ACTIVE_STATUSES = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];

  const getSLA = (a: Atendimento): SLAResult | null => {
    if (!ACTIVE_STATUSES.includes(a.status)) return null;
    return calcSLA(a.data_atendimento, feriados || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filtros
        </Button>
        {Object.keys(filters).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
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
        {isLoading ? "Carregando..." : `${atendimentos?.length ?? 0} atendimentos encontrados`}
      </p>

      <div className="border rounded-lg" style={{ overflow: "auto", maxHeight: "calc(100vh - 400px)" }}>
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
              <TableHead className="min-w-[70px]">SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atendimentos?.map((a) => (
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
            ))}
            {(!atendimentos || atendimentos.length === 0) && !isLoading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Nenhum atendimento encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ASOWorkflowDrawer
        atendimento={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={() => refetch()}
      />
    </div>
  );
}
