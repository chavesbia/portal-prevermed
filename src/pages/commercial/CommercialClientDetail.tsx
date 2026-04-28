import { useState, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useCommercialClients, useClientAttachments } from '@/hooks/useCommercialClients';
import { useClientServices } from '@/hooks/useCommercialServices';
import { computeClientStatus, statusLabels, statusColors } from '@/lib/commercial-status';
import { ArrowLeft, Upload, Trash2, FileText, Loader2, Check, X, ClipboardCheck, Power, PowerOff, Phone, Mail, MessageCircle, User } from 'lucide-react';
import CommercialClientForm from './CommercialClientForm';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { formatRiskGrade } from '@/lib/commercial-constants';

function formatDateBR(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try { return format(parseISO(dateStr), 'dd/MM/yyyy'); } catch { return dateStr; }
}

interface Props {
  clientId: string;
  onBack: () => void;
  readOnly: boolean;
}

export default function CommercialClientDetail({ clientId, onBack, readOnly }: Props) {
  const { clients, updateClient, deleteClient } = useCommercialClients();
  const { attachments, isLoading: attachLoading, uploadAttachment, deleteAttachment } = useClientAttachments(clientId);
  const { clientServices } = useClientServices(clientId);
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                updateClient.mutate({
                  id: clientId,
                  is_active: !client.is_active,
                } as any)
              }
            >
              {client.is_active ? (
                <><PowerOff className="h-4 w-4" /> Inativar</>
              ) : (
                <><Power className="h-4 w-4" /> Reativar</>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5">
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir <strong>{client.company_name}</strong>? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteClient.mutate(clientId);
                      onBack();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{client.company_name}</h2>
        {!client.is_active && (
          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-xs">Inativo</Badge>
        )}
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="proposta">Proposta</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
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
              <Info label="Grau de Risco" value={formatRiskGrade(client.risk_grade)} />
              <Info label="Vidas Ativas" value={String(client.active_lives)} />
              <Info label="Cidade" value={client.city} />
              <Info label="UF" value={client.state} />

              <div className="md:col-span-2 pt-3 mt-2 border-t">
                <p className="text-sm font-semibold text-muted-foreground mb-3">Contato</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoIcon icon={User} label="Nome" value={client.contact_name} />
                  <InfoIcon icon={MessageCircle} label="WhatsApp" value={client.contact_whatsapp} />
                  <InfoIcon icon={Phone} label="Telefone" value={client.contact_phone} />
                  <InfoIcon icon={Mail} label="E-mail" value={client.contact_email} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrato">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <BoolField label="Contrato Elaborado" value={client.has_contract} />
              <BoolField label="Contrato Assinado" value={client.contract_signed} />
              <Info label="Número do Contrato" value={client.contract_number} />
              <Info label="Início da Vigência" value={formatDateBR(client.contract_start_date)} />
              <Info label="Fim da Vigência" value={formatDateBR(client.contract_end_date)} />
              <div className="md:col-span-2 pt-2">
                <Info label="Observações do Contrato" value={client.contract_notes} />
              </div>
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                💡 O contrato assinado pode ser anexado na aba <strong>Anexos</strong> (tipo "Contrato"). Em breve: integração com a plataforma <strong>Autentique</strong> para assinatura digital.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposta">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <BoolField label="Proposta Aprovada" value={client.proposal_approved} />
              <Info label="Número da Proposta" value={client.proposal_number} />
              <Info label="Data de Aprovação" value={formatDateBR(client.approval_date)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Serviços Contratados (TAGs)</p>
                {clientServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum serviço vinculado. Edite o cliente para selecionar.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {clientServices.map(cs => (
                      <Badge key={cs.id} variant="secondary" className="text-xs">
                        {cs.service?.name || '—'}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Info label="Resumo de Serviços (texto livre)" value={client.services_summary} />
              </div>
              <BoolField label="Tabela de Preços Anexada" value={client.pricing_table_attached} />
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                💡 Para anexar a <strong>tabela vigente</strong>, vá na aba <strong>Anexos</strong> e selecione o tipo "Tabela".
              </div>
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

function InfoIcon({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value || '—'}</p>
      </div>
    </div>
  );
}

