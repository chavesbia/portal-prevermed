import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFeriados } from "@/hooks/useFeriados";
import { calcSLA } from "@/lib/aso/sla";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useASOExames, useASOExameMutations, useASOHistorico } from "@/hooks/useASOExames";
import { useQueryClient } from "@tanstack/react-query";
import { parseExamesTexto } from "@/lib/aso/examClassifier";
import {
  CheckCircle, Clock, Plus, Trash2, FileText,
  ClipboardCheck, Stethoscope, ScanLine, Receipt, History
} from "lucide-react";

function cleanAgenda(agenda: string | null): string {
  if (!agenda) return "—";
  const upper = agenda.toUpperCase();
  if (upper.includes("OSASCO")) return "Osasco";
  if (upper.includes("LAPA")) return "Lapa";
  return agenda;
}

const STATUS_LABELS: Record<string, string> = {
  importado: "Importado",
  em_triagem: "Em Triagem",
  aguardando_exames: "Aguard. Exames",
  pronto_assinatura_medica: "Assinatura Médica",
  em_escaneamento: "Escaneamento",
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

const WORKFLOW_STEPS = [
  { status: "importado", label: "Importado", icon: FileText },
  { status: "em_triagem", label: "Conferência", icon: ClipboardCheck },
  { status: "aguardando_exames", label: "Exames", icon: Clock },
  { status: "pronto_assinatura_medica", label: "Assinatura", icon: Stethoscope },
  { status: "em_escaneamento", label: "Escaneamento", icon: ScanLine },
  { status: "liberado", label: "Liberado", icon: CheckCircle },
  { status: "liberado_faturamento", label: "Faturamento", icon: Receipt },
  { status: "finalizado", label: "Finalizado", icon: CheckCircle },
];

const EXAME_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  datado_soc: "Datado SOC",
  inserido_socged: "Inserido SOCGED",
  concluido: "Concluído",
};

interface Props {
  atendimento: any;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ASOWorkflowDrawer({ atendimento, open, onClose, onUpdate }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("info");
  const [novoExame, setNovoExame] = useState("");
  const [novoExameTipo, setNovoExameTipo] = useState<"imediato" | "complementar">("complementar");

  // Local state that mirrors the atendimento for instant UI updates
  const [local, setLocal] = useState<any>(null);

  useEffect(() => {
    if (atendimento) {
      setLocal({ ...atendimento });
    }
  }, [atendimento]);

  const a = local || atendimento;
  const { data: exames } = useASOExames(a?.id);
  const { data: historico } = useASOHistorico(a?.id);
  const { data: feriados } = useFeriados();
  const exameMutations = useASOExameMutations(a?.id ?? "");

  if (!a) return null;

  const ACTIVE_STATUSES = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];
  const sla = ACTIVE_STATUSES.includes(a.status) ? calcSLA(a.data_atendimento, feriados || []) : null;
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.status === a.status);

  const updateField = async (field: string, value: any) => {
    // Optimistic local update
    setLocal((prev: any) => prev ? { ...prev, [field]: value } : prev);

    const { error } = await supabase
      .from("aso_atendimentos")
      .update({ [field]: value } as any)
      .eq("id", a.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      // Revert
      setLocal((prev: any) => prev ? { ...prev, [field]: a[field] } : prev);
      return;
    }
    await supabase.from("aso_historico").insert({
      atendimento_id: a.id,
      user_id: profile?.user_id,
      user_name: profile?.full_name,
      acao: "alteracao_campo",
      campo: field,
      valor_antigo: String(atendimento?.[field] ?? ""),
      valor_novo: String(value),
    } as any);
    onUpdate();
    qc.invalidateQueries({ queryKey: ["aso-historico", a.id] });
  };

  const updateMultipleFields = async (fields: Record<string, any>) => {
    setLocal((prev: any) => prev ? { ...prev, ...fields } : prev);
    const { error } = await supabase
      .from("aso_atendimentos")
      .update(fields as any)
      .eq("id", a.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    for (const [field, value] of Object.entries(fields)) {
      await supabase.from("aso_historico").insert({
        atendimento_id: a.id,
        user_id: profile?.user_id,
        user_name: profile?.full_name,
        acao: "alteracao_campo",
        campo: field,
        valor_antigo: String(atendimento?.[field] ?? ""),
        valor_novo: String(value),
      } as any);
    }
    onUpdate();
    qc.invalidateQueries({ queryKey: ["aso-historico", a.id] });
  };

  const advanceStatus = async (newStatus: string, newSetor: string) => {
    setLocal((prev: any) => prev ? { ...prev, status: newStatus, setor_responsavel: newSetor } : prev);
    const { error } = await supabase
      .from("aso_atendimentos")
      .update({ status: newStatus, setor_responsavel: newSetor } as any)
      .eq("id", a.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("aso_historico").insert({
      atendimento_id: a.id,
      user_id: profile?.user_id,
      user_name: profile?.full_name,
      acao: "avanco_status",
      campo: "status",
      valor_antigo: a.status,
      valor_novo: newStatus,
      observacao: `Setor: ${newSetor}`,
    } as any);
    toast({ title: "Status atualizado", description: STATUS_LABELS[newStatus] });
    onUpdate();
    qc.invalidateQueries({ queryKey: ["aso-historico", a.id] });
  };

  const iniciarConferencia = async () => {
    await advanceStatus("em_triagem", getSetorRecepcao());
    // Auto-create individual exams from exames_texto if none exist yet
    if (a.exames_texto && (!exames || exames.length === 0)) {
      const parsed = parseExamesTexto(a.exames_texto);
      if (parsed.length > 0) {
        const records = parsed.map(e => ({
          atendimento_id: a.id,
          nome_exame: e.nome_exame,
          tipo: e.tipo,
        }));
        await supabase.from("aso_exames_atendimento").insert(records as any);
        const hasCompl = parsed.some(e => e.tipo === "complementar");
        if (hasCompl) {
          await supabase.from("aso_atendimentos").update({ possui_exame_complementar: true } as any).eq("id", a.id);
          setLocal((prev: any) => prev ? { ...prev, possui_exame_complementar: true } : prev);
        }
        qc.invalidateQueries({ queryKey: ["aso-exames", a.id] });
        onUpdate();
      }
    }
    setTab("recepcao");
  };

  // Handle tipo_prontuario change with auto-set of tipo_assinatura
  const handleTipoProntuarioChange = (v: string) => {
    const val = v === "none" ? null : v;
    const updates: Record<string, any> = { tipo_prontuario: val };
    if (val === "digital") {
      updates.tipo_assinatura = "digital";
      // Auto-fill data_assinatura with data_atendimento
      if (!a.data_assinatura && a.data_atendimento) {
        updates.data_assinatura = a.data_atendimento;
      }
    }
    updateMultipleFields(updates);
  };

  const complementaresPendentes = exames?.filter(
    e => e.tipo === "complementar" && e.status !== "concluido"
  ) || [];
  const hasComplementares = exames?.some(e => e.tipo === "complementar") || false;
  const allExamesConcluidos = !hasComplementares || complementaresPendentes.length === 0;

  const canAdvanceFromTriagem = (): { ok: boolean; msg?: string } => {
    if (!a.tipo_prontuario) return { ok: false, msg: "Defina o tipo de prontuário" };
    if (!a.ficha_clinica_ok) return { ok: false, msg: "Confirme a Ficha Clínica" };
    return { ok: true };
  };

  const canAdvanceFromExames = (): { ok: boolean; msg?: string } => {
    if (!allExamesConcluidos) return { ok: false, msg: `${complementaresPendentes.length} exame(s) pendente(s)` };
    return { ok: true };
  };

  const canAdvanceFromAssinatura = (): { ok: boolean; msg?: string } => {
    if (!a.aso_assinado) return { ok: false, msg: "ASO não assinado" };
    return { ok: true };
  };

  const canAdvanceFromEscaneamento = (): { ok: boolean; msg?: string } => {
    if (!a.escaneado) return { ok: false, msg: "Prontuário não escaneado" };
    if (!a.salvo_rede) return { ok: false, msg: "Não salvo na rede" };
    if (!a.conferencia_final_ok) return { ok: false, msg: "Conferência final pendente" };
    return { ok: true };
  };

  const getNextAction = (): { label: string; action: () => void; validate: () => { ok: boolean; msg?: string } } | null => {
    switch (a.status) {
      case "importado":
        return { label: "Iniciar Conferência", action: () => iniciarConferencia(), validate: () => ({ ok: true }) };
      case "em_triagem": {
        const v = canAdvanceFromTriagem();
        if (a.possui_exame_complementar) {
          return { label: "Enviar para Aguardando Exames", action: () => advanceStatus("aguardando_exames", getSetorEnfermagem()), validate: () => v };
        }
        return { label: "Enviar para Assinatura Médica", action: () => advanceStatus("pronto_assinatura_medica", "Médico"), validate: () => v };
      }
      case "aguardando_exames": {
        const v = canAdvanceFromExames();
        return { label: "Enviar para Assinatura Médica", action: () => advanceStatus("pronto_assinatura_medica", "Médico"), validate: () => v };
      }
      case "pronto_assinatura_medica": {
        const v = canAdvanceFromAssinatura();
        if (a.tipo_prontuario === "fisico") {
          return { label: "Enviar para Escaneamento", action: () => advanceStatus("em_escaneamento", "Liberação / Digitalização"), validate: () => v };
        }
        return { label: "Liberar para Faturamento", action: () => advanceStatus("liberado_faturamento", "Faturamento"), validate: () => v };
      }
      case "em_escaneamento": {
        const v = canAdvanceFromEscaneamento();
        return { label: "Liberar para Faturamento", action: () => advanceStatus("liberado_faturamento", "Faturamento"), validate: () => v };
      }
      case "liberado":
        return { label: "Liberar para Faturamento", action: () => advanceStatus("liberado_faturamento", "Faturamento"), validate: () => ({ ok: true }) };
      case "liberado_faturamento":
        return { label: "Finalizar", action: () => advanceStatus("finalizado", "Concluído"), validate: () => ({ ok: true }) };
      default:
        return null;
    }
  };

  const getSetorRecepcao = () => a.agenda?.toLowerCase().includes("osasco") ? "Recepção Osasco" : "Recepção Lapa";
  const getSetorEnfermagem = () => a.agenda?.toLowerCase().includes("osasco") ? "Enfermagem Osasco" : "Enfermagem Lapa";

  const nextAction = getNextAction();

  const handleAdvance = () => {
    if (!nextAction) return;
    const v = nextAction.validate();
    if (!v.ok) {
      toast({ title: "Não é possível avançar", description: v.msg, variant: "destructive" });
      return;
    }
    nextAction.action();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto p-0">
        <div className="p-6 pb-3">
          <SheetHeader>
            <SheetTitle className="text-lg font-mono">{a.id_interno}</SheetTitle>
          </SheetHeader>

          {/* Workflow progress */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const isActive = i === currentStepIndex;
              const isDone = i < currentStepIndex;
              const Icon = step.icon;
              return (
                <div key={step.status} className="flex items-center">
                  <div className={`flex flex-col items-center min-w-[50px] ${isActive ? "opacity-100" : isDone ? "opacity-70" : "opacity-30"}`}>
                    <div className={`rounded-full p-1.5 ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-[10px] mt-1 text-center leading-tight">{step.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className={`w-4 h-px ${isDone ? "bg-green-400" : "bg-border"} mx-0.5 mt-[-12px]`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current status + action */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${STATUS_COLORS[a.status] || ""} text-sm`}>
                {STATUS_LABELS[a.status] || a.status}
              </Badge>
              {sla && (
                <Badge className={`text-xs ${sla.bgColor} ${sla.color}`}>
                  {sla.emoji} {sla.diasUteis}d úteis — {sla.label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Setor: {a.setor_responsavel || "—"}
              </span>
            </div>
            {nextAction && a.status !== "finalizado" && (
              <Button size="sm" onClick={handleAdvance}>
                {nextAction.label}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <Tabs value={tab} onValueChange={setTab} className="px-6 pt-3">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="recepcao" className="text-xs">Recepção</TabsTrigger>
            <TabsTrigger value="exames" className="text-xs">Exames</TabsTrigger>
            <TabsTrigger value="assinatura" className="text-xs">Assinatura</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          {/* TAB: Info (read-only) */}
          <TabsContent value="info" className="space-y-4 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Funcionário", a.funcionario],
                ["CPF", a.cpf],
                ["Empresa", a.empresa],
                ["Agenda", cleanAgenda(a.agenda)],
                ["Data", formatDateBR(a.data_atendimento)],
                ["Hora", a.hora_inicial],
                ["Médico", a.medico],
                ["Tipo ASO", a.tipo_compromisso],
                ["Cargo", a.cargo],
                ["Setor", a.setor],
                ["Unidade", a.unidade],
                ["Usuário SOC", a.usuario_soc],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <Label className="text-xs text-muted-foreground">{label as string}</Label>
                  <p className="text-sm">{(val as string) || "—"}</p>
                </div>
              ))}
            </div>
            {a.detalhes && (
              <div>
                <Label className="text-xs text-muted-foreground">Detalhes</Label>
                <p className="text-sm bg-muted/50 p-2 rounded">{a.detalhes}</p>
              </div>
            )}
            {a.exames_texto && (
              <div>
                <Label className="text-xs text-muted-foreground">Exames (texto importado)</Label>
                <p className="text-sm bg-muted/50 p-2 rounded whitespace-pre-wrap">{a.exames_texto}</p>
              </div>
            )}
          </TabsContent>

          {/* TAB: Recepção */}
          <TabsContent value="recepcao" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Conferência da Recepção
            </h4>

            {/* Tipo Prontuário + Base SOCNET */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tipo de Prontuário</Label>
                <Select
                  value={a.tipo_prontuario || "none"}
                  onValueChange={handleTipoProntuarioChange}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={a.base_socnet || false}
                  onCheckedChange={(v) => updateField("base_socnet", v)}
                />
                <Label className="text-sm">Base SOCNET</Label>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              {[
                { field: "ficha_clinica_ok", label: "Ficha Clínica" },
                { field: "vias_aso_ok", label: "ASO" },
              ].map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between py-1">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={a[field] || false}
                    onCheckedChange={(v) => updateField(field, v)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm font-medium">Possui exame complementar pendente?</Label>
                <p className="text-xs text-muted-foreground">Se não selecionar, o exame está OK</p>
              </div>
              <Switch
                checked={a.possui_exame_complementar || false}
                onCheckedChange={(v) => updateField("possui_exame_complementar", v)}
              />
            </div>

            <div>
              <Label className="text-xs">Observações da Recepção</Label>
              <Textarea
                className="mt-1"
                rows={3}
                defaultValue={a.observacoes_recepcao || ""}
                key={`obs-rec-${a.id}-${a.observacoes_recepcao}`}
                onBlur={(e) => {
                  if (e.target.value !== (a.observacoes_recepcao || "")) {
                    updateField("observacoes_recepcao", e.target.value);
                  }
                }}
              />
            </div>
          </TabsContent>

          {/* TAB: Exames */}
          <TabsContent value="exames" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Exames Complementares
            </h4>

            <div className="flex gap-2">
              <Input
                placeholder="Nome do exame"
                value={novoExame}
                onChange={(e) => setNovoExame(e.target.value)}
                className="flex-1"
              />
              <Select value={novoExameTipo} onValueChange={(v: any) => setNovoExameTipo(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Imediato</SelectItem>
                  <SelectItem value="complementar">Complementar</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!novoExame.trim() || exameMutations?.addExame.isPending}
                onClick={() => {
                  exameMutations?.addExame.mutate({ nome_exame: novoExame.trim(), tipo: novoExameTipo });
                  setNovoExame("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {exames && exames.length > 0 ? (
              <div className="space-y-3">
                {exames.map((ex) => (
                  <Card key={ex.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{ex.nome_exame}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">
                          {ex.tipo === "complementar" ? "Complementar" : "Imediato"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={ex.status === "concluido" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}>
                          {EXAME_STATUS_LABELS[ex.status] || ex.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => exameMutations?.deleteExame.mutate(ex.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {ex.tipo === "complementar" && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Status</Label>
                          <Select
                            value={ex.status}
                            onValueChange={(v) => exameMutations?.updateExame.mutate({ id: ex.id, field: "status", value: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(EXAME_STATUS_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px]">Data Recebimento</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            defaultValue={ex.data_recebimento || ""}
                            onChange={(e) => exameMutations?.updateExame.mutate({ id: ex.id, field: "data_recebimento", value: e.target.value || null })}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Datado SOC</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            defaultValue={ex.data_datado_soc || ""}
                            onChange={(e) => exameMutations?.updateExame.mutate({ id: ex.id, field: "data_datado_soc", value: e.target.value || null })}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Inserido SOCGED</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            defaultValue={ex.data_inserido_socged || ""}
                            onChange={(e) => exameMutations?.updateExame.mutate({ id: ex.id, field: "data_inserido_socged", value: e.target.value || null })}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum exame cadastrado</p>
            )}

            {hasComplementares && (
              <div className={`p-3 rounded-lg text-sm ${allExamesConcluidos ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                {allExamesConcluidos
                  ? "✅ Todos os exames complementares concluídos"
                  : `⏳ ${complementaresPendentes.length} exame(s) complementar(es) pendente(s)`}
              </div>
            )}
          </TabsContent>

          {/* TAB: Assinatura + Escaneamento */}
          <TabsContent value="assinatura" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Assinatura Médica
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <Label className="text-sm">ASO assinado?</Label>
                <Switch
                  checked={a.aso_assinado || false}
                  onCheckedChange={(v) => updateField("aso_assinado", v)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo de Assinatura</Label>
                  <Select
                    value={a.tipo_assinatura || "none"}
                    onValueChange={(v) => updateField("tipo_assinatura", v === "none" ? null : v)}
                    disabled={a.tipo_prontuario === "digital"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não definido</SelectItem>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  {a.tipo_prontuario === "digital" && (
                    <p className="text-[10px] text-muted-foreground mt-1">Prontuário digital → assinatura digital</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Data da Assinatura</Label>
                  <Input
                    type="date"
                    key={`data-ass-${a.id}-${a.data_assinatura}`}
                    defaultValue={a.data_assinatura || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (a.data_assinatura || "")) {
                        updateField("data_assinatura", e.target.value || null);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações da Assinatura</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  key={`obs-ass-${a.id}-${a.observacoes_assinatura}`}
                  defaultValue={a.observacoes_assinatura || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (a.observacoes_assinatura || "")) {
                      updateField("observacoes_assinatura", e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            {/* Escaneamento section - only for physical records */}
            {a.tipo_prontuario === "fisico" && (
              <>
                <Separator />
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <ScanLine className="h-4 w-4" /> Escaneamento / Digitalização
                </h4>
                <div className="space-y-3">
                  {[
                    { field: "escaneado", label: "Escaneado" },
                    { field: "renomeado", label: "Renomeado" },
                    { field: "salvo_rede", label: "Salvo na rede" },
                    { field: "salvo_socged", label: "Salvo no SOCGED" },
                    { field: "email_enviado", label: "E-mail enviado" },
                    { field: "conferencia_final_ok", label: "Conferência final OK" },
                  ].map(({ field, label }) => (
                    <div key={field} className="flex items-center justify-between py-1">
                      <Label className="text-sm">{label}</Label>
                      <Switch
                        checked={a[field] || false}
                        onCheckedChange={(v) => updateField(field, v)}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-xs">Observações do Escaneamento</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    key={`obs-esc-${a.id}-${a.observacoes_escaneamento}`}
                    defaultValue={a.observacoes_escaneamento || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (a.observacoes_escaneamento || "")) {
                        updateField("observacoes_escaneamento", e.target.value);
                      }
                    }}
                  />
                </div>
              </>
            )}

            {/* Faturamento obs */}
            <Separator />
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Faturamento
            </h4>
            <div>
              <Label className="text-xs">Observações do Faturamento</Label>
              <Textarea
                className="mt-1"
                rows={2}
                key={`obs-fat-${a.id}-${a.observacoes_faturamento}`}
                defaultValue={a.observacoes_faturamento || ""}
                onBlur={(e) => {
                  if (e.target.value !== (a.observacoes_faturamento || "")) {
                    updateField("observacoes_faturamento", e.target.value);
                  }
                }}
              />
            </div>
          </TabsContent>

          {/* TAB: Histórico */}
          <TabsContent value="historico" className="space-y-2 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Rastreabilidade
            </h4>
            {historico && historico.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {historico.map((h) => (
                  <div key={h.id} className="border rounded p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{h.acao}</span>
                      <span className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {h.campo && (
                      <p className="text-muted-foreground">
                        Campo: <strong>{h.campo}</strong>
                        {h.valor_antigo && <> | De: {h.valor_antigo}</>}
                        {h.valor_novo && <> | Para: {h.valor_novo}</>}
                      </p>
                    )}
                    {h.observacao && <p className="text-muted-foreground">{h.observacao}</p>}
                    <p className="text-muted-foreground">Por: {h.user_name || "Sistema"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
