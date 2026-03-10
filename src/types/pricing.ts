// Tipos para Atendimento In Loco
export interface ServiceItem {
  id: string;
  code: string;
  description: string;
  unit: 'HORAS' | 'DIA' | 'POR ATENDIMENTO' | 'TOTAL KM' | 'EQUIPAMENTOS' | 'DESLOCAMENTO' | 'ALIMENTAÇÃO' | 'OUTROS' | 'EXAME' | 'PESSOAL' | 'EXTRAS';
  unitValue: number;
  costValue: number;
  minQuantity?: number;
  category: 'servico' | 'deslocamento' | 'exame_complementar';
  // Markup padrão para cálculo automático de preço de venda (para deslocamento)
  defaultMarkup?: number;
  // Instruções ou informações adicionais (preparo de exame, contato, procedimentos, etc.)
  infoText?: string;
}

export interface QuotationItem {
  serviceId: string;
  quantity: number;
  unitValue: number;
  customUnitValue?: number; // Valor de venda customizado pelo vendedor
  totalValue: number;
  costValue: number;
  customCostValue?: number; // Custo customizado (para deslocamento)
  totalCost: number;
  markup: number;
  result: number;
  resultPercent: number;
}

// Item adicional de custo de deslocamento
export interface OutroCustoItem {
  id: string;
  descricao: string;
  valor: number;
}

// Estrutura para custos de deslocamento
export interface DeslocamentoItem {
  kmTotal: number;
  kmCusto: number;
  hospedagem: number;
  aplicativo: number; // Uber/99 - fixo
  outrosCustos: OutroCustoItem[];
  markupPercent: number;
}

export interface Quotation {
  id: string;
  clientName: string;
  createdAt: Date;
  items: QuotationItem[];
  totalValue: number;
  totalCost: number;
  totalResult: number;
  marginPercent: number;
  status: 'rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'rejeitado';
  approvalLevel?: ApprovalLevel;
  discountPercent?: number;
  notes?: string;
}

// Níveis de Alçada de Aprovação
export interface ApprovalLevel {
  level: number;
  name: string;
  minMargin: number; // Margem mínima que pode aprovar
  maxDiscount: number; // Desconto máximo que pode aprovar
  approverRole: PricingRole;
}

// Roles específicas do módulo de precificação, mapeadas da hierarquia do Portal
export type PricingRole = 'vendedor' | 'coordenador' | 'gerente' | 'diretor' | 'admin';
// Alias para compatibilidade com componentes migrados
export type UserRole = PricingRole;

export const APPROVAL_LEVELS: ApprovalLevel[] = [
  { level: 1, name: 'Vendedor', minMargin: 30, maxDiscount: 5, approverRole: 'vendedor' },
  { level: 2, name: 'Coordenador', minMargin: 20, maxDiscount: 15, approverRole: 'coordenador' },
  { level: 3, name: 'Gerente', minMargin: 10, maxDiscount: 25, approverRole: 'gerente' },
  { level: 4, name: 'Diretor', minMargin: 5, maxDiscount: 35, approverRole: 'diretor' },
  { level: 5, name: 'Admin Master', minMargin: 0, maxDiscount: 50, approverRole: 'admin' },
];

// Tipos para Planos
export interface Plan {
  id: string;
  name: string;
  type: 'A' | 'B' | 'C';
  description: string;
  pricePerLife: number;
  includedServices: string[];
}

export interface PlanPricing {
  lives: number;
  ltcat: number;
  pgr: number;
  drps: number;
  pcmso: number;
  pricePerLife: number;
}

// Tipos para Treinamentos
export interface Training {
  id: string;
  baseLegal: string;
  description: string;
  objective: string;
  targetFunction: string;
  type: string;
  hours: number;
  particularities?: string;
  internalCost: number;
  externalCost: number;
  variableCost: number;
  adminFee: number;
  desiredMargin: number;
  minTurmaPrice: number;
  priceTier1_3: number;
  priceTier4_6: number;
  priceTier7_10: number;
  pricePerPersonAbove10: number;
}
