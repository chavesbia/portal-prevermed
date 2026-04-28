import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Boxes, Save } from 'lucide-react';
import {
  useCommercialServices,
  useClientServices,
  useClientServiceModules,
  useAllPackageComponents,
} from '@/hooks/useCommercialServices';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  clientId: string;
  readOnly?: boolean;
}

/** Carrega todas as relações pacote->componente do catálogo para os pacotes vinculados ao cliente */
function usePackageComponentsBulk(packageIds: string[]) {
  return useQuery({
    queryKey: ['package-components-bulk', packageIds.sort().join(',')],
    queryFn: async () => {
      if (packageIds.length === 0) return [] as { package_id: string; component_id: string; component: any }[];
      const { data, error } = await supabase
        .from('commercial_service_components')
        .select('package_id, component_id, component:commercial_services!commercial_service_components_component_id_fkey(*)')
        .in('package_id', packageIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: packageIds.length > 0,
  });
}

export default function ClientPackageModules({ clientId, readOnly }: Props) {
  const { services } = useCommercialServices();
  const { clientServices } = useClientServices(clientId);
  const { modules, setPackageModules } = useClientServiceModules(clientId);

  // Pacotes vinculados ao cliente
  const linkedPackages = useMemo(
    () => clientServices.filter(cs => cs.service?.is_package).map(cs => cs.service!),
    [clientServices],
  );

  const { data: bulkComponents = [], isLoading } = usePackageComponentsBulk(
    linkedPackages.map(p => p.id),
  );

  // Estado local de marcações por pacote (componentId[] ativos)
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  // Inicializa estado local quando dados chegam
  useEffect(() => {
    if (linkedPackages.length === 0) return;
    const next: Record<string, string[]> = {};
    for (const pkg of linkedPackages) {
      const allComponentsOfPkg = bulkComponents
        .filter(c => c.package_id === pkg.id)
        .map(c => c.component_id);
      const customized = modules.filter(m => m.package_id === pkg.id);
      if (customized.length > 0) {
        next[pkg.id] = customized.filter(m => m.is_active).map(m => m.component_id);
      } else {
        // Padrão: todos do catálogo ativos
        next[pkg.id] = allComponentsOfPkg;
      }
    }
    setPending(next);
    setDirty({});
  }, [linkedPackages.length, bulkComponents.length, modules.length]);

  const toggle = (packageId: string, componentId: string) => {
    setPending(prev => {
      const cur = prev[packageId] || [];
      const has = cur.includes(componentId);
      return { ...prev, [packageId]: has ? cur.filter(id => id !== componentId) : [...cur, componentId] };
    });
    setDirty(d => ({ ...d, [packageId]: true }));
  };

  const save = async (packageId: string) => {
    const allOfPkg = bulkComponents
      .filter(c => c.package_id === packageId)
      .map(c => c.component_id);
    await setPackageModules.mutateAsync({
      packageId,
      allComponentIds: allOfPkg,
      activeComponentIds: pending[packageId] || [],
    });
    setDirty(d => ({ ...d, [packageId]: false }));
  };

  if (linkedPackages.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Pacotes Modulares Contratados</h4>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Marque quais módulos de cada pacote estão ativos para este cliente.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        linkedPackages.map(pkg => {
          const pkgComponents = bulkComponents.filter(c => c.package_id === pkg.id);
          const activeIds = pending[pkg.id] || [];
          return (
            <Card key={pkg.id} className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{pkg.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {activeIds.length}/{pkgComponents.length} módulos ativos
                    </Badge>
                  </div>
                  {dirty[pkg.id] && !readOnly && (
                    <Button size="sm" onClick={() => save(pkg.id)} disabled={setPackageModules.isPending} className="gap-1.5">
                      {setPackageModules.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                  )}
                </div>

                {pkgComponents.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Este pacote ainda não tem componentes cadastrados. Configure-os em <strong>Configurações → Catálogo</strong>.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {pkgComponents.map(c => {
                      const checked = activeIds.includes(c.component_id);
                      return (
                        <label
                          key={c.component_id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-sm cursor-pointer transition-colors ${
                            checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/40'
                          } ${readOnly ? 'pointer-events-none opacity-70' : ''}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => !readOnly && toggle(pkg.id, c.component_id)}
                            disabled={readOnly}
                          />
                          <span className="flex-1 truncate">{c.component?.name || '—'}</span>
                          {c.component?.category && (
                            <span className="text-[10px] text-muted-foreground uppercase">{c.component.category}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
