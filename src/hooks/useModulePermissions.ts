import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ModulePermission {
  module_id: string;
  module_name: string;
  module_route: string;
  module_icon: string;
  department_id: string;
  department_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export interface DepartmentWithModules {
  id: string;
  name: string;
  modules: ModulePermission[];
}

type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export function useModulePermissions() {
  const { user, role } = useAuth();

  const { data: modules = [], isLoading, refetch } = useQuery({
    queryKey: ['module-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_user_accessible_modules', {
        _user_id: user.id,
      });
      if (error) {
        console.error('Error fetching module permissions:', error);
        return [];
      }
      return (data || []) as ModulePermission[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const departmentsWithModules = useMemo<DepartmentWithModules[]>(() => {
    const deptMap = new Map<string, DepartmentWithModules>();
    for (const mod of modules) {
      if (!mod.module_route) continue;
      let dept = deptMap.get(mod.department_id);
      if (!dept) {
        dept = { id: mod.department_id, name: mod.department_name, modules: [] };
        deptMap.set(mod.department_id, dept);
      }
      if (!dept.modules.find(m => m.module_id === mod.module_id)) {
        dept.modules.push(mod);
      }
    }
    return Array.from(deptMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [modules]);

  const getModulePermissions = useCallback((route: string) => {
    if (role === 'adm_master') {
      return { can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true };
    }
    const mod = modules.find(m => m.module_route === route);
    if (!mod) return null;
    return {
      can_view: mod.can_view,
      can_create: mod.can_create,
      can_edit: mod.can_edit,
      can_delete: mod.can_delete,
      can_approve: mod.can_approve,
    };
  }, [modules, role]);

  const hasPermission = useCallback((route: string, action: PermissionAction) => {
    if (role === 'adm_master') return true;
    const perms = getModulePermissions(route);
    if (!perms) return false;
    return perms[`can_${action}`];
  }, [getModulePermissions, role]);

  const isReadOnly = useCallback((route: string) => {
    if (role === 'adm_master') return false;
    const perms = getModulePermissions(route);
    if (!perms) return true;
    return perms.can_view && !perms.can_create && !perms.can_edit && !perms.can_delete;
  }, [getModulePermissions, role]);

  const hasModuleAccess = useCallback((route: string) => {
    if (role === 'adm_master') return true;
    return modules.some(m => m.module_route === route && m.can_view);
  }, [modules, role]);

  return {
    modules,
    departmentsWithModules,
    getModulePermissions,
    hasPermission,
    isReadOnly,
    hasModuleAccess,
    isLoading,
    refresh: refetch,
  };
}
