import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, FileDown, Pencil, Trash2 } from 'lucide-react';
import { formatCNPJ, formatBRL, formatDateBR } from '@/lib/contractual/format';
import { Input } from '@/components/ui/input';
import { ContratualContratoWizard } from './ContratualContratoWizard';
import { ContratualContratoDetalhe } from './ContratualContratoDetalhe';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  rascunho: { label: 'Pronto para Envio', tone: 'bg-blue-100 text-blue-700' },
  aguardando_assinatura: { label: 'Aguardando assinatura', tone: 'bg-amber-100 text-amber-800' },
  parcialmente_assinado: { label: 'Parc. assinado', tone: 'bg-orange-100 text-orange-800' },
  assinado: { label: 'Assinado', tone: 'bg-emerald-50 text-emerald-600' },
  ativo: { label: 'Ativo', tone: 'bg-emerald-100 text-emerald-800' },
  vencendo_60: { label: 'Vence 60d', tone: 'bg-amber-200 text-amber-900' },
  vencendo_30: { label: 'Vence 30d', tone: 'bg-amber-200 text-amber-900' },
  vencendo_15: { label: 'Vence 15d', tone: 'bg-amber-200 text-amber-900' },
  vencido: { label: 'Vencido', tone: 'bg-red-100 text-red-800' },
  encerrado: { label: 'Encerrado', tone: 'bg-slate-600 text-white' },
  cancelado: { label: 'Cancelado', tone: 'bg-red-50 text-red-600' },
};

interface Props { canEdit: boolean }

export default function ContratualContratos({ canEdit }: Props) {
  const { isAdmMaster } = useAuth() as any;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ['contract-contratos', search],
    queryFn: async () => {
      let q = supabase.from('contract_contratos')
        .select('id, numero_contrato, status, data_inicio, data_fim, valor_mensal, pdf_url, html_final, cliente:contract_clientes(razao_social, cnpj)')
        .order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      const arr = data || [];
      if (!search) return arr;
      const s = search.toLowerCase();
      return arr.filter((c: any) =>
        c.numero_contrato?.toLowerCase().includes(s) ||
        c.cliente?.razao_social?.toLowerCase().includes(s) ||
        c.cliente?.cnpj?.includes(s.replace(/\D/g, ''))
      );
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('contract-contratos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contract_contratos'
        },
        () => {
          qc.invalidateQueries({ queryKey: ['contract-contratos'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  // Rascunho ainda não finalizado (PDF não gerado): reabre o assistente
  const isRascunhoAberto = (c: any) => c.status === 'rascunho' && !c.html_final;

  const abrirContrato = (c: any) => {
    if (isRascunhoAberto(c)) {
      setDraftId(c.id);
      setWizardOpen(true);
    } else {
      setDetailId(c.id);
    }
  };

  const excluirContrato = async (id: string, pdfUrl?: string) => {
    setDeleting(true);
    try {
      if (pdfUrl) {
        await supabase.storage.from('contract-pdfs').remove([pdfUrl]).catch(() => {});
      }
      await supabase.from('contract_assinaturas').delete().eq('contrato_id', id);
      await supabase.from('contract_eventos').delete().eq('contrato_id', id);
      const { error } = await supabase.from('contract_contratos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Contrato excluído');
      qc.invalidateQueries({ queryKey: ['contract-contratos'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir contrato');
    } finally { setDeleting(false); }
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar por número, empresa ou CNPJ…" className="max-w-md"
          value={search} onChange={e => setSearch(e.target.value)} />
        {canEdit && (
          <Button onClick={() => { setDraftId(null); setWizardOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Contrato
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && contratos.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum contrato encontrado.</TableCell></TableRow>
                )}
                {contratos.map((c: any) => {
                  const draft = isRascunhoAberto(c);
                  const st = draft
                    ? { label: 'Em preenchimento', tone: 'bg-slate-100 text-slate-700' }
                    : STATUS_LABEL[c.status] || { label: c.status, tone: 'bg-slate-100' };
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => abrirContrato(c)}>
                      <TableCell className="font-mono text-xs">{c.numero_contrato}</TableCell>
                      <TableCell className="font-medium">{c.cliente?.razao_social}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCNPJ(c.cliente?.cnpj)}</TableCell>
                      <TableCell><Badge variant="secondary" className={st.tone}>{st.label}</Badge></TableCell>
                      <TableCell className="text-xs">{formatDateBR(c.data_inicio)} → {formatDateBR(c.data_fim)}</TableCell>
                      <TableCell className="text-right">{formatBRL(c.valor_mensal)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); abrirContrato(c); }}>
                            {draft ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          
                          {isAdmMaster && ['rascunho', 'cancelado'].includes(c.status) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()} disabled={deleting}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir contrato {c.numero_contrato}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação remove o contrato, seus assinantes, eventos e o PDF. Não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => excluirContrato(c.id, c.pdf_url)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContratualContratoWizard
        key={draftId || 'novo'}
        open={wizardOpen}
        draftId={draftId}
        onOpenChange={(b) => { setWizardOpen(b); if (!b) { setDraftId(null); qc.invalidateQueries({ queryKey: ['contract-contratos'] }); } }}
        onCreated={(id) => { qc.invalidateQueries({ queryKey: ['contract-contratos'] }); setWizardOpen(false); setDraftId(null); setDetailId(id); }}
      />


      <ContratualContratoDetalhe
        contratoId={detailId}
        onClose={() => { setDetailId(null); qc.invalidateQueries({ queryKey: ['contract-contratos'] }); }}
        canEdit={canEdit}
      />
    </div>
  );
}
