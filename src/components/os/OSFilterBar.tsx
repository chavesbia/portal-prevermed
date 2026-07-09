import { Search, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { OSFilters, STATUS_OS_OPTIONS, TIPO_SERVICO_OPTIONS, TIPO_OS_OPTIONS } from '@/types/os';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OSFilterBarProps {
  filters: OSFilters;
  setFilters: (f: OSFilters) => void;
  responsaveis: string[];
}

export function OSFilterBar({ filters, setFilters, responsaveis }: OSFilterBarProps) {
  const clearFilters = () => {
    setFilters({
      search: '', status_os: '', responsavel: '',
      tipo_servico: '', tipo_os: '',
      periodo_inicio: null, periodo_fim: null,
    });
  };

  const hasActive = filters.search || filters.status_os || filters.responsavel ||
    filters.tipo_servico || filters.tipo_os || filters.periodo_inicio || filters.periodo_fim;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou Nº OS..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        <Select value={filters.status_os} onValueChange={(v) => setFilters({ ...filters, status_os: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status da OS" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.responsavel} onValueChange={(v) => setFilters({ ...filters, responsavel: v })}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Elaborador/Executor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {responsaveis.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.tipo_servico} onValueChange={(v) => setFilters({ ...filters, tipo_servico: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Serviço" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TIPO_SERVICO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.tipo_os} onValueChange={(v) => setFilters({ ...filters, tipo_os: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo OS" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TIPO_OS_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {filters.periodo_inicio ? format(filters.periodo_inicio, 'dd/MM/yy', { locale: ptBR }) : 'Início'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filters.periodo_inicio || undefined}
              onSelect={(d) => setFilters({ ...filters, periodo_inicio: d || null })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {filters.periodo_fim ? format(filters.periodo_fim, 'dd/MM/yy', { locale: ptBR }) : 'Fim'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filters.periodo_fim || undefined}
              onSelect={(d) => setFilters({ ...filters, periodo_fim: d || null })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
