import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSlaStatus, getSlaColor, getSlaLabel } from "@/lib/guias/sla";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Search, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { GuiaFilters, emptyFilters, type GuiaFiltersState } from "@/components/guias/GuiaFilters";

type GuiaWithGestao = {
  id: string;
  guia_codigo: string;
  data_guia: string | null;
  empresa_nome: string | null;
  prestador_nome: string | null;
  funcionario_nome: string | null;
  funcionario_cpf: string | null;
  tipo_exame: string | null;
  atendido_texto: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  situacao: string | null;
  guia_gestao: {
    compareceu_status: string;
    atendimento_lancado: string;
    aso_anexado: string;
  } | null;
};

interface GuiasListProps {
  readOnly?: boolean;
}

export default function GuiasList({ readOnly = false }: GuiasListProps) {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GuiaFiltersState>({ ...emptyFilters });

  const canEdit = !readOnly && isAdmin;

  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await supabase.from("feriados").select("data");
      return data?.map((f: any) => f.data) ?? [];
    },
  });

  const { data: guiasRaw, isLoading } = useQuery({
    queryKey: ["guias", search],
    queryFn: async () => {
      let query = supabase
        .from("guias")
        .select("id, guia_codigo, data_guia, empresa_nome, prestador_nome, funcionario_nome, funcionario_cpf, tipo_exame, atendido_texto, data_agendamento, hora_agendamento, situacao, guia_gestao(compareceu_status, atendimento_lancado, aso_anexado)")
        .order("data_guia", { ascending: false });

      if (search) {
        query = query.or(
          `guia_codigo.ilike.%${search}%,funcionario_nome.ilike.%${search}%,funcionario_cpf.ilike.%${search}%,empresa_nome.ilike.%${search}%,prestador_nome.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as GuiaWithGestao[];
    },
  });

  const empresas = useMemo(() => [...new Set(guiasRaw?.map((g) => g.empresa_nome).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const prestadores = useMemo(() => [...new Set(guiasRaw?.map((g) => g.prestador_nome).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const tiposExame = useMemo(() => [...new Set(guiasRaw?.map((g) => g.tipo_exame).filter(Boolean) as string[])].sort(), [guiasRaw]);
  const situacoes = useMemo(() => [...new Set(guiasRaw?.map((g) => g.situacao).filter(Boolean) as string[])].sort(), [guiasRaw]);

  const guias = useMemo(() => {
    if (!guiasRaw) return [];
    return guiasRaw.filter((g) => {
      const f = filters;
      if (f.dataGuiaInicio && g.data_guia && new Date(g.data_guia + "T00:00:00") < f.dataGuiaInicio) return false;
      if (f.dataGuiaFim && g.data_guia && new Date(g.data_guia + "T00:00:00") > f.dataGuiaFim) return false;
      if (f.dataAgendamentoInicio && g.data_agendamento && new Date(g.data_agendamento + "T00:00:00") < f.dataAgendamentoInicio) return false;
      if (f.dataAgendamentoFim && g.data_agendamento && new Date(g.data_agendamento + "T00:00:00") > f.dataAgendamentoFim) return false;
      if (f.empresa && g.empresa_nome !== f.empresa) return false;
      if (f.prestador && g.prestador_nome !== f.prestador) return false;
      if (f.tipoExame && g.tipo_exame !== f.tipoExame) return false;
      if (f.situacao && g.situacao !== f.situacao) return false;
      if (f.atendido) {
        const isAtendido = g.atendido_texto?.toLowerCase() === "sim";
        if (f.atendido === "SIM" && !isAtendido) return false;
        if (f.atendido === "NAO" && isAtendido) return false;
      }
      const gestao = g.guia_gestao;
      if (f.compareceu && (gestao?.compareceu_status ?? "NAO_INFORMADO") !== f.compareceu) return false;
      if (f.atendimentoLancado && (gestao?.atendimento_lancado ?? "NAO_INFORMADO") !== f.atendimentoLancado) return false;
      if (f.asoAnexado && (gestao?.aso_anexado ?? "NAO_INFORMADO") !== f.asoAnexado) return false;
      if (f.sla) {
        const dataBase = g.data_agendamento ?? g.data_guia;
        const sla = getSlaStatus(dataBase, gestao?.atendimento_lancado ?? "NAO_INFORMADO", feriados ?? []);
        if (sla !== f.sla) return false;
      }
      return true;
    });
  }, [guiasRaw, filters, feriados]);

  const displayName = profile?.full_name ?? user?.email ?? "";

  const bulkUpdate = useMutation({
    mutationFn: async ({ field, value }: { field: "compareceu_status" | "atendimento_lancado" | "aso_anexado"; value: string }) => {
      const codes = Array.from(selected);
      for (const code of codes) {
        const guia = guias?.find((g) => g.guia_codigo === code);
        const gestao = guia?.guia_gestao;
        const oldValue = gestao?.[field] ?? "NAO_INFORMADO";

        await supabase
          .from("guia_gestao")
          .update({ [field]: value, updated_by: user?.id })
          .eq("guia_codigo", code);

        await supabase.from("guia_audit_log").insert({
          user_id: user?.id,
          user_name: displayName,
          guia_codigo: code,
          campo: field,
          valor_antigo: oldValue,
          valor_novo: value,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guias"] });
      setSelected(new Set());
      toast({ title: "Atualizado!", description: `${selected.size} guias atualizadas.` });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const toggleAll = () => {
    if (guias && selected.size === guias.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(guias?.map((g) => g.guia_codigo) ?? []));
    }
  };

  const formatCompareceu = (s: string) => {
    const map: Record<string, string> = {
      NAO_INFORMADO: "—",
      COMPARECEU: "Sim",
      NAO_COMPARECEU: "Não",
      REMARCADO: "Remarcado",
      PARCIAL: "Parcial",
    };
    return map[s] ?? s;
  };

  const formatSimNao = (s: string) => {
    const map: Record<string, string> = { NAO_INFORMADO: "—", SIM: "Sim", NAO: "Não" };
    return map[s] ?? s;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guias</h1>
          <p className="text-muted-foreground">Lista de guias importadas</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, funcionário, CPF, empresa, prestador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <GuiaFilters filters={filters} onChange={setFilters} empresas={empresas} prestadores={prestadores} tiposExame={tiposExame} situacoes={situacoes} />

        {canEdit && selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{selected.size} selecionadas</Badge>
            <Button size="sm" variant="outline" onClick={() => {
              if (confirm(`Marcar como Compareceu para ${selected.size} guias?`))
                bulkUpdate.mutate({ field: "compareceu_status", value: "COMPARECEU" });
            }}>
              <CheckSquare className="h-4 w-4 mr-1" /> Compareceu ✓
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              if (confirm(`Marcar atendimento lançado para ${selected.size} guias?`))
                bulkUpdate.mutate({ field: "atendimento_lancado", value: "SIM" });
            }}>
              <CheckSquare className="h-4 w-4 mr-1" /> Atendimento ✓
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              if (confirm(`Marcar ASO anexado para ${selected.size} guias?`))
                bulkUpdate.mutate({ field: "aso_anexado", value: "SIM" });
            }}>
              <CheckSquare className="h-4 w-4 mr-1" /> ASO ✓
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && (
                      <TableHead className="w-10">
                        <Checkbox checked={guias?.length ? selected.size === guias.length : false} onCheckedChange={toggleAll} />
                      </TableHead>
                    )}
                    <TableHead>Data</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Atendido</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Compareceu</TableHead>
                    <TableHead>Atend. Lançado</TableHead>
                    <TableHead>ASO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guias?.map((guia) => {
                    const gestao = guia.guia_gestao;
                    const atendLancado = gestao?.atendimento_lancado ?? "NAO_INFORMADO";
                    const dataBase = guia.data_agendamento ?? guia.data_guia;
                    const sla = getSlaStatus(dataBase, atendLancado, feriados ?? []);

                    return (
                      <TableRow key={guia.id} className="hover:bg-muted/50">
                        {canEdit && (
                          <TableCell>
                            <Checkbox
                              checked={selected.has(guia.guia_codigo)}
                              onCheckedChange={() => toggleSelect(guia.guia_codigo)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-xs whitespace-nowrap">
                          {guia.data_guia ? format(new Date(guia.data_guia + "T00:00:00"), "dd/MM/yy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Link to={`/guias/${guia.guia_codigo}`} className="text-primary hover:underline font-mono text-xs">
                            {guia.guia_codigo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs max-w-28 truncate">{guia.empresa_nome ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-28 truncate">{guia.prestador_nome ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-28 truncate">{guia.funcionario_nome ?? "—"}</TableCell>
                        <TableCell className="text-xs">{guia.tipo_exame ?? "—"}</TableCell>
                        <TableCell className="text-xs">{guia.atendido_texto ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {guia.data_agendamento ? format(new Date(guia.data_agendamento + "T00:00:00"), "dd/MM/yy") : "—"}
                          {guia.hora_agendamento ? ` ${guia.hora_agendamento}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getSlaColor(sla)}`}>{getSlaLabel(sla)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatCompareceu(gestao?.compareceu_status ?? "NAO_INFORMADO")}</TableCell>
                        <TableCell className="text-xs">{formatSimNao(atendLancado)}</TableCell>
                        <TableCell className="text-xs">{formatSimNao(gestao?.aso_anexado ?? "NAO_INFORMADO")}</TableCell>
                      </TableRow>
                    );
                  })}
                  {guias?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Nenhuma guia encontrada. Faça uma importação primeiro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
