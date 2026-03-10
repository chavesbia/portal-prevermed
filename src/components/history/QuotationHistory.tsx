import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { History, Check, X, FileText, Download, Loader2, Pencil, Trash2, Clock, GitCompare, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { useServices } from "@/hooks/useServices";
import { EditingQuotation } from "@/types/quotation-editing";
import { CustosAdicionaisData } from "@/components/pricing/CustosAdicionaisTab";
import { QuotationItem as QuotationItemType } from "@/types/pricing";
import { RejectDialog } from "./RejectDialog";
import { VersionHistory } from "./VersionHistory";
import { VersionComparison } from "./VersionComparison";

interface QuotationItem {
  serviceId: string;
  quantity: number;
  unitValue: number;
  customUnitValue?: number;
  totalValue: number;
  costValue: number;
  totalCost: number;
}

interface CustosAdicionais {
  kmTotal: number;
  kmCusto: number;
  hospedagem: number;
  aplicativo: number;
  alimentacao: number;
  transporteEquipamentos: number;
  markupPercent: number;
  outrosCustos: { id: string; descricao: string; valor: number }[];
}

interface Quotation {
  id: string;
  quotation_number: string | null;
  version_number: number;
  client_name: string;
  total_value: number;
  total_cost: number;
  margin_percent: number;
  discount_percent: number;
  discount_value: number;
  status: "aguardando_aprovacao" | "aprovado" | "rejeitado";
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  created_by: string;
  approved_by: string | null;
  notes: string | null;
  items: QuotationItem[];
  custos_adicionais: CustosAdicionais;
  creator_profile?: { full_name: string };
  approver_profile?: { full_name: string };
}

interface QuotationHistoryProps {
  onEditQuotation?: (quotation: EditingQuotation) => void;
}

export function QuotationHistory({ onEditQuotation }: QuotationHistoryProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [quotationToReject, setQuotationToReject] = useState<Quotation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryQuotationId, setVersionHistoryQuotationId] = useState<string>("");
  const [versionCompareOpen, setVersionCompareOpen] = useState(false);
  const [versionCompareQuotation, setVersionCompareQuotation] = useState<Quotation | null>(null);
  const [previousRejections, setPreviousRejections] = useState<Map<string, { reason: string; version: number }>>(new Map());
  const { user, isApprover, isAdmin } = useAuth();
  const { services } = useServices();

  // Mapa de serviços para lookup rápido por ID
  const servicesMap = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((s) => map.set(s.id, s.description));
    return map;
  }, [services]);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("quotations")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "aguardando_aprovacao" | "aprovado" | "rejeitado");
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles separately
      const quotationsWithProfiles = await Promise.all(
        (data || []).map(async (q) => {
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", q.created_by)
            .maybeSingle();

          let approverProfile = null;
          if (q.approved_by) {
            const { data: approver } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", q.approved_by)
              .maybeSingle();
            approverProfile = approver;
          }

          return {
            ...q,
            items: q.items as unknown as QuotationItem[],
            custos_adicionais: q.custos_adicionais as unknown as CustosAdicionais,
            creator_profile: creatorProfile,
            approver_profile: approverProfile,
          } as Quotation;
        })
      );

      setQuotations(quotationsWithProfiles);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar rejeições anteriores das versões
  const fetchPreviousRejections = async (quotationIds: string[]) => {
    if (quotationIds.length === 0) return;
    
    const { data, error } = await supabase
      .from("quotation_versions")
      .select("quotation_id, rejection_reason, version_number, status")
      .in("quotation_id", quotationIds)
      .eq("status", "rejeitado")
      .order("version_number", { ascending: false });

    if (!error && data) {
      const rejMap = new Map<string, { reason: string; version: number }>();
      data.forEach((v: any) => {
        // Guardar só a rejeição mais recente por quotation
        if (!rejMap.has(v.quotation_id) && v.rejection_reason) {
          rejMap.set(v.quotation_id, { reason: v.rejection_reason, version: v.version_number });
        }
      });
      setPreviousRejections(rejMap);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  useEffect(() => {
    // Após carregar quotations, buscar rejeições anteriores para as que estão aguardando e versão > 1
    const ids = quotations
      .filter(q => q.status === "aguardando_aprovacao" && q.version_number > 1)
      .map(q => q.id);
    fetchPreviousRejections(ids);
  }, [quotations]);

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("quotations")
        .update({
          status: "aprovado",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Memória de cálculo aprovada!");
      fetchQuotations();
      setIsDetailOpen(false);
    } catch (error) {
      toast.error("Erro ao aprovar");
    }
  };

  const handleRejectClick = (quotation: Quotation) => {
    setQuotationToReject(quotation);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!quotationToReject) return;

    try {
      const { error } = await supabase
        .from("quotations")
        .update({
          status: "rejeitado",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", quotationToReject.id);

      if (error) throw error;
      toast.success("Memória de cálculo rejeitada");
      setRejectDialogOpen(false);
      setQuotationToReject(null);
      fetchQuotations();
      setIsDetailOpen(false);
    } catch (error) {
      toast.error("Erro ao rejeitar");
    }
  };

  const handleDeleteClick = (quotation: Quotation) => {
    setQuotationToDelete(quotation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;

    try {
      const { error } = await supabase
        .from("quotations")
        .delete()
        .eq("id", quotationToDelete.id);

      if (error) throw error;
      toast.success("Memória de cálculo excluída");
      setDeleteDialogOpen(false);
      setQuotationToDelete(null);
      fetchQuotations();
      setIsDetailOpen(false);
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const handleViewVersionHistory = (quotationId: string) => {
    setVersionHistoryQuotationId(quotationId);
    setVersionHistoryOpen(true);
  };

  const handleOpenVersionCompare = (quotation: Quotation) => {
    setVersionCompareQuotation(quotation);
    setVersionCompareOpen(true);
  };

  const canEdit = (quotation: Quotation) => {
    // Vendedor pode editar se for o criador e status for aguardando ou rejeitado
    // Admin pode editar qualquer um que esteja aguardando
    // Admin também pode editar aprovados (cria nova versão)
    if (isAdmin) {
      return quotation.status === "aguardando_aprovacao" || quotation.status === "aprovado";
    }
    return (
      (quotation.status === "aguardando_aprovacao" || quotation.status === "rejeitado") &&
      quotation.created_by === user?.id
    );
  };

  // Verifica se é edição de MDC rejeitado (vai voltar para aguardando aprovação)
  const isEditingRejected = (quotation: Quotation) => {
    return quotation.status === "rejeitado" && quotation.created_by === user?.id;
  };

  // Verifica se é edição de admin em MDC aprovado (vai criar nova versão)
  const isAdminEditingApproved = (quotation: Quotation) => {
    return isAdmin && quotation.status === "aprovado";
  };

  const handleEditClick = (quotation: Quotation) => {
    if (!onEditQuotation) return;
    
    // Converter items para o formato correto com todos os campos necessários
    const items: QuotationItemType[] = quotation.items.map(item => ({
      serviceId: item.serviceId,
      quantity: item.quantity,
      unitValue: item.unitValue,
      customUnitValue: item.customUnitValue,
      totalValue: item.totalValue,
      costValue: item.costValue,
      totalCost: item.totalCost,
      markup: item.totalCost > 0 ? ((item.totalValue - item.totalCost) / item.totalCost) * 100 : 0,
      result: item.totalValue - item.totalCost,
      resultPercent: item.totalValue > 0 ? ((item.totalValue - item.totalCost) / item.totalValue) * 100 : 0,
    }));

    // Converter custos adicionais para o formato correto
    const custosAdicionais: CustosAdicionaisData = {
      kmTotal: quotation.custos_adicionais.kmTotal || 0,
      kmCusto: quotation.custos_adicionais.kmCusto || 1.5,
      alimentacao: quotation.custos_adicionais.alimentacao || 0,
      hospedagem: quotation.custos_adicionais.hospedagem || 0,
      transporteEquipamentos: quotation.custos_adicionais.transporteEquipamentos || 0,
      aplicativo: quotation.custos_adicionais.aplicativo || 0,
      outrosCustos: quotation.custos_adicionais.outrosCustos || [],
      markupPercent: quotation.custos_adicionais.markupPercent || 80,
    };

    onEditQuotation({
      id: quotation.id,
      clientName: quotation.client_name,
      notes: quotation.notes || "",
      discountPercent: quotation.discount_percent,
      discountValue: quotation.discount_value || 0,
      items,
      custosAdicionais,
      isApprovedEdit: isAdminEditingApproved(quotation),
      isRejectedEdit: isEditingRejected(quotation),
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getServiceName = (serviceId: string) => {
    return servicesMap.get(serviceId) || serviceId;
  };

  // Formatar número da memória de cálculo (ORC -> MDC)
  const formatQuotationNumber = (quotationNumber: string | null) => {
    if (!quotationNumber) return null;
    return quotationNumber.replace(/^ORC-/, 'MDC-');
  };

  const handleExportPDF = async (quotation: Quotation) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 15;

      // Colors
      const primaryColor = { r: 34, g: 139, b: 34 }; // Green
      const grayBg = { r: 248, g: 250, b: 252 };
      const grayBorder = { r: 226, g: 232, b: 240 };
      const grayText = { r: 100, g: 116, b: 139 };

      // Header - Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Detalhes da Memória de Cálculo", margin, y);
      
      // MDC Number badge on the right
      const displayNumber = formatQuotationNumber(quotation.quotation_number);
      if (displayNumber) {
        const badgeText = `${displayNumber} - v${quotation.version_number}`;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const badgeWidth = doc.getTextWidth(badgeText) + 10;
        const badgeX = pageWidth - margin - badgeWidth;
        doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(badgeX, y - 5, badgeWidth, 8, 2, 2, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.text(badgeText, badgeX + 5, y);
      }
      
      y += 12;

      // Client Info Box
      doc.setFillColor(grayBg.r, grayBg.g, grayBg.b);
      doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
      doc.roundedRect(margin, y, contentWidth, quotation.approved_by ? 32 : 18, 2, 2, 'FD');
      
      const col1 = margin + 5;
      const col2 = margin + 45;
      const col3 = margin + 95;
      const col4 = margin + 145;
      
      y += 6;
      doc.setFontSize(7);
      doc.setTextColor(grayText.r, grayText.g, grayText.b);
      doc.text("Cliente", col1, y);
      doc.text("Status", col2, y);
      doc.text("Criado por", col3, y);
      doc.text("Data", col4, y);
      
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(quotation.client_name.length > 15 ? quotation.client_name.substring(0, 12) + "..." : quotation.client_name, col1, y);
      
      // Status badge
      const statusText = quotation.status === "aprovado" ? "Aprovado" : quotation.status === "rejeitado" ? "Rejeitado" : "Aguardando";
      const statusColor = quotation.status === "aprovado" ? primaryColor : quotation.status === "rejeitado" ? { r: 220, g: 53, b: 69 } : { r: 234, g: 179, b: 8 };
      doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
      doc.roundedRect(col2, y - 4, doc.getTextWidth(statusText) + 6, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusText, col2 + 3, y - 0.5);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(quotation.creator_profile?.full_name || "-", col3, y);
      doc.text(format(new Date(quotation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }), col4, y);
      
      if (quotation.approved_by) {
        y += 8;
        doc.setFontSize(7);
        doc.setTextColor(grayText.r, grayText.g, grayText.b);
        doc.text(quotation.status === "rejeitado" ? "Rejeitado por" : "Aprovado por", col1, y);
        doc.text("Data Aprovação", col2 + 20, y);
        
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(quotation.approver_profile?.full_name || "-", col1, y);
        if (quotation.approved_at) {
          doc.text(format(new Date(quotation.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR }), col2 + 20, y);
        }
      }
      
      y += 12;

      // Services Table
      if (quotation.items && quotation.items.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Serviços", margin, y);
        y += 6;

        // Table header
        const colWidths = [55, 15, 28, 28, 28, 28];
        const headers = ["Descrição", "Qtd", "Custo Unit.", "Custo Total", "Venda Unit.", "Venda Total"];
        
        doc.setFillColor(grayBg.r, grayBg.g, grayBg.b);
        doc.rect(margin, y - 4, contentWidth, 8, 'F');
        doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
        doc.line(margin, y + 4, margin + contentWidth, y + 4);
        
        doc.setFontSize(7);
        doc.setTextColor(grayText.r, grayText.g, grayText.b);
        let xPos = margin + 2;
        headers.forEach((header, i) => {
          doc.text(header, xPos, y);
          xPos += colWidths[i];
        });
        y += 6;

        // Table rows
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        
        quotation.items.forEach((item, idx) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          
          // Alternating row background
          if (idx % 2 === 1) {
            doc.setFillColor(252, 252, 252);
            doc.rect(margin, y - 3, contentWidth, 5, 'F');
          }
          
          const serviceName = getServiceName(item.serviceId);
          const truncatedName = serviceName.length > 28 ? serviceName.substring(0, 25) + "..." : serviceName;
          
          xPos = margin + 2;
          doc.setFont("helvetica", "bold");
          doc.text(truncatedName, xPos, y);
          xPos += colWidths[0];
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(grayText.r, grayText.g, grayText.b);
          doc.text(String(item.quantity), xPos + 5, y);
          xPos += colWidths[1];
          doc.text(formatCurrency(item.costValue), xPos, y);
          xPos += colWidths[2];
          doc.text(formatCurrency(item.totalCost), xPos, y);
          xPos += colWidths[3];
          doc.setTextColor(0, 0, 0);
          doc.text(formatCurrency(item.customUnitValue || item.unitValue), xPos, y);
          xPos += colWidths[4];
          doc.setFont("helvetica", "bold");
          doc.text(formatCurrency(item.totalValue), xPos, y);
          
          doc.setTextColor(0, 0, 0);
          y += 5;
        });
        
        y += 8;
      }

      // Custos Adicionais
      const custos = quotation.custos_adicionais;
      const hasCustos = custos && (custos.kmTotal > 0 || custos.hospedagem > 0 || custos.aplicativo > 0 || custos.alimentacao > 0 || custos.transporteEquipamentos > 0 || (custos.outrosCustos && custos.outrosCustos.length > 0));
      
      if (hasCustos) {
        if (y > 220) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Custos Adicionais (Deslocamento)", margin, y);
        y += 6;

        // Header
        doc.setFillColor(grayBg.r, grayBg.g, grayBg.b);
        doc.rect(margin, y - 4, contentWidth, 8, 'F');
        doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
        doc.line(margin, y + 4, margin + contentWidth, y + 4);
        
        doc.setFontSize(7);
        doc.setTextColor(grayText.r, grayText.g, grayText.b);
        doc.text("Descrição", margin + 2, y);
        doc.text("Valor", margin + contentWidth - 25, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);

        const markup = custos.markupPercent || 80;
        let totalCustoAdicional = 0;

        const addCustoLine = (desc: string, valor: number) => {
          totalCustoAdicional += valor;
          doc.text(desc, margin + 2, y);
          doc.text(formatCurrency(valor), margin + contentWidth - 25, y);
          y += 5;
        };

        if (custos.kmTotal > 0) {
          const kmCusto = custos.kmTotal * custos.kmCusto;
          addCustoLine(`Deslocamento (${custos.kmTotal} km × ${formatCurrency(custos.kmCusto)})`, kmCusto);
        }
        if (custos.hospedagem > 0) addCustoLine("Hospedagem", custos.hospedagem);
        if (custos.alimentacao > 0) addCustoLine("Alimentação", custos.alimentacao);
        if (custos.aplicativo > 0) addCustoLine("Uber/99", custos.aplicativo);
        if (custos.transporteEquipamentos > 0) addCustoLine("Transporte Equipamentos", custos.transporteEquipamentos);
        custos.outrosCustos?.forEach((c) => addCustoLine(c.descricao, c.valor));

        // Subtotals
        doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
        doc.line(margin, y, margin + contentWidth, y);
        y += 5;
        
        doc.setFont("helvetica", "bold");
        doc.text("Subtotal Custos", margin + 2, y);
        doc.text(formatCurrency(totalCustoAdicional), margin + contentWidth - 25, y);
        y += 5;
        
        const markupValue = totalCustoAdicional * (markup / 100);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(grayText.r, grayText.g, grayText.b);
        doc.text(`Markup (${markup}%)`, margin + 2, y);
        doc.text(`+${formatCurrency(markupValue)}`, margin + contentWidth - 25, y);
        y += 5;
        
        const totalVendaDeslocamento = totalCustoAdicional + markupValue;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text("Total Venda Deslocamento", margin + 2, y);
        doc.text(formatCurrency(totalVendaDeslocamento), margin + contentWidth - 25, y);
        y += 10;
      }

      // Resumo Financeiro
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(grayBg.r, grayBg.g, grayBg.b);
      doc.setDrawColor(grayBorder.r, grayBorder.g, grayBorder.b);
      doc.roundedRect(margin, y, contentWidth, 45, 2, 2, 'FD');
      
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Resumo Financeiro", margin + 5, y);
      y += 8;

      // First row
      doc.setFontSize(7);
      doc.setTextColor(grayText.r, grayText.g, grayText.b);
      doc.text("Custo Total", margin + 5, y);
      doc.text("Valor de Venda", margin + 65, y);
      y += 5;
      
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(quotation.total_cost), margin + 5, y);
      doc.text(formatCurrency(quotation.total_value), margin + 65, y);
      y += 10;

      // Second row
      const discountValue = quotation.total_value * (quotation.discount_percent / 100);
      const finalValue = quotation.total_value - discountValue;
      const resultado = finalValue - quotation.total_cost;
      
      doc.setFontSize(7);
      doc.setTextColor(grayText.r, grayText.g, grayText.b);
      doc.text("Valor Final", margin + 5, y);
      doc.text("Margem", margin + 130, y);
      y += 5;
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text(formatCurrency(finalValue), margin + 5, y);
      doc.text(`${quotation.margin_percent.toFixed(1)}%`, margin + 130, y);
      y += 6;
      
      doc.setFontSize(8);
      doc.setTextColor(grayText.r, grayText.g, grayText.b);
      doc.text(`Resultado: ${formatCurrency(resultado)}`, margin + 5, y);
      
      y += 15;

      // Notes
      if (quotation.notes) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Observações", margin, y);
        y += 5;
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(grayText.r, grayText.g, grayText.b);
        const splitNotes = doc.splitTextToSize(quotation.notes, contentWidth);
        doc.text(splitNotes, margin, y);
      }

      // Save - usar MDC ao invés de ORC no nome do arquivo
      const fileNumber = quotation.quotation_number 
        ? quotation.quotation_number.replace(/^ORC-/, 'MDC-')
        : null;
      const fileName = fileNumber 
        ? `${fileNumber}_v${quotation.version_number}`
        : `memoria_calculo_${quotation.client_name.replace(/\s+/g, "_")}`;
      doc.save(`${fileName}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleExportXLSX = async () => {
    try {
      const headers = [
        "Número",
        "Versão",
        "Cliente",
        "Valor Total",
        "Custo Total",
        "Margem %",
        "Desconto %",
        "Status",
        "Criado por",
        "Data Criação",
        "Aprovado por",
        "Data Aprovação",
        "Motivo Recusa",
      ];

      const rows = quotations.map((q) => [
        q.quotation_number || "-",
        q.version_number,
        q.client_name,
        q.total_value.toFixed(2),
        q.total_cost.toFixed(2),
        q.margin_percent.toFixed(2),
        q.discount_percent?.toFixed(2) || "0",
        q.status,
        q.creator_profile?.full_name || "-",
        format(new Date(q.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        q.approver_profile?.full_name || "-",
        q.approved_at
          ? format(new Date(q.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
        q.rejection_reason || "-",
      ]);

      const csvContent =
        [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `historico_memorias_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Arquivo exportado!");
    } catch (error) {
      toast.error("Erro ao exportar");
    }
  };


  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      aguardando_aprovacao: { variant: "secondary", label: "Aguardando" },
      aprovado: { variant: "default", label: "Aprovado" },
      rejeitado: { variant: "destructive", label: "Rejeitado" },
    };
    const config = variants[status] || variants.aguardando_aprovacao;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Histórico de Memórias de Cálculo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aguardando_aprovacao">Aguardando</SelectItem>
                  <SelectItem value="aprovado">Aprovados</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportXLSX}
                disabled={quotations.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma memória de cálculo encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q) => (
                    <TableRow 
                      key={q.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedQuotation(q);
                        setIsDetailOpen(true);
                      }}
                    >
                      <TableCell className="font-mono text-xs">
                        {formatQuotationNumber(q.quotation_number) || "-"}
                        <span className="text-muted-foreground ml-1">v{q.version_number}</span>
                      </TableCell>
                      <TableCell className="font-medium">{q.client_name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(q.total_value)}
                        {q.discount_percent > 0 && (
                          <span className="text-xs text-warning ml-1">
                            -{q.discount_percent}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            q.margin_percent >= 20
                              ? "text-success"
                              : q.margin_percent >= 10
                              ? "text-warning"
                              : "text-destructive"
                          }
                        >
                          {q.margin_percent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusBadge(q.status)}
                          {q.status === "aguardando_aprovacao" && previousRejections.has(q.id) && (
                            <Badge variant="outline" className="text-xs border-warning text-warning">
                              <RotateCcw className="h-3 w-3 mr-0.5" />
                              Reenviado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {q.creator_profile?.full_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(q.created_at), "dd/MM/yy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEdit(q) && onEditQuotation && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditClick(q)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {q.version_number > 1 && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenVersionCompare(q)}
                                title="Comparar Versões"
                              >
                                <GitCompare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleViewVersionHistory(q.id)}
                                title="Histórico de Versões"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {q.status === "aguardando_aprovacao" && isApprover && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:text-success"
                                onClick={() => handleApprove(q.id)}
                                title="Aprovar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleRejectClick(q)}
                                title="Rejeitar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {q.status === "aprovado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleExportPDF(q)}
                              title="Exportar PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(q)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Memória de Cálculo
              {selectedQuotation?.quotation_number && (
                <Badge variant="outline" className="ml-2">
                  {formatQuotationNumber(selectedQuotation.quotation_number)} - v{selectedQuotation.version_number}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedQuotation && (
            <ScrollArea className="max-h-[70vh] pr-4">
              {/* Informações do Cliente */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedQuotation.client_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedQuotation.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Criado por</p>
                    <p className="font-medium">{selectedQuotation.creator_profile?.full_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(new Date(selectedQuotation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {selectedQuotation.approved_by && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {selectedQuotation.status === "rejeitado" ? "Rejeitado por" : "Aprovado por"}
                        </p>
                        <p className="font-medium">{selectedQuotation.approver_profile?.full_name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Data {selectedQuotation.status === "rejeitado" ? "Rejeição" : "Aprovação"}
                        </p>
                        <p className="font-medium">
                          {selectedQuotation.approved_at 
                            ? format(new Date(selectedQuotation.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"
                          }
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Motivo da Recusa (atual) */}
                {selectedQuotation.status === "rejeitado" && selectedQuotation.rejection_reason && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive mb-1">Motivo da Recusa:</p>
                    <p className="text-sm">{selectedQuotation.rejection_reason}</p>
                  </div>
                )}

                {/* Rejeição anterior (quando reenviado) */}
                {selectedQuotation.status === "aguardando_aprovacao" && previousRejections.has(selectedQuotation.id) && (
                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCcw className="h-4 w-4 text-warning" />
                      <p className="text-sm font-medium text-warning">
                        Reenviado após recusa (versão {previousRejections.get(selectedQuotation.id)!.version})
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Motivo anterior: {previousRejections.get(selectedQuotation.id)!.reason}
                    </p>
                  </div>
                )}

                <Separator />

                {/* Serviços */}
                {selectedQuotation.items && selectedQuotation.items.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Serviços</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Custo Unit.</TableHead>
                            <TableHead className="text-right">Custo Total</TableHead>
                            <TableHead className="text-right">Venda Unit.</TableHead>
                            <TableHead className="text-right">Venda Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedQuotation.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium text-sm">
                                {getServiceName(item.serviceId)}
                              </TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(item.costValue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(item.totalCost)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.customUnitValue || item.unitValue)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(item.totalValue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Custos Adicionais */}
                {selectedQuotation.custos_adicionais && (
                  (() => {
                    const custos = selectedQuotation.custos_adicionais;
                    const hasCustos = custos.kmTotal > 0 || custos.hospedagem > 0 || custos.aplicativo > 0 || 
                                      custos.alimentacao > 0 || custos.transporteEquipamentos > 0 ||
                                      (custos.outrosCustos && custos.outrosCustos.length > 0);
                    
                    if (!hasCustos) return null;

                    const totalCustosAdicionais = (custos.kmTotal * custos.kmCusto) + 
                                                   custos.hospedagem + custos.aplicativo + 
                                                   custos.alimentacao + custos.transporteEquipamentos +
                                                   (custos.outrosCustos?.reduce((acc, c) => acc + c.valor, 0) || 0);
                    const markupMultiplier = 1 + (custos.markupPercent / 100);
                    const vendaCustosAdicionais = totalCustosAdicionais * markupMultiplier;

                    return (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3">Custos Adicionais (Deslocamento)</h4>
                          <div className="space-y-2 text-sm">
                            {custos.kmTotal > 0 && (
                              <div className="flex justify-between">
                                <span>Deslocamento ({custos.kmTotal} km × {formatCurrency(custos.kmCusto)})</span>
                                <span>{formatCurrency(custos.kmTotal * custos.kmCusto)}</span>
                              </div>
                            )}
                            {custos.hospedagem > 0 && (
                              <div className="flex justify-between">
                                <span>Hospedagem</span>
                                <span>{formatCurrency(custos.hospedagem)}</span>
                              </div>
                            )}
                            {custos.aplicativo > 0 && (
                              <div className="flex justify-between">
                                <span>Uber/99</span>
                                <span>{formatCurrency(custos.aplicativo)}</span>
                              </div>
                            )}
                            {custos.alimentacao > 0 && (
                              <div className="flex justify-between">
                                <span>Alimentação</span>
                                <span>{formatCurrency(custos.alimentacao)}</span>
                              </div>
                            )}
                            {custos.transporteEquipamentos > 0 && (
                              <div className="flex justify-between">
                                <span>Transporte de Equipamentos</span>
                                <span>{formatCurrency(custos.transporteEquipamentos)}</span>
                              </div>
                            )}
                            {custos.outrosCustos?.map((c) => (
                              <div key={c.id} className="flex justify-between">
                                <span>{c.descricao}</span>
                                <span>{formatCurrency(c.valor)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 border-t font-medium">
                              <span>Subtotal Custos</span>
                              <span>{formatCurrency(totalCustosAdicionais)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Markup ({custos.markupPercent}%)</span>
                              <span>+{formatCurrency(vendaCustosAdicionais - totalCustosAdicionais)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-primary">
                              <span>Total Venda Deslocamento</span>
                              <span>{formatCurrency(vendaCustosAdicionais)}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}

                <Separator />

                {/* Resumo Financeiro */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-semibold">Resumo Financeiro</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Custo Total</p>
                      <p className="text-lg font-medium">{formatCurrency(selectedQuotation.total_cost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor de Venda</p>
                      <p className="text-lg font-medium">{formatCurrency(selectedQuotation.total_value)}</p>
                    </div>
                  </div>

                  {(selectedQuotation.discount_percent > 0 || selectedQuotation.discount_value > 0) && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>
                        Desconto
                        {selectedQuotation.discount_percent > 0 && selectedQuotation.discount_value > 0 
                          ? ` (${selectedQuotation.discount_percent}% + R$)` 
                          : selectedQuotation.discount_percent > 0 
                            ? ` (${selectedQuotation.discount_percent}%)` 
                            : " (R$)"}
                      </span>
                      <span>
                        -{formatCurrency(
                          (selectedQuotation.total_value / (1 - selectedQuotation.discount_percent / 100)) * (selectedQuotation.discount_percent / 100) + 
                          (selectedQuotation.discount_value || 0)
                        )}
                      </span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-muted-foreground text-sm">Valor Final</p>
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(selectedQuotation.total_value * (1 - selectedQuotation.discount_percent / 100))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-sm">Margem</p>
                      <p className={`text-xl font-bold ${
                        selectedQuotation.margin_percent >= 20 
                          ? "text-success" 
                          : selectedQuotation.margin_percent >= 10 
                          ? "text-warning" 
                          : "text-destructive"
                      }`}>
                        {selectedQuotation.margin_percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <span>Resultado: </span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedQuotation.total_value * (1 - selectedQuotation.discount_percent / 100) - selectedQuotation.total_cost)}
                    </span>
                  </div>
                </div>

                {/* Observações */}
                {selectedQuotation.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">Observações</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedQuotation.notes}
                      </p>
                    </div>
                  </>
                )}

                {/* Ações no Dialog */}
                <Separator />
                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  {selectedQuotation.version_number > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewVersionHistory(selectedQuotation.id)}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Ver Histórico
                    </Button>
                  )}
                  {canEdit(selectedQuotation) && onEditQuotation && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleEditClick(selectedQuotation);
                        setIsDetailOpen(false);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  )}
                  {selectedQuotation.status === "aguardando_aprovacao" && isApprover && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-success border-success/30 hover:bg-success/10"
                        onClick={() => handleApprove(selectedQuotation.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleRejectClick(selectedQuotation)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  {selectedQuotation.status === "aprovado" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportPDF(selectedQuotation)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Exportar PDF
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(selectedQuotation)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeição */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleRejectConfirm}
        quotationName={quotationToReject?.client_name}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a memória de cálculo do cliente{" "}
              <span className="font-medium text-foreground">{quotationToDelete?.client_name}</span>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Histórico de Versões */}
      <VersionHistory
        quotationId={versionHistoryQuotationId}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />

      {/* Dialog de Comparação de Versões */}
      {versionCompareQuotation && (
        <VersionComparison
          quotationId={versionCompareQuotation.id}
          currentVersion={{
            version_number: versionCompareQuotation.version_number,
            client_name: versionCompareQuotation.client_name,
            total_value: versionCompareQuotation.total_value,
            total_cost: versionCompareQuotation.total_cost,
            margin_percent: versionCompareQuotation.margin_percent,
            discount_percent: versionCompareQuotation.discount_percent,
            notes: versionCompareQuotation.notes,
            items: versionCompareQuotation.items as unknown as QuotationItemType[],
            custos_adicionais: {
              kmTotal: versionCompareQuotation.custos_adicionais.kmTotal || 0,
              kmCusto: versionCompareQuotation.custos_adicionais.kmCusto || 2.80,
              alimentacao: versionCompareQuotation.custos_adicionais.alimentacao || 0,
              hospedagem: versionCompareQuotation.custos_adicionais.hospedagem || 0,
              transporteEquipamentos: versionCompareQuotation.custos_adicionais.transporteEquipamentos || 0,
              aplicativo: versionCompareQuotation.custos_adicionais.aplicativo || 0,
              outrosCustos: versionCompareQuotation.custos_adicionais.outrosCustos || [],
              markupPercent: versionCompareQuotation.custos_adicionais.markupPercent || 30,
            },
            created_at: versionCompareQuotation.created_at,
          }}
          open={versionCompareOpen}
          onOpenChange={setVersionCompareOpen}
        />
      )}
    </>
  );
}
