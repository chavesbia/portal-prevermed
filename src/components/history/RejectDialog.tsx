import { useState } from "react";
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

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  quotationName?: string;
}

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  quotationName,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("O motivo da recusa é obrigatório");
      return;
    }
    onConfirm(reason.trim());
    setReason("");
    setError("");
  };

  const handleCancel = () => {
    setReason("");
    setError("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rejeitar Memória de Cálculo</AlertDialogTitle>
          <AlertDialogDescription>
            {quotationName && (
              <span className="font-medium text-foreground">{quotationName}</span>
            )}
            <br />
            Por favor, informe o motivo da recusa. Esta informação será visível para o vendedor.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rejection-reason">Motivo da Recusa *</Label>
          <Textarea
            id="rejection-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder="Descreva o motivo da recusa..."
            className="min-h-[100px]"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Recusa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
