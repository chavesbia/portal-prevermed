import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Normaliza acentos/caixa para comparação
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function useUserDepartments() {
  const { user, isAdmMaster } = useAuth();
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setDepartments([]); setIsLoading(false); return; }
      const { data: ud } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);
      const ids = (ud || []).map((r: any) => r.department_id);
      if (ids.length === 0) { if (!cancelled) { setDepartments([]); setIsLoading(false); } return; }
      const { data: deps } = await supabase
        .from('departments')
        .select('name')
        .in('id', ids);
      if (!cancelled) {
        setDepartments((deps || []).map((d: any) => d.name as string));
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const hasDepartment = (name: string) =>
    isAdmMaster || departments.some(d => norm(d) === norm(name));

  const isFinanceiro = hasDepartment('Financeiro');

  return { departments, hasDepartment, isFinanceiro, isLoading };
}
