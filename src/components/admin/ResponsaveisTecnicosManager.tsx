import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Search, UserCog, X } from "lucide-react";
import { useResponsaveisTecnicos } from "@/hooks/useOSData";
import { useConselhosClasse } from "@/hooks/useConselhosClasse";
import { ResponsavelTecnico } from "@/types/os";

interface Draft {
  id?: string;
  nome: string;
  conselho: string;
  numero_registro: string;
  especialidade: string;
  email: string;
  ativo: boolean;
}

const emptyDraft = (): Draft => ({
  nome: "", conselho: "CREA", numero_registro: "", especialidade: "", email: "", ativo: true,
});

export function ResponsaveisTecnicosManager() {
  const { responsaveis, isLoading, add, update } = useResponsaveisTecnicos();
  const { conselhos } = useConselhosClasse();

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return responsaveis.filter((r) => {
      if (!showInactive && !r.ativo) return false;
      if (!s) return true;
      return [r.nome, r.conselho, r.numero_registro, r.especialidade, r.email]
        .some((v) => (v || "").toLowerCase().includes(s));
    });
  }, [responsaveis, search, showInactive]);

  const startCreate = () => { setDraft(emptyDraft()); setOpen(true); };

  const startEdit = (r: ResponsavelTecnico) => {
    setDraft({
      id: r.id,
      nome: r.nome || "",
      conselho: r.conselho || "CREA",
      numero_registro: r.numero_registro || "",
      especialidade: r.especialidade || "",
      email: r.email || "",
      ativo: r.ativo,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!draft.nome.trim() || !draft.numero_registro.trim()) return;
    setSaving(true);
    const payload = {
      nome: draft.nome.trim(),
      conselho: draft.conselho,
      numero_registro: draft.numero_registro.trim(),
      especialidade: draft.especialidade.trim() || null,
      email: draft.email.trim() || null,
      ativo: draft.ativo,
    } as any;
    const ok = draft.id ? await update(draft.id, payload) : await add(payload);
    setSaving(false);
    if (ok) setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Responsáveis Técnicos
          </CardTitle>
          <Button onClick={startCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, conselho, registro..."
              className="pl-9 pr-9"
            />
            {search && (
              <Button
                variant="ghost" size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
            Mostrar inativos
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Conselho</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhum responsável técnico cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.conselho}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.numero_registro || "—"}</TableCell>
                    <TableCell className="text-xs">{r.especialidade || "—"}</TableCell>
                    <TableCell className="text-xs">{r.email || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.ativo ? "default" : "secondary"} className="text-xs">
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-8 text-xs"
                          onClick={() => update(r.id, { ativo: !r.ativo })}
                        >
                          {r.ativo ? "Inativar" : "Reativar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar responsável técnico" : "Novo responsável técnico"}</DialogTitle>
            <DialogDescription>
              Cadastro único usado nas Ordens de Serviço e nos laudos, evitando nomes duplicados nos dashboards.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={draft.nome}
                onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                placeholder="Ex.: Eliseu Silva"
              />
            </div>
            <div className="space-y-2">
              <Label>Conselho *</Label>
              <Select value={draft.conselho} onValueChange={(v) => setDraft({ ...draft, conselho: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {conselhos.map((c) => (
                    <SelectItem key={c.id} value={c.sigla}>{c.sigla}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número de registro *</Label>
              <Input
                value={draft.numero_registro}
                onChange={(e) => setDraft({ ...draft, numero_registro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input
                value={draft.especialidade}
                onChange={(e) => setDraft({ ...draft, especialidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Checkbox checked={draft.ativo} onCheckedChange={(v) => setDraft({ ...draft, ativo: v === true })} />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !draft.nome.trim() || !draft.numero_registro.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
