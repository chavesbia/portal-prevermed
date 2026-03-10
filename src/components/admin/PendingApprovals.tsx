import { UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingApprovals() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Aprovação de Usuários
        </CardTitle>
        <CardDescription>
          Componente copiado e simplificado para compatibilidade com o schema atual do Portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Use /admin/usuarios para aprovar, ativar e gerenciar usuários.</p>
      </CardContent>
    </Card>
  );
}
