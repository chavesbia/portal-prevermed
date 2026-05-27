import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateBR } from "@/lib/utils";
import { Syringe, AlertTriangle, CheckCircle, RefreshCcw } from "lucide-react";

interface NovaColetaRow {
  exame_id: string;
  atendimento_id: string;
  id_interno: string;
  funcionario: string | null;
  empresa: string | null;
  agenda: string | null;
  nome_exame: string;
  motivo_nova_coleta: string | null;
  nova_coleta_data_prevista_retorno: string | null;
  nova_coleta_data_retorno_efetivo: string | null;
  colaborador_chamado: boolean;
  colaborador_chamado_em: string | null;
  status: string;
  updated_at: string;
}

function useNovasColetas() {
  return useQuery({
    queryKey: ["aso-novas-coletas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aso_exames_atendimento" as any)
        .select(`
          id,
          atendimento_id,
          nome_exame,
          status,
          motivo_nova_coleta,
          nova_coleta_data_prevista_retorno,
          nova_coleta_data_retorno_efetivo,
          colaborador_chamado,
          colaborador_chamado_em,
          updated_at,
          aso_atendimentos:atendimento_id (
            id_interno, funcionario, empresa, agenda
          )
        `)
        .eq("status", "nova_coleta")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        exame_id: row.id,
        atendimento_id: row.atendimento_id,
        id_interno: row.aso_atendimentos?.id_interno ?? "—",
        funcionario: row.aso_atendimentos?.funcionario ?? null,
        empresa: row.aso_atendimentos?.empresa ?? null,
        agenda: row.aso_atendimentos?.agenda ?? null,
        nome_exame: row.nome_exame,
        motivo_nova_coleta: row.motivo_nova_coleta,
        nova_coleta_data_prevista_retorno: row.nova_coleta_data_prevista_retorno,
        nova_coleta_data_retorno_efetivo: row.nova_coleta_data_retorno_efetivo,
        colaborador_chamado: row.colaborador_chamado,
        colaborador_chamado_em: row.colaborador_chamado_em,
        status: row.status,
        updated_at: row.updated_at,
      })) as NovaColetaRow[];
    },
  });
}

export default function ASONovasColetas() {
  const { data, isLoading, refetch, isFetching } = useNovasColetas();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "nao_chamado" | "chamado">("all");

  const filtered = useMemo(() => {
    let rows = data || [];
    if (filter === "nao_chamado") rows = rows.filter((r) => !r.colaborador_chamado);
    if (filter === "chamado") rows = rows.filter((r) => r.colaborador_chamado);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.funcionario?.toLowerCase().includes(q) ||
          r.empresa?.toLowerCase().includes(q) ||
          r.nome_exame.toLowerCase().includes(q) ||
          r.id_interno.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, filter, search]);

  const totalNaoChamado = (data || []).filter((r) => !r.colaborador_chamado).length;
  const totalChamado = (data || []).filter((r) => r.colaborador_chamado).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Syringe className="h-4 w-4 text-orange-600" /> Novas Coletas Solicitadas
        </h3>
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
          {data?.length ?? 0} no total
        </Badge>
        {totalNaoChamado > 0 && (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {totalNaoChamado} colaborador(es) não chamado(s)
          </Badge>
        )}
        {totalChamado > 0 && (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            {totalChamado} chamado(s)
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCcw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Funcionário, empresa, exame ou ID..."
          />
        </div>
        <div>
          <Label className="text-xs">Status colaborador</Label>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nao_chamado">Ainda não chamado</SelectItem>
              <SelectItem value="chamado">Já chamado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ASO</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Exame</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Prev. retorno</TableHead>
              <TableHead>Retorno efetivo</TableHead>
              <TableHead>Colab. chamado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Nenhuma nova coleta encontrada.</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.exame_id}>
                <TableCell className="font-mono text-xs">{r.id_interno}</TableCell>
                <TableCell className="text-sm">{r.funcionario || "—"}</TableCell>
                <TableCell className="text-sm">{r.empresa || "—"}</TableCell>
                <TableCell className="text-sm font-medium">{r.nome_exame}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                  {r.motivo_nova_coleta || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.nova_coleta_data_prevista_retorno
                    ? formatDateBR(r.nova_coleta_data_prevista_retorno)
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.nova_coleta_data_retorno_efetivo ? (
                    <Badge className="bg-green-100 text-green-700">
                      {formatDateBR(r.nova_coleta_data_retorno_efetivo)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.colaborador_chamado ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      Chamado{r.colaborador_chamado_em ? ` em ${formatDateBR(r.colaborador_chamado_em.slice(0,10))}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Não chamado</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
