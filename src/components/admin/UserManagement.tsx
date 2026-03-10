import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UserManagement() {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gerenciamento de Usuários
        </CardTitle>
        <CardDescription>
          Componente copiado e simplificado para compatibilidade com o schema atual do Portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Use /admin/usuarios para editar e-mails, perfis e status de usuários.</p>
      </CardContent>
    </Card>
  );
}
