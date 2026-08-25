import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';
import { formatDateBR, formatBRL } from '@/lib/contractual/format';
import { toast } from 'sonner';

const MOTIVO_LABEL: Record<string, string> = {
  insatisfacao: 'Insatisfação',
  preco: 'Preço',
  encerramento_atividades: 'Encerramento de Atividades',
  transferencia_cnpj: 'Transferência de CNPJ',
  mudanca_estrategica: 'Mudança Estratégica',
  alteracao_endereco: 'Alteração de Endereço',
  outro: 'Outro',
};

function Field({ label, value }: { label: string; value?: any }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{value === null || value === undefined || value === '' ? '—' : value}</div>
    </div>
  );
}

interface Props {
  rescisaoId: string | null;
  onClose: () => void;
}

export function ContratualRescisaoDetalhe({ rescisaoId, onClose }: Props) {
  const { data: r, isLoading } = useQuery({
    queryKey: ['contract-rescisao-detalhe', rescisaoId],
    enabled: !!rescisaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_rescisoes')
        .select(`*, companies (razao_social, cnpj, soc_code), contract_contratos (numero_contrato, data_inicio, data_fim, valor_mensal)`)
        .eq('id', rescisaoId as string)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const baixarAnexo = async () => {
    if (!r?.anexo_url) return;
    const { data, error } = await supabase.storage.from('contract-rescisoes').createSignedUrl(r.anexo_url, 300);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível gerar o link do anexo');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const confirmada = !!r?.data_real_inativacao;

  return (
    <Dialog open={!!rescisaoId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Rescisão {r?.numero || ''}
            {r && (
              <Badge className={confirmada
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 whitespace-nowrap'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 whitespace-nowrap'}>
                {confirmada ? 'Confirmada' : 'Solicitada'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !r ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Empresa</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Razão Social" value={r.companies?.razao_social} />
                <Field label="CNPJ" value={r.companies?.cnpj} />
                <Field label="Código SOC" value={r.companies?.soc_code} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Contrato</h3>
              {r.contrato_id ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Número" value={r.contract_contratos?.numero_contrato} />
                  <Field label="Vigência" value={`${formatDateBR(r.contract_contratos?.data_inicio)} → ${formatDateBR(r.contract_contratos?.data_fim)}`} />
                  <Field label="Valor Mensal" value={formatBRL(r.contract_contratos?.valor_mensal)} />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Número (manual/legado)" value={r.numero_contrato_manual} />
                  <Field label="Vigência" value={`${formatDateBR(r.vigencia_inicio_manual)} → ${formatDateBR(r.vigencia_fim_manual)}`} />
                  <Field label="Valor Mensal" value={r.valor_mensal_manual != null ? formatBRL(r.valor_mensal_manual) : null} />
                  <Field label="Qtd. de Vidas" value={r.qtd_vidas_manual} />
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Solicitante</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Nome" value={r.solicitante_nome} />
                <Field label="Cargo" value={r.solicitante_cargo} />
                <Field label="WhatsApp" value={r.solicitante_whatsapp} />
                <Field label="E-mail" value={r.solicitante_email} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Motivo</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Motivo" value={MOTIVO_LABEL[r.motivo] || r.motivo} />
                <Field label="Clínica de Destino" value={r.clinica_destino} />
              </div>
              <Field label="Descrição" value={r.motivo_descricao} />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Datas</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Previsão de Inativação" value={formatDateBR(r.data_prevista_inativacao)} />
                <Field label="Data Real de Inativação" value={formatDateBR(r.data_real_inativacao)} />
                <Field label="Previsão do Último Faturamento" value={formatDateBR(r.data_prevista_ultimo_faturamento)} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Últimos Faturamentos</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Faturamento 1" value={r.valor_fat_1 != null ? formatBRL(r.valor_fat_1) : null} />
                <Field label="Faturamento 2" value={r.valor_fat_2 != null ? formatBRL(r.valor_fat_2) : null} />
                <Field label="Faturamento 3" value={r.valor_fat_3 != null ? formatBRL(r.valor_fat_3) : null} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Anexo</h3>
              {r.anexo_url ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={baixarAnexo}>
                  <Download className="h-4 w-4" /> Baixar carta de solicitação
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum anexo enviado.</div>
              )}
            </section>

            <div className="text-[11px] text-muted-foreground">
              Registrada em {formatDateBR(r.created_at)}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
