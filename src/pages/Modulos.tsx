import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { launchExternalModule } from '@/lib/module-launcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  ExternalLink,
  Lock,
  Calculator,
  ClipboardList,
  Boxes,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Calculator,
  ClipboardList,
  Boxes,
};

interface ModuleWithAccess {
  id: string;
  name: string;
  description: string | null;
  base_url: string | null;
  app_type: string | null;
  icon: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  has_access: boolean;
}

export default function Modulos() {
  const { user, isAdmin } = useAuth();
  const [modules, setModules] = useState<ModuleWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchModules();
  }, [user]);

  const fetchModules = async () => {
    if (!user) return;

    const { data: allModules } = await supabase
      .from('modules')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!allModules) {
      setLoading(false);
      return;
    }

    // Get user's access
    const { data: accessList } = await supabase
      .from('user_module_access')
      .select('module_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const accessSet = new Set((accessList || []).map(a => a.module_id));

    setModules(
      allModules.map(m => ({
        ...m,
        has_access: isAdmin || accessSet.has(m.id),
      }))
    );
    setLoading(false);
  };

  const handleLaunch = async (mod: ModuleWithAccess) => {
    if (!mod.base_url) return;
    setLaunching(mod.id);

    const result = await launchExternalModule(mod.base_url, mod.id);

    if (!result.success) {
      toast({
        title: 'Acesso negado',
        description: result.error,
        variant: 'destructive',
      });
    }

    setLaunching(null);
  };

  const getIcon = (iconName: string | null) => {
    const Icon = iconName ? iconMap[iconName] : Boxes;
    return Icon || Boxes;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Módulos</h1>
        <p className="page-subtitle">
          Acesse os sistemas integrados ao Portal PreverMed.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(mod => {
          const Icon = getIcon(mod.icon);
          return (
            <Card
              key={mod.id}
              className={`card-elevated transition-all ${
                mod.has_access
                  ? 'hover:shadow-lg cursor-pointer'
                  : 'opacity-60'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{mod.name}</CardTitle>
                      {mod.app_type && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {mod.app_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!mod.has_access && (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {mod.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {mod.description}
                  </p>
                )}
                <Button
                  className="w-full"
                  variant={mod.has_access ? 'default' : 'secondary'}
                  disabled={!mod.has_access || launching === mod.id}
                  onClick={() => handleLaunch(mod)}
                >
                  {launching === mod.id ? (
                    'Abrindo...'
                  ) : mod.has_access ? (
                    <>
                      Acessar <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  ) : (
                    'Sem permissão'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {modules.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhum módulo disponível.
          </div>
        )}
      </div>
    </div>
  );
}
