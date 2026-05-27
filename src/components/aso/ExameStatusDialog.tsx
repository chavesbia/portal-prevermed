import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ExameStatusPayload {
  status: "aguardando" | "pendente" | "liberado" | "nova_coleta";
  motivo_pendencia?: string | null;
  motivo_nova_coleta?: string | null;
  nova_coleta_data_prevista_retorno?: string | null;
}

interface Props {
  open: boolean;
  mode: "pendente" | "nova_coleta" | null;
  exameNome?: string;
  initial?: {
    motivo_pendencia?: string | null;
    motivo_nova_coleta?: string | null;
    nova_coleta_data_prevista_retorno?: string | null;
  };
  onClose: () => void;
  onConfirm: (payload: ExameStatusPayload) => void;
}

export default function ExameStatusDialog({
  open,
  mode,
  exameNome,
  initial,
  onClose,
  onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "pendente") {
      setMotivo(initial?.motivo_pendencia || "");
    } else if (mode === "nova_coleta") {
      setMotivo(initial?.motivo_nova_coleta || "");
      setDataPrevista(initial?.nova_coleta_data_prevista_retorno || "");
    }
  }, [open, mode, initial]);

  if (!mode) return null;
  const isPendente = mode === "pendente";

  const handleConfirm = () => {
    if (!motivo.trim()) return;
    if (isPendente) {
      onConfirm({
        status: "pendente",
        motivo_pendencia: motivo.trim(),
        motivo_nova_coleta: null,
        nova_coleta_data_prevista_retorno: null,
      });
    } else {
      onConfirm({
        status: "nova_coleta",
        motivo_nova_coleta: motivo.trim(),
        nova_coleta_data_prevista_retorno: dataPrevista || null,
        motivo_pendencia: null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPendente ? "Marcar exame como Pendente" : "Marcar como Nova Coleta"}
          </DialogTitle>
          <DialogDescription>
            {exameNome && <span className="font-medium">{exameNome}</span>}
            {isPendente
              ? " — Descreva o motivo pelo qual este exame está pendente. O exame ficará bloqueado para envio à Assinatura até ser liberado."
              : " — O laboratório solicitou uma nova coleta. Descreva o motivo e, se possível, a data prevista para o retorno do colaborador."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                isPendente
                  ? "Ex.: aguardando contato do laboratório, exame não realizado por falta de jejum..."
                  : "Ex.: amostra insuficiente, contaminação, valor alterado..."
              }
              autoFocus
            />
          </div>

          {!isPendente && (
            <div>
              <Label className="text-xs">Data prevista de retorno</Label>
              <Input
                type="date"
                value={dataPrevista}
                onChange={(e) => setDataPrevista(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Opcional — usada no relatório de Novas Coletas para acompanhar a previsão de retorno.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!motivo.trim()}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
