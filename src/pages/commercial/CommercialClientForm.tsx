import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { SUBGROUP_OPTIONS, RISK_GRADES, STATES } from '@/lib/commercial-constants';

export default function CommercialClientForm({ onSuccess, initialData, isEditing }: Props) {
  const { createClient, updateClient } = useCommercialClients();
  const { user } = useAuth();

  const [form, setForm] = useState({
    company_name: initialData?.company_name || '',
    legal_name: initialData?.legal_name || '',
    cnpj: initialData?.cnpj || '',
    soc_code: initialData?.soc_code || '',
    city: initialData?.city || '',
    state: initialData?.state || 'SP',
    active_lives: initialData?.active_lives || 0,
    subgroup: initialData?.subgroup || '',
    risk_grade: initialData?.risk_grade || '',
    has_contract: initialData?.has_contract || false,
    contract_signed: initialData?.contract_signed || false,
    contract_number: initialData?.contract_number || '',
    contract_start_date: initialData?.contract_start_date || '',
    contract_end_date: initialData?.contract_end_date || '',
    proposal_approved: initialData?.proposal_approved || false,
    proposal_number: initialData?.proposal_number || '',
    approval_date: initialData?.approval_date || '',
    services_summary: initialData?.services_summary || '',
    pricing_table_attached: initialData?.pricing_table_attached || false,
    notes: initialData?.notes || '',
    contract_notes: initialData?.contract_notes || '',
  });

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.company_name.trim()) return toast({ title: 'Empresa é obrigatória', variant: 'destructive' });
    if (!form.subgroup.trim()) return toast({ title: 'Subgrupo é obrigatório', variant: 'destructive' });
    if (!form.risk_grade) return toast({ title: 'Grau de risco é obrigatório', variant: 'destructive' });
    if (!form.cnpj.trim() && !form.soc_code.trim()) return toast({ title: 'Informe CNPJ ou Código SOC', variant: 'destructive' });

    const payload = {
      ...form,
      cnpj: form.cnpj.trim() || null,
      soc_code: form.soc_code.trim() || null,
      contract_start_date: form.contract_start_date || null,
      contract_end_date: form.contract_end_date || null,
      approval_date: form.approval_date || null,
      ...(isEditing ? { updated_by: user?.id } : { created_by: user?.id }),
    };

    if (isEditing && initialData?.id) {
      await updateClient.mutateAsync({ id: initialData.id, ...payload });
    } else {
      await createClient.mutateAsync(payload);
    }
    onSuccess();
  };

  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados Básicos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Empresa *</Label>
            <Input value={form.company_name} onChange={e => handleChange('company_name', e.target.value)} />
          </div>
          <div>
            <Label>Razão Social</Label>
            <Input value={form.legal_name} onChange={e => handleChange('legal_name', e.target.value)} />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={e => handleChange('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label>Código SOC</Label>
            <Input value={form.soc_code} onChange={e => handleChange('soc_code', e.target.value)} />
          </div>
          <div>
            <Label>Subgrupo *</Label>
            <Input value={form.subgroup} onChange={e => handleChange('subgroup', e.target.value)} />
          </div>
          <div>
            <Label>Grau de Risco *</Label>
            <Select value={form.risk_grade} onValueChange={v => handleChange('risk_grade', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {riskGrades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vidas Ativas</Label>
            <Input type="number" value={form.active_lives} onChange={e => handleChange('active_lives', parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.city} onChange={e => handleChange('city', e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Select value={form.state} onValueChange={v => handleChange('state', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Contrato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.has_contract} onCheckedChange={v => handleChange('has_contract', v)} />
            <Label>Possui Contrato</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.contract_signed} onCheckedChange={v => handleChange('contract_signed', v)} />
            <Label>Contrato Assinado</Label>
          </div>
          <div>
            <Label>Número do Contrato</Label>
            <Input value={form.contract_number} onChange={e => handleChange('contract_number', e.target.value)} />
          </div>
          <div>
            <Label>Início da Vigência</Label>
            <Input type="date" value={form.contract_start_date} onChange={e => handleChange('contract_start_date', e.target.value)} />
          </div>
          <div>
            <Label>Fim da Vigência</Label>
            <Input type="date" value={form.contract_end_date} onChange={e => handleChange('contract_end_date', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações do Contrato</Label>
            <Textarea value={form.contract_notes} onChange={e => handleChange('contract_notes', e.target.value)} rows={3} placeholder="Observações específicas do contrato..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Proposta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.proposal_approved} onCheckedChange={v => handleChange('proposal_approved', v)} />
            <Label>Proposta Aprovada</Label>
          </div>
          <div>
            <Label>Número da Proposta</Label>
            <Input value={form.proposal_number} onChange={e => handleChange('proposal_number', e.target.value)} />
          </div>
          <div>
            <Label>Data de Aprovação</Label>
            <Input type="date" value={form.approval_date} onChange={e => handleChange('approval_date', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Resumo de Serviços</Label>
            <Textarea value={form.services_summary} onChange={e => handleChange('services_summary', e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.pricing_table_attached} onCheckedChange={v => handleChange('pricing_table_attached', v)} />
            <Label>Tabela de Preços Anexada</Label>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
        </Button>
      </div>
    </div>
  );
}
