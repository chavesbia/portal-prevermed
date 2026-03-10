import { useState, useEffect } from "react";
import { UserCheck, Clock, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  approved: boolean;
}

export function PendingApprovals() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  const fetchPendingUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at, approved")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      console.error("Error fetching pending users:", error);
      toast.error("Erro ao carregar usuários pendentes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: currentUser?.id,
        })
        .eq("id", userId);

      if (error) throw error;

      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("Usuário aprovado com sucesso!");
    } catch (error) {
      console.error("Error approving user:", error);
      toast.error("Erro ao aprovar usuário");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setProcessingId(userId);
    try {
      // Delete from profiles (will cascade to user_roles due to trigger)
      // Note: This doesn't delete from auth.users - admin would need to do that from dashboard
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("Usuário rejeitado");
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast.error("Erro ao rejeitar usuário");
    } finally {
      setProcessingId(null);
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
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Aprovação de Usuários
          {pendingUsers.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingUsers.length} pendente{pendingUsers.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Aprove ou rejeite novos cadastros de usuários
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-success mb-4" />
            <p className="text-muted-foreground">
              Nenhum usuário pendente de aprovação
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-warning border-warning">
                        <Clock className="mr-1 h-3 w-3" />
                        Pendente
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReject(user.id)}
                          disabled={processingId === user.id}
                        >
                          {processingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="mr-1 h-4 w-4" />
                              Rejeitar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="prever-gradient"
                          onClick={() => handleApprove(user.id)}
                          disabled={processingId === user.id}
                        >
                          {processingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Aprovar
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
