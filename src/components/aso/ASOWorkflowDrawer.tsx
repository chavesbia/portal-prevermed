import { useState, useEffect } from "react";
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
import { useASOEtapaPermissions, type ASOEtapa } from "@/hooks/useASOEtapaPermissions";
import { useQueryClient } from "@tanstack/react-query";
import { parseExamesTexto, classifyExame, podeRecepcaoLiberar } from "@/lib/aso/examClassifier";
import {
  CheckCircle, Clock, Plus, Trash2, FileText, AlertTriangle,
  ClipboardCheck, Stethoscope, ScanLine, Receipt, History,
  Syringe, Eye as EyeIcon, Info, Lock
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

const WORKFLOW_STEPS = [
  { status: "importado", label: "Importado", icon: FileText },
  { status: "em_triagem", label: "Inicial", icon: ClipboardCheck },
  { status: "aguardando_exames", label: "Exames Pendentes", icon: Syringe },
  { status: "pronto_assinatura_medica", label: "Assinatura", icon: Stethoscope },
  { status: "em_escaneamento", label: "Liberação", icon: ScanLine },
  { status: "liberado", label: "Liberado", icon: CheckCircle },
  { status: "liberado_faturamento", label: "Faturamento", icon: Receipt },
  { status: "fechado", label: "Fechado", icon: CheckCircle },
];

/** Mapeia status do prontuário → etapa de permissão. */
function statusToEtapa(status: string): ASOEtapa | null {
  switch (status) {
    case "importado":
    case "em_triagem":
      return "recepcao";
    case "aguardando_exames":
      return "enfermagem";
    case "pronto_assinatura_medica":
      return "assinatura";
    case "em_escaneamento":
      return "liberacao";
    case "liberado":
    case "liberado_faturamento":
      return "faturamento";
    default:
      return null;
  }
}

// Friendly field labels for history
const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  tipo_prontuario: "Tipo de Prontuário",
  base_socnet: "Base SOCNET",
  ficha_clinica_ok: "Ficha Clínica",
  vias_aso_ok: "ASO",
  possui_exame_complementar: "Exame Complementar Pendente",
  aso_assinado: "ASO Assinado",
  tipo_assinatura: "Tipo de Assinatura",
  data_assinatura: "Data da Assinatura",
  escaneado: "Escaneado",
  renomeado: "Renomeado",
  salvo_rede: "Salvo na Rede",
  salvo_socged: "Inserido no SOCGED",
  email_enviado: "E-mail Enviado",
  conferencia_final_ok: "Conferência Final",
  observacoes_recepcao: "Observações da Recepção",
  observacoes_assinatura: "Observações da Assinatura",
  observacoes_escaneamento: "Observações da Liberação",
  observacoes_faturamento: "Observações do Faturamento",
  setor_responsavel: "Setor Responsável",
};

const ACTION_LABELS: Record<string, string> = {
  avanco_status: "Avanço de status",
  alteracao_campo: "Alteração de campo",
  alteracao_exame: "Alteração de exame",
  exame_adicionado: "Exame adicionado",
  exame_removido: "Exame removido",
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
  const [local, setLocal] = useState<any>(null);
  const etapaPerms = useASOEtapaPermissions();
  const canAccessAssinatura = etapaPerms.canEditAssinatura || etapaPerms.canAdvanceAssinatura;

  useEffect(() => {
    if (atendimento) {
      setLocal({ ...atendimento });
    }
  }, [atendimento]);

  useEffect(() => {
    if (tab === "assinatura" && !canAccessAssinatura) {
      setTab("info");
    }
  }, [tab, canAccessAssinatura]);

  const a = local || atendimento;
  const { data: exames } = useASOExames(a?.id);
  const { data: historico } = useASOHistorico(a?.id);
  const { data: feriados } = useFeriados();
  const exameMutations = useASOExameMutations(a?.id ?? "");

  if (!a) return null;

  const ACTIVE_STATUSES = ["importado", "em_triagem", "aguardando_exames", "pronto_assinatura_medica", "em_escaneamento"];
  const sla = ACTIVE_STATUSES.includes(a.status) ? calcSLA(a.data_atendimento, feriados || []) : null;
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.status === a.status);

  const isDigital = a.tipo_prontuario === "digital";
  const isFisico = a.tipo_prontuario === "fisico";

  // ── ETAPA / BLOQUEIOS ──
  const etapaAtual = statusToEtapa(a.status);
  const isImportado = a.status === "importado";
  const isFechado = a.status === "fechado" || a.status === "finalizado";

  // Pode atuar na etapa atual?
  const canEditEtapaAtual = !isFechado && (etapaAtual ? etapaPerms.canEditEtapa(etapaAtual) : false);
  const canManageRecepcaoSetup = !isFechado && etapaAtual === "recepcao" && etapaPerms.canEditRecepcao;

  // Recepção só edita checklist após "Iniciar Conferência" (status sai de 'importado')
  const canEditRecepcao = !isImportado && canManageRecepcaoSetup;
  const canEditEnfermagem = !isFechado && etapaAtual === "enfermagem" && etapaPerms.canEditEnfermagem;
  const canEditAssinatura = !isFechado && etapaAtual === "assinatura" && etapaPerms.canEditAssinatura;
  const canEditLiberacao = !isFechado && etapaAtual === "liberacao" && etapaPerms.canEditLiberacao;
  const canEditFaturamento = !isFechado && etapaAtual === "faturamento" && etapaPerms.canEditFaturamento;
  const canManageExames = canEditEnfermagem;
  const canAdvanceCurrentStage = etapaAtual === "assinatura"
    ? !isFechado && etapaPerms.canAdvanceAssinatura
    : canEditEtapaAtual;
  
  // FONTE DE VERDADE: parse do exames_texto (raw da agenda SOC) como fallback quando ainda não há registros
  const parsedFromRaw = a.exames_texto ? parseExamesTexto(a.exames_texto) : [];
  const hasRawExames = parsedFromRaw.length > 0;

  // Differentiate "sem exames" vs "sem exames complementares"
  const totalExames = exames?.length ?? 0;
  const examesClinicos = exames?.filter(e => e.nome_exame === "Exame Clínico") || [];
  const examesImediatos = exames?.filter(e => {
    const tipo = classifyExame(e.nome_exame);
    return tipo === "imediato" && e.nome_exame !== "Exame Clínico";
  }) || [];
  const examesComplementaresReais = exames?.filter(e => {
    const tipo = classifyExame(e.nome_exame);
    return tipo === "complementar";
  }) || [];
  const todosExamesNaoClinicos = exames?.filter(e => e.nome_exame !== "Exame Clínico") || [];
  const examesPendentes = todosExamesNaoClinicos.filter(e => e.status !== "liberado" && e.status !== "concluido");
  const hasComplementaresReais = examesComplementaresReais.length > 0;
  const allExamesLiberados = todosExamesNaoClinicos.length > 0 && examesPendentes.length === 0;

  // "Sem exames" = SEM nada nem no raw nem na tabela
  const semExamesNenhum = exames !== undefined && totalExames === 0 && !hasRawExames;

  // "Sem exames complementares" = só tem clínico (considera tabela ou raw)
  const nomesEfetivos = totalExames > 0
    ? exames!.map(e => e.nome_exame)
    : parsedFromRaw.map(e => e.nome_exame);
  const apenasClinico = nomesEfetivos.length > 0 && nomesEfetivos.every(n => n === "Exame Clínico");

  // Can reception release directly? Only if exams are just clinical + immediate
  const recepcaoPodeLiberar = nomesEfetivos.length > 0
    ? podeRecepcaoLiberar(nomesEfetivos)
    : !a.possui_exame_complementar;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
    qc.invalidateQueries({ queryKey: ["aso-stats"] });
    qc.invalidateQueries({ queryKey: ["aso-historico", a.id] });
    qc.invalidateQueries({ queryKey: ["aso-exames", a.id] });
    onUpdate();
  };

  const updateField = async (field: string, value: any) => {
    setLocal((prev: any) => prev ? { ...prev, [field]: value } : prev);
    const { error } = await supabase
      .from("aso_atendimentos")
      .update({ [field]: value } as any)
      .eq("id", a.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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
    invalidateAll();
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
    invalidateAll();
  };

  const advanceStatus = async (newStatus: string, newSetor: string) => {
    setLocal((prev: any) => prev ? { ...prev, status: newStatus, setor_responsavel: newSetor } : prev);
    const { data, error } = await supabase
      .from("aso_atendimentos")
      .update({ status: newStatus, setor_responsavel: newSetor } as any)
      .eq("id", a.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast({ title: "Erro", description: error?.message || "Você não tem permissão para alterar o status deste prontuário.", variant: "destructive" });
      setLocal((prev: any) => prev ? { ...prev, status: a.status, setor_responsavel: a.setor_responsavel } : prev);
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
    invalidateAll();
  };

  // Auto-apply signature effects for immediate release cases
  const applyAutoSignature = async () => {
    const updates: Record<string, any> = { aso_assinado: true };
    if (!a.data_assinatura) {
      updates.data_assinatura = new Date().toISOString().slice(0, 10);
    }
    await updateMultipleFields(updates);
    // Auto-liberar exame clínico
    if (examesClinicos.length > 0) {
      for (const ex of examesClinicos) {
        if (ex.status === "realizado") {
          await exameMutations?.updateExame.mutateAsync({ id: ex.id, field: "status", value: "liberado" });
        }
      }
    }
  };

  const iniciarConferencia = async () => {
    if (!canManageRecepcaoSetup) {
      toast({ title: "Acesso negado", description: "Somente a equipe de Recepção pode iniciar a conferência.", variant: "destructive" });
      return;
    }
    if (!a.tipo_prontuario) {
      toast({ title: "Não é possível avançar", description: "Selecione o Tipo de Prontuário (Digital ou Físico) antes de iniciar a conferência.", variant: "destructive" });
      return;
    }
    // Auto-create individual exams from exames_texto (sempre lê do raw da agenda SOC)
    if (a.exames_texto && (!exames || exames.length === 0)) {
      const parsed = parseExamesTexto(a.exames_texto);
      if (parsed.length > 0) {
        const records = parsed.map(e => ({
          atendimento_id: a.id,
          nome_exame: e.nome_exame,
          tipo: e.tipo,
          status: e.status_inicial,
        }));
        const { error: insErr } = await supabase.from("aso_exames_atendimento").insert(records as any);
        if (insErr) {
          toast({ title: "Erro ao criar exames", description: insErr.message, variant: "destructive" });
        }
        const nomes = parsed.map(e => e.nome_exame);
        const apenasRecepcao = podeRecepcaoLiberar(nomes);
        if (!apenasRecepcao) {
          await supabase.from("aso_atendimentos").update({ possui_exame_complementar: true } as any).eq("id", a.id);
          setLocal((prev: any) => prev ? { ...prev, possui_exame_complementar: true } : prev);
        }
        qc.invalidateQueries({ queryKey: ["aso-exames", a.id] });
      }
    }
    await advanceStatus("em_triagem", getSetorRecepcao());
    setTab("recepcao");
  };

  const handleTipoProntuarioChange = (v: string) => {
    const val = v === "none" ? null : v;
    const updates: Record<string, any> = { tipo_prontuario: val };
    if (val === "digital") {
      updates.tipo_assinatura = "digital";
      if (!a.data_assinatura && a.data_atendimento) {
        updates.data_assinatura = a.data_atendimento;
      }
    } else if (val === "fisico") {
      updates.tipo_assinatura = "manual";
    }
    updateMultipleFields(updates);
  };

  const getSetorRecepcao = () => a.agenda?.toLowerCase().includes("osasco") ? "Recepção Osasco" : "Recepção Lapa";
  const getSetorEnfermagem = () => a.agenda?.toLowerCase().includes("osasco") ? "Enfermagem Osasco" : "Enfermagem Lapa";
  const getSetorLiberacao = () => "Liberação";

  // Auto-liberar exame clínico quando ASO assinado + data preenchida
  const autoLiberarClinico = async () => {
    if (examesClinicos.length === 0) return;
    for (const ex of examesClinicos) {
      if (ex.status !== "liberado") {
        await exameMutations?.updateExame.mutateAsync({ id: ex.id, field: "status", value: "liberado" });
      }
    }
  };

  const handleAsoAssinado = async (v: boolean) => {
    await updateField("aso_assinado", v);
    if (v && a.data_assinatura) {
      await autoLiberarClinico();
    }
  };

  const handleDataAssinatura = async (v: string) => {
    await updateField("data_assinatura", v || null);
    if (v && a.aso_assinado) {
      await autoLiberarClinico();
    }
  };

  // ── FLOW LOGIC ──
  const getNextAction = (): { label: string; action: () => void; validate: () => { ok: boolean; msg?: string } } | null => {
    switch (a.status) {
      case "importado":
        return {
          label: "Iniciar Conferência",
          action: iniciarConferencia,
          validate: () => {
            if (!a.tipo_prontuario) return { ok: false, msg: "Selecione o Tipo de Prontuário (Digital ou Físico)" };
            return { ok: true };
          },
        };

      case "em_triagem": {
        if (a.possui_exame_complementar && !recepcaoPodeLiberar) {
          return {
            label: "Enviar para Exames Pendentes",
            action: () => advanceStatus("aguardando_exames", getSetorEnfermagem()),
            validate: () => {
              if (!a.tipo_prontuario) return { ok: false, msg: "Defina o tipo de prontuário" };
              return { ok: true };
            },
          };
        }
        if (isDigital) {
          return {
            label: "Liberar Prontuário",
            action: async () => {
              // Auto-apply signature effects before liberating
              await applyAutoSignature();
              await advanceStatus("liberado", "Liberação");
            },
            validate: () => {
              if (!a.tipo_prontuario) return { ok: false, msg: "Defina o tipo de prontuário" };
              if (!a.ficha_clinica_ok) return { ok: false, msg: "Confirme a Ficha Clínica" };
              if (!a.vias_aso_ok) return { ok: false, msg: "Confirme o ASO" };
              const imPendentes = examesImediatos.filter(e => e.status !== "liberado" && e.status !== "concluido");
              if (imPendentes.length > 0) return { ok: false, msg: `${imPendentes.length} exame(s) imediato(s) pendente(s)` };
              return { ok: true };
            },
          };
        }
        if (isFisico) {
          return {
            label: "Enviar para Liberação",
            action: async () => {
              // Auto-apply signature effects before sending to liberação
              await applyAutoSignature();
              await advanceStatus("em_escaneamento", getSetorLiberacao());
            },
            validate: () => {
              if (!a.ficha_clinica_ok) return { ok: false, msg: "Confirme a Ficha Clínica com carimbo e assinatura" };
              if (!a.vias_aso_ok) return { ok: false, msg: "Confirme o ASO com carimbo e assinatura" };
              const imPendentes = examesImediatos.filter(e => e.status !== "liberado" && e.status !== "concluido");
              if (imPendentes.length > 0) return { ok: false, msg: `${imPendentes.length} exame(s) imediato(s) pendente(s)` };
              return { ok: true };
            },
          };
        }
        return {
          label: "Definir tipo de prontuário",
          action: () => {},
          validate: () => ({ ok: false, msg: "Defina o tipo de prontuário primeiro" }),
        };
      }

      case "aguardando_exames": {
        return {
          label: "Enviar para Assinatura",
          action: () => advanceStatus("pronto_assinatura_medica", "Médico"),
          validate: () => {
            if (examesPendentes.length > 0)
              return { ok: false, msg: `${examesPendentes.length} exame(s) pendente(s)` };
            return { ok: true };
          },
        };
      }

      case "pronto_assinatura_medica": {
        if (isFisico) {
          return {
            label: "Enviar para Liberação",
            action: () => advanceStatus("em_escaneamento", getSetorLiberacao()),
            validate: () => {
              if (!a.aso_assinado) return { ok: false, msg: "ASO não assinado" };
              return { ok: true };
            },
          };
        }
        return {
          label: "Liberar Prontuário",
          action: () => advanceStatus("liberado", "Liberação"),
          validate: () => {
            if (!a.aso_assinado) return { ok: false, msg: "ASO não assinado" };
            return { ok: true };
          },
        };
      }

      case "em_escaneamento": {
        return {
          label: "Liberar Prontuário",
          action: () => advanceStatus("liberado", "Liberação"),
          validate: () => {
            if (!a.escaneado) return { ok: false, msg: "Prontuário não escaneado" };
            if (!a.conferencia_final_ok) return { ok: false, msg: "Conferência final pendente" };
            return { ok: true };
          },
        };
      }

      case "liberado":
        return {
          label: "Enviar para Faturamento",
          action: () => advanceStatus("liberado_faturamento", "Faturamento"),
          validate: () => ({ ok: true }),
        };

      case "liberado_faturamento":
        // Sem ação individual: finalização ocorre via Fechamento de Lote.
        return null;

      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  const handleAdvance = () => {
    if (!nextAction) return;
    if (!canAdvanceCurrentStage) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para avançar esta etapa.", variant: "destructive" });
      return;
    }
    const v = nextAction.validate();
    if (!v.ok) {
      toast({ title: "Não é possível avançar", description: v.msg, variant: "destructive" });
      return;
    }
    nextAction.action();
  };

  // Determine which tabs to show
  const showLiberacaoTab = isFisico;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[860px] sm:w-[860px] overflow-y-auto p-0">
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
              {a.status !== "importado" && semExamesNenhum && (
                <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100">Sem exames</Badge>
              )}
              {a.status !== "importado" && !semExamesNenhum && apenasClinico && (
                <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Só clínico</Badge>
              )}
              {a.status !== "importado" && !semExamesNenhum && !apenasClinico && (
                <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">Com exames</Badge>
              )}
              {sla && (
                <Badge className={`text-xs ${sla.bgColor} ${sla.color}`}>
                  {sla.emoji} {sla.diasUteis}d úteis — {sla.label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Setor: {a.setor_responsavel || "—"}
              </span>
            </div>
            {nextAction && a.status !== "finalizado" && nextAction.label !== "Definir tipo de prontuário" && canAdvanceCurrentStage && (
              <Button size="sm" onClick={handleAdvance}>
                {nextAction.label}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        <Tabs value={tab} onValueChange={(nextTab) => {
          if (nextTab === "assinatura" && !canAccessAssinatura) return;
          setTab(nextTab);
        }} className="px-6 pt-3">
          <TabsList className={`w-full grid ${showLiberacaoTab ? "grid-cols-6" : "grid-cols-5"}`}>
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="recepcao" className="text-xs">Recepção</TabsTrigger>
            <TabsTrigger value="exames" className="text-xs">Exames</TabsTrigger>
            <TabsTrigger value="assinatura" className="text-xs" disabled={!canAccessAssinatura}>Assinatura</TabsTrigger>
            {showLiberacaoTab && (
              <TabsTrigger value="liberacao" className="text-xs">Liberação</TabsTrigger>
            )}
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
          </TabsList>

          {/* ── TAB: Info ── */}
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
                <Label className="text-xs text-muted-foreground">Exames</Label>
                <p className="text-sm bg-muted/50 p-2 rounded whitespace-pre-wrap">{a.exames_texto}</p>
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Recepção ── */}
          <TabsContent value="recepcao" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Conferência da Recepção
            </h4>

            {/* Tipo Prontuário + Base SOCNET */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">
                  Tipo de Prontuário <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={a.tipo_prontuario || "none"}
                  onValueChange={handleTipoProntuarioChange}
                  disabled={!canManageRecepcaoSetup}
                >
                  <SelectTrigger className={!a.tipo_prontuario ? "border-red-300 ring-1 ring-red-200" : ""}>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                  </SelectContent>
                </Select>
                {!a.tipo_prontuario && (
                  <p className="text-[10px] text-red-500 mt-1">Campo obrigatório</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={a.base_socnet || false}
                  disabled={!canManageRecepcaoSetup}
                  onCheckedChange={(v) => updateField("base_socnet", v)}
                />
                <Label className="text-sm">Base SOCNET</Label>
              </div>
            </div>

            <Separator />

            {/* Conferência items */}
            <div className="space-y-3">
              {a.possui_exame_complementar && !recepcaoPodeLiberar ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                  <p className="font-medium">⚠️ Prontuário com exames complementares pendentes</p>
                  <p className="text-xs mt-1">
                    A recepção deve apenas identificar e direcionar para a Enfermagem. 
                    A conferência de Ficha Clínica e ASO será realizada após a conclusão dos exames.
                  </p>
                </div>
              ) : (
                <>
                  {isFisico ? (
                    <>
                      {[
                        { field: "ficha_clinica_ok", label: "Ficha Clínica com carimbo e assinatura" },
                        { field: "vias_aso_ok", label: "ASO com carimbo e assinatura", isAso: true },
                      ].map(({ field, label, isAso }) => {
                        const blockedByPendente = isAso && a.possui_exame_complementar;
                        return (
                          <div key={field} className="flex items-center justify-between py-1">
                            <Label className={`text-sm ${blockedByPendente ? "text-muted-foreground" : ""}`}>
                              {label}
                              {blockedByPendente && <span className="text-[10px] ml-1">(libere os exames complementares primeiro)</span>}
                            </Label>
                            <Switch
                              checked={a[field] || false}
                              disabled={!canEditRecepcao || blockedByPendente}
                              onCheckedChange={(v) => updateField(field, v)}
                            />
                          </div>
                        );
                      })}
                    </>
                  ) : isDigital ? (
                    <>
                      {[
                        { field: "ficha_clinica_ok", label: "Ficha Clínica" },
                        { field: "vias_aso_ok", label: "ASO", isAso: true },
                        { field: "salvo_socged", label: "Inserido no SOCGED" },
                      ].map(({ field, label, isAso }) => {
                        const blockedByPendente = isAso && a.possui_exame_complementar;
                        return (
                          <div key={field} className="flex items-center justify-between py-1">
                            <Label className={`text-sm ${blockedByPendente ? "text-muted-foreground" : ""}`}>
                              {label}
                              {blockedByPendente && <span className="text-[10px] ml-1">(libere os exames complementares primeiro)</span>}
                            </Label>
                            <Switch
                              checked={a[field] || false}
                              disabled={!canEditRecepcao || blockedByPendente}
                              onCheckedChange={(v) => updateField(field, v)}
                            />
                          </div>
                        );
                      })}
                      <div>
                        <Label className="text-xs">Data da Assinatura</Label>
                        <Input
                          type="date"
                          key={`data-ass-rec-${a.id}-${a.data_assinatura}`}
                          defaultValue={a.data_assinatura || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (a.data_assinatura || "")) {
                              handleDataAssinatura(e.target.value);
                            }
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Preenchida automaticamente com a data da conferência. Edite se necessário.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded">
                      Selecione o tipo de prontuário para ver os itens de conferência.
                    </div>
                  )}

                  {/* Exames imediatos na recepção (Audiometria, Acuidade Visual) */}
                  {examesImediatos.length > 0 && (
                    <>
                      <Separator />
                      <Label className="text-xs text-muted-foreground block">Exames com Liberação Imediata</Label>
                      {examesImediatos.map((ex) => (
                        <Card key={ex.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{ex.nome_exame}</p>
                              <p className="text-[10px] text-muted-foreground">Complementar com liberação no mesmo dia</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={ex.status === "concluido" ? "liberado" : ex.status}
                                disabled={!canManageExames}
                                onValueChange={(v) => exameMutations?.updateExame.mutate({ id: ex.id, field: "status", value: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="liberado">Liberado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {/* Digital → SOCGED | Físico → Impresso */}
                          {isFisico ? (
                            <div className="flex items-center gap-2 mt-2">
                              <Switch
                                checked={!!ex.data_recebimento}
                                disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                                onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                                  id: ex.id,
                                  field: "data_recebimento",
                                  value: v ? new Date().toISOString().slice(0, 10) : null,
                                })}
                              />
                              <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                                Impresso
                                {ex.status !== "liberado" && ex.status !== "concluido" && (
                                  <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                                )}
                              </Label>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-2">
                              <Switch
                                checked={!!ex.data_inserido_socged}
                                disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                                onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                                  id: ex.id,
                                  field: "data_inserido_socged",
                                  value: v ? new Date().toISOString().slice(0, 10) : null,
                                })}
                              />
                              <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                                Inserido no SOCGED
                                {ex.status !== "liberado" && ex.status !== "concluido" && (
                                  <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                                )}
                              </Label>
                            </div>
                          )}
                        </Card>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-sm font-medium">Possui exame complementar pendente?</Label>
                <p className="text-xs text-muted-foreground">Se não selecionar, o exame está OK</p>
              </div>
              <Switch
                checked={a.possui_exame_complementar || false}
                onCheckedChange={(v) => {
                  updateField("possui_exame_complementar", v);
                }}
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

          {/* ── TAB: Exames ── */}
          <TabsContent value="exames" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Syringe className="h-4 w-4" /> Controle de Exames
            </h4>

            {/* Alert: sem exames nenhum (nem no raw nem na tabela) */}
            {semExamesNenhum && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sem exames</p>
                  <p className="text-xs mt-0.5">Nenhum exame vinculado a este prontuário (raw vazio). Adicione exames manualmente abaixo.</p>
                </div>
              </div>
            )}

            {/* Alert: apenas clínico, sem complementares */}
            {apenasClinico && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Sem exames complementares</p>
                  <p className="text-xs mt-0.5">Este prontuário possui apenas Exame Clínico. Pode ser liberado diretamente pela recepção.</p>
                </div>
              </div>
            )}

            {/* Add new exam */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome do exame"
                value={novoExame}
                onChange={(e) => setNovoExame(e.target.value)}
                className="flex-1"
                disabled={!canManageExames}
              />
              <Select value={novoExameTipo} onValueChange={(v: any) => setNovoExameTipo(v)} disabled={!canManageExames}>
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
                disabled={!canManageExames || !novoExame.trim() || exameMutations?.addExame.isPending}
                onClick={() => {
                  exameMutations?.addExame.mutate({ nome_exame: novoExame.trim(), tipo: novoExameTipo });
                  setNovoExame("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {!canManageExames && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                As alterações de status dos exames e o controle de inserção no SOCGED ficam disponíveis apenas para a equipe de Enfermagem, durante a etapa de Exames Pendentes.
              </div>
            )}

            {/* Exame Clínico */}
            {examesClinicos.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Exame Clínico</Label>
                {examesClinicos.map((ex) => (
                  <Card key={ex.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{ex.nome_exame}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Status inicial: Realizado. Liberado automaticamente ao assinar o ASO.
                        </p>
                      </div>
                      <Badge className={
                        ex.status === "liberado" ? "bg-green-100 text-green-700" :
                        ex.status === "realizado" ? "bg-blue-100 text-blue-700" :
                        "bg-orange-100 text-orange-700"
                      }>
                        {ex.status === "realizado" ? "Realizado" : ex.status === "liberado" ? "Liberado" : ex.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Exames com Liberação Imediata */}
            {examesImediatos.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Exames Complementares com Liberação Imediata</Label>
                {examesImediatos.map((ex) => (
                  <Card key={ex.id} className="p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{ex.nome_exame}</p>
                        <Badge variant="outline" className="text-[10px]">Imediato</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={ex.status === "concluido" ? "liberado" : ex.status}
                          disabled={!canManageExames}
                          onValueChange={(v) => exameMutations?.updateExame.mutate({ id: ex.id, field: "status", value: v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="liberado">Liberado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canManageExames} onClick={() => exameMutations?.deleteExame.mutate(ex.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Digital → SOCGED | Físico → Impresso */}
                    {isFisico ? (
                      <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={!!ex.data_recebimento}
                            disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                          onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                            id: ex.id,
                            field: "data_recebimento",
                            value: v ? new Date().toISOString().slice(0, 10) : null,
                          })}
                        />
                        <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                          Impresso
                          {ex.status !== "liberado" && ex.status !== "concluido" && (
                            <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                          )}
                        </Label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={!!ex.data_inserido_socged}
                            disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                          onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                            id: ex.id,
                            field: "data_inserido_socged",
                            value: v ? new Date().toISOString().slice(0, 10) : null,
                          })}
                        />
                        <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                          Inserido no SOCGED
                          {ex.status !== "liberado" && ex.status !== "concluido" && (
                            <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                          )}
                        </Label>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Exames Complementares */}
            {examesComplementaresReais.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Exames Complementares</Label>
                {examesComplementaresReais.map((ex) => (
                  <Card key={ex.id} className="p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{ex.nome_exame}</p>
                      <div className="flex items-center gap-2">
                        <Select
                          value={ex.status === "concluido" ? "liberado" : (ex.status === "pendente" || ex.status === "liberado" ? ex.status : "pendente")}
                          disabled={!canManageExames}
                          onValueChange={(v) => exameMutations?.updateExame.mutate({ id: ex.id, field: "status", value: v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="liberado">Liberado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canManageExames} onClick={() => exameMutations?.deleteExame.mutate(ex.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Digital → SOCGED | Físico → Impresso */}
                    {isFisico ? (
                      <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={!!ex.data_recebimento}
                            disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                          onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                            id: ex.id,
                            field: "data_recebimento",
                            value: v ? new Date().toISOString().slice(0, 10) : null,
                          })}
                        />
                        <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                          Impresso
                          {ex.status !== "liberado" && ex.status !== "concluido" && (
                            <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                          )}
                        </Label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={!!ex.data_inserido_socged}
                            disabled={!canManageExames || (ex.status !== "liberado" && ex.status !== "concluido")}
                          onCheckedChange={(v) => exameMutations?.updateExame.mutate({
                            id: ex.id,
                            field: "data_inserido_socged",
                            value: v ? new Date().toISOString().slice(0, 10) : null,
                          })}
                        />
                        <Label className={`text-xs ${ex.status !== "liberado" && ex.status !== "concluido" ? "text-muted-foreground" : ""}`}>
                          Inserido no SOCGED
                          {ex.status !== "liberado" && ex.status !== "concluido" && (
                            <span className="text-[10px] ml-1">(libere o exame primeiro)</span>
                          )}
                        </Label>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {exames && exames.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum exame cadastrado</p>
            )}

            {todosExamesNaoClinicos.length > 0 && (
              <div className={`p-3 rounded-lg text-sm ${allExamesLiberados ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                {allExamesLiberados
                  ? "✅ Todos os exames liberados"
                  : `⏳ ${examesPendentes.length} exame(s) pendente(s)`}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Assinatura ── */}
          <TabsContent value="assinatura" className="space-y-4 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Assinatura Médica
            </h4>

            {!canEditAssinatura && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Somente usuários com permissão de edição da etapa Assinatura podem alterar os campos desta aba.
              </div>
            )}

            {!canAdvanceCurrentStage && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Você pode visualizar esta etapa, mas não possui permissão para avançar o prontuário para a próxima fase.
              </div>
            )}

            {/* Informativo do tipo de atendimento (somente leitura) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded p-3">
                <Label className="text-[10px] text-muted-foreground">Tipo de Prontuário</Label>
                <p className="text-sm font-medium capitalize">{a.tipo_prontuario || "Não definido"}</p>
              </div>
              <div className="bg-muted/50 rounded p-3">
                <Label className="text-[10px] text-muted-foreground">Base SOCNET</Label>
                <p className="text-sm font-medium">{a.base_socnet ? "Sim" : "Não"}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <Label className="text-sm">ASO assinado?</Label>
                <Switch
                  checked={a.aso_assinado || false}
                  disabled={!canEditAssinatura}
                  onCheckedChange={handleAsoAssinado}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo de Assinatura</Label>
                  <div className="bg-muted/50 rounded p-2 text-sm mt-1">
                    {a.tipo_assinatura === "digital" ? "Digital" : a.tipo_assinatura === "manual" ? "Manual" : "Não definido"}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isFisico ? "Prontuário físico → assinatura manual" : isDigital ? "Prontuário digital → assinatura digital" : ""}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Data da Assinatura</Label>
                  <Input
                    type="date"
                    key={`data-ass-${a.id}-${a.data_assinatura}`}
                    defaultValue={a.data_assinatura || ""}
                    disabled={!canEditAssinatura}
                    onBlur={(e) => {
                      if (e.target.value !== (a.data_assinatura || "")) {
                        handleDataAssinatura(e.target.value);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Exame Clínico - somente leitura na assinatura */}
              {examesClinicos.length > 0 && (
                <>
                  <Separator />
                  <Label className="text-xs text-muted-foreground">Exame Clínico</Label>
                  {examesClinicos.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{ex.nome_exame}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ex.status === "realizado" ? "Realizado" : ex.status === "liberado" ? "Liberado" : ex.status}
                      </Badge>
                    </div>
                  ))}
                </>
              )}

              <div>
                <Label className="text-xs">Observações da Assinatura</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  key={`obs-ass-${a.id}-${a.observacoes_assinatura}`}
                  defaultValue={a.observacoes_assinatura || ""}
                  disabled={!canEditAssinatura}
                  onBlur={(e) => {
                    if (e.target.value !== (a.observacoes_assinatura || "")) {
                      updateField("observacoes_assinatura", e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: Liberação (only for físico) ── */}
          {showLiberacaoTab && (
            <TabsContent value="liberacao" className="space-y-4 pb-6">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <ScanLine className="h-4 w-4" /> Liberação / Digitalização
              </h4>
              <div className="space-y-3">
                {[
                  { field: "escaneado", label: "Escaneado" },
                  { field: "renomeado", label: "Renomeado" },
                  { field: "salvo_socged", label: "Inserido no SOCGED" },
                  { field: "email_enviado", label: "E-mail enviado" },
                  { field: "conferencia_final_ok", label: "Conferência final" },
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
                <Label className="text-xs">Observações da Liberação</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  key={`obs-lib-${a.id}-${a.observacoes_escaneamento}`}
                  defaultValue={a.observacoes_escaneamento || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (a.observacoes_escaneamento || "")) {
                      updateField("observacoes_escaneamento", e.target.value);
                    }
                  }}
                />
              </div>
            </TabsContent>
          )}

          {/* ── TAB: Histórico ── */}
          <TabsContent value="historico" className="space-y-2 pb-6">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Alterações
            </h4>
            {historico && historico.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {historico.map((h) => {
                  const acaoLabel = ACTION_LABELS[h.acao] || h.acao;
                  const campoLabel = h.campo ? (FIELD_LABELS[h.campo] || h.campo) : null;
                  return (
                    <div key={h.id} className="border rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="text-[10px]">{acaoLabel}</Badge>
                        <span className="text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {campoLabel && (
                        <p>
                          <span className="text-muted-foreground">Campo:</span>{" "}
                          <strong>{campoLabel}</strong>
                          {h.valor_antigo && <> · De: <span className="text-red-600">{formatFieldValue(h.campo, h.valor_antigo)}</span></>}
                          {h.valor_novo && <> · Para: <span className="text-green-600">{formatFieldValue(h.campo, h.valor_novo)}</span></>}
                        </p>
                      )}
                      {h.observacao && <p className="text-muted-foreground">📝 {h.observacao}</p>}
                      <p className="text-muted-foreground">👤 {h.user_name || "Sistema"}</p>
                    </div>
                  );
                })}
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

function formatFieldValue(campo: string | null, value: string): string {
  if (!campo) return value;
  if (value === "true") return "Sim";
  if (value === "false") return "Não";
  const statusMap: Record<string, string> = {
    importado: "Importado",
    em_triagem: "Inicial",
    aguardando_exames: "Exames Pendentes",
    pronto_assinatura_medica: "Assinatura",
    em_escaneamento: "Liberação",
    liberado: "Liberado",
    liberado_faturamento: "Faturamento",
    finalizado: "Finalizado",
  };
  if (campo === "status" && statusMap[value]) return statusMap[value];
  return value;
}
