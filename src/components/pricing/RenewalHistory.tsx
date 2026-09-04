import { useState } from "react";
import { useRenewalQuotations, RenewalItem } from "@/hooks/useRenewalQuotations";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { History, Check, X, Trash2, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function RenewalHistory() {
  const { renewals, isLoading, fetchItems, approve, reject, remove } = useRenewalQuotations();
  const { user, profile, isAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detail, setDetail] = useState<any | null>(null);
  const [detailItems, setDetailItems] = useState<RenewalItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [toReject, setToReject] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const isApprover =
    isAdmin || ["director", "manager", "coordinator"].includes(profile?.hierarchy_position || "");

  const filtered = renewals.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  const openDetail = async (r: any) => {
    setDetail(r);
    setLoadingItems(true);
    try {
      const items = await fetchItems(r.id);
      setDetailItems(items);
    } finally {
      setLoadingItems(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      aguardando_aprovacao: { label: "Aguardando", variant: "secondary" },
      aprovado: { label: "Liberado", variant: "default" },
      rejeitado: { label: "Rejeitado", variant: "destructive" },
    };
    const cfg = map[status] || map.aguardando_aprovacao;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const devBadge = (status: string, percent: number) => {
    const variant =
      status === "abaixo" ? "destructive" : status === "acima" ? "default" : "secondary";
    return (
      <Badge variant={variant}>
        {status.toUpperCase()} {percent > 0 ? "+" : ""}
        {percent.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Renovações
          </CardTitle>
          <CardDescription>
            Memórias de cálculo de renovações contratuais
          </CardDescription>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando</SelectItem>
            <SelectItem value="aprovado">Liberados</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma renovação encontrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Vidas</TableHead>
                  <TableHead>Índice</TableHead>
                  <TableHead className="text-right">Reajustado/mês</TableHead>
                  <TableHead>vs Padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.renewal_number}</TableCell>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell className="text-center">{r.current_lives}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {r.index_type} {r.index_percent}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(r.adjusted_total_monthly)}
                    </TableCell>
                    <TableCell>
                      {devBadge(r.deviation_status, r.deviation_percent)}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isApprover && r.status === "aguardando_aprovacao" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => approve.mutate(r.id)}
                              className="text-success"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setToReject(r.id);
                                setRejectOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setToDelete(r.id)}
                            className="text-destructive"
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Renovação {detail?.renewal_number} — {detail?.client_name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Vidas atuais</div>
                  <div className="font-medium">{detail.current_lives}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Índice</div>
                  <div className="font-medium">
                    {detail.index_type} {detail.index_percent}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Período</div>
                  <div className="font-medium">{detail.reference_period || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{statusBadge(detail.status)}</div>
                </div>
              </div>

              {loadingItems ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead className="text-right">Atual</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Reajustado</TableHead>
                      <TableHead>Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.service_name}</TableCell>
                        <TableCell className="text-right">{fmt(it.current_value)}</TableCell>
                        <TableCell className="text-right">{it.applied_percent}%</TableCell>
                        <TableCell className="text-right">{fmt(it.adjusted_value)}</TableCell>
                        <TableCell className="text-xs">{it.observation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Atual mensal</div>
                  <div className="font-semibold">{fmt(detail.current_total_monthly)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reajustado mensal</div>
                  <div className="font-semibold text-primary">
                    {fmt(detail.adjusted_total_monthly)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">vs Padrão</div>
                  <div>{devBadge(detail.deviation_status, detail.deviation_percent)}</div>
                </div>
              </div>

              {detail.justification && (
                <div className="p-3 bg-muted/50 rounded text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Justificativa</div>
                  {detail.justification}
                </div>
              )}
              {detail.rejection_reason && (
                <div className="p-3 bg-destructive/10 rounded text-sm">
                  <div className="text-xs text-destructive mb-1">Motivo da rejeição</div>
                  {detail.rejection_reason}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar renovação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toReject && rejectReason.trim()) {
                  reject.mutate({ id: toReject, reason: rejectReason });
                  setRejectOpen(false);
                  setRejectReason("");
                  setToReject(null);
                }
              }}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir renovação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  remove.mutate(toDelete);
                  setToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
