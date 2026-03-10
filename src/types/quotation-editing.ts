import type { QuotationItem } from "@/types/pricing";
import type { CustosAdicionaisData } from "@/components/pricing/CustosAdicionaisTab";

export interface EditingQuotation {
  id: string;
  clientName: string;
  notes: string;
  discountPercent: number;
  discountValue: number;
  items: QuotationItem[];
  custosAdicionais: CustosAdicionaisData;
  isApprovedEdit?: boolean;
  isRejectedEdit?: boolean;
}
