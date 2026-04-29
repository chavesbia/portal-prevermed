import { LaudosServicosManager } from "@/components/admin/LaudosServicosManager";

export default function AdminLaudosServicos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laudos e Serviços</h1>
        <p className="text-muted-foreground">
          Catálogo central reutilizado em Renovação, Proposta, Contrato, OS e Faturamento.
        </p>
      </div>
      <LaudosServicosManager />
    </div>
  );
}
