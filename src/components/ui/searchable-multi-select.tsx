import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SearchableMultiSelectOption = {
  value: string;
  label: string;
  typeLabel?: string;
  secondaryLabel?: string;
  keywords?: string[];
  disabled?: boolean;
};

type SearchableMultiSelectProps = {
  options: SearchableMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  maxSelected?: number;
  disabled?: boolean;
  className?: string;
};

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecionar',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado encontrado.',
  maxSelected,
  disabled,
  className,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);

  const selectedOptions = React.useMemo(() => {
    const map = new Map(options.map((option) => [option.value, option]));
    return value.map((selectedValue) => map.get(selectedValue)).filter(Boolean) as SearchableMultiSelectOption[];
  }, [options, value]);

  const filteredOptions = React.useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return options;

    return options.filter((option) => {
      const haystack = [option.label, option.secondaryLabel, option.typeLabel, ...(option.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return haystack.includes(term);
    });
  }, [deferredSearch, options]);

  const toggleValue = (selectedValue: string) => {
    const exists = value.includes(selectedValue);

    if (exists) {
      onChange(value.filter((item) => item !== selectedValue));
      return;
    }

    if (maxSelected === 1) {
      onChange([selectedValue]);
      setOpen(false);
      return;
    }

    if (typeof maxSelected === 'number' && value.length >= maxSelected) {
      onChange([...value.slice(1 - maxSelected), selectedValue]);
      return;
    }

    onChange([...value, selectedValue]);
  };

  const removeValue = (selectedValue: string) => {
    onChange(value.filter((item) => item !== selectedValue));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'min-h-11 w-full justify-between gap-2 px-3 py-2 text-left font-normal',
            value.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden">
            {selectedOptions.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
                {selectedOptions.map((option) => (
                  <Badge key={option.value} variant="secondary" className="flex max-w-full items-center gap-1.5 py-1 pl-2 pr-1">
                    {option.typeLabel && <span className="text-[10px] uppercase text-muted-foreground">{option.typeLabel}</span>}
                    <span className="max-w-[180px] truncate">{option.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded-sm p-0.5 hover:bg-background/60"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeValue(option.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          removeValue(option.value);
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </Badge>
                ))}
              </div>
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(32rem,var(--radix-popover-trigger-width))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const selected = value.includes(option.value);
                const selectionLocked = !selected && typeof maxSelected === 'number' && maxSelected === 1 && value.length >= 1;

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled || selectionLocked}
                    onSelect={() => toggleValue(option.value)}
                    className="items-start gap-3 py-2"
                  >
                    <div className={cn('mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border border-border', selected && 'bg-primary text-primary-foreground')}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{option.label}</span>
                        {option.typeLabel && (
                          <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{option.typeLabel}</span>
                        )}
                      </div>
                      {option.secondaryLabel && (
                        <p className="truncate text-xs text-muted-foreground">{option.secondaryLabel}</p>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}