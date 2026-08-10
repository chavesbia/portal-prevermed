import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanySelector, type CompanyOption } from '@/components/shared/CompanySelector';
import { UnitSelector } from '@/components/shared/UnitSelector';
import { useResponsaveisTecnicos, useTiposLaudo } from '@/hooks/useOSData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-seleciona a empresa (ex.: quando aberto pelo Painel do Cliente). */
  companyId?: string | null;
  /** Quando informado, o diálogo abre em modo de edição. */
  laudo?: any | null;
  onSaved?: () => void;
}

export function NovoLaudoManualDialog({ open, onOpenChange, companyId, laudo, onSaved }: Props) {
  const { user } = useAuth();
  const { responsaveis } = useResponsaveisTecnicos();
  const { tiposLaudo } = useTiposLaudo();

  const [company, setCompany] = useState<{ id: string; nome: string } | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [tipoLaudoId, setTipoLaudoId] = useState<string>('');
  const [responsavelId, setResponsavelId] = useState<string>('');
  const [dataEmissao, setDataEmissao] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dataValidade, setDataValidade] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUnidadeId(null);
    setTipoLaudoId('');
    setResponsavelId('');
    setDataEmissao(new Date().toISOString().slice(0, 10));
    setDataValidade('');
    setObservacoes('');
    if (!companyId) {
      setCompany(null);
      return;
    }
    supabase
      .from('companies')
      .select('id, razao_social, nome_abreviado')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCompany({ id: data.id, nome: data.nome_abreviado || data.razao_social });
      });
  }, [open, companyId]);

  const tiposAtivos = tiposLaudo.filter((t: any) => t.ativo !== false);
  const tipoSelecionado = tiposAtivos.find((t: any) => t.id === tipoLaudoId);
  const exigeVigencia = !!(tipoSelecionado as any)?.exige_vigencia;

  const handleTipoChange = (id: string) => {
    setTipoLaudoId(id);
    const tipo: any = tiposAtivos.find((t: any) => t.id === id);
    if (tipo?.prazo_vigencia_padrao) {
      const base = dataEmissao ? new Date(`${dataEmissao}T00:00:00`) : new Date();
      base.setDate(base.getDate() + Number(tipo.prazo_vigencia_padrao));
      setDataValidade(base.toISOString().slice(0, 10));
    } else {
      setDataValidade('');
    }
  };

  const handleCompanyChange = (id: string | null, c: CompanyOption | null) => {
    setCompany(id && c ? { id, nome: c.nome_abreviado || c.razao_social } : null);
    setUnidadeId(null);
  };

  const handleSave = async () => {
    if (!company) return toast({ title: 'Empresa obrigatória', description: 'Selecione a empresa do laudo.', variant: 'destructive' });
    if (!tipoLaudoId) return toast({ title: 'Tipo obrigatório', description: 'Selecione o tipo de laudo.', variant: 'destructive' });
    if (!responsavelId) return toast({ title: 'Responsável obrigatório', description: 'Selecione o responsável técnico.', variant: 'destructive' });
    if (!dataEmissao) return toast({ title: 'Data de emissão obrigatória', variant: 'destructive' });
    if (exigeVigencia && !dataValidade) {
      return toast({ title: 'Vigência obrigatória', description: `${(tipoSelecionado as any)?.nome} exige data de validade.`, variant: 'destructive' });
    }

    const rt = responsaveis.find((r) => r.id === responsavelId);
    setSaving(true);
    const { error } = await supabase.from('laudos').insert({
      origem: 'cadastro_manual',
      company_id: company.id,
      unidade_id: unidadeId,
      empresa_cliente: company.nome,
      tipo_laudo_id: tipoLaudoId,
      tipo_laudo_nome: (tipoSelecionado as any)?.nome ?? '',
      tipo_servico: (tipoSelecionado as any)?.nome ?? 'Laudo',
      responsavel_tecnico_id: responsavelId,
      responsavel_tecnico_nome: rt?.nome ?? '',
      responsavel_tecnico_registro: rt ? `${rt.conselho} ${rt.numero_registro}` : '',
      data_emissao: dataEmissao,
      data_validade: dataValidade || null,
      possui_vigencia: !!dataValidade,
      observacoes: observacoes.trim() || null,
      created_by: user?.id ?? null,
    } as any);
    setSaving(false);

    if (error) {
      console.error('Erro ao cadastrar laudo manual:', error);
      toast({ title: 'Erro', description: 'Não foi possível cadastrar o laudo.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Laudo cadastrado', description: 'Laudo manual registrado com sucesso.' });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Laudo Manual</DialogTitle>
          <DialogDescription>
            Cadastro de laudo sem OS — para documentos providenciados pelo próprio cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <CompanySelector value={company?.id ?? null} onChange={handleCompanyChange} hideDuplicateWarning />
          </div>

          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <UnitSelector companyId={company?.id ?? null} value={unidadeId} onChange={(id) => setUnidadeId(id)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Laudo *</Label>
              <Select value={tipoLaudoId} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tiposAtivos.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Responsável Técnico *</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {responsaveis.filter((r) => r.ativo !== false).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} — {r.conselho} {r.numero_registro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Data de Emissão *</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Data de Validade {exigeVigencia ? '*' : ''}</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
              {!exigeVigencia && (tipoSelecionado as any)?.prazo_vigencia_padrao && (
                <p className="text-xs text-muted-foreground">
                  Sugestão de revisão em {(tipoSelecionado as any).prazo_vigencia_padrao} dias — opcional, pode editar ou apagar.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar laudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
