import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, FileText, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RetificacaoFormDrawer } from './RetificacaoFormDrawer';

export interface SolicitacaoRow {
  id: string;
  data_solicitacao: string;
  empresa: string;
  cnpj: string;
  unidade: string | null;
  colaborador_nome: string;
  colaborador_cpf: string;
  descricao: string;
  data_retificacao: string | null;
  observacoes: string | null;
  area_id: string | null;
  motivo_id: string | null;
  medico_examinador_id: string | null;
  responsavel_retificacao_id: string | null;
  created_by: string;
  created_by_name: string | null;
  area?: { nome: string } | null;
  motivo?: { nome: string } | null;
  medico?: { nome: string } | null;
}

export function RetificacaoList() {
  const { isAdmMaster } = useAuth();
  const { hasPermission } = useModulePermissions();
  const canCreate = isAdmMaster || hasPermission('/retificacao-asos', 'create');
  const canEdit = isAdmMaster || hasPermission('/retificacao-asos', 'edit');
  const canDelete = isAdmMaster;

  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SolicitacaoRow | null>(null);
  const [toDelete, setToDelete] = useState<SolicitacaoRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['retificacao-solicitacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aso_retificacao_solicitacoes')
        .select(`
          *,
          area:aso_retificacao_areas!area_id(nome),
          motivo:aso_retificacao_motivos!motivo_id(nome),
          medico:aso_retificacao_medicos_examinadores!medico_examinador_id(nome)
        `)
        .order('data_solicitacao', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SolicitacaoRow[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.empresa, r.cnpj, r.colaborador_nome, r.colaborador_cpf, r.area?.nome, r.motivo?.nome]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase
      .from('aso_retificacao_solicitacoes')
      .delete()
      .eq('id', toDelete.id);
    if (error) {
      toast.error('Erro ao excluir solicitação: ' + error.message);
      return;
    }
    toast.success('Solicitação excluída.');
    setToDelete(null);
    qc.invalidateQueries({ queryKey: ['retificacao-solicitacoes'] });
  };

  const openNew = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: SolicitacaoRow) => { setEditing(row); setDrawerOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, CNPJ, colaborador, CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Solicitação</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Data Retificação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma solicitação encontrada.</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.data_solicitacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                <TableCell className="font-medium">{r.empresa}</TableCell>
                <TableCell>{r.cnpj}</TableCell>
                <TableCell>{r.colaborador_nome}</TableCell>
                <TableCell>{r.colaborador_cpf}</TableCell>
                <TableCell>{r.area?.nome ? <Badge variant="secondary">{r.area.nome}</Badge> : '—'}</TableCell>
                <TableCell>{r.motivo?.nome || '—'}</TableCell>
                <TableCell>{r.data_retificacao ? format(new Date(r.data_retificacao + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Detalhes / Editar">
                    {canEdit ? <Pencil className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(r)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RetificacaoFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        solicitacao={editing}
        readOnly={!canEdit && !!editing}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os anexos vinculados também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
