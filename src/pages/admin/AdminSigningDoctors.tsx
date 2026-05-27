import { useState } from "react";
import {
  useASOSigningDoctors,
  useASOSigningDoctorMutations,
  type ASOSigningDoctor,
} from "@/hooks/useASOSigningDoctors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";

function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export default function AdminSigningDoctors() {
  const { data: doctors = [], isLoading } = useASOSigningDoctors();
  const { create, update, remove } = useASOSigningDoctorMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ASOSigningDoctor | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    crm: "",
    crm_uf: "SP",
    is_active: true,
  });

  const reset = () => {
    setEditing(null);
    setForm({ full_name: "", crm: "", crm_uf: "SP", is_active: true });
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (d: ASOSigningDoctor) => {
    setEditing(d);
    setForm({
      full_name: d.full_name,
      crm: d.crm,
      crm_uf: d.crm_uf || "",
      is_active: d.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.crm.trim()) return;
    if (editing) {
      await update.mutateAsync({
        id: editing.id,
        full_name: form.full_name,
        crm: form.crm,
        crm_uf: form.crm_uf,
        is_active: form.is_active,
      });
    } else {
      await create.mutateAsync({
        full_name: form.full_name,
        crm: form.crm,
        crm_uf: form.crm_uf,
      });
    }
    setOpen(false);
    reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Médicos Assinantes de ASO
          </h1>
          <p className="text-muted-foreground text-sm">
            Cadastro central dos médicos responsáveis pela assinatura do ASO. Aparece como opção na aba Assinatura do prontuário.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo médico
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar médico" : "Cadastrar médico"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome completo *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="DR. NOME SOBRENOME"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">CRM *</Label>
                  <Input
                    value={form.crm}
                    onChange={(e) => setForm({ ...form, crm: e.target.value })}
                    placeholder="123456"
                  />
                </div>
                <div>
                  <Label className="text-xs">UF</Label>
                  <Input
                    value={form.crm_uf}
                    onChange={(e) => setForm({ ...form, crm_uf: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>
              {editing && (
                <div className="flex items-center justify-between pt-2">
                  <Label className="text-sm">Ativo</Label>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Médico</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && doctors.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum médico cadastrado.</TableCell></TableRow>
            )}
            {doctors.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{toTitleCase(d.full_name)}</TableCell>
                <TableCell className="font-mono text-sm">
                  {d.crm}{d.crm_uf ? `/${d.crm_uf}` : ""}
                </TableCell>
                <TableCell>
                  {d.is_active ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover ${toTitleCase(d.full_name)}?`)) {
                        remove.mutate(d.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
