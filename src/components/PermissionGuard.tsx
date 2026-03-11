import { ReactNode } from 'react';
import { useModulePermissions } from '@/hooks/useModulePermissions';

interface PermissionGuardProps {
  module: string; // module route e.g. '/gestao-guias'
  action?: 'view' | 'create' | 'edit' | 'delete' | 'approve';
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ module, action = 'view', children, fallback = null }: PermissionGuardProps) {
  const { hasPermission } = useModulePermissions();

  if (!hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
