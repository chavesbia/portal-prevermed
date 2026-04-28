import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Search, Package } from 'lucide-react';
import { useCommercialServices } from '@/hooks/useCommercialServices';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function ServicesTagSelector({ value, onChange, disabled }: Props) {
  const { services, isLoading } = useCommercialServices();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const list = services.filter(s => s.is_active);
    const filtered = query
      ? list.filter(s =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          (s.category || '').toLowerCase().includes(query.toLowerCase()),
        )
      : list;
    const map: Record<string, typeof filtered> = {};
    for (const s of filtered) {
      const cat = s.category || 'Outros';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    return Object.entries(map);
  }, [services, query]);

  const selected = services.filter(s => value.includes(s.id));

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border bg-background">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">Nenhum serviço selecionado</span>
        )}
        {selected.map(s => (
          <Badge
            key={s.id}
            variant={s.is_package ? 'default' : 'secondary'}
            className="gap-1 text-xs"
          >
            {s.is_package && <Package className="h-3 w-3" />}
            {s.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="hover:text-destructive"
                aria-label={`Remover ${s.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar serviços
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar serviço..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <ScrollArea className="h-72">
              <div className="p-2 space-y-3">
                {isLoading && <p className="text-xs text-muted-foreground p-2">Carregando...</p>}
                {!isLoading && grouped.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Nenhum serviço encontrado.</p>
                )}
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground px-1 mb-1">{cat}</p>
                    <div className="space-y-1">
                      {items.map(s => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={value.includes(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <span className="flex-1">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
