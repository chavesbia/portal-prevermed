import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X, CalendarIcon, Search, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface GuiaFiltersState {
  dataGuiaInicio: Date | undefined;
  dataGuiaFim: Date | undefined;
  dataAgendamentoInicio: Date | undefined;
  dataAgendamentoFim: Date | undefined;
  empresas: string[];
  prestadores: string[];
  tipoExame: string;
  situacao: string;
  atendido: string;
  sla: string;
  compareceu: string;
  atendimentoLancado: string;
  asoAnexado: string;
  exame: string;
  origemAgendamento: string;
  statusPrestador: string;
  unidade: string;
  semAgendamento: boolean;
  statusGuia: string;
}

export const emptyFilters: GuiaFiltersState = {
  dataGuiaInicio: undefined,
  dataGuiaFim: undefined,
  dataAgendamentoInicio: undefined,
  dataAgendamentoFim: undefined,
  empresas: [],
  prestadores: [],
  tipoExame: "",
  situacao: "",
  atendido: "",
  sla: "",
  compareceu: "",
  atendimentoLancado: "",
  asoAnexado: "",
  exame: "",
  origemAgendamento: "",
  statusPrestador: "",
  unidade: "",
  semAgendamento: false,
  statusGuia: "",
};

interface Props {
  filters: GuiaFiltersState;
  onChange: (f: GuiaFiltersState) => void;
  empresas: string[];
  prestadores: string[];
  tiposExame: string[];
  situacoes: string[];
  unidades: string[];
  exames?: string[];
  search: string;
  onSearchChange: (v: string) => void;
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start text-left text-xs font-normal h-8">
            <CalendarIcon className="mr-1 h-3 w-3" />
            {value ? format(value, "dd/MM/yy") : "Selecionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiSelectField({ label, selected, onChange, options }: { label: string; selected: string[]; onChange: (v: string[]) => void; options: string[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label} {selected.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{selected.length}</Badge>}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start text-left text-xs font-normal truncate h-8">
            {selected.length === 0 ? "Todos" : selected.length === 1 ? selected[0].substring(0, 25) : `${selected.length} selecionados`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-7 text-xs pl-7" />
          </div>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full h-6 text-xs mb-1" onClick={() => onChange([])}>Limpar seleção</Button>
          )}
          <ScrollArea className="h-48">
            <div className="space-y-0.5">
              {filtered.map((option) => (
                <label key={option} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-xs">
                  <Checkbox checked={selected.includes(option)} onCheckedChange={() => toggle(option)} className="h-3.5 w-3.5" />
                  <span className="truncate">{option}</span>
                </label>
              ))}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function GuiaFilters({ filters, onChange, empresas, prestadores, tiposExame, situacoes, unidades, exames = [], search, onSearchChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = [
    filters.dataGuiaInicio, filters.dataGuiaFim,
    filters.dataAgendamentoInicio, filters.dataAgendamentoFim,
    filters.empresas.length > 0 ? true : undefined,
    filters.prestadores.length > 0 ? true : undefined,
    filters.tipoExame || undefined,
    filters.situacao || undefined,
    filters.atendido || undefined,
    filters.sla || undefined,
    filters.compareceu || undefined,
    filters.atendimentoLancado || undefined,
    filters.asoAnexado || undefined,
    filters.exame || undefined,
    filters.origemAgendamento || undefined,
    filters.statusPrestador || undefined,
    filters.unidade || undefined,
    filters.semAgendamento ? true : undefined,
    filters.statusGuia || undefined,
  ].filter(Boolean).length;

  const update = (patch: Partial<GuiaFiltersState>) => {
    const next = { ...filters, ...patch };
    for (const key of Object.keys(next) as (keyof GuiaFiltersState)[]) {
      if ((next as any)[key] === "__all__") (next as any)[key] = "";
    }
    onChange(next);
  };

  const clear = () => {
    onChange({ ...emptyFilters });
    onSearchChange("");
  };

  return (
    <div className="sticky top-0 z-30 bg-background border-b border-border pb-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar código, funcionário, CPF, empresa, prestador..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant={expanded ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clear}>
            <X className="h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </div>

      {expanded && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <DatePickerField label="Data Guia (de)" value={filters.dataGuiaInicio} onChange={(d) => update({ dataGuiaInicio: d })} />
            <DatePickerField label="Data Guia (até)" value={filters.dataGuiaFim} onChange={(d) => update({ dataGuiaFim: d })} />
            <DatePickerField label="Agendamento (de)" value={filters.dataAgendamentoInicio} onChange={(d) => update({ dataAgendamentoInicio: d })} />
            <DatePickerField label="Agendamento (até)" value={filters.dataAgendamentoFim} onChange={(d) => update({ dataAgendamentoFim: d })} />
            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs h-8">
                <Checkbox
                  checked={filters.semAgendamento}
                  onCheckedChange={(checked) => update({ semAgendamento: !!checked })}
                  className="h-3.5 w-3.5"
                />
                Sem data e horário
              </label>
            </div>

            <MultiSelectField label="Empresa" selected={filters.empresas} onChange={(v) => update({ empresas: v })} options={empresas} />
            <MultiSelectField label="Prestador" selected={filters.prestadores} onChange={(v) => update({ prestadores: v })} options={prestadores} />

            <SelectField label="Unidade" value={filters.unidade || "__all__"} onChange={(v) => update({ unidade: v })} options={unidades.map((u) => ({ value: u, label: u }))} />
            <SelectField label="Tipo Exame" value={filters.tipoExame || "__all__"} onChange={(v) => update({ tipoExame: v })} options={tiposExame.map((t) => ({ value: t, label: t }))} />
            <SelectField label="Situação" value={filters.situacao || "__all__"} onChange={(v) => update({ situacao: v })} options={situacoes.map((s) => ({ value: s, label: s }))} />

            {exames.length > 0 && (
              <SelectField label="Exame" value={filters.exame || "__all__"} onChange={(v) => update({ exame: v })} options={exames.map((e) => ({ value: e, label: e }))} />
            )}

            <SelectField label="Atendido" value={filters.atendido || "__all__"} onChange={(v) => update({ atendido: v })} options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }]} />
            <SelectField
              label="SLA"
              value={filters.sla || "__all__"}
              onChange={(v) => update({ sla: v })}
              options={[
                { value: "EM_DIA", label: "🟢 Em Dia" },
                { value: "ATENCAO", label: "🟡 Atenção" },
                { value: "ATRASADO", label: "🔴 Atrasado" },
              ]}
            />
            <SelectField
              label="Status da Guia"
              value={filters.statusGuia || "__all__"}
              onChange={(v) => update({ statusGuia: v })}
              options={[
                { value: "PENDENTE", label: "Pendente" },
                { value: "INICIADA", label: "Iniciada" },
                { value: "EM_ANDAMENTO", label: "Em Andamento" },
                { value: "FINALIZADA", label: "Finalizada" },
              ]}
            />
            <SelectField
              label="Compareceu"
              value={filters.compareceu || "__all__"}
              onChange={(v) => update({ compareceu: v })}
              options={[
                { value: "COMPARECEU", label: "Sim" },
                { value: "NAO_COMPARECEU", label: "Não" },
                { value: "PARCIAL", label: "Parcial" },
                { value: "NAO_INFORMADO", label: "Sem Preenchimento" },
              ]}
            />
            <SelectField label="Atend. Lançado" value={filters.atendimentoLancado || "__all__"} onChange={(v) => update({ atendimentoLancado: v })} options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }, { value: "NAO_INFORMADO", label: "Sem Preenchimento" }]} />
            <SelectField label="ASO Anexado" value={filters.asoAnexado || "__all__"} onChange={(v) => update({ asoAnexado: v })} options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }, { value: "NAO_INFORMADO", label: "Sem Preenchimento" }]} />
            <SelectField
              label="Origem Agendamento"
              value={filters.origemAgendamento || "__all__"}
              onChange={(v) => update({ origemAgendamento: v })}
              options={[{ value: "CLIENTE", label: "Cliente" }, { value: "PREVERMED", label: "PreverMed" }]}
            />
            <SelectField
              label="Status Prestador"
              value={filters.statusPrestador || "__all__"}
              onChange={(v) => update({ statusPrestador: v })}
              options={[{ value: "COM PRESTADOR", label: "Com Prestador" }, { value: "SEM PRESTADOR", label: "Sem Prestador" }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
