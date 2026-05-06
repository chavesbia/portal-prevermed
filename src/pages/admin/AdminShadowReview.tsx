import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Shield, Check, X, RefreshCw, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ShadowRow {
  id: string;
  permission_id: string;
  template_id: string;
  match_type: 'exact' | 'closest' | string;
  diff: Record<string, { current: boolean; template: boolean }> | null;
  computed_at: string;
  review_status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  review_notes: string | null;
  // joined
  user_name?: string;
  user_email?: string;
  module_name?: string;
  module_route?: string;
  template_name?: string;
  template_slug?: string;
  current_perms?: {
    can_view: boolean; can_create: boolean; can_edit: boolean;
    can_delete: boolean; can_approve: boolean;
  };
}

const FLAGS: Array<keyof NonNullable<ShadowRow['current_perms']>> = [
  'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve',
];
const FLAG_LABELS: Record<string, string> = {
  can_view: 'Visualizar',
  can_create: 'Criar',
  can_edit: 'Editar',
  can_delete: 'Excluir',
  can_approve: 'Aprovar',
};

export default function AdminShadowReview() {
  const [rows, setRows] = useState<ShadowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<ShadowRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: shadows, error } = await supabase
      .from('permission_template_shadow')
      .select('*')
      .order('computed_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar mapeamentos');
      setLoading(false);
      return;
    }

    const permIds = [...new Set(shadows.map((s: any) => s.permission_id))];
    const tplIds = [...new Set(shadows.map((s: any) => s.template_id))];

    const [{ data: perms }, { data: tpls }] = await Promise.all([
      supabase.from('permissions').select('id,user_id,module_id,can_view,can_create,can_edit,can_delete,can_approve').in('id', permIds),
      supabase.from('role_templates').select('id,slug,name').in('id', tplIds),
    ]);

    const userIds = [...new Set((perms || []).map((p: any) => p.user_id))];
    const modIds = [...new Set((perms || []).map((p: any) => p.module_id))];
    const [{ data: profiles }, { data: modules }] = await Promise.all([
      supabase.from('profiles').select('user_id,full_name,email').in('user_id', userIds),
      supabase.from('modules').select('id,name,route').in('id', modIds),
    ]);

    const permMap = new Map((perms || []).map((p: any) => [p.id, p]));
    const tplMap = new Map((tpls || []).map((t: any) => [t.id, t]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const moduleMap = new Map((modules || []).map((m: any) => [m.id, m]));

    const enriched: ShadowRow[] = shadows.map((s: any) => {
      const p = permMap.get(s.permission_id);
      const t = tplMap.get(s.template_id);
      const prof = p ? profileMap.get(p.user_id) : null;
      const mod = p ? moduleMap.get(p.module_id) : null;
      return {
        ...s,
        user_name: prof?.full_name,
        user_email: prof?.email,
        module_name: mod?.name,
        module_route: mod?.route,
        template_name: t?.name,
        template_slug: t?.slug,
        current_perms: p ? {
          can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit,
          can_delete: p.can_delete, can_approve: p.can_approve,
        } : undefined,
      };
    });
    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (r.review_status !== tab) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return [r.user_name, r.user_email, r.module_name, r.module_route, r.template_name]
        .some(v => v?.toLowerCase().includes(s));
    });
  }, [rows, tab, search]);

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.review_status === 'pending').length,
    approved: rows.filter(r => r.review_status === 'approved').length,
    rejected: rows.filter(r => r.review_status === 'rejected').length,
  }), [rows]);

  const submit = async () => {
    if (!selected || !action) return;
    setSubmitting(true);
    const fn = action === 'approve' ? 'apply_shadow_template' : 'reject_shadow_template';
    const { error } = await supabase.rpc(fn as any, {
      _shadow_id: selected.id,
      _notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(action === 'approve' ? 'Mapeamento aprovado e aplicado' : 'Mapeamento rejeitado');
    setSelected(null); setAction(null); setNotes('');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Revisão de Mapeamento Sombra
          </h1>
          <p className="text-sm text-muted-foreground">
            Revise e aprove o mapeamento de permissões individuais para os templates de role antes de aplicá-los.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Mapeamentos</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar usuário, módulo ou template..."
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
              <TabsTrigger value="approved">Aprovados ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados ({counts.rejected})</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Divergências</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {loading ? 'Carregando...' : 'Nenhum mapeamento neste status'}
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map(r => {
                      const diffKeys = r.diff ? Object.keys(r.diff) : [];
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.user_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{r.user_email}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.module_name}</div>
                            <div className="text-xs text-muted-foreground">{r.module_route}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.template_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.match_type === 'exact' ? 'default' : 'secondary'}>
                              {r.match_type === 'exact' ? 'Exato' : 'Aproximado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {diffKeys.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Nenhuma</span>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                {diffKeys.length} flag(s)
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => { setSelected(r); setAction(null); setNotes(''); }}>
                              Revisar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar mapeamento</DialogTitle>
            <DialogDescription>
              Compare as permissões atuais do usuário com o template sugerido.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Usuário</div>
                  <div className="font-medium">{selected.user_name}</div>
                  <div className="text-xs text-muted-foreground">{selected.user_email}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Módulo</div>
                  <div className="font-medium">{selected.module_name}</div>
                  <div className="text-xs text-muted-foreground">{selected.module_route}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Template sugerido</div>
                  <div className="font-medium">{selected.template_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tipo de match</div>
                  <Badge variant={selected.match_type === 'exact' ? 'default' : 'secondary'}>
                    {selected.match_type === 'exact' ? 'Exato' : 'Aproximado'}
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Atual</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FLAGS.map(f => {
                      const current = selected.current_perms?.[f];
                      const diffEntry = selected.diff?.[f];
                      const tplVal = diffEntry?.template ?? current;
                      const changed = !!diffEntry;
                      return (
                        <TableRow key={f} className={changed ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                          <TableCell>{FLAG_LABELS[f]}</TableCell>
                          <TableCell>{current ? '✓' : '—'}</TableCell>
                          <TableCell>{tplVal ? '✓' : '—'}</TableCell>
                          <TableCell>{changed ? <Badge variant="outline" className="text-amber-600 border-amber-600">Alterar</Badge> : null}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {selected.review_status === 'pending' && (
                <Textarea
                  placeholder="Observação (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              )}

              {selected.review_status !== 'pending' && (
                <div className="text-sm text-muted-foreground">
                  Revisado em {selected.reviewed_at ? new Date(selected.reviewed_at).toLocaleString('pt-BR') : '—'}.
                  {selected.review_notes && <div className="mt-1">Observação: {selected.review_notes}</div>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selected?.review_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setAction('reject'); submit(); }}
                  disabled={submitting}
                >
                  <X className="h-4 w-4 mr-2" /> Rejeitar
                </Button>
                <Button
                  onClick={() => { setAction('approve'); submit(); }}
                  disabled={submitting}
                >
                  <Check className="h-4 w-4 mr-2" /> Aprovar e aplicar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
