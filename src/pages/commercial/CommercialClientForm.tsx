import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommercialClients } from '@/hooks/useCommercialClients';
import { useClientServices } from '@/hooks/useCommercialServices';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { SUBGROUP_OPTIONS, RISK_GRADES, STATES } from '@/lib/commercial-constants';
import ServicesTagSelector from '@/components/commercial/ServicesTagSelector';

interface Props {
  onSuccess: () => void;
  initialData?: any;
  isEditing?: boolean;
}

export default function CommercialClientForm({ onSuccess, initialData, isEditing }: Props) {
  const { createClient, updateClient } = useCommercialClients();
  const { user } = useAuth();
  const { clientServices, setServices } = useClientServices(isEditing ? initialData?.id : undefined);

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
    contact_name: initialData?.contact_name || '',
    contact_whatsapp: initialData?.contact_whatsapp || '',
    contact_email: initialData?.contact_email || '',
    contact_phone: initialData?.contact_phone || '',
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

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Sync selected services when editing
  useEffect(() => {
    if (isEditing) {
      setSelectedServiceIds(clientServices.map(cs => cs.service_id));
    }
  }, [isEditing, clientServices]);

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
      contact_name: form.contact_name.trim() || null,
      contact_whatsapp: form.contact_whatsapp.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contract_start_date: form.contract_start_date || null,
      contract_end_date: form.contract_end_date || null,
      approval_date: form.approval_date || null,
      ...(isEditing ? { updated_by: user?.id } : { created_by: user?.id }),
    };

    let resultId: string | undefined;
    if (isEditing && initialData?.id) {
      await updateClient.mutateAsync({ id: initialData.id, ...payload });
      resultId = initialData.id;
    } else {
      const created: any = await createClient.mutateAsync(payload);
      resultId = created?.id;
    }

    // Save services tags (only for editing existing client; new clients can edit after creation)
    if (isEditing && resultId) {
      await setServices.mutateAsync(selectedServiceIds);
    }
    onSuccess();
  };

  const isPending = createClient.isPending || updateClient.isPending || setServices.isPending;

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
            <Select value={form.subgroup} onValueChange={v => handleChange('subgroup', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {SUBGROUP_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grau de Risco *</Label>
            <Select value={form.risk_grade} onValueChange={v => handleChange('risk_grade', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {RISK_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
              <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Contato */}
          <div className="md:col-span-2 pt-3 border-t">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome do Contato</Label>
                <Input value={form.contact_name} onChange={e => handleChange('contact_name', e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.contact_whatsapp} onChange={e => handleChange('contact_whatsapp', e.target.value)} placeholder="(11) 90000-0000" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.contact_phone} onChange={e => handleChange('contact_phone', e.target.value)} placeholder="(11) 0000-0000" />
              </div>
              <div className="md:col-span-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.contact_email} onChange={e => handleChange('contact_email', e.target.value)} placeholder="contato@empresa.com.br" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Contrato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.has_contract} onCheckedChange={v => handleChange('has_contract', v)} />
            <Label>Contrato Elaborado</Label>
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
          <div className="md:col-span-2 text-xs text-muted-foreground bg-muted/40 rounded p-2">
            💡 Após salvar o cadastro, vá em <strong>Anexos</strong> para anexar o contrato assinado e a tabela vigente.
            <br />
            <span className="opacity-80">Em breve: integração com a plataforma Autentique para assinatura digital.</span>
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
            <Label>Serviços Contratados (TAGs)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {isEditing
                ? 'Selecione os serviços contratados pelo cliente.'
                : 'Você poderá selecionar os serviços contratados após salvar o cadastro inicial.'}
            </p>
            {isEditing ? (
              <ServicesTagSelector value={selectedServiceIds} onChange={setSelectedServiceIds} />
            ) : (
              <div className="text-xs text-muted-foreground italic p-3 rounded border border-dashed">
                Disponível após o cadastro inicial.
              </div>
            )}
          </div>
          <div>
            <Label>Resumo de Serviços (texto livre)</Label>
            <Textarea value={form.services_summary} onChange={e => handleChange('services_summary', e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.pricing_table_attached} onCheckedChange={v => handleChange('pricing_table_attached', v)} />
            <Label>Tabela de Preços Anexada</Label>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            💡 Para anexar a <strong>tabela vigente</strong>, salve o cadastro e vá na aba <strong>Anexos</strong> do cliente, escolhendo o tipo "Tabela".
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
