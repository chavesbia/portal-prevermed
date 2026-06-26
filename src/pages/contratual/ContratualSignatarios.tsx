import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Power, Loader2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useContractSignatarios, type ContractSignatario, type SignatarioTipo } from '@/hooks/useContractSignatarios';
import { useAuth } from '@/contexts/AuthContext';
import { CPFInput } from '@/components/contratual/CPFInput';
import { isValidCPF } from '@/lib/contractual/cpf';
import { formatCPF } from '@/lib/contractual/format';

const TIPOS: { key: SignatarioTipo; label: string }[] = [
  { key: 'responsavel_prevermed', label: 'Responsável PreverMed' },
  { key: 'testemunha', label: 'Testemunha' },
];

export default function ContratualSignatarios() {
  const { isAdmMaster } = useAuth() as any;
  const canEdit = !!isAdmMaster;
  const qc = useQueryClient();
  const { data = [], isLoading } = useContractSignatarios(undefined, false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractSignatario | null>(null);

  const grouped = TIPOS.map(t => ({ ...t, items: data.filter(s => s.tipo === t.key) }));

  const toggleAtivo = async (s: ContractSignatario) => {
    const { error } = await supabase.from('contract_signatarios' as any)
      .update({ ativo: !s.ativo }).eq('id', s.id);
    if (error) toast.error(error.message);
    else {
      toast.success(s.ativo ? 'Signatário desativado' : 'Signatário ativado');
      qc.invalidateQueries({ queryKey: ['contract_signatarios'] });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Pré-cadastro de responsáveis pela PreverMed e testemunhas para uso rápido em novos contratos.
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo signatário
          </Button>
        )}
      </div>

      {isLoading && <div className="text-center py-6 text-muted-foreground text-sm">Carregando…</div>}

      {grouped.map(g => (
        <Card key={g.key}>
          <CardContent className="p-0">
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary">{g.label}</Badge>
              <span className="text-xs text-muted-foreground">{g.items.length} cadastros</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-44">CPF</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.items.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                    Nenhum cadastro.
                  </TableCell></TableRow>
                )}
                {g.items.map(s => (
                  <TableRow key={s.id} className={!s.ativo ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-xs font-mono">{formatCPF(s.cpf)}</TableCell>
                    <TableCell className="text-xs">{s.email || '—'}</TableCell>
                    <TableCell className="text-xs">{s.cargo || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={s.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200'}>
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(s); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAtivo(s)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <SignatarioDialog open={open} onOpenChange={setOpen} signatario={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['contract_signatarios'] }); setOpen(false); }} />
    </div>
  );
}

function SignatarioDialog({ open, onOpenChange, signatario, onSaved }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  signatario: ContractSignatario | null; onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<SignatarioTipo>('testemunha');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setTipo('testemunha'); setNome(''); setCpf(''); setEmail(''); setCargo(''); };

  // Sync on open
  if (open && signatario && nome === '' && cpf === '' && tipo === 'testemunha' && signatario.nome) {
    setTipo(signatario.tipo);
    setNome(signatario.nome);
    setCpf(signatario.cpf);
    setEmail(signatario.email || '');
    setCargo(signatario.cargo || '');
  }

  const handleOpenChange = (b: boolean) => {
    if (!b) reset();
    onOpenChange(b);
  };

  const save = async () => {
    if (!nome.trim()) return toast.error('Informe o nome');
    if (!isValidCPF(cpf)) return toast.error('CPF inválido');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        tipo, nome: nome.trim(), cpf, email: email.trim() || null, cargo: cargo.trim() || null,
        updated_by: user?.id,
      };
      if (signatario?.id) {
        const { error } = await supabase.from('contract_signatarios' as any).update(payload).eq('id', signatario.id);
        if (error) throw error;
        toast.success('Signatário atualizado');
      } else {
        const { error } = await supabase.from('contract_signatarios' as any).insert({ ...payload, created_by: user?.id, ativo: true });
        if (error) throw error;
        toast.success('Signatário cadastrado');
      }
      handleOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{signatario ? 'Editar signatário' : 'Novo signatário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as SignatarioTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CPF *</Label>
              <CPFInput value={cpf} onChange={setCpf} required />
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex.: Diretor" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usado para envio à Autentique" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {signatario ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
