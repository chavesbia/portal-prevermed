import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { History, Loader2 } from "lucide-react";

interface QuotationVersion {
  id: string;
  version_number: number;
  client_name: string;
  total_value: number;
  total_cost: number;
  margin_percent: number;
  discount_percent: number;
  notes: string | null;
  status: string | null;
  rejection_reason: string | null;
  created_at: string;
  created_by: string;
  creator_name?: string;
}

interface VersionHistoryProps {
  quotationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistory({ quotationId, open, onOpenChange }: VersionHistoryProps) {
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && quotationId) {
      fetchVersions();
    }
  }, [open, quotationId]);

  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("quotation_versions")
        .select("*")
        .eq("quotation_id", quotationId)
        .order("version_number", { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const versionsWithNames = await Promise.all(
        (data || []).map(async (v) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", v.created_by)
            .maybeSingle();

          return {
            ...v,
            creator_name: profile?.full_name || "-",
          };
        })
      );

      setVersions(versionsWithNames);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Versões
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma versão anterior encontrada
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div key={version.id}>
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        Versão {version.version_number}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(version.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="font-medium">{version.client_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-medium">{formatCurrency(version.total_value)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Custo</p>
                        <p className="font-medium">{formatCurrency(version.total_cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margem</p>
                        <p className={`font-medium ${
                          version.margin_percent >= 20
                            ? "text-success"
                            : version.margin_percent >= 10
                            ? "text-warning"
                            : "text-destructive"
                        }`}>
                          {version.margin_percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {version.discount_percent > 0 && (
                      <p className="text-xs text-warning">
                        Desconto aplicado: {version.discount_percent}%
                      </p>
                    )}

                    {version.status === "rejeitado" && version.rejection_reason && (
                      <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                        <p className="font-medium text-destructive">Rejeitado</p>
                        <p className="mt-0.5 text-muted-foreground">{version.rejection_reason}</p>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Alterado por: {version.creator_name}
                    </div>

                    {version.notes && (
                      <div className="text-xs">
                        <p className="text-muted-foreground">Observações:</p>
                        <p className="mt-1">{version.notes}</p>
                      </div>
                    )}
                  </div>

                  {index < versions.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
