import { useMemo, useState } from "react";
import { useASOAtendimentos } from "@/hooks/useASOData";
import { useFeriados } from "@/hooks/useFeriados";
import { useAuth } from "@/contexts/AuthContext";
import { useASOEtapaPermissions } from "@/hooks/useASOEtapaPermissions";
import { calcSLA } from "@/lib/aso/sla";
import { getAsoStageFromStatus, getAsoStageLabel, getCurrentStageDurationMs, getCurrentStageStartedAt, getTotalDurationMs } from "@/lib/aso/tempo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ASOWorkflowDrawer from "@/components/aso/ASOWorkflowDrawer";
import { AlertTriangle, CheckCircle, ChevronRight, Clock, ScanLine, Stethoscope } from "lucide-react";

interface Alert {
  id: string;
  atendimentoId: string;
  type: "exame_parado" | "assinatura_pendente" | "escaneamento_pendente" | "liberado_incompleto";
  groupStage: "recepcao" | "exames" | "assinatura" | "liberacao" | "faturamento";
  actionTab: "recepcao" | "exames" | "assinatura" | "liberacao";
  severity: "warning" | "critical";
  title: string;
  description: string;
  funcionario: string;
  empresa: string;
  diasUteis: number;
  totalDurationMs: number;
  stageDurationMs: number;
  stageStartedAtMs: number;
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
  const { role, isAdmin } = useAuth();
  const etapaPerms = useASOEtapaPermissions();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const alerts: Alert[] = [];
  const now = new Date();
  const feriadoList = feriados || [];

  const formatAlertDuration = (ms: number) => {
    const totalHours = Math.floor(ms / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) {
      return hours > 0 ? `${days} dia${days === 1 ? "" : "s"} ${hours}h` : `${days} dia${days === 1 ? "" : "s"}`;
    }

    if (totalHours > 0) return `${totalHours}h`;
    return "< 1h";
  };

  const canViewStage = (stage: Alert["groupStage"]) => {
    if (role === "adm_master" || isAdmin) return true;

    switch (stage) {
      case "recepcao":
        return etapaPerms.canEditRecepcao || etapaPerms.canAdvanceEtapa("recepcao");
      case "exames":
        return etapaPerms.canEditEnfermagem || etapaPerms.canAdvanceEtapa("enfermagem");
      case "assinatura":
        return etapaPerms.canEditAssinatura || etapaPerms.canAdvanceAssinatura;
      case "liberacao":
        return etapaPerms.canEditLiberacao || etapaPerms.canAdvanceEtapa("liberacao");
      case "faturamento":
        return etapaPerms.canEditFaturamento || etapaPerms.canAdvanceEtapa("faturamento");
      default:
        return false;
    }
  };

  (atendimentos || []).forEach((a) => {
    const timingRecord = a as unknown as Record<string, unknown>;
    const sla = calcSLA(a.data_atendimento, feriadoList, now);
    const totalDurationMs = getTotalDurationMs(timingRecord, now) ?? 0;
    const stageDurationMs = getCurrentStageDurationMs(timingRecord, now) ?? 0;
    const stageLabel = getAsoStageLabel(getAsoStageFromStatus(a.status));
    const stageStartedAtMs = getCurrentStageStartedAt(timingRecord)?.getTime() ?? new Date(a.data_atendimento).getTime();
    const timingLabel = `${formatAlertDuration(totalDurationMs)} total — ${formatAlertDuration(stageDurationMs)} em ${stageLabel}`;

    // Exame parado: aguardando_exames há mais de 3 dias úteis
    if (a.status === "aguardando_exames" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-exame",
        atendimentoId: a.id,
        type: "exame_parado",
        groupStage: "exames",
        actionTab: "exames",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Aguardando exames há ${sla.diasUteis} dias úteis`,
        description: `${a.id_interno} — Setor: ${a.setor_responsavel || "—"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        stageStartedAtMs,
        timingLabel,
      });
    }

    // Assinatura pendente: pronto_assinatura_medica há mais de 2 dias úteis
    if (a.status === "pronto_assinatura_medica" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-assin",
        atendimentoId: a.id,
        type: "assinatura_pendente",
        groupStage: "assinatura",
        actionTab: "assinatura",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Pronto para assinatura há ${sla.diasUteis} dias úteis`,
        description: `${a.id_interno} — Médico: ${a.medico || "—"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        stageStartedAtMs,
        timingLabel,
      });
    }

    // Escaneamento pendente: em_escaneamento há mais de 2 dias úteis
    if (a.status === "em_escaneamento" && sla.diasUteis >= 3) {
      alerts.push({
        id: a.id + "-scan",
        atendimentoId: a.id,
        type: "escaneamento_pendente",
        groupStage: "liberacao",
        actionTab: "liberacao",
        severity: sla.diasUteis >= 5 ? "critical" : "warning",
        title: `Prontuário físico parado no escaneamento há ${sla.diasUteis} dias úteis`,
        description: a.id_interno,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        stageStartedAtMs,
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
        atendimentoId: a.id,
        type: "liberado_incompleto",
        groupStage: a.status === "liberado_faturamento" ? "faturamento" : "liberacao",
        actionTab: "liberacao",
        severity: "critical",
        title: "Liberado sem conferência completa",
        description: `${a.id_interno} — Escaneado: ${a.escaneado ? "Sim" : "Não"} | Conferência: ${a.conferencia_final_ok ? "OK" : "Pendente"}`,
        funcionario: a.funcionario || "—",
        empresa: a.empresa || "—",
        diasUteis: sla.diasUteis,
        totalDurationMs,
        stageDurationMs,
        stageStartedAtMs,
        timingLabel,
      });
    }
  });

  const visibleAlerts = alerts.filter((alert) => canViewStage(alert.groupStage));

  const sortedAlerts = [...visibleAlerts].sort((a, b) => {
    if (b.stageDurationMs !== a.stageDurationMs) return b.stageDurationMs - a.stageDurationMs;
    if (b.totalDurationMs !== a.totalDurationMs) return b.totalDurationMs - a.totalDurationMs;
    return a.stageStartedAtMs - b.stageStartedAtMs;
  });

  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, Alert[]>();

    for (const alert of sortedAlerts) {
      const key = getAsoStageLabel(alert.groupStage);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(alert);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [sortedAlerts]);

  const criticalCount = visibleAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = visibleAlerts.filter((a) => a.severity === "warning").length;
  const selectedAtendimento = selectedAlert ? (atendimentos || []).find((item) => item.id === selectedAlert.atendimentoId) ?? null : null;

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
        {visibleAlerts.length === 0 && (
          <Badge className="text-xs bg-green-100 text-green-700">Tudo em dia ✅</Badge>
        )}
      </div>

      {groupedAlerts.length > 0 ? (
        <div className="space-y-4">
          {groupedAlerts.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{group.label}</h4>
                <Badge variant="outline" className="text-xs">{group.items.length}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((alert) => {
                  const config = ALERT_CONFIG[alert.type];
                  const Icon = config.icon;

                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => setSelectedAlert(alert)}
                      className="text-left"
                    >
                      <Card className={`border transition-colors hover:bg-muted/40 ${config.bg}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{alert.title}</p>
                                {alert.severity === "critical" && (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">CRÍTICO</Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{alert.timingLabel}</p>
                              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span>👤 {alert.funcionario}</span>
                                <span>🏢 {alert.empresa}</span>
                              </div>
                            </div>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Nenhum alerta no momento. Todos os atendimentos estão dentro do prazo. 🎉
          </CardContent>
        </Card>
      )}

      <ASOWorkflowDrawer
        atendimento={selectedAtendimento}
        open={!!selectedAlert}
        initialTab={selectedAlert?.actionTab}
        onClose={() => setSelectedAlert(null)}
        onUpdate={() => setSelectedAlert(null)}
      />
    </div>
  );
}
