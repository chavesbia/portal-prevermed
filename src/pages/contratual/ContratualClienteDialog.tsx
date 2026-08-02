import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCNPJ } from '@/lib/contractual/format';
import { CPFInput } from '@/components/contratual/CPFInput';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  cliente: any | null;
  onSaved: () => void;
}

const empty = {
  email: '', telefone: '', representante_legal: '', cpf_representante: '', observacoes: '',
};

/** Edição apenas dos dados mantidos manualmente: contato e representante legal.
 *  Razão social / CNPJ / endereço vêm da base mestre de empresas (SOC) e são somente leitura. */
export function ContratualClienteDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cliente) {
      setForm({
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        representante_legal: cliente.representante_legal || '',
        cpf_representante: cliente.cpf_representante || '',
        observacoes: cliente.observacoes || '',
      });
    } else {
      setForm(empty);
    }
  }, [cliente, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('contract_clientes')
        .update({ ...form, updated_by: user?.id })
        .eq('id', cliente.id);
      if (error) throw error;
      toast.success('Dados atualizados');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contato e Representante Legal</DialogTitle>
          {cliente && (
            <DialogDescription>
              {cliente.display_razao || cliente.razao_social} · {formatCNPJ(cliente.display_cnpj || cliente.cnpj)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input value={form.telefone} onChange={e => set('telefone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Representante Legal</Label>
            <Input value={form.representante_legal} onChange={e => set('representante_legal', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CPF do Representante</Label>
            <CPFInput value={form.cpf_representante || ''} onChange={v => set('cpf_representante', v)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
