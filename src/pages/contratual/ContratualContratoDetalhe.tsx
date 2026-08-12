import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileDown, History, FileSignature, Loader2, Trash2, RefreshCw, Mail, Edit2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatCNPJ, formatBRL, formatDateBR, formatCPF } from '@/lib/contractual/format';
import { getSignedPdfUrl, generateAndUploadPdf } from '@/lib/contractual/pdf';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { STATUS_LABEL, getContractStatusDisplay } from '@/lib/contractual/statusLabels';
import { AssinanteEditDialog } from './AssinanteEditDialog';

interface Props {
  contratoId: string | null;
  onClose: () => void;
  canEdit: boolean;
}


export function ContratualContratoDetalhe({ contratoId, onClose, canEdit }: Props) {
  const { isAdmMaster } = useAuth() as any;
  const qc = useQueryClient();
  const [regen, setRegen] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editingAssinante, setEditingAssinante] = useState<any>(null);

  const reenviarEmail = async (assinaturaId: string) => {
    setResendingId(assinaturaId);
    try {
      const { data, error } = await supabase.functions.invoke('autentique-resend', {
        body: { assinatura_id: assinaturaId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success('E-mail reenviado');
      qc.invalidateQueries({ queryKey: ['contract-contrato', contratoId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reenviar e-mail');
    } finally { setResendingId(null); }
  };

  const sincronizarAutentique = async () => {
    if (!contratoId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('autentique-sync', {
        body: { contrato_id: contratoId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      toast.success(`Sincronizado: ${d.assinadas}/${d.total} assinaturas`);
      qc.invalidateQueries({ queryKey: ['contract-contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contract-contratos'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao sincronizar');
    } finally { setSyncing(false); }
  };

  const excluirContrato = async () => {
    if (!contratoId) return;
    setDeleting(true);
    try {
      // remover pdf do storage se houver
      if (contrato?.pdf_url) {
        await supabase.storage.from('contract-pdfs').remove([contrato.pdf_url]).catch(() => {});
      }
      await supabase.from('contract_assinaturas').delete().eq('contrato_id', contratoId);
      await supabase.from('contract_eventos').delete().eq('contrato_id', contratoId);
      const { error } = await supabase.from('contract_contratos').delete().eq('id', contratoId);
      if (error) throw error;
      toast.success('Contrato excluído');
      qc.invalidateQueries({ queryKey: ['contract-contratos'] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir contrato');
    } finally { setDeleting(false); }
  };

  const enviarAutentique = async () => {
    if (!contratoId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('autentique-send', {
        body: { contrato_id: contratoId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success('Contrato enviado para Autentique');
      qc.invalidateQueries({ queryKey: ['contract-contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contract-contratos'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para Autentique', {
        duration: 5000,
      });
    } finally { setSending(false); }
  };

  const { data: contrato, refetch, isError, error, isLoading } = useQuery({
    queryKey: ['contract-contrato', contratoId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contract_contratos')
        .select('*, cliente:contract_clientes(*), assinaturas:contract_assinaturas(*), eventos:contract_eventos(*)')
        .eq('id', contratoId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Contrato não encontrado');

      // Busca opcional do autor (não bloqueia o carregamento do contrato)
      let criado_por: { display_name: string } | null = null;
      if ((data as any).created_by) {
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name, nickname')
          .eq('user_id', (data as any).created_by)
          .maybeSingle();
        if (p) criado_por = { display_name: (p as any).nickname || (p as any).full_name };
      }
      return { ...(data as any), criado_por };
    },
    enabled: !!contratoId,
  });


  const baixarPdf = async () => {
    if (!contrato?.pdf_url) { toast.error('PDF não disponível'); return; }
    try {
      // Baixa direto do Storage via SDK (não usa URL pública — evita bloqueio por adblock/Edge)
      const { data, error } = await supabase.storage.from('contract-pdfs').download(contrato.pdf_url);
      if (error || !data) throw error || new Error('Falha ao baixar PDF');
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${contrato.numero_contrato}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível baixar o PDF. Verifique se há bloqueador de anúncios ativo.');
    }
  };

  const regenerarPdf = async () => {
    if (!contrato?.html_final) { toast.error('Conteúdo do contrato não encontrado'); return; }
    setRegen(true);
    try {
      const path = await generateAndUploadPdf({
        contratoId: contrato.id, numero: contrato.numero_contrato, html: contrato.html_final,
      });
      await supabase.from('contract_contratos').update({ pdf_url: path }).eq('id', contrato.id);
      toast.success('PDF Pronto');
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF');
    } finally { setRegen(false); }
  };

  const st = contrato ? getContractStatusDisplay(contrato) : null;

  return (
    <Sheet open={!!contratoId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {contrato?.numero_contrato || 'Contrato'}
            {st && <Badge variant="secondary" className={st.tone}>{st.label}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {isError ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">
              Não foi possível carregar este contrato.
            </p>
            <p className="text-xs text-muted-foreground break-words px-4">
              {(error as any)?.message || 'Erro desconhecido'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          </div>
        ) : isLoading || !contrato ? (
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
                  Preparar para Envio
                </Button>
              )}
              {canEdit && contrato.status === 'rascunho' && (
                <Button size="sm" onClick={enviarAutentique} disabled={sending || !contrato.pdf_url}>
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSignature className="h-4 w-4 mr-1" />}
                  Enviar para Autentique
                </Button>
              )}
              {contrato.autentique_document_id && (
                <>
                  <Button variant="outline" size="sm" onClick={sincronizarAutentique} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Sincronizar status
                  </Button>
                  <Badge variant="outline" className="text-xs self-center">
                    Autentique: {contrato.autentique_document_id.slice(0, 8)}…
                  </Badge>
                </>
              )}
              {isAdmMaster && ['rascunho', 'cancelado'].includes(contrato.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="ml-auto" disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir contrato {contrato.numero_contrato}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove o contrato, seus assinantes, eventos e o PDF. Não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={excluirContrato} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  <div className="col-span-2 border-t mt-1.5 pt-1.5 text-[10px] text-muted-foreground italic">
                    Redigido por: {(contrato as any).criado_por?.display_name || 'Não registrado'}, em {formatDateBR(contrato.created_at)} {new Date(contrato.created_at).toLocaleTimeString('pt-BR').slice(0, 5)}
                  </div>
                </Section>

              </TabsContent>

              <TabsContent value="conteudo" className="mt-3">
                <div className="border rounded-lg bg-white p-6 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: contrato.html_final || '<p class="text-muted-foreground">Sem conteúdo</p>' }} />
              </TabsContent>

              <TabsContent value="assinaturas" className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(contrato.assinaturas || []).map((a: any) => {
                    const statusColors: Record<string, string> = {
                      pendente: 'bg-amber-100 text-amber-800',
                      assinado: 'bg-emerald-100 text-emerald-800',
                      rejeitado: 'bg-red-100 text-red-800',
                      falha: 'bg-red-100 text-red-800 border-red-200',
                      falha_envio: 'bg-red-500 text-white border-red-600 font-bold animate-pulse',
                    };
 
                    const statusLabels: Record<string, string> = {
                      pendente: 'Pendente',
                      assinado: 'Assinado',
                      rejeitado: 'Rejeitado',
                      falha: 'Falha',
                      falha_envio: 'FALHA DE ENVIO',
                    };

                    return (
                      <div key={a.id} className={`border rounded-lg p-4 flex flex-col justify-between space-y-3 ${['falha', 'falha_envio'].includes(a.status) ? 'border-red-200 bg-red-50/30' : 'bg-white'}`}>
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {a.tipo.replace(/_/g, ' ')}
                            </div>
                            <div className="font-semibold text-sm">{a.nome}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={a.email}>
                              {a.email || 'E-mail não cadastrado'}
                            </div>
                            {a.cpf && <div className="text-[10px] text-muted-foreground">{formatCPF(a.cpf)}</div>}
                          </div>
                          <Badge variant="secondary" className={`whitespace-nowrap ${statusColors[a.status] || 'bg-slate-100 text-slate-700'}`}>
                            {statusLabels[a.status] || a.status}
                          </Badge>
                        </div>

                        {(a.erro_mensagem || a.erro_detalhe) && (
                          <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                            {a.erro_mensagem || a.erro_detalhe}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                          <div className="text-[10px] text-muted-foreground flex-1">
                            {a.data_assinatura ? `Assinado em: ${formatDateBR(a.data_assinatura)}` : 'Aguardando'}
                          </div>
                          {canEdit && a.status !== 'assinado' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              onClick={() => setEditingAssinante(a)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(a.status === 'pendente' || a.status === 'falha' || a.status === 'falha_envio') && contrato.autentique_document_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5"
                              onClick={() => reenviarEmail(a.id)}
                              disabled={resendingId === a.id || !a.email}
                            >
                              {resendingId === a.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Mail className="h-3 w-3 mr-1" />
                              )}
                              Reenviar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(!contrato.assinaturas || contrato.assinaturas.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                    <FileSignature className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Nenhum assinante registrado</p>
                    <p className="text-xs text-slate-400">Gere o PDF e envie para o Autentique primeiro.</p>
                  </div>
                )}
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

      <AssinanteEditDialog 
        open={!!editingAssinante}
        onOpenChange={(o) => !o && setEditingAssinante(null)}
        assinante={editingAssinante}
        contrato={contrato}
        onSuccess={() => refetch()}
        regenerarPdf={regenerarPdf}
      />
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
