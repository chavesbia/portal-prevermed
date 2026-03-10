import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { QuotationItem } from "@/types/pricing";
import { toast } from "@/hooks/use-toast";

interface CustosAdicionaisData {
  [key: string]: any;
}

interface SaveQuotationParams {
  clientName: string;
  notes: string;
  discountPercent: number;
  discountValue: number;
  items: QuotationItem[];
  custosAdicionais: CustosAdicionaisData;
  totalValue: number;
  totalCost: number;
  marginPercent: number;
}

interface UpdateQuotationParams extends SaveQuotationParams {
  id: string;
  isApprovedEdit?: boolean;
  isRejectedEdit?: boolean;
}

export function useQuotations() {
  const { user } = useAuth();

  const saveQuotation = async (params: SaveQuotationParams) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado para salvar", variant: "destructive" });
      return false;
    }

    const {
      clientName,
      notes,
      discountPercent,
      discountValue: discountFixedValue,
      items,
      custosAdicionais,
      totalValue,
      totalCost,
      marginPercent,
    } = params;

    const discountFromPercent = totalValue * (discountPercent / 100);
    const totalDiscount = discountFromPercent + discountFixedValue;
    const finalValue = totalValue - totalDiscount;
    const finalResult = finalValue - totalCost;

    try {
      const { error } = await supabase.from("quotations").insert({
        client_name: clientName,
        notes,
        discount_percent: discountPercent,
        discount_value: discountFixedValue,
        total_value: finalValue,
        total_cost: totalCost,
        total_result: finalResult,
        margin_percent: marginPercent,
        items: items as any,
        custos_adicionais: custosAdicionais as any,
        created_by: user.id,
        status: "aguardando_aprovacao" as any,
        version_number: 1,
      });

      if (error) throw error;

      toast({ title: "Sucesso", description: "Memória de cálculo salva! Aguardando aprovação." });
      return true;
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast({ title: "Erro", description: "Erro ao salvar memória de cálculo", variant: "destructive" });
      return false;
    }
  };

  const updateQuotation = async (params: UpdateQuotationParams) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado para atualizar", variant: "destructive" });
      return false;
    }

    const {
      id,
      clientName,
      notes,
      discountPercent,
      discountValue: discountFixedValue,
      items,
      custosAdicionais,
      totalValue,
      totalCost,
      marginPercent,
      isApprovedEdit,
      isRejectedEdit,
    } = params;

    const discountFromPercent = totalValue * (discountPercent / 100);
    const totalDiscount = discountFromPercent + discountFixedValue;
    const finalValue = totalValue - totalDiscount;
    const finalResult = finalValue - totalCost;

    try {
      const { data: currentQuotation, error: fetchError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Salvar versão anterior no histórico
      const { error: versionError } = await supabase
        .from("quotation_versions")
        .insert({
          quotation_id: id,
          version_number: currentQuotation.version_number,
          client_name: currentQuotation.client_name,
          items: currentQuotation.items,
          custos_adicionais: currentQuotation.custos_adicionais,
          discount_percent: currentQuotation.discount_percent,
          discount_value: currentQuotation.discount_value || 0,
          total_value: currentQuotation.total_value,
          total_cost: currentQuotation.total_cost,
          total_result: currentQuotation.total_result,
          margin_percent: currentQuotation.margin_percent,
          notes: currentQuotation.notes,
          created_by: user.id,
          status: currentQuotation.status,
          rejection_reason: currentQuotation.rejection_reason,
        });

      if (versionError) throw versionError;

      const updateData: any = {
        client_name: clientName,
        notes,
        discount_percent: discountPercent,
        discount_value: discountFixedValue,
        total_value: finalValue,
        total_cost: totalCost,
        total_result: finalResult,
        margin_percent: marginPercent,
        items: items as any,
        custos_adicionais: custosAdicionais as any,
        updated_at: new Date().toISOString(),
        version_number: currentQuotation.version_number + 1,
      };

      if (isRejectedEdit) {
        updateData.status = "aguardando_aprovacao";
        updateData.rejection_reason = null;
        updateData.approved_by = null;
        updateData.approved_at = null;
      }

      let query = supabase
        .from("quotations")
        .update(updateData)
        .eq("id", id);

      if (!isApprovedEdit && !isRejectedEdit) {
        query = query.eq("status", "aguardando_aprovacao" as any);
      } else if (isRejectedEdit) {
        query = query.eq("status", "rejeitado" as any);
      }

      const { error } = await query;

      if (error) throw error;

      toast({ title: "Sucesso", description: `Memória de cálculo atualizada! Versão ${currentQuotation.version_number + 1}` });
      return true;
    } catch (error) {
      console.error("Error updating quotation:", error);
      toast({ title: "Erro", description: "Erro ao atualizar memória de cálculo", variant: "destructive" });
      return false;
    }
  };

  return { saveQuotation, updateQuotation };
}
