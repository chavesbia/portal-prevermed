import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommercialClients, useClientAttachments } from '@/hooks/useCommercialClients';
import { computeClientStatus, statusLabels, statusColors } from '@/lib/commercial-status';
import { ArrowLeft, Upload, Trash2, FileText, Loader2, Check, X, ClipboardCheck } from 'lucide-react';
import CommercialClientForm from './CommercialClientForm';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface Props {
  clientId: string;
  onBack: () => void;
  readOnly: boolean;
}

export default function CommercialClientDetail({ clientId, onBack, readOnly }: Props) {
  const { clients, updateClient } = useCommercialClients();
  const { attachments, isLoading: attachLoading, uploadAttachment, deleteAttachment } = useClientAttachments(clientId);
  const { user } = useAuth();
  const [tab, setTab] = useState('dados');
  const [isEditing, setIsEditing] = useState(false);
  const [uploadType, setUploadType] = useState<'contrato' | 'proposta' | 'tabela'>('contrato');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const client = clients.find(c => c.id === clientId);
  if (!client) return <div className="text-center py-8 text-muted-foreground">Cliente não encontrado</div>;

  const status = computeClientStatus({ ...client, attachments_count: attachments.length });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAttachment.mutateAsync({ file, type: uploadType });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const BoolField = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center gap-2">
      {value ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
      <span className="text-sm">{label}</span>
    </div>
  );

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setIsEditing(false)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Cancelar Edição
        </Button>
        <CommercialClientForm initialData={client} isEditing onSuccess={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        {!readOnly && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{client.company_name}</h2>
        <Badge className={`${statusColors[status]} text-xs`}>{statusLabels[status]}</Badge>
        {client.revisado ? (
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-xs gap-1">
            <ClipboardCheck className="h-3 w-3" /> Revisado {client.revisado_em ? `em ${format(new Date(client.revisado_em), 'dd/MM/yyyy')}` : ''}
          </Badge>
        ) : (
          !readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => updateClient.mutate({ id: clientId, revisado: true, revisado_em: new Date().toISOString(), revisado_por: user?.id || null } as any)}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Marcar como Revisado
            </Button>
          )
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="proposta">Proposta</TabsTrigger>
          <TabsTrigger value="anexos">Anexos ({attachments.length})</TabsTrigger>
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Razão Social" value={client.legal_name} />
              <Info label="CNPJ" value={client.cnpj} />
              <Info label="Código SOC" value={client.soc_code} />
              <Info label="Subgrupo" value={client.subgroup} />
              <Info label="Grau de Risco" value={client.risk_grade} />
              <Info label="Vidas Ativas" value={String(client.active_lives)} />
              <Info label="Cidade" value={client.city} />
              <Info label="UF" value={client.state} />
              <div className="md:col-span-2">
                <Info label="Resumo de Serviços" value={client.services_summary} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <BoolField label="Possui Contrato" value={client.has_contract} />
              <BoolField label="Contrato Assinado" value={client.contract_signed} />
              <Info label="Número do Contrato" value={client.contract_number} />
              <Info label="Início da Vigência" value={client.contract_start_date} />
              <Info label="Fim da Vigência" value={client.contract_end_date} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposta">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <BoolField label="Proposta Aprovada" value={client.proposal_approved} />
              <Info label="Número da Proposta" value={client.proposal_number} />
              <Info label="Data de Aprovação" value={client.approval_date} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anexos">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {!readOnly && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={uploadType} onValueChange={v => setUploadType(v as any)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="proposta">Proposta</SelectItem>
                      <SelectItem value="tabela">Tabela</SelectItem>
                    </SelectContent>
                  </Select>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAttachment.isPending}
                    className="gap-1.5"
                  >
                    {uploadAttachment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Anexar
                  </Button>
                </div>
              )}

              {attachLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum anexo encontrado</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-md border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                            {a.file_name || 'Arquivo'}
                          </a>
                          <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
                        </div>
                      </div>
                      {!readOnly && (
                        <Button variant="ghost" size="icon" onClick={() => deleteAttachment.mutate(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observacoes">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm whitespace-pre-wrap">{client.notes || 'Nenhuma observação registrada.'}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}
