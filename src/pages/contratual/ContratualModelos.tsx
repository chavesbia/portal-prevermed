import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Copy, Power } from 'lucide-react';
import { ContratualModeloDialog } from './ContratualModeloDialog';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/contractual/format';

const CATEGORIAS: Record<string, string> = {
  gestao_ocupacional: 'Gestão Ocupacional',
  contrato_por_uso: 'Contrato Por Uso',
  contrato_pontual: 'Contrato Pontual',
  contrato_parceiras: 'Contrato Parceiras',
  outros: 'Outros',
};

interface Props { canEdit: boolean }

export default function ContratualModelos({ canEdit }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*, current_version:contract_template_versions!contract_templates_current_version_fk(id, versao, conteudo_html)')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const handleDuplicate = async (t: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: tpl, error } = await supabase.from('contract_templates').insert({
        nome: `${t.nome} (cópia)`, categoria: t.categoria, descricao: t.descricao,
        ativo: true, versao_atual: 1, created_by: user?.id, updated_by: user?.id,
      }).select().single();
      if (error) throw error;
      const html = t.current_version?.conteudo_html || '';
      const { data: ver } = await supabase.from('contract_template_versions').insert({
        template_id: tpl.id, versao: 1, conteudo_html: html, changelog: 'Duplicado', created_by: user?.id,
      }).select().single();
      await supabase.from('contract_templates').update({ current_version_id: ver?.id }).eq('id', tpl.id);
      toast.success('Modelo duplicado');
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao duplicar');
    }
  };

  const toggleAtivo = async (t: any) => {
    const { error } = await supabase.from('contract_templates').update({ ativo: !t.ativo }).eq('id', t.id);
    if (error) toast.error(error.message);
    else { toast.success(t.ativo ? 'Modelo desativado' : 'Modelo ativado'); qc.invalidateQueries({ queryKey: ['contract-templates'] }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Modelos versionados — editar gera nova versão sem afetar contratos já gerados.
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Modelo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && templates.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum modelo cadastrado.</TableCell></TableRow>
                )}
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.nome}</div>
                      {t.descricao && <div className="text-xs text-muted-foreground">{t.descricao}</div>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{CATEGORIAS[t.categoria] || t.categoria}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">v{t.versao_atual}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={t.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200'}>
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateBR(t.updated_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDuplicate(t)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAtivo(t)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContratualModeloDialog
        open={open}
        onOpenChange={setOpen}
        template={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['contract-templates'] }); setOpen(false); }}
      />
    </div>
  );
}
