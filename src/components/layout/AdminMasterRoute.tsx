import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AdminMasterRouteProps {
  children: ReactNode;
}

/**
 * Restringe acesso a rotas exclusivas do ADM Master.
 * Usuários adm_user (Admin User) e tech_user são bloqueados.
 */
export function AdminMasterRoute({ children }: AdminMasterRouteProps) {
  const { user, isAdmMaster, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmMaster) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 p-6">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva para Administradores Master. Você não possui permissão para acessá-la.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
