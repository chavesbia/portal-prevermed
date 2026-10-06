import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

const fmtData = (d: string) => d.split("-").reverse().join("/");

export default function AdminSocAgenda() {
  const qc = useQueryClient();
  const { data: unidades = [] } = useQuery({
    queryKey: ["soc-agenda-unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("soc_agenda_unidades").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["soc-agendamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("soc_agendamentos")
        .select("*, soc_agenda_unidades(nome)")
        .order("data_agendada", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const atualizar = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("soc_agenda_unidades").update(patch).eq("id", id);
    if (error) return toast.error("Não foi possível salvar");
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["soc-agenda-unidades"] });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">SOC Agenda</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Unidades e Agendas do SOC</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Código da Agenda</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidades.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="font-mono">{u.codigo_agenda}</TableCell>
                  <TableCell>
                    <Input type="time" className="w-28" defaultValue={u.hora_inicio.slice(0, 5)}
                      onBlur={(e) => e.target.value !== u.hora_inicio.slice(0, 5) && atualizar(u.id, { hora_inicio: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="time" className="w-28" defaultValue={u.hora_fim.slice(0, 5)}
                      onBlur={(e) => e.target.value !== u.hora_fim.slice(0, 5) && atualizar(u.id, { hora_fim: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={u.ativo} onCheckedChange={(v) => atualizar(u.id, { ativo: v })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">
            As credenciais do usuário WebService ficam guardadas de forma protegida no servidor, nunca nesta tela.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Agendamentos recebidos</CardTitle></CardHeader>
        <CardContent>
          {agendamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Exame</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.protocolo}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtData(a.data_agendada)} {a.hora_agendada.slice(0, 5)}</TableCell>
                    <TableCell>{(a.soc_agenda_unidades as { nome: string } | null)?.nome ?? "-"}</TableCell>
                    <TableCell>{a.empresa_nome}</TableCell>
                    <TableCell>{a.colaborador_nome}</TableCell>
                    <TableCell>{a.tipo_exame}</TableCell>
                    <TableCell><Badge variant="secondary" className="whitespace-nowrap">{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
