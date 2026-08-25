import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OrdemServico, ServicoOS, StatusOS, STATUS_OS_OPTIONS, statusOSColors, statusServicoColors } from '@/types/os';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { OSCustosTab } from './OSCustosTab';
import { Printer, Timer } from 'lucide-react';
import { elapsedMs, formatDuration } from '@/lib/os/cronometro';
import { generateOSPdf } from '@/lib/os/pdf';


import { OSAnexosTab } from './OSAnexosTab';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useAuth } from '@/contexts/AuthContext';

interface OSDetailDialogProps {
  ordem: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: StatusOS, comment?: string) => Promise<boolean>;
}

function formatCnpj(v: string | null | undefined) {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatEndereco(c: any) {
  const linha1 = [c?.logradouro, c?.numero].filter(Boolean).join(', ');
  const partes = [linha1, c?.complemento, c?.bairro, [c?.cidade, c?.estado].filter(Boolean).join(' - '), c?.cep]
    .map((p: any) => (typeof p === 'string' ? p.trim() : p))
    .filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}



export function OSDetailDialog({ ordem, open, onOpenChange, onUpdateStatus }: OSDetailDialogProps) {
  const [newStatus, setNewStatus] = useState<StatusOS>(ordem.status_os as StatusOS);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [emissorNome, setEmissorNome] = useState<string | null>(null);
  const [empresaCnpj, setEmpresaCnpj] = useState<string | null>(null);
  const [empresaEndereco, setEmpresaEndereco] = useState<string | null>(null);

  const [servicos, setServicos] = useState<ServicoOS[]>([]);
  const { getModulePermissions } = useModulePermissions();
  const { user } = useAuth();
  
  const permissions = getModulePermissions('/gestao-os');
  const hasGlobalEdit = permissions?.can_edit ?? false;
  
  // O emissor pode editar se a OS ainda não foi iniciada (status "Não iniciado")
  const isEmissor = user?.id === ordem.created_by;
  const isNaoIniciado = ordem.status_os === 'Não iniciado';
  const canEdit = hasGlobalEdit || (isEmissor && isNaoIniciado);


  useEffect(() => {
    if (!open || !ordem.created_by) { setEmissorNome(null); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', ordem.created_by)
        .maybeSingle();
      setEmissorNome((data as any)?.full_name || null);
    })();
  }, [open, ordem.created_by]);

  useEffect(() => {
    const companyId = (ordem as any).company_id as string | undefined;
    if (!open || !companyId) { setEmpresaCnpj(null); setEmpresaEndereco(null); return; }
    (async () => {
      const { data } = await supabase
        .from('companies')
        .select('cnpj, logradouro, numero, complemento, bairro, cidade, estado, cep')
        .eq('id', companyId)
        .maybeSingle();
      const c = data as any;
      setEmpresaCnpj(c?.cnpj || null);
      setEmpresaEndereco(c ? formatEndereco(c) : null);
    })();
  }, [open, (ordem as any).company_id]);




  useEffect(() => {
    if (!open) return;
    if (ordem.servicos && ordem.servicos.length) { setServicos(ordem.servicos); return; }
    (async () => {
      const { data } = await supabase
        .from('servicos_os')
        .select('*')
        .eq('ordem_id', ordem.id)
        .order('created_at');
      setServicos((data || []) as unknown as ServicoOS[]);
    })();
  }, [open, ordem.id, ordem.servicos]);

  // Cronômetro OS: início = data_emissao (fallback data_registro); fim = updated_at se Encerrado
  const osStart = ordem.data_emissao || ordem.data_registro;
  const osEnd = ordem.status_os === 'Encerrado' ? ordem.updated_at : null;
  const osElapsed = elapsedMs(osStart, osEnd);

  const handleUpdate = async () => {
    if (newStatus !== ordem.status_os || comentario) {
      setSaving(true);
      await onUpdateStatus(ordem.id, newStatus, comentario);
      setSaving(false);
      setComentario('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>OS #{ordem.numero_os}</span>
            <Badge className={statusOSColors[ordem.status_os]}>{ordem.status_os}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="mt-2">
          <TabsList>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="mt-4">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Cliente</Label>
                  <p className="font-medium">{ordem.empresa_cliente}</p>
                  {empresaCnpj && (
                    <p className="text-xs text-muted-foreground">CNPJ: {formatCnpj(empresaCnpj)}</p>
                  )}
                </div>
                {empresaEndereco && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Endereço do CNPJ</Label>
                    <p className="font-medium">{empresaEndereco}</p>
                    <p className="text-xs text-muted-foreground">
                      Confirme o local real da visita — nem sempre coincide com o endereço do CNPJ.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Contato do Cliente</Label>
                  <p className="font-medium">{ordem.contato_cliente || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">E-mail</Label>
                  <p className="font-medium text-sm">{ordem.contato_email || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Telefone</Label>
                  <p className="font-medium text-sm">{ordem.contato_telefone || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Serviços</Label>
                  <p className="font-medium">{ordem.tipo_servico_resumo || '-'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Emissor da OS</Label>
                  <p className="font-medium">{emissorNome || ordem.responsavel_atual || '—'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Data de Emissão</Label>
                  <p className="font-medium">{format(parseISO(ordem.data_emissao || ordem.data_registro), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
                {ordem.prazo_acordado && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Prazo de Entrega</Label>
                    <p className="font-medium">{format(parseISO(ordem.prazo_acordado), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                )}
              </div>

              {ordem.observacoes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="rounded-lg bg-muted p-3 text-sm">{ordem.observacoes}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" /> Cronômetro
                </h4>
                <div className="rounded-lg border p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Tempo total da OS</div>
                    <div className="font-medium">{formatDuration(osElapsed)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {osStart && <>Início: {format(parseISO(osStart), 'dd/MM/yyyy', { locale: ptBR })}</>}<br />
                    {osEnd
                      ? <>Encerrado: {format(parseISO(osEnd), 'dd/MM/yyyy', { locale: ptBR })}</>
                      : <span className="text-emerald-600">Em andamento</span>}
                  </div>
                </div>
                {servicos.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Por serviço</Label>
                    <div className="rounded-lg border divide-y">
                      {servicos.map(s => {
                        const sEnd = s.status === 'Encerrado' ? (s.data_conclusao || s.updated_at) : null;
                        const sMs = elapsedMs(s.data_inicio, sEnd);
                        return (
                          <div key={s.id} className="flex items-center justify-between p-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{s.tipo}</span>
                              <Badge className={statusServicoColors[s.status] + ' text-[10px]'}>{s.status}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {s.data_inicio ? formatDuration(sMs) : 'não iniciado'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>


              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Atualizar Status</h4>
                <div className="space-y-2">
                  <Label>Novo Status</Label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusOS)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comentário</Label>
                  <Textarea placeholder="Adicione um comentário..." value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="custos" className="mt-4">
            <OSCustosTab ordem={ordem} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="anexos" className="mt-4">
            <OSAnexosTab ordem={ordem} canEdit={canEdit} />
          </TabsContent>
        </Tabs>


      </DialogContent>
    </Dialog>
  );
}
