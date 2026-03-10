import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Filter, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface GuiaFiltersState {
  dataGuiaInicio: Date | undefined;
  dataGuiaFim: Date | undefined;
  dataAgendamentoInicio: Date | undefined;
  dataAgendamentoFim: Date | undefined;
  empresa: string;
  prestador: string;
  tipoExame: string;
  situacao: string;
  atendido: string;
  sla: string;
  compareceu: string;
  atendimentoLancado: string;
  asoAnexado: string;
}

export const emptyFilters: GuiaFiltersState = {
  dataGuiaInicio: undefined,
  dataGuiaFim: undefined,
  dataAgendamentoInicio: undefined,
  dataAgendamentoFim: undefined,
  empresa: "",
  prestador: "",
  tipoExame: "",
  situacao: "",
  atendido: "",
  sla: "",
  compareceu: "",
  atendimentoLancado: "",
  asoAnexado: "",
};

interface Props {
  filters: GuiaFiltersState;
  onChange: (f: GuiaFiltersState) => void;
  empresas: string[];
  prestadores: string[];
  tiposExame: string[];
  situacoes: string[];
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start text-left text-xs font-normal">
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
      <Label className="text-xs">{label}</Label>
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

export function GuiaFilters({ filters, onChange, empresas, prestadores, tiposExame, situacoes }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.entries(filters).filter(([_, v]) => v !== undefined && v !== "").length;

  const update = (patch: Partial<GuiaFiltersState>) => {
    const next = { ...filters, ...patch };
    for (const key of Object.keys(next) as (keyof GuiaFiltersState)[]) {
      if (next[key] === "__all__") (next as any)[key] = "";
    }
    onChange(next);
  };

  const clear = () => onChange({ ...emptyFilters });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-4" align="start">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Filtros Avançados</h4>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DatePickerField label="Data Guia (de)" value={filters.dataGuiaInicio} onChange={(d) => update({ dataGuiaInicio: d })} />
          <DatePickerField label="Data Guia (até)" value={filters.dataGuiaFim} onChange={(d) => update({ dataGuiaFim: d })} />
          <DatePickerField label="Agendamento (de)" value={filters.dataAgendamentoInicio} onChange={(d) => update({ dataAgendamentoInicio: d })} />
          <DatePickerField label="Agendamento (até)" value={filters.dataAgendamentoFim} onChange={(d) => update({ dataAgendamentoFim: d })} />

          <SelectField label="Empresa" value={filters.empresa || "__all__"} onChange={(v) => update({ empresa: v })} options={empresas.map((e) => ({ value: e, label: e }))} />
          <SelectField label="Prestador" value={filters.prestador || "__all__"} onChange={(v) => update({ prestador: v })} options={prestadores.map((p) => ({ value: p, label: p }))} />
          <SelectField label="Tipo Exame" value={filters.tipoExame || "__all__"} onChange={(v) => update({ tipoExame: v })} options={tiposExame.map((t) => ({ value: t, label: t }))} />
          <SelectField label="Situação" value={filters.situacao || "__all__"} onChange={(v) => update({ situacao: v })} options={situacoes.map((s) => ({ value: s, label: s }))} />

          <SelectField
            label="Atendido"
            value={filters.atendido || "__all__"}
            onChange={(v) => update({ atendido: v })}
            options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }]}
          />
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
            label="Compareceu"
            value={filters.compareceu || "__all__"}
            onChange={(v) => update({ compareceu: v })}
            options={[
              { value: "COMPARECEU", label: "Sim" },
              { value: "NAO_COMPARECEU", label: "Não" },
              { value: "REMARCADO", label: "Remarcado" },
              { value: "PARCIAL", label: "Parcial" },
            ]}
          />
          <SelectField
            label="Atend. Lançado"
            value={filters.atendimentoLancado || "__all__"}
            onChange={(v) => update({ atendimentoLancado: v })}
            options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }]}
          />
          <SelectField
            label="ASO Anexado"
            value={filters.asoAnexado || "__all__"}
            onChange={(v) => update({ asoAnexado: v })}
            options={[{ value: "SIM", label: "Sim" }, { value: "NAO", label: "Não" }]}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
