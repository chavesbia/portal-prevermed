import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSlaStatus, getSlaColor, getSlaLabel } from "@/lib/guias/sla";
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

type CompareceuStatus = "NAO_INFORMADO" | "COMPARECEU" | "NAO_COMPARECEU" | "REMARCADO" | "PARCIAL";
type SimNaoStatus = "NAO_INFORMADO" | "SIM" | "NAO";

export default function GuiaDetalhe() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = isAdmin;
  const displayName = profile?.full_name ?? user?.email ?? "";

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
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (gestao) {
      setCompareceu(gestao.compareceu_status as CompareceuStatus);
      setAtendLancado(gestao.atendimento_lancado as SimNaoStatus);
      setAsoAnexado(gestao.aso_anexado as SimNaoStatus);
      setObservacoes(gestao.observacoes ?? "");
    }
  }, [gestao]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!gestao || !user) return;

      const changes: { campo: string; antigo: string; novo: string }[] = [];
      if (compareceu !== gestao.compareceu_status) changes.push({ campo: "compareceu_status", antigo: gestao.compareceu_status, novo: compareceu });
      if (atendLancado !== gestao.atendimento_lancado) changes.push({ campo: "atendimento_lancado", antigo: gestao.atendimento_lancado, novo: atendLancado });
      if (asoAnexado !== gestao.aso_anexado) changes.push({ campo: "aso_anexado", antigo: gestao.aso_anexado, novo: asoAnexado });
      if (observacoes !== (gestao.observacoes ?? "")) changes.push({ campo: "observacoes", antigo: gestao.observacoes ?? "", novo: observacoes });

      if (changes.length === 0) return;

      await supabase
        .from("guia_gestao")
        .update({
          compareceu_status: compareceu,
          atendimento_lancado: atendLancado,
          aso_anexado: asoAnexado,
          observacoes,
          updated_by: user.id,
        })
        .eq("guia_codigo", codigo!);

      for (const change of changes) {
        await supabase.from("guia_audit_log").insert({
          user_id: user.id,
          user_name: displayName,
          guia_codigo: codigo!,
          campo: change.campo,
          valor_antigo: change.antigo,
          valor_novo: change.novo,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guia_gestao", codigo] });
      queryClient.invalidateQueries({ queryKey: ["guia_audit_log", codigo] });
      queryClient.invalidateQueries({ queryKey: ["guias"] });
      toast({ title: "Salvo!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!guia) return <div className="p-8 text-center text-muted-foreground">Guia não encontrada.</div>;

  const dataBase = guia.data_agendamento ?? guia.data_guia;
  const sla = getSlaStatus(dataBase, atendLancado, []);

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
    observacoes: "Observações",
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
            <Badge className={getSlaColor(sla)}>{getSlaLabel(sla)}</Badge>
            <span className="text-sm text-muted-foreground">{guia.situacao}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do SOC</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {formatField("Data da Guia", guia.data_guia ? format(new Date(guia.data_guia + "T00:00:00"), "dd/MM/yyyy") : null)}
            {formatField("Tipo de Exame", guia.tipo_exame)}
            {formatField("Situação", guia.situacao)}
            {formatField("Atendido", guia.atendido_texto)}
            {formatField("Funcionário", guia.funcionario_nome)}
            {formatField("CPF", guia.funcionario_cpf)}
            {formatField("Empresa", guia.empresa_nome)}
            {formatField("Unidade", guia.unidade_nome)}
            {formatField("Prestador", guia.prestador_nome)}
            {formatField("Email Prestador", guia.prestador_email && guia.prestador_email.includes("@") ? guia.prestador_email : null)}
            {formatField("Telefone Prestador", guia.prestador_telefone)}
            {formatField("Agendamento", guia.data_agendamento ? `${format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yyyy")} ${guia.hora_agendamento ?? ""}` : null)}
            {formatField("Solicitante", guia.solicitante_nome)}
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

      <Card>
        <CardHeader><CardTitle className="text-lg">Gestão Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Compareceu</Label>
              <Select value={compareceu} onValueChange={(v) => setCompareceu(v as CompareceuStatus)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
                  <SelectItem value="COMPARECEU">Compareceu</SelectItem>
                  <SelectItem value="NAO_COMPARECEU">Não Compareceu</SelectItem>
                  <SelectItem value="REMARCADO">Remarcado</SelectItem>
                  <SelectItem value="PARCIAL">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atendimento Lançado</Label>
              <Select value={atendLancado} onValueChange={(v) => setAtendLancado(v as SimNaoStatus)} disabled={!canEdit}>
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
              <Select value={asoAnexado} onValueChange={(v) => setAsoAnexado(v as SimNaoStatus)} disabled={!canEdit}>
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
