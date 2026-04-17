import { useMemo } from "react";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Permissões granulares por etapa do módulo Liberação de ASOs.
 *
 * O ADM Master cria sub-módulos no admin com as rotas abaixo (qualquer subset).
 * Se existirem, controlam o acesso de edição de cada aba do drawer.
 * Caso não existam, o sistema faz fallback para a permissão geral do módulo
 * (`/liberacao-asos`), preservando o comportamento atual (qualquer usuário do
 * módulo pode editar todas as abas).
 *
 * Rotas esperadas:
 *  - /liberacao-asos/recepcao
 *  - /liberacao-asos/enfermagem
 *  - /liberacao-asos/assinatura
 *  - /liberacao-asos/liberacao
 *  - /liberacao-asos/faturamento
 *  - /liberacao-asos/fechamento  (gerar lote de fechamento — gerencial)
 */
export type ASOEtapa =
  | "recepcao"
  | "enfermagem"
  | "assinatura"
  | "liberacao"
  | "faturamento"
  | "fechamento";

const ROUTE_PREFIX = "/liberacao-asos";

export function useASOEtapaPermissions() {
  const { role } = useAuth();
  const { modules, hasPermission } = useModulePermissions();

  const isAdmMaster = role === "adm_master";

  return useMemo(() => {
    const baseCanEdit = hasPermission(ROUTE_PREFIX, "edit");

    const detectGranular = (etapa: ASOEtapa) => {
      const route = `${ROUTE_PREFIX}/${etapa}`;
      return modules.some((m) => m.module_route === route);
    };

    const canEditEtapa = (etapa: ASOEtapa): boolean => {
      if (isAdmMaster) return true;
      const route = `${ROUTE_PREFIX}/${etapa}`;
      const hasGranular = detectGranular(etapa);
      // Se houver sub-módulo configurado, exige permissão específica
      if (hasGranular) return hasPermission(route, "edit");
      // Fallback: usa a permissão geral
      return baseCanEdit;
    };

    return {
      isAdmMaster,
      canEditEtapa,
      canEditRecepcao: canEditEtapa("recepcao"),
      canEditEnfermagem: canEditEtapa("enfermagem"),
      canEditAssinatura: canEditEtapa("assinatura"),
      canEditLiberacao: canEditEtapa("liberacao"),
      canEditFaturamento: canEditEtapa("faturamento"),
      canCloseLote: isAdmMaster || canEditEtapa("fechamento"),
      canDeleteLote: isAdmMaster,
    };
  }, [isAdmMaster, hasPermission, modules]);
}
