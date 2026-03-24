import { useState } from "react";
import { usePrestadoresBloqueados } from "@/hooks/usePrestadoresBloqueados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ShieldBan, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export default function PrestadoresBloqueadosConfig() {
  const { prestadores, isLoading, adicionarPrestador, removerPrestador } = usePrestadoresBloqueados();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filtered = prestadores.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!novoNome.trim()) return;
    setSubmitting(true);
    try {
      await adicionarPrestador(novoNome, novoMotivo);
      toast({ title: "Prestador bloqueado", description: `"${novoNome}" adicionado à lista de bloqueio.` });
      setNovoNome("");
      setNovoMotivo("");
      setDialogOpen(false);
    } catch (err: any) {
      const msg = err?.message?.includes("unique") ? "Este prestador já está na lista." : err?.message || "Erro ao adicionar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string, nome: string) {
    setRemovingId(id);
    try {
      await removerPrestador(id);
      toast({ title: "Prestador desbloqueado", description: `"${nome}" removido da lista de bloqueio.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Erro ao remover.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldBan className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Prestadores Bloqueados</CardTitle>
              <Badge variant="secondary" className="text-xs">{prestadores.length}</Badge>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Prestadores nesta lista são excluídos da contagem, dashboard e listagem de guias.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar prestador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum prestador encontrado.</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    {p.motivo && (
                      <p className="text-xs text-muted-foreground truncate">{p.motivo}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(p.id, p.nome)}
                    disabled={removingId === p.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Prestador</DialogTitle>
            <DialogDescription>
              O prestador será excluído de todas as contagens e visualizações do módulo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do Prestador *</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Laboratório XYZ"
              />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                placeholder="Ex: Prestador interno da unidade Lapa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={submitting || !novoNome.trim()}>
              {submitting ? "Bloqueando..." : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
