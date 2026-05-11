import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RetificacaoList } from '@/components/retificacao/RetificacaoList';
import { RetificacaoSettings } from '@/components/retificacao/RetificacaoSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function RetificacaoASOs() {
  const [params, setParams] = useSearchParams();
  const { isAdmMaster } = useAuth();
  const tab = params.get('tab') || 'solicitacoes';

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', v);
    setParams(next, { replace: true });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Retificação de ASOs</h1>
        <p className="text-muted-foreground text-sm">
          Controle das solicitações de retificação enviadas pelos clientes.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          {isAdmMaster && <TabsTrigger value="configuracoes">Configurações</TabsTrigger>}
        </TabsList>
        <TabsContent value="solicitacoes" className="mt-4">
          <RetificacaoList />
        </TabsContent>
        {isAdmMaster && (
          <TabsContent value="configuracoes" className="mt-4">
            <RetificacaoSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
