import { useASOAtendimentos } from "@/hooks/useASOData";
import { useFeriados } from "@/hooks/useFeriados";
import { calcSLA } from "@/lib/aso/sla";
import { formatDuration, getAsoStageFromStatus, getAsoStageLabel, getCurrentStageDurationMs, getTotalDurationMs } from "@/lib/aso/tempo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Stethoscope, ScanLine, CheckCircle } from "lucide-react";

interface Alert {
  id: string;
  type: "exame_parado" | "assinatura_pendente" | "escaneamento_pendente" | "liberado_incompleto";
  severity: "warning" | "critical";
  title: string;
  description: string;
  funcionario: string;
  empresa: string;
  diasUteis: number;
  totalDurationMs: number;
  stageDurationMs: number;
  timingLabel: string;
}

const ALERT_CONFIG = {
  exame_parado: { icon: Clock, label: "Exame parado", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  assinatura_pendente: { icon: Stethoscope, label: "Assinatura pendente", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  escaneamento_pendente: { icon: ScanLine, label: "Escaneamento pendente", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
  liberado_incompleto: { icon: CheckCircle, label: "Liberação incompleta", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

export default function ASOAlertas() {
  const { data: atendimentos } = useASOAtendimentos({});
  const { data: feriados } = useFeriados();

  const alerts: Alert[] = [];
  const now = new Date();
  const feriadoList = feriados || [];

  (atendimentos || []).forEach((a) => {
    const timingRecord = a as unknown as Record<string, unknown>;
    const sla = calcSLA(a.data_atendimento, feriadoList, now);
    const totalDurationMs = getTotalDurationMs(timingRecord, now) ?? 0;
    const stageDurationMs = getCurrentStageDurationMs(timingRecord, now) ?? 0;
    const stageLabel = getAsoStageLabel(getAsoStageFromStatus(a.status));
    const timingLabel = `${formatDuration(totalDurationMs)} total — ${formatDuration(stageDurationMs)} em ${stageLabel}`;

    // Exame parado: aguardando_exames há mais de 3 dias úteis
    if (a.status === "aguardando_exames" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-exame",
        type: "exame_parado",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Aguardando exames há ${sla.diasUteis} dias úteis`,
        description: `${a.id_interno} — Setor: ${a.setor_responsavel || "—"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        timingLabel,
      });
    }

    // Assinatura pendente: pronto_assinatura_medica há mais de 2 dias úteis
    if (a.status === "pronto_assinatura_medica" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-assin",
        type: "assinatura_pendente",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Pronto para assinatura há ${sla.diasUteis} dias úteis`,
        description: `${a.id_interno} — Médico: ${a.medico || "—"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        timingLabel,
      });
    }

    // Escaneamento pendente: em_escaneamento há mais de 2 dias úteis
    if (a.status === "em_escaneamento" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-scan",
        type: "escaneamento_pendente",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Prontuário físico parado no escaneamento há ${sla.diasUteis} dias úteis`,
        description: a.id_interno,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        timingLabel,
      });
    }

    // Liberado sem conferência completa
    if (
      (a.status === "liberado" || a.status === "liberado_faturamento") &&
      a.tipo_prontuario === "fisico" &&
      (!a.escaneado || !a.conferencia_final_ok)
    ) {
      alerts.push({
        id: a.id + "-lib",
        type: "liberado_incompleto",
        severity: "critical",
        title: "Liberado sem conferência completa",
        description: `${a.id_interno} — Escaneado: ${a.escaneado ? "Sim" : "Não"} | Conferência: ${a.conferencia_final_ok ? "OK" : "Pendente"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        timingLabel,
      });
    }
  });

  // Sort: critical first, then by dias
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    if (b.diasUteis !== a.diasUteis) return b.diasUteis - a.diasUteis;
    return b.stageDurationMs - a.stageDurationMs;
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas Operacionais
        </h3>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-xs">{criticalCount} crítico(s)</Badge>
        )}
        {warningCount > 0 && (
          <Badge className="text-xs bg-yellow-100 text-yellow-700">{warningCount} atenção</Badge>
        )}
        {alerts.length === 0 && (
          <Badge className="text-xs bg-green-100 text-green-700">Tudo em dia ✅</Badge>
        )}
      </div>

      {alerts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alerts.slice(0, 20).map((alert) => {
            const config = ALERT_CONFIG[alert.type];
            const Icon = config.icon;
            return (
              <Card key={alert.id} className={`border ${config.bg}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{alert.title}</p>
                        {alert.severity === "critical" && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">CRÍTICO</Badge>
                        )}
                      </div>
                       <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                       <p className="text-xs text-muted-foreground mt-1">{alert.timingLabel}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>👤 {alert.funcionario}</span>
                        <span>🏢 {alert.empresa}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Nenhum alerta no momento. Todos os atendimentos estão dentro do prazo. 🎉
          </CardContent>
        </Card>
      )}
    </div>
  );
}
