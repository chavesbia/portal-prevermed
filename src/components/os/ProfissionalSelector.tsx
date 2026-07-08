import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useProfissionais } from '@/hooks/useProfissionais';
import { ProfissionalFormDialog } from './ProfissionalFormDialog';

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProfissionalSelector({ value, onChange, placeholder = 'Selecionar responsável', disabled }: Props) {
  const { profissionais } = useProfissionais();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');

  const ativos = useMemo(() => profissionais.filter(p => p.ativo), [profissionais]);
  const selected = profissionais.find(p => p.id === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal h-8 text-xs', !selected && 'text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5 truncate">
              <User className="h-3.5 w-3.5 shrink-0" />
              {selected ? (
                <>
                  <span className="truncate">{selected.nome}</span>
                  <span className="text-muted-foreground">
                    · {selected.categoria}
                    {selected.tipo === 'externo' ? ' (Ext.)' : ''}
                  </span>
                </>
              ) : placeholder}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar profissional…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => { onChange(null); setOpen(false); }}
                    className="text-muted-foreground italic"
                  >
                    Remover responsável
                  </CommandItem>
                )}
                {ativos.map(p => (
                  <CommandItem
                    key={p.id}
                    value={`${p.nome} ${p.categoria} ${p.conselho_sigla || ''} ${p.numero_conselho || ''}`}
                    onSelect={() => { onChange(p.id); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.categoria} · {p.tipo === 'interno' ? 'Interno' : 'Externo'}
                        {p.conselho_sigla ? ` · ${p.conselho_sigla} ${p.numero_conselho || ''}` : ''}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => { setOpen(false); setShowNew(true); }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo profissional{search ? ` "${search}"` : ''}
                </Button>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ProfissionalFormDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultNome={search}
        onSaved={p => { if (p) onChange(p.id); }}
      />
    </>
  );
}
