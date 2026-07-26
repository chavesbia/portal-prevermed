import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface UnitOption {
  id: string;
  name: string | null;
  razao_social: string | null;
  soc_unit_code: string | null;
  cidade: string | null;
  estado: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
}

function unitLabel(u: UnitOption) {
  return u.name || u.razao_social || u.soc_unit_code || 'Unidade sem nome';
}

function unitSubtitle(u: UnitOption) {
  const addr = [u.logradouro, u.numero, u.bairro].filter(Boolean).join(', ');
  const city = [u.cidade, u.estado].filter(Boolean).join('/');
  return [addr, city, u.soc_unit_code ? `SOC ${u.soc_unit_code}` : ''].filter(Boolean).join(' · ');
}

interface Props {
  companyId: string | null | undefined;
  value: string | null | undefined;
  onChange: (unitId: string | null, unit: UnitOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UnitSelector({
  companyId, value, onChange,
  placeholder = 'Buscar unidade…', disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['company-units-selector', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const all: UnitOption[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('company_units')
          .select('id, name, razao_social, soc_unit_code, cidade, estado, logradouro, numero, bairro')
          .eq('company_id', companyId!)
          .eq('is_active', true)
          .order('name')
          .range(from, from + step - 1);
        if (error) throw error;
        const batch = (data || []) as UnitOption[];
        all.push(...batch);
        if (batch.length < step) break;
        from += step;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = useMemo(() => units.find(u => u.id === value) || null, [units, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units.slice(0, 100);
    return units
      .filter(u => `${unitLabel(u)} ${unitSubtitle(u)}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [units, search]);

  const isDisabled = disabled || !companyId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isDisabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">
              {selected ? unitLabel(selected) : (!companyId ? 'Selecione uma empresa primeiro' : placeholder)}
            </span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {!!value && !isDisabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpar unidade"
                className="rounded-sm p-0.5 opacity-60 hover:opacity-100 hover:bg-muted"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null, null); }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>

        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar unidade por nome, endereço ou código…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Carregando unidades…' : 'Nenhuma unidade encontrada para esta empresa.'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(u => (
                <CommandItem
                  key={u.id}
                  value={u.id}
                  onSelect={() => { onChange(u.id, u); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === u.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{unitLabel(u)}</div>
                    <div className="text-xs text-muted-foreground truncate">{unitSubtitle(u) || 'Sem endereço cadastrado'}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
