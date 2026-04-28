import { ReactNode, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AdminMasterRouteProps {
  children: ReactNode;
}

/**
 * Restringe acesso a rotas exclusivas do ADM Master.
 * Bloqueia adm_user, tech_user e qualquer outro papel.
 * Toda tentativa de acesso indevido é registrada em unauthorized_access_log.
 */
export function AdminMasterRoute({ children }: AdminMasterRouteProps) {
  const { user, role, isAdmMaster, isLoading } = useAuth();
  const location = useLocation();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !user || isAdmMaster) return;
    const key = `${user.id}:${location.pathname}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;

    supabase.rpc('log_unauthorized_access', {
      _resource: location.pathname,
      _source: 'frontend_route_guard',
      _method: 'GET',
      _details: {
        attempted_role: role,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      },
    }).then(({ error }) => {
      if (error) console.error('Failed to log unauthorized access:', error);
    });
  }, [isLoading, user, isAdmMaster, role, location.pathname]);

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
          Esta área é exclusiva para Administradores Master. Sua tentativa de acesso foi registrada.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
