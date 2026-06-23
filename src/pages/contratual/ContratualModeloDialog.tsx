import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TipTapEditor } from '@/components/contratual/TipTapEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  template: any | null;
  onSaved: () => void;
}

export function ContratualModeloDialog({ open, onOpenChange, template, onSaved }: Props) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('outros');
  const [descricao, setDescricao] = useState('');
  const [html, setHtml] = useState('');
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (template) {
      setNome(template.nome || '');
      setCategoria(template.categoria || 'outros');
      setDescricao(template.descricao || '');
      setHtml(template.current_version?.conteudo_html || '');
      setChangelog('');
    } else {
      setNome(''); setCategoria('outros'); setDescricao(''); setHtml(''); setChangelog('');
    }
  }, [template, open]);

  const save = async () => {
    if (!nome.trim()) { toast.error('Informe o nome do modelo'); return; }
    if (!html.trim()) { toast.error('O conteúdo do contrato não pode estar vazio'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (template?.id) {
        // Update header + create new version
        const novaVersao = (template.versao_atual || 1) + 1;
        const { error: e1 } = await supabase.from('contract_templates').update({
          nome, categoria: categoria as any, descricao,
          versao_atual: novaVersao, updated_by: user?.id,
        }).eq('id', template.id);
        if (e1) throw e1;
        const { data: ver, error: e2 } = await supabase.from('contract_template_versions').insert({
          template_id: template.id, versao: novaVersao, conteudo_html: html,
          changelog: changelog || null, created_by: user?.id,
        }).select().single();
        if (e2) throw e2;
        await supabase.from('contract_templates').update({ current_version_id: ver.id }).eq('id', template.id);
        toast.success(`Nova versão v${novaVersao} salva`);
      } else {
        const { data: tpl, error: e1 } = await supabase.from('contract_templates').insert({
          nome, categoria: categoria as any, descricao,
          ativo: true, versao_atual: 1, created_by: user?.id, updated_by: user?.id,
        }).select().single();
        if (e1) throw e1;
        const { data: ver, error: e2 } = await supabase.from('contract_template_versions').insert({
          template_id: tpl.id, versao: 1, conteudo_html: html, changelog: 'Versão inicial', created_by: user?.id,
        }).select().single();
        if (e2) throw e2;
        await supabase.from('contract_templates').update({ current_version_id: ver.id }).eq('id', tpl.id);
        toast.success('Modelo criado');
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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? `Editar modelo — v${template.versao_atual}` : 'Novo modelo de contrato'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gestao_ocupacional">Gestão Ocupacional</SelectItem>
                  <SelectItem value="contrato_por_uso">Contrato Por Uso</SelectItem>
                  <SelectItem value="contrato_pontual">Contrato Pontual</SelectItem>
                  <SelectItem value="contrato_parceiras">Contrato Parceiras</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Conteúdo do contrato</Label>
            <TipTapEditor value={html} onChange={setHtml} minHeight={420} />
            <p className="text-xs text-muted-foreground">
              Use o botão "Placeholder" para inserir campos dinâmicos. Eles serão substituídos automaticamente na geração.
            </p>
          </div>

          {template && (
            <div className="space-y-1">
              <Label>Changelog (opcional)</Label>
              <Input value={changelog} onChange={e => setChangelog(e.target.value)}
                placeholder="Ex.: ajuste na cláusula de reajuste" />
              <p className="text-xs text-amber-600">
                Salvar criará a versão <strong>v{(template.versao_atual || 1) + 1}</strong>. Contratos antigos continuam vinculados à versão original.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {template ? 'Salvar nova versão' : 'Criar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
