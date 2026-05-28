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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  exameId: string | null;
  exameNome?: string;
  funcionario?: string | null;
  empresa?: string | null;
  motivo?: string | null;
  initial?: {
    nova_coleta_canal_contato?: string | null;
    nova_coleta_contato_rh?: string | null;
    nova_coleta_data_convocacao?: string | null;
    nova_coleta_data_prevista_retorno?: string | null;
    nova_coleta_observacoes_convocacao?: string | null;
    nova_coleta_data_retorno_efetivo?: string | null;
    colaborador_chamado?: boolean;
  };
  onClose: () => void;
}

const CANAIS = [
  { v: "email", label: "E-mail" },
  { v: "whatsapp", label: "WhatsApp" },
  { v: "telefone", label: "Telefone" },
  { v: "presencial", label: "Presencial" },
];

export default function ConvocacaoColetaDialog({
  open,
  exameId,
  exameNome,
  funcionario,
  empresa,
  motivo,
  initial,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [canal, setCanal] = useState<string>("");
  const [contatoRh, setContatoRh] = useState("");
  const [dataConvocacao, setDataConvocacao] = useState(today);
  const [previsaoRetorno, setPrevisaoRetorno] = useState("");
  const [obs, setObs] = useState("");
  const [retornoEfetivo, setRetornoEfetivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCanal(initial?.nova_coleta_canal_contato || "");
    setContatoRh(initial?.nova_coleta_contato_rh || "");
    setDataConvocacao(initial?.nova_coleta_data_convocacao || today);
    setPrevisaoRetorno(initial?.nova_coleta_data_prevista_retorno || "");
    setObs(initial?.nova_coleta_observacoes_convocacao || "");
    setRetornoEfetivo(initial?.nova_coleta_data_retorno_efetivo || "");
  }, [open, initial]);

  if (!exameId) return null;

  const handleSave = async () => {
    if (!canal || !contatoRh.trim() || !dataConvocacao) {
      toast.error("Preencha canal, contato no RH e data da convocação.");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload: any = {
      colaborador_chamado: true,
      colaborador_chamado_em: new Date().toISOString(),
      colaborador_chamado_por: userRes.user?.id ?? null,
      nova_coleta_canal_contato: canal,
      nova_coleta_contato_rh: contatoRh.trim(),
      nova_coleta_data_convocacao: dataConvocacao,
      nova_coleta_data_prevista_retorno: previsaoRetorno || null,
      nova_coleta_observacoes_convocacao: obs.trim() || null,
      nova_coleta_data_retorno_efetivo: retornoEfetivo || null,
    };
    const { error } = await supabase
      .from("aso_exames_atendimento" as any)
      .update(payload)
      .eq("id", exameId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao registrar convocação: " + error.message);
      return;
    }
    toast.success("Convocação registrada.");
    qc.invalidateQueries({ queryKey: ["aso-novas-coletas"] });
    qc.invalidateQueries({ queryKey: ["aso-atendimentos"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convocar colaborador para nova coleta</DialogTitle>
          <DialogDescription>
            Registre quando e como o colaborador foi chamado para retornar e refazer a coleta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Exame:</span> <strong>{exameNome || "—"}</strong></div>
            <div><span className="text-muted-foreground">Colaborador:</span> {funcionario || "—"}</div>
            <div><span className="text-muted-foreground">Empresa:</span> {empresa || "—"}</div>
            {motivo && (
              <div className="text-xs">
                <Badge variant="outline" className="mr-1">Motivo</Badge>
                <span className="text-muted-foreground">{motivo}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Canal de contato <span className="text-red-500">*</span></Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data da convocação <span className="text-red-500">*</span></Label>
              <Input type="date" value={dataConvocacao} onChange={(e) => setDataConvocacao(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Contato no RH da empresa <span className="text-red-500">*</span></Label>
            <Input
              value={contatoRh}
              onChange={(e) => setContatoRh(e.target.value)}
              placeholder="Ex.: Maria (RH) — falei por WhatsApp"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Previsão de retorno</Label>
              <Input type="date" value={previsaoRetorno} onChange={(e) => setPrevisaoRetorno(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Retorno efetivo</Label>
              <Input type="date" value={retornoEfetivo} onChange={(e) => setRetornoEfetivo(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar convocação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
