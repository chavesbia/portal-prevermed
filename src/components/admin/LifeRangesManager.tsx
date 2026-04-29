import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useLifeRanges, LifeRange } from "@/hooks/useLifeRanges";
import { useAuth } from "@/contexts/AuthContext";

interface Draft {
  id?: string;
  label: string;
  min_lives: string;
  max_lives: string;
}

const empty = (): Draft => ({ label: "", min_lives: "", max_lives: "" });

export function LifeRangesManager() {
  const { isAdmMaster } = useAuth();
  const { ranges, isLoading, upsert, remove } = useLifeRanges();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

  const startCreate = () => {
    setDraft(empty());
    setOpen(true);
  };
  const startEdit = (r: LifeRange) => {
    setDraft({
      id: r.id,
      label: r.label,
      min_lives: String(r.min_lives),
      max_lives: r.max_lives == null ? "" : String(r.max_lives),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.label.trim() || !draft.min_lives) return;
    await upsert.mutateAsync({
      id: draft.id,
      label: draft.label.trim(),
      min_lives: Number(draft.min_lives),
      max_lives: draft.max_lives === "" ? null : Number(draft.max_lives),
      is_active: true,
    });
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Faixas de Vida
            </CardTitle>
            <CardDescription>
              Faixas usadas na composição de preços por plano. Sem sobreposição entre faixas ativas.
            </CardDescription>
          </div>
          {isAdmMaster && (
            <Button onClick={startCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Faixa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">Mín. Vidas</TableHead>
              <TableHead className="text-right">Máx. Vidas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma faixa cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              ranges.map((r) => (
                <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right">{r.min_lives}</TableCell>
                  <TableCell className="text-right">
                    {r.max_lives == null ? "∞" : r.max_lives}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.is_active ? "Ativa" : "Inativa"}
                  </TableCell>
                  <TableCell>
                    {isAdmMaster && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {r.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => remove.mutate(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar faixa" : "Nova faixa"}</DialogTitle>
            <DialogDescription>
              Use "Máx" vazio para representar uma faixa aberta (∞).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="space-y-2 col-span-3">
              <Label>Label *</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Ex.: 1–5"
              />
            </div>
            <div className="space-y-2">
              <Label>Mín. Vidas *</Label>
              <Input
                type="number"
                min={1}
                value={draft.min_lives}
                onChange={(e) => setDraft({ ...draft, min_lives: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Máx. Vidas (vazio = ∞)</Label>
              <Input
                type="number"
                min={1}
                value={draft.max_lives}
                onChange={(e) => setDraft({ ...draft, max_lives: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
