import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminEmpresas() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("soc-empresas-sync");
      if (error) throw error;
      setResult(data);
      if (data?.ok) {
        toast.success(`Sync concluído: ${data.inserted} inseridas, ${data.updated} atualizadas`);
      } else {
        toast.error(data?.error || "Falha na sincronização");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar");
      setResult({ error: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Base Mestre de Empresas (SOC)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sincronização com SOC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Puxa a lista de empresas do SOC e atualiza a tabela mestre <code>companies</code>.
          </p>
          <Button onClick={sync} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar com SOC
          </Button>

          {result && (
            <pre className="mt-4 p-4 bg-muted rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
