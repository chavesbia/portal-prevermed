import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AssinanteEditDialogProps {
  assinante: any;
  contrato: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  regenerarPdf: () => Promise<void>;
}

export function AssinanteEditDialog({ 
  assinante, 
  contrato, 
  open, 
  onOpenChange, 
  onSuccess,
  regenerarPdf 
}: AssinanteEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
  });

  useEffect(() => {
    if (assinante) {
      setFormData({
        nome: assinante.nome || '',
        email: assinante.email || '',
        cpf: assinante.cpf || '',
      });
    }
  }, [assinante]);

  const handleSave = async () => {
    if (!assinante || !contrato) return;
    setLoading(true);
    try {
      // 1. Mapear o tipo de assinante para os campos na tabela contract_contratos
      const mapping: Record<string, any> = {
        contratada: { nome: 'prevermed_nome', email: 'prevermed_email', cpf: 'prevermed_cpf' },
        contratante: { nome: 'rep_nome', email: 'rep_email', cpf: 'rep_cpf' },
        testemunha_contratada: { nome: 'testemunha1_nome', email: 'testemunha1_email', cpf: 'testemunha1_cpf' },
        testemunha_contratante: { nome: 'testemunha2_nome', email: 'testemunha2_email', cpf: 'testemunha2_cpf' },
      };

      const fields = mapping[assinante.tipo];
      
      // 2. Atualizar contract_assinaturas
      const { error: errorAssinatura } = await supabase
        .from('contract_assinaturas')
        .update({
          nome: formData.nome,
          email: formData.email,
          cpf: formData.cpf,
        })
        .eq('id', assinante.id);

      if (errorAssinatura) throw errorAssinatura;

      // 3. Atualizar contract_contratos se o mapeamento existir
      if (fields) {
        const updateData: any = {};
        updateData[fields.nome] = formData.nome;
        updateData[fields.email] = formData.email;
        updateData[fields.cpf] = formData.cpf;

        const { error: errorContrato } = await supabase
          .from('contract_contratos')
          .update(updateData)
          .eq('id', contrato.id);

        if (errorContrato) throw errorContrato;
      }

      toast.success('Dados atualizados localmente');
      
      // 4. Se já foi enviado ao Autentique, sincronizar a alteração
      if (contrato.autentique_document_id) {
        toast.loading('Sincronizando com Autentique...', { id: 'sync-autentique' });
        
        try {
          const { data, error: syncError } = await supabase.functions.invoke('autentique-update-signer', {
            body: {
              assinatura_id: assinante.id,
              novo_nome: formData.nome,
              novo_email: formData.email
            }
          });

          if (syncError) throw syncError;
          
          toast.success('Sincronizado. Disparando reenvio...', { id: 'sync-autentique' });
          
          // 5. Disparar reenvio automático após trocar o signatário
          await supabase.functions.invoke('autentique-resend', {
            body: { assinatura_id: assinante.id }
          });
          
          toast.success('E-mail enviado para o novo endereço', { id: 'sync-autentique' });
        } catch (syncErr: any) {
          console.error('Erro na sincronização Autentique:', syncErr);
          toast.error('Erro ao sincronizar com Autentique: ' + (syncErr.message || 'Erro desconhecido'), { id: 'sync-autentique' });
        }
      } else {
        // 6. Se NÃO foi enviado ao Autentique e não tem assinaturas, regenerar PDF
        const temAssinaturaRealizada = contrato.assinaturas?.some((a: any) => a.status === 'assinado');
        if (!temAssinaturaRealizada) {
          await regenerarPdf();
          toast.success('PDF do contrato regenerado');
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar alterações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Assinante</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input 
              id="nome" 
              value={formData.nome} 
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input 
              id="email" 
              type="email" 
              value={formData.email} 
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input 
              id="cpf" 
              value={formData.cpf} 
              onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
