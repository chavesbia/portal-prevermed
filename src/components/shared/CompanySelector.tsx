import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyOption {
  id: string;
  razao_social: string;
  nome_abreviado: string | null;
  cnpj: string | null;
  soc_code: string;
}

function formatCnpj(v: string | null | undefined) {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const CONTRACT_EXCLUDE_KEYWORDS = ['PARTICULAR', 'TESTE', 'NAO UTILIZAR'];

function normalizeForMatch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

interface Props {
  value: string | null | undefined;
  onChange: (companyId: string | null, company: CompanyOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Fallback display text when a legacy record has no company_id linked. */
  legacyLabel?: string | null;
  className?: string;
  /** Exclude internal/test records (PARTICULAR, TESTE, NAO UTILIZAR) — for contract flows. */
  excludeInternal?: boolean;
}

export function CompanySelector({
  value, onChange, placeholder = 'Buscar empresa por nome ou CNPJ…',
  disabled, legacyLabel, className, excludeInternal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies-active-selector'],
    queryFn: async () => {
      const all: CompanyOption[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, razao_social, nome_abreviado, cnpj, soc_code')
          .eq('is_active', true)
          .order('razao_social')
          .range(from, from + step - 1);
        if (error) throw error;
        const batch = (data || []) as CompanyOption[];
        all.push(...batch);
        if (batch.length < step) break;
        from += step;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Selected company from list; if not in list (legacy or inactive) try one-off fetch.
  const inList = useMemo(() => companies.find(c => c.id === value) || null, [companies, value]);
  const { data: fallback } = useQuery({
    queryKey: ['company-by-id', value],
    enabled: !!value && !inList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, razao_social, nome_abreviado, cnpj, soc_code')
        .eq('id', value!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as CompanyOption | null;
    },
  });
  const selected = inList || fallback || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) return companies.slice(0, 100);
    return companies
      .filter(c => {
        const razao = c.razao_social?.toLowerCase() || '';
        const abr = c.nome_abreviado?.toLowerCase() || '';
        const cnpjDigits = (c.cnpj || '').replace(/\D/g, '');
        if (razao.includes(q) || abr.includes(q)) return true;
        if (qDigits && cnpjDigits.includes(qDigits)) return true;
        return false;
      })
      .slice(0, 100);
  }, [companies, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 opacity-70" />
            {selected ? (
              <span className="truncate">
                {selected.razao_social}
                {selected.cnpj && (
                  <span className="text-muted-foreground"> · {formatCnpj(selected.cnpj)}</span>
                )}
              </span>
            ) : legacyLabel ? (
              <span className="flex items-center gap-1 truncate">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="truncate">{legacyLabel}</span>
                <span className="text-xs text-muted-foreground">(sem vínculo)</span>
              </span>
            ) : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por razão social, nome ou CNPJ…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Carregando empresas…' : 'Nenhuma empresa encontrada. Cadastre a empresa no SOC primeiro.'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => { onChange(c.id, c); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{c.razao_social}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.nome_abreviado ? `${c.nome_abreviado} · ` : ''}
                      {c.cnpj ? formatCnpj(c.cnpj) : 'Sem CNPJ'}
                      {c.soc_code ? ` · SOC ${c.soc_code}` : ''}
                    </div>
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

export { formatCnpj as formatCompanyCnpj };
