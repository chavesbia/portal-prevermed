import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { getSlaStatus, getSlaColor, getSlaLabel, calcSlaToFreeze, getGuiaStatus, getGuiaStatusColor, getGuiaStatusLabel } from "@/lib/guias/sla";
import { toTitleCase } from "@/lib/guias/blocklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";

type CompareceuStatus = "NAO_INFORMADO" | "COMPARECEU" | "NAO_COMPARECEU" | "PARCIAL";
type SimNaoStatus = "NAO_INFORMADO" | "SIM" | "NAO";
type AguardandoAsoStatus = "NAO_INFORMADO" | "CONTATO_REALIZADO" | "RECEBIDO" | "NAO_RECEBIDO";

export default function GuiaDetalhe() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, profile, isAdmin } = useAuth();
  const { hasPermission } = useModulePermissions();
  const queryClient = useQueryClient();
  const canEdit = isAdmin && hasPermission("/gestao-guias", "edit");
  const displayName = profile?.full_name ?? user?.email ?? "";

  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("data");
      return data?.map((f: any) => f.data) ?? [];
    },
  });

  const { data: guia, isLoading } = useQuery({
    queryKey: ["guia", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guias")
        .select("*")
        .eq("guia_codigo", codigo!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });

  const { data: exames } = useQuery({
    queryKey: ["guia_exames", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guia_exames")
        .select("*")
        .eq("guia_codigo", codigo!)
        .order("exame_nome");
      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });

  const { data: gestao } = useQuery({
    queryKey: ["guia_gestao", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guia_gestao")
        .select("*")
        .eq("guia_codigo", codigo!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["guia_audit_log", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guia_audit_log")
        .select("*")
        .eq("guia_codigo", codigo!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!codigo,
  });

  const [compareceu, setCompareceu] = useState<CompareceuStatus>("NAO_INFORMADO");
  const [atendLancado, setAtendLancado] = useState<SimNaoStatus>("NAO_INFORMADO");
  const [asoAnexado, setAsoAnexado] = useState<SimNaoStatus>("NAO_INFORMADO");
  const [aguardandoAso, setAguardandoAso] = useState<AguardandoAsoStatus>("NAO_INFORMADO");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (gestao) {
      const comp = gestao.compareceu_status as string;
      setCompareceu(comp === "REMARCADO" ? "NAO_INFORMADO" : comp as CompareceuStatus);
      setAtendLancado(gestao.atendimento_lancado as SimNaoStatus);
      setAsoAnexado(gestao.aso_anexado as SimNaoStatus);
      setAguardandoAso((gestao as any).aguardando_aso as AguardandoAsoStatus ?? "NAO_INFORMADO");
      setObservacoes(gestao.observacoes ?? "");
    }
  }, [gestao]);

  // Consistency validations
  const handleCompareceuChange = (v: CompareceuStatus) => {
    setCompareceu(v);
    if (v === "NAO_COMPARECEU") {
      setAtendLancado("NAO");
      setAsoAnexado("NAO");
    }
  };

  const handleAtendLancadoChange = (v: SimNaoStatus) => {
    if (v === "SIM" && compareceu === "NAO_INFORMADO") {
      toast({ title: "Atenção", description: "Preencha o campo 'Compareceu' antes de lançar o atendimento.", variant: "destructive" });
      return;
    }
    if (v === "SIM" && compareceu === "NAO_COMPARECEU") {
      toast({ title: "Atenção", description: "Não é possível lançar atendimento se o funcionário não compareceu.", variant: "destructive" });
      return;
    }
    setAtendLancado(v);
    if (v !== "SIM") {
      setAsoAnexado("NAO_INFORMADO");
    }
  };

  const handleAsoAnexadoChange = (v: SimNaoStatus) => {
    if (v === "SIM" && atendLancado !== "SIM") {
      toast({ title: "Atenção", description: "O atendimento precisa estar lançado antes de anexar o ASO.", variant: "destructive" });
      return;
    }
    setAsoAnexado(v);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!gestao || !user) return;

      const changes: { campo: string; antigo: string; novo: string }[] = [];
      const oldComp = gestao.compareceu_status === "REMARCADO" ? "NAO_INFORMADO" : gestao.compareceu_status;
      if (compareceu !== oldComp) changes.push({ campo: "compareceu_status", antigo: oldComp, novo: compareceu });
      if (atendLancado !== gestao.atendimento_lancado) changes.push({ campo: "atendimento_lancado", antigo: gestao.atendimento_lancado, novo: atendLancado });
      if (asoAnexado !== gestao.aso_anexado) changes.push({ campo: "aso_anexado", antigo: gestao.aso_anexado, novo: asoAnexado });
      if (aguardandoAso !== ((gestao as any).aguardando_aso ?? "NAO_INFORMADO")) changes.push({ campo: "aguardando_aso", antigo: (gestao as any).aguardando_aso ?? "NAO_INFORMADO", novo: aguardandoAso });
      if (observacoes !== (gestao.observacoes ?? "")) changes.push({ campo: "observacoes", antigo: gestao.observacoes ?? "", novo: observacoes });

      if (changes.length === 0) return;

      // Calculate SLA to freeze if atendimento is being set to SIM
      const dataBase = guia?.data_agendamento ?? null;
      let slaFinalValue = (gestao as any).sla_final ?? null;

      if (atendLancado === "SIM" && gestao.atendimento_lancado !== "SIM") {
        // Freezing SLA at this moment
        slaFinalValue = calcSlaToFreeze(dataBase, feriados ?? []);
        changes.push({ campo: "sla_final", antigo: (gestao as any).sla_final ?? "N/A", novo: slaFinalValue });
      } else if (atendLancado !== "SIM" && gestao.atendimento_lancado === "SIM") {
        // Unfreezing - keep the worst SLA (can't go back to better)
        // SLA is historical, don't clear it
      }

      const { error: updateError } = await supabase
        .from("guia_gestao")
        .update({
          compareceu_status: compareceu,
          atendimento_lancado: atendLancado,
          aso_anexado: asoAnexado,
          aguardando_aso: aguardandoAso,
          observacoes,
          updated_by: user.id,
          ...(atendLancado === "SIM" && gestao.atendimento_lancado !== "SIM" ? { sla_final: slaFinalValue } : {}),
        } as any)
        .eq("guia_codigo", codigo!);

      if (updateError) throw updateError;

      for (const change of changes) {
        const { error: auditError } = await supabase.from("guia_audit_log").insert({
          user_id: user.id,
          user_name: displayName,
          guia_codigo: codigo!,
          campo: change.campo,
          valor_antigo: change.antigo,
          valor_novo: change.novo,
        });

        if (auditError) throw auditError;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guia_gestao", codigo] }),
        queryClient.invalidateQueries({ queryKey: ["guia_audit_log", codigo] }),
        queryClient.invalidateQueries({ queryKey: ["guias"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-guias"], refetchType: "all" }),
      ]);
      toast({ title: "Salvo!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!guia) return <div className="p-8 text-center text-muted-foreground">Guia não encontrada.</div>;

  const dataBase = guia.data_agendamento;
  const sla = getSlaStatus(dataBase, atendLancado, feriados ?? [], (gestao as any)?.sla_final);
  const guiaStatus = getGuiaStatus(compareceu, atendLancado, asoAnexado, aguardandoAso);

  const formatField = (label: string, value: string | null) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );

  const campoLabels: Record<string, string> = {
    compareceu_status: "Compareceu",
    atendimento_lancado: "Atendimento Lançado",
    aso_anexado: "ASO Anexado",
    aguardando_aso: "Aguardando ASO",
    observacoes: "Observações",
    sla_final: "SLA Final",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/gestao-guias?tab=guias">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Guia {guia.guia_codigo}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getSlaColor(sla)}>SLA: {getSlaLabel(sla)}</Badge>
            <Badge className={getGuiaStatusColor(guiaStatus)}>{getGuiaStatusLabel(guiaStatus)}</Badge>
            <span className="text-sm text-muted-foreground">{guia.situacao}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do SOC</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {formatField("Data da Guia", guia.data_guia ? format(new Date(guia.data_guia + "T00:00:00"), "dd/MM/yyyy") : null)}
            {formatField("Tipo de Exame", toTitleCase(guia.tipo_exame))}
            {formatField("Situação", toTitleCase(guia.situacao))}
            {formatField("Atendido", guia.atendido_texto)}
            {formatField("Funcionário", toTitleCase(guia.funcionario_nome))}
            {formatField("CPF", guia.funcionario_cpf)}
            {formatField("Empresa", toTitleCase(guia.empresa_nome))}
            {formatField("Unidade", toTitleCase(guia.unidade_nome))}
            {formatField("Prestador", toTitleCase(guia.prestador_nome))}
            {formatField("Email Prestador", guia.prestador_email && guia.prestador_email.includes("@") ? guia.prestador_email : null)}
            {formatField("Telefone Prestador", guia.prestador_telefone)}
            {formatField("Agendamento", guia.data_agendamento ? `${format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yyyy")} ${guia.hora_agendamento ?? ""}` : null)}
            {formatField("Solicitante", toTitleCase(guia.solicitante_nome))}
          </div>
        </CardContent>
      </Card>

      {exames && exames.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Exames ({exames.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Exame</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exames.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-mono text-xs">{ex.exame_codigo ?? "—"}</TableCell>
                    <TableCell className="text-sm">{ex.exame_nome ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* SLA + Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">SLA — Prazo da Ação</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge className={`text-sm px-3 py-1 ${getSlaColor(sla)}`}>{getSlaLabel(sla)}</Badge>
              <span className="text-sm text-muted-foreground">
                {(gestao as any)?.sla_final ? "Congelado no lançamento" : "Calculado em tempo real"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Status da Guia</CardTitle></CardHeader>
          <CardContent>
            <Badge className={`text-sm px-3 py-1 ${getGuiaStatusColor(guiaStatus)}`}>{getGuiaStatusLabel(guiaStatus)}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Gestão Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Compareceu</Label>
              <Select value={compareceu} onValueChange={(v) => handleCompareceuChange(v as CompareceuStatus)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
                  <SelectItem value="COMPARECEU">Compareceu</SelectItem>
                  <SelectItem value="NAO_COMPARECEU">Não Compareceu</SelectItem>
                  <SelectItem value="PARCIAL">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aguardando ASO</Label>
              <Select value={aguardandoAso} onValueChange={(v) => setAguardandoAso(v as AguardandoAsoStatus)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
                  <SelectItem value="CONTATO_REALIZADO">Contato Realizado</SelectItem>
                  <SelectItem value="RECEBIDO">Recebido</SelectItem>
                  <SelectItem value="NAO_RECEBIDO">Não Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atendimento Lançado</Label>
              <Select value={atendLancado} onValueChange={(v) => handleAtendLancadoChange(v as SimNaoStatus)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NAO">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ASO Anexado</Label>
              <Select value={asoAnexado} onValueChange={(v) => handleAsoAnexadoChange(v as SimNaoStatus)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NAO">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!canEdit} rows={3} />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {auditLogs && auditLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Auditoria</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-l-2 border-primary/20 pl-4 py-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{log.user_name}</span>
                      <span className="text-muted-foreground">alterou</span>
                      <Badge variant="outline" className="text-xs">{campoLabels[log.campo] ?? log.campo}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="line-through">{log.valor_antigo || "(vazio)"}</span>
                      {" → "}
                      <span className="font-medium text-foreground">{log.valor_novo || "(vazio)"}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
