
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTiposServicoOS, TipoServicoOS } from "@/hooks/useTiposServicoOS";
import { Plus, Pencil, Power, PowerOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function TiposServicoOSManager() {
  const { isAdmMaster } = useAuth();
  const { tipos, isLoading, upsert, toggleAtivo } = useTiposServicoOS();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<TipoServicoOS>>({ nome: "", ativo: true });

  const handleSave = async () => {
    if (!draft.nome?.trim()) return;
    await upsert.mutateAsync(draft);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Configuração de Tipos de Serviço</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os tipos de serviço disponíveis para seleção em Ordens de Serviço.
          </p>
        </div>
        {isAdmMaster && (
          <Button onClick={() => { setDraft({ nome: "", ativo: true }); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Tipo
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.map((tipo) => (
              <TableRow key={tipo.id} className={!tipo.ativo ? "opacity-50" : ""}>
                <TableCell className="font-medium uppercase">{tipo.nome}</TableCell>
                <TableCell>
                  <Badge variant={tipo.ativo ? "outline" : "secondary"} className={tipo.ativo ? "border-emerald-500 text-emerald-600" : ""}>
                    {tipo.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {isAdmMaster && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDraft(tipo); setOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={tipo.ativo ? "text-destructive" : "text-primary"}
                        onClick={() => toggleAtivo.mutate({ id: tipo.id, ativo: !tipo.ativo })}
                      >
                        {tipo.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}</DialogTitle>
            <DialogDescription>
              O nome será convertido para MAIÚSCULAS automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Tipo</Label>
              <Input
                value={draft.nome}
                onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                placeholder="Ex: PGR, LTCAT, etc."
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
