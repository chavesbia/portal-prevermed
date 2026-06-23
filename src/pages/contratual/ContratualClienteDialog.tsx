import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import { validateCNPJ, formatCNPJ, onlyDigits } from '@/lib/contractual/format';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  cliente: any | null;
  onSaved: () => void;
}

const empty = {
  cnpj: '', razao_social: '', nome_fantasia: '', cep: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', estado: '', situacao_cadastral: '', cnae_principal: '',
  email: '', telefone: '', representante_legal: '', cpf_representante: '', observacoes: '',
};

export function ContratualClienteDialog({ open, onOpenChange, cliente, onSaved }: Props) {
  const [form, setForm] = useState<any>(empty);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (cliente) setForm({ ...empty, ...cliente });
    else setForm(empty);
  }, [cliente, open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const lookupCNPJ = async () => {
    const raw = onlyDigits(form.cnpj);
    if (raw.length !== 14 || !validateCNPJ(raw)) {
      toast.error('CNPJ inválido');
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', { body: { cnpj: raw } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f: any) => ({ ...f, ...data.data, cnpj: raw }));
      toast.success('Dados carregados da Receita Federal');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao consultar CNPJ');
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!form.razao_social || !form.cnpj) { toast.error('CNPJ e razão social são obrigatórios'); return; }
    if (!validateCNPJ(form.cnpj)) { toast.error('CNPJ inválido'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { ...form, cnpj: onlyDigits(form.cnpj), updated_by: user?.id };
      if (cliente?.id) {
        const { error } = await supabase.from('contract_clientes').update(payload).eq('id', cliente.id);
        if (error) throw error;
        toast.success('Cliente atualizado');
      } else {
        const { error } = await supabase.from('contract_clientes').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success('Cliente cadastrado');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>CNPJ *</Label>
            <div className="flex gap-2">
              <Input value={formatCNPJ(form.cnpj)} onChange={e => set('cnpj', e.target.value)}
                placeholder="00.000.000/0000-00" disabled={!!cliente?.id} />
              {!cliente?.id && (
                <Button type="button" variant="outline" onClick={lookupCNPJ} disabled={searching} className="gap-1.5 shrink-0">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Consultar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Informe o CNPJ e clique em consultar para preencher automaticamente.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Razão Social *" value={form.razao_social} onChange={v => set('razao_social', v)} />
            <Field label="Nome Fantasia" value={form.nome_fantasia} onChange={v => set('nome_fantasia', v)} />
            <Field label="CEP" value={form.cep} onChange={v => set('cep', v)} />
            <Field label="Situação Cadastral" value={form.situacao_cadastral} onChange={v => set('situacao_cadastral', v)} />
            <Field label="Logradouro" value={form.logradouro} onChange={v => set('logradouro', v)} cls="col-span-2" />
            <Field label="Número" value={form.numero} onChange={v => set('numero', v)} />
            <Field label="Complemento" value={form.complemento} onChange={v => set('complemento', v)} />
            <Field label="Bairro" value={form.bairro} onChange={v => set('bairro', v)} />
            <Field label="Cidade" value={form.cidade} onChange={v => set('cidade', v)} />
            <Field label="Estado (UF)" value={form.estado} onChange={v => set('estado', v?.toUpperCase().slice(0, 2))} />
            <Field label="CNAE Principal" value={form.cnae_principal} onChange={v => set('cnae_principal', v)} cls="col-span-2" />
          </div>

          <div className="pt-3 border-t">
            <h4 className="text-sm font-medium mb-2">Contato e representante</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail" value={form.email} onChange={v => set('email', v)} />
              <Field label="Telefone" value={form.telefone} onChange={v => set('telefone', v)} />
              <Field label="Representante Legal" value={form.representante_legal} onChange={v => set('representante_legal', v)} />
              <Field label="CPF do Representante" value={form.cpf_representante} onChange={v => set('cpf_representante', v)} />
            </div>
            <div className="mt-3">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
            </div>
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

function Field({ label, value, onChange, cls }: { label: string; value: any; onChange: (v: string) => void; cls?: string }) {
  return (
    <div className={`space-y-1 ${cls || ''}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
