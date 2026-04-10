import { useState } from "react";
import { useASOAtendimentos, ASOFilters } from "@/hooks/useASOData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Search, Eye, Filter, X } from "lucide-react";

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

type Atendimento = NonNullable<ReturnType<typeof useASOAtendimentos>["data"]>[number];

export default function ASOListagem() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<ASOFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Atendimento | null>(null);
  const { data: atendimentos, isLoading, refetch } = useASOAtendimentos(filters);

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from("aso_atendimentos")
      .update({ [field]: value } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    // Log in history
    await supabase.from("aso_historico").insert({
      atendimento_id: id,
      user_id: profile?.user_id,
      user_name: profile?.full_name,
      acao: "alteracao_campo",
      campo: field,
      valor_novo: String(value),
    } as any);
    toast({ title: "Atualizado" });
    refetch();
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, empresa ou ID..."
            className="pl-9"
            value={filters.search || ""}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value || undefined }))}
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.agenda || "all"} onValueChange={(v) => setFilters(f => ({ ...f, agenda: v === "all" ? undefined : v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="Lapa">Lapa</SelectItem>
            <SelectItem value="Osasco">Osasco</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-1" /> Filtros
        </Button>
        {Object.keys(filters).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Data de</Label>
            <Input type="date" value={filters.data_de || ""} onChange={(e) => setFilters(f => ({ ...f, data_de: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Data até</Label>
            <Input type="date" value={filters.data_ate || ""} onChange={(e) => setFilters(f => ({ ...f, data_ate: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Médico</Label>
            <Input placeholder="Nome do médico" value={filters.medico || ""} onChange={(e) => setFilters(f => ({ ...f, medico: e.target.value || undefined }))} />
          </div>
          <div>
            <Label className="text-xs">Tipo Prontuário</Label>
            <Select value={filters.tipo_prontuario || "all"} onValueChange={(v) => setFilters(f => ({ ...f, tipo_prontuario: v === "all" ? undefined : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="fisico">Físico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Carregando..." : `${atendimentos?.length ?? 0} atendimentos encontrados`}
      </p>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-background w-10"></TableHead>
              <TableHead className="sticky top-0 bg-background">ID</TableHead>
              <TableHead className="sticky top-0 bg-background">Data</TableHead>
              <TableHead className="sticky top-0 bg-background">Hora</TableHead>
              <TableHead className="sticky top-0 bg-background">Funcionário</TableHead>
              <TableHead className="sticky top-0 bg-background">Empresa</TableHead>
              <TableHead className="sticky top-0 bg-background">Agenda</TableHead>
              <TableHead className="sticky top-0 bg-background">Tipo ASO</TableHead>
              <TableHead className="sticky top-0 bg-background">Prontuário</TableHead>
              <TableHead className="sticky top-0 bg-background">SOCNET</TableHead>
              <TableHead className="sticky top-0 bg-background">Status</TableHead>
              <TableHead className="sticky top-0 bg-background">Setor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atendimentos?.map((a) => (
              <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(a)}>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelected(a); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell className="text-xs font-mono">{a.id_interno?.slice(-12) || "—"}</TableCell>
                <TableCell className="text-xs">{a.data_atendimento || "—"}</TableCell>
                <TableCell className="text-xs">{a.hora_inicial || "—"}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{a.funcionario || "—"}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{a.empresa || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{a.agenda || "—"}</Badge>
                </TableCell>
                <TableCell className="text-xs">{a.tipo_compromisso || "—"}</TableCell>
                <TableCell>
                  {a.tipo_prontuario ? (
                    <Badge variant="secondary" className="text-xs capitalize">{a.tipo_prontuario}</Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {a.base_socnet ? (
                    <Badge className="text-xs bg-blue-100 text-blue-700">SIM</Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${STATUS_COLORS[a.status] || ""}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{a.setor_responsavel || "—"}</TableCell>
              </TableRow>
            ))}
            {(!atendimentos || atendimentos.length === 0) && !isLoading && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Nenhum atendimento encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selected.id_interno}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Funcionário</Label>
                    <p className="text-sm font-medium">{selected.funcionario || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF</Label>
                    <p className="text-sm font-mono">{selected.cpf || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Empresa</Label>
                    <p className="text-sm">{selected.empresa || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Agenda</Label>
                    <p className="text-sm">{selected.agenda || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <p className="text-sm">{selected.data_atendimento || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hora</Label>
                    <p className="text-sm">{selected.hora_inicial || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Médico</Label>
                    <p className="text-sm">{selected.medico || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo ASO</Label>
                    <p className="text-sm">{selected.tipo_compromisso || "—"}</p>
                  </div>
                </div>

                {selected.detalhes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Detalhes</Label>
                    <p className="text-sm bg-muted/50 p-2 rounded">{selected.detalhes}</p>
                  </div>
                )}

                {selected.exames_texto && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Exames</Label>
                    <p className="text-sm bg-muted/50 p-2 rounded">{selected.exames_texto}</p>
                  </div>
                )}

                {selected.riscos && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Riscos</Label>
                    <p className="text-sm bg-muted/50 p-2 rounded">{selected.riscos}</p>
                  </div>
                )}

                {/* Classification */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Classificação</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Tipo de Prontuário</Label>
                      <Select
                        value={selected.tipo_prontuario || "none"}
                        onValueChange={(v) => updateField(selected.id, "tipo_prontuario", v === "none" ? null : v)}
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
                        checked={selected.base_socnet || false}
                        onCheckedChange={(v) => updateField(selected.id, "base_socnet", v)}
                      />
                      <Label className="text-sm">Base SOCNET</Label>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Status do Fluxo</h4>
                  <Badge className={`${STATUS_COLORS[selected.status] || ""} text-sm`}>
                    {STATUS_LABELS[selected.status] || selected.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Setor responsável: {selected.setor_responsavel || "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
