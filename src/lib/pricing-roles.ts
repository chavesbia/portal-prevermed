import type { PricingRole } from '@/types/pricing';

/**
 * Mapeia a hierarquia do Portal para as roles do módulo de Precificação.
 * 
 * Portal hierarchy_position → PricingRole:
 *   team_member → vendedor
 *   leader → vendedor
 *   coordinator → coordenador
 *   manager → gerente
 *   director → diretor
 * 
 * Portal user_role → PricingRole:
 *   adm_master → admin
 *   adm_user → gerente
 *   tech_user → vendedor
 */
export function mapToPricingRole(
  hierarchyPosition: string | null | undefined,
  userRole: string | null | undefined
): PricingRole {
  // adm_master always maps to admin
  if (userRole === 'adm_master') return 'admin';

  // Map hierarchy position
  switch (hierarchyPosition) {
    case 'director':
      return 'diretor';
    case 'manager':
      return 'gerente';
    case 'coordinator':
      return 'coordenador';
    case 'leader':
    case 'team_member':
    default:
      // adm_user without director/manager hierarchy gets gerente
      if (userRole === 'adm_user') return 'gerente';
      return 'vendedor';
  }
}
