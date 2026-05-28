import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useASOStats } from "@/hooks/useASOData";

import { useASORealtimeSync } from "@/hooks/useASORealtimeSync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, List, BarChart3, ClipboardCheck, Clock, CheckCircle, FileDown, Columns3, AlertTriangle, PackageCheck, Syringe } from "lucide-react";
import ASOImportacao from "./aso/ASOImportacao";
import ASOListagem from "./aso/ASOListagem";
import ASODashboard from "./aso/ASODashboard";
import ASORelatorio from "./aso/ASORelatorio";
import ASOKanban from "./aso/ASOKanban";
import ASOAlertas from "./aso/ASOAlertas";
import ASOFechamento from "./aso/ASOFechamento";
import ASONovasColetas from "./aso/ASONovasColetas";


const STAT_CARDS = [
  { key: "total", label: "Total", icon: FileText, color: "text-foreground" },
  { key: "importado", label: "Importados", icon: Upload, color: "text-muted-foreground" },
  { key: "em_triagem", label: "Inicial", icon: ClipboardCheck, color: "text-blue-500" },
  { key: "aguardando_exames", label: "Exames Pendentes", icon: Clock, color: "text-orange-500" },
  { key: "pronto_assinatura_medica", label: "Assinatura", icon: FileText, color: "text-purple-500" },
  { key: "liberado", label: "Liberados", icon: CheckCircle, color: "text-green-500" },
  { key: "liberado_faturamento", label: "Faturamento", icon: BarChart3, color: "text-emerald-500" },
] as const;

export default function LiberacaoASOs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "listagem");
  const { hasPermission } = useModulePermissions();
  const { data: stats } = useASOStats();
  useASORealtimeSync();

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(searchParams);
    if (v === "listagem") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };



  const canCreate = hasPermission("/liberacao-asos", "create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Liberação de ASOs</h1>
        <p className="text-muted-foreground">
          Controle do fluxo de atendimentos, exames e liberação de ASOs
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
            <Card key={key} className="p-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{(stats as any)[key] ?? 0}</p>
            </Card>
          ))}
        </div>
      )}

      {stats && (
        <div className="flex gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            🏢 Lapa: {stats.lapa}
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3">
            🏢 Osasco: {stats.osasco}
          </Badge>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="listagem" className="gap-1">
            <List className="h-4 w-4" /> Listagem
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1">
            <Columns3 className="h-4 w-4" /> Kanban
          </TabsTrigger>
          {canCreate && (
            <TabsTrigger value="importacao" className="gap-1">
              <Upload className="h-4 w-4" /> Importação
            </TabsTrigger>
          )}
          <TabsTrigger value="alertas" className="gap-1">
            <AlertTriangle className="h-4 w-4" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="novas-coletas" className="gap-1">
            <Syringe className="h-4 w-4" /> Novas Coletas
          </TabsTrigger>
          <TabsTrigger value="fechamento" className="gap-1">
            <PackageCheck className="h-4 w-4" /> Fechamento
          </TabsTrigger>

          <TabsTrigger value="dashboard" className="gap-1">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-1">
            <FileDown className="h-4 w-4" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listagem">
          <ASOListagem />
        </TabsContent>
        <TabsContent value="kanban">
          <ASOKanban />
        </TabsContent>
        {canCreate && (
          <TabsContent value="importacao">
            <ASOImportacao />
          </TabsContent>
        )}
        <TabsContent value="alertas">
          <ASOAlertas />
        </TabsContent>
        <TabsContent value="novas-coletas">
          <ASONovasColetas />
        </TabsContent>

        <TabsContent value="fechamento">
          <ASOFechamento />
        </TabsContent>
        <TabsContent value="dashboard">
          <ASODashboard />
        </TabsContent>
        <TabsContent value="relatorio">
          <ASORelatorio />
        </TabsContent>
      </Tabs>
    </div>
  );
}
