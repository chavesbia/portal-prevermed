import { useState } from "react";
import { useASOAtendimentos } from "@/hooks/useASOData";
import { useFeriados } from "@/hooks/useFeriados";
import { calcSLA, SLAResult } from "@/lib/aso/sla";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, User, Building2 } from "lucide-react";
import ASOWorkflowDrawer from "@/components/aso/ASOWorkflowDrawer";

const COLUMNS = [
  { status: "importado", label: "Importados", color: "bg-slate-500" },
  { status: "em_triagem", label: "Em Triagem", color: "bg-blue-500" },
  { status: "aguardando_exames", label: "Aguard. Exames", color: "bg-orange-500" },
  { status: "pronto_assinatura_medica", label: "Assin. Médica", color: "bg-purple-500" },
  { status: "em_escaneamento", label: "Escaneamento", color: "bg-yellow-500" },
  { status: "liberado", label: "Liberado", color: "bg-green-500" },
  { status: "liberado_faturamento", label: "Faturamento", color: "bg-emerald-500" },
  { status: "finalizado", label: "Finalizado", color: "bg-gray-400" },
] as const;

const SLA_BG: Record<string, string> = {
  em_dia: "border-l-green-500",
  atencao: "border-l-yellow-500",
  atrasado: "border-l-red-500",
};

const ACTIVE_STATUSES = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];

type Atendimento = NonNullable<ReturnType<typeof useASOAtendimentos>["data"]>[number];

export default function ASOKanban() {
  const [unidade, setUnidade] = useState("all");
  const [selected, setSelected] = useState<Atendimento | null>(null);
  const { data: atendimentos, isLoading, refetch } = useASOAtendimentos(
    unidade !== "all" ? { agenda: unidade } : {}
  );
  const { data: feriados } = useFeriados();

  const grouped: Record<string, Atendimento[]> = {};
  COLUMNS.forEach((c) => (grouped[c.status] = []));
  (atendimentos || []).forEach((a) => {
    if (grouped[a.status]) grouped[a.status].push(a);
  });

  const getSLA = (a: Atendimento): SLAResult | null => {
    if (!ACTIVE_STATUSES.includes(a.status)) return null;
    return calcSLA(a.data_atendimento, feriados || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={unidade} onValueChange={setUnidade}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="Lapa">Lapa</SelectItem>
            <SelectItem value="Osasco">Osasco</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${atendimentos?.length ?? 0} atendimentos`}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = grouped[col.status] || [];
          return (
            <div key={col.status} className="min-w-[240px] max-w-[280px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="text-sm font-medium">{col.label}</span>
                <Badge variant="secondary" className="text-xs ml-auto">{items.length}</Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="space-y-2 pr-2">
                  {items.map((a) => {
                    const sla = getSLA(a);
                    return (
                      <Card
                        key={a.id}
                        className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${sla ? SLA_BG[sla.status] || "" : "border-l-transparent"}`}
                        onClick={() => setSelected(a)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-medium truncate flex-1">
                            {a.funcionario || "Sem nome"}
                          </p>
                          {sla && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className={`text-[10px] font-medium ${sla.color}`}>
                                    {sla.emoji} {sla.diasUteis}d
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent><p>{sla.label}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        <div className="mt-1.5 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{a.empresa || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatDateBR(a.data_atendimento)} {a.hora_inicial || ""}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{a.setor_responsavel || "—"}</span>
                          </div>
                        </div>

                        <div className="flex gap-1 mt-2 flex-wrap">
                          {a.agenda && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{a.agenda}</Badge>
                          )}
                          {a.tipo_prontuario && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize">{a.tipo_prontuario}</Badge>
                          )}
                          {a.base_socnet && (
                            <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700">SOC</Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Vazio</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
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
