import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileDown, History, FileSignature, Loader2 } from 'lucide-react';
import { formatCNPJ, formatBRL, formatDateBR, formatCPF } from '@/lib/contractual/format';
import { getSignedPdfUrl, generateAndUploadPdf } from '@/lib/contractual/pdf';
import { toast } from 'sonner';

interface Props {
  contratoId: string | null;
  onClose: () => void;
  canEdit: boolean;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  rascunho: { label: 'Rascunho', tone: 'bg-slate-100 text-slate-700' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'bg-amber-100 text-amber-800' },
  parcialmente_assinado: { label: 'Parc. assinado', tone: 'bg-amber-100 text-amber-800' },
  assinado: { label: 'Assinado', tone: 'bg-emerald-100 text-emerald-800' },
  ativo: { label: 'Ativo', tone: 'bg-emerald-100 text-emerald-800' },
  vencendo_60: { label: 'Vence 60d', tone: 'bg-yellow-100 text-yellow-800' },
  vencendo_30: { label: 'Vence 30d', tone: 'bg-orange-100 text-orange-800' },
  vencendo_15: { label: 'Vence 15d', tone: 'bg-red-100 text-red-700' },
  vencido: { label: 'Vencido', tone: 'bg-red-100 text-red-800' },
  encerrado: { label: 'Encerrado', tone: 'bg-slate-200 text-slate-700' },
  cancelado: { label: 'Cancelado', tone: 'bg-slate-200 text-slate-700' },
};

export function ContratualContratoDetalhe({ contratoId, onClose, canEdit }: Props) {
  const qc = useQueryClient();
  const [regen, setRegen] = useState(false);

  const { data: contrato, refetch } = useQuery({
    queryKey: ['contract-contrato', contratoId],
    queryFn: async () => {
      const { data } = await supabase.from('contract_contratos')
        .select('*, cliente:contract_clientes(*), assinaturas:contract_assinaturas(*), eventos:contract_eventos(*)')
        .eq('id', contratoId).maybeSingle();
      return data;
    },
    enabled: !!contratoId,
  });

  const baixarPdf = async () => {
    if (!contrato?.pdf_url) { toast.error('PDF não disponível'); return; }
    const url = await getSignedPdfUrl(contrato.pdf_url);
    if (url) window.open(url, '_blank');
    else toast.error('Não foi possível gerar URL do PDF');
  };

  const regenerarPdf = async () => {
    if (!contrato?.html_final) { toast.error('Conteúdo do contrato não encontrado'); return; }
    setRegen(true);
    try {
      const path = await generateAndUploadPdf({
        contratoId: contrato.id, numero: contrato.numero_contrato, html: contrato.html_final,
      });
      await supabase.from('contract_contratos').update({ pdf_url: path }).eq('id', contrato.id);
      toast.success('PDF regenerado');
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF');
    } finally { setRegen(false); }
  };

  const st = contrato ? (STATUS_LABEL[contrato.status] || { label: contrato.status, tone: 'bg-slate-100' }) : null;

  return (
    <Sheet open={!!contratoId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {contrato?.numero_contrato || 'Contrato'}
            {st && <Badge variant="secondary" className={st.tone}>{st.label}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {!contrato ? (
          <div className="py-10 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={baixarPdf} disabled={!contrato.pdf_url}>
                <FileDown className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={regenerarPdf} disabled={regen}>
                  {regen ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSignature className="h-4 w-4 mr-1" />}
                  Regenerar PDF
                </Button>
              )}
            </div>

            <Tabs defaultValue="dados">
              <TabsList>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-3 mt-3">
                <Section title="Cliente">
                  <Row k="Razão Social" v={contrato.cliente?.razao_social} />
                  <Row k="CNPJ" v={formatCNPJ(contrato.cliente?.cnpj)} />
                  <Row k="Cidade/UF" v={[contrato.cliente?.cidade, contrato.cliente?.estado].filter(Boolean).join(' / ')} />
                </Section>
                <Section title="Contrato">
                  <Row k="Início" v={formatDateBR(contrato.data_inicio)} />
                  <Row k="Término" v={formatDateBR(contrato.data_fim)} />
                  <Row k="Vigência" v={`${contrato.vigencia_meses} meses`} />
                  <Row k="Valor mensal" v={formatBRL(contrato.valor_mensal)} />
                  <Row k="Qtd. vidas" v={contrato.qtd_vidas} />
                  <Row k="Vida excedente" v={formatBRL(contrato.valor_excedente)} />
                  <Row k="Reajuste" v={contrato.indice_reajuste} />
                  <Row k="Multa" v={contrato.multa != null ? `${contrato.multa}%` : '-'} />
                  <Row k="Juros" v={contrato.juros != null ? `${contrato.juros}%` : '-'} />
                  <Row k="Aviso prévio" v={contrato.prazo_aviso ? `${contrato.prazo_aviso} dias` : '-'} />
                </Section>
              </TabsContent>

              <TabsContent value="conteudo" className="mt-3">
                <div className="border rounded-lg bg-white p-6 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: contrato.html_final || '<p class="text-muted-foreground">Sem conteúdo</p>' }} />
              </TabsContent>

              <TabsContent value="assinaturas" className="mt-3 space-y-2">
                {(contrato.assinaturas || []).map((a: any) => (
                  <div key={a.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{a.tipo.replace('_', ' ')}</div>
                      <div className="font-medium">{a.nome}</div>
                      <div className="text-xs text-muted-foreground">{formatCPF(a.cpf)}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{a.status}</Badge>
                      {a.data_assinatura && (
                        <div className="text-xs text-muted-foreground mt-1">{formatDateBR(a.data_assinatura)}</div>
                      )}
                    </div>
                  </div>
                ))}
                {(!contrato.assinaturas || contrato.assinaturas.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum assinante registrado.</p>
                )}
                <p className="text-xs text-muted-foreground italic pt-2 border-t">
                  Integração com Autentique será ativada na próxima fase.
                </p>
              </TabsContent>

              <TabsContent value="timeline" className="mt-3 space-y-2">
                {[...(contrato.eventos || [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)).map((e: any) => (
                  <div key={e.id} className="flex gap-3 text-sm border-l-2 border-primary pl-3 py-1">
                    <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">{e.descricao || e.tipo}</div>
                      <div className="text-xs text-muted-foreground">{formatDateBR(e.created_at)} {new Date(e.created_at).toLocaleTimeString('pt-BR').slice(0, 5)}</div>
                    </div>
                  </div>
                ))}
                {(!contrato.eventos || contrato.eventos.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-y-1.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: any }) {
  return (
    <>
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? '-'}</div>
    </>
  );
}
