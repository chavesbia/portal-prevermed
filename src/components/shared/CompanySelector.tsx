import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Building2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  /** Hide the built-in duplicate-CNPJ warning (kept visible by default). */
  hideDuplicateWarning?: boolean;
  /**
   * Notifies the parent when there is a duplicate-CNPJ warning still awaiting
   * confirmation, so flows can block progression until the user acknowledges it.
   */
  onDuplicateWarningChange?: (pending: boolean) => void;
}

export function CompanySelector({
  value, onChange, placeholder = 'Buscar empresa por nome ou CNPJ…',
  disabled, legacyLabel, className, excludeInternal,
  hideDuplicateWarning, onDuplicateWarningChange,
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

  const visibleCompanies = useMemo(() => {
    if (!excludeInternal) return companies;
    return companies.filter(c => {
      const norm = normalizeForMatch(c.razao_social);
      return !CONTRACT_EXCLUDE_KEYWORDS.some(k => norm.includes(k));
    });
  }, [companies, excludeInternal]);

  // Other ACTIVE companies in the SOC master sharing the same CNPJ.
  const duplicates = useMemo(() => {
    const digits = (selected?.cnpj || '').replace(/\D/g, '');
    if (!selected || !digits) return [] as CompanyOption[];
    return companies.filter(
      c => c.id !== selected.id && (c.cnpj || '').replace(/\D/g, '') === digits,
    );
  }, [companies, selected]);

  const [ackCompanyId, setAckCompanyId] = useState<string | null>(null);
  const duplicateWarningPending =
    duplicates.length > 0 && !!selected && ackCompanyId !== selected.id;

  useEffect(() => {
    onDuplicateWarningChange?.(duplicateWarningPending);
  }, [duplicateWarningPending, onDuplicateWarningChange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) return visibleCompanies.slice(0, 100);
    return visibleCompanies
      .filter(c => {
        const razao = c.razao_social?.toLowerCase() || '';
        const abr = c.nome_abreviado?.toLowerCase() || '';
        const cnpjDigits = (c.cnpj || '').replace(/\D/g, '');
        if (razao.includes(q) || abr.includes(q)) return true;
        if (qDigits && cnpjDigits.includes(qDigits)) return true;
        return false;
      })
      .slice(0, 100);
  }, [visibleCompanies, search]);

  return (
    <div className="space-y-2">
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
          <span className="flex items-center gap-1 shrink-0">
            {!!value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpar empresa"
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

      {!hideDuplicateWarning && duplicates.length > 0 && selected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: CNPJ com mais de um cadastro ativo no SOC</AlertTitle>
          <AlertDescription className="space-y-2">
            <ul className="text-sm list-disc pl-5">
              <li>
                <span className="font-medium">{selected.soc_code}</span> — {selected.razao_social}{' '}
                <span className="text-xs opacity-80">(selecionado)</span>
              </li>
              {duplicates.map(d => (
                <li key={d.id}>
                  <span className="font-medium">{d.soc_code}</span> — {d.razao_social}
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Confirme se este é o cadastro correto antes de continuar.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {duplicateWarningPending ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAckCompanyId(selected.id)}
                >
                  Continuar com {selected.razao_social}
                </Button>
              ) : (
                <span className="text-xs italic opacity-90">
                  Confirmado: seguindo com {selected.razao_social}.
                </span>
              )}
              {duplicates.map(d => (
                <Button
                  key={d.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setAckCompanyId(null); onChange(d.id, d); }}
                >
                  Trocar para {d.soc_code}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setAckCompanyId(null); onChange(null, null); }}
              >
                Escolher outro
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Other ACTIVE companies sharing the same CNPJ as the given company. */
export function useDuplicateCnpjCompanies(company: { id: string; cnpj: string | null } | null | undefined) {
  const digits = (company?.cnpj || '').replace(/\D/g, '');
  return useQuery({
    queryKey: ['companies-duplicate-cnpj', digits, company?.id],
    enabled: !!company?.id && digits.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, razao_social, nome_abreviado, cnpj, soc_code')
        .eq('cnpj', digits)
        .eq('is_active', true)
        .neq('id', company!.id);
      if (error) throw error;
      return (data || []) as CompanyOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export { formatCnpj as formatCompanyCnpj };
