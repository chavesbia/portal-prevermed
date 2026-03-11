import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedModuleRouteProps {
  route: string;
  children: ReactNode;
}

export function ProtectedModuleRoute({ route, children }: ProtectedModuleRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { hasModuleAccess, isLoading: permLoading } = useModulePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasModuleAccess(route)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar este módulo. Solicite acesso ao administrador do sistema.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
