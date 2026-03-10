import { useState, useEffect } from "react";
import { Users, Shield, Loader2, Pencil, Check, X, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserRole } from "@/types/pricing";
import { useAuth } from "@/contexts/AuthContext";

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  approved: boolean;
}

const roleLabels: Record<UserRole, string> = {
  vendedor: "Vendedor",
  coordenador: "Coordenador",
  gerente: "Gerente",
  diretor: "Diretor",
  admin: "Administrador",
};

const roleColors: Record<UserRole, string> = {
  vendedor: "bg-muted text-muted-foreground",
  coordenador: "bg-info/10 text-info",
  gerente: "bg-warning/10 text-warning",
  diretor: "bg-primary/10 text-primary",
  admin: "bg-destructive/10 text-destructive",
};

export function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with approved status
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, approved")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          approved: profile.approved,
          role: (userRole?.role as UserRole) || "vendedor",
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
      toast.error("Você não pode alterar sua própria role");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`Role atualizada para ${roleLabels[newRole]}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleApproval = async (userId: string, currentApproved: boolean) => {
    if (userId === currentUser?.id) {
      toast.error("Você não pode alterar seu próprio status");
      return;
    }

    setUpdatingUserId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          approved: !currentApproved,
          approved_at: !currentApproved ? new Date().toISOString() : null,
          approved_by: !currentApproved ? currentUser?.id : null,
        })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, approved: !currentApproved } : u))
      );
      toast.success(!currentApproved ? "Usuário ativado!" : "Usuário desativado!");
    } catch (error) {
      console.error("Error toggling approval:", error);
      toast.error("Erro ao alterar status do usuário");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleEditClick = (user: UserWithRole) => {
    setEditingUser(user);
    setEditEmail(user.email);
    setIsEditDialogOpen(true);
  };

  const handleSaveEmail = async () => {
    if (!editingUser) return;
    
    const trimmedEmail = editEmail.trim();
    if (!trimmedEmail) {
      toast.error("E-mail não pode estar vazio");
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error("E-mail inválido");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ email: trimmedEmail })
        .eq("id", editingUser.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, email: trimmedEmail } : u))
      );
      toast.success("E-mail atualizado com sucesso!");
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating email:", error);
      toast.error("Erro ao atualizar e-mail");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription>
            Visualize e altere as roles, e-mails e status dos usuários do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role Atual</TableHead>
                  <TableHead className="w-48">Alterar Role</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={!user.approved ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      {user.full_name}
                      {user.id === currentUser?.id && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Você
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.approved ? (
                        <Badge className="bg-success/10 text-success">
                          <UserCheck className="mr-1 h-3 w-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive">
                          <UserX className="mr-1 h-3 w-3" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role]}>
                        <Shield className="mr-1 h-3 w-3" />
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.id === currentUser?.id ? (
                        <span className="text-sm text-muted-foreground">
                          —
                        </span>
                      ) : (
                        <Select
                          value={user.role}
                          onValueChange={(value: UserRole) =>
                            handleRoleChange(user.id, value)
                          }
                          disabled={updatingUserId === user.id}
                        >
                          <SelectTrigger className="w-40">
                            {updatingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vendedor">Vendedor</SelectItem>
                            <SelectItem value="coordenador">Coordenador</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="diretor">Diretor</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.id !== currentUser?.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(user)}
                            title="Editar e-mail"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleApproval(user.id, user.approved)}
                            disabled={updatingUserId === user.id}
                            title={user.approved ? "Desativar usuário" : "Ativar usuário"}
                            className={user.approved ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}
                          >
                            {updatingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.approved ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {users.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum usuário encontrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição de e-mail */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar E-mail</DialogTitle>
            <DialogDescription>
              Altere o e-mail do usuário {editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Digite o novo e-mail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEmail} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
