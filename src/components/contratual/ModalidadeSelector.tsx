import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Modalidade {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function ModalidadeSelector({ value, onChange, placeholder = 'Selecione a modalidade' }: Props) {
  const { isAdmMaster } = useAuth();
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['contract_modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_modalidades')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Modalidade[];
    },
  });

  const criar = async () => {
    const n = nome.trim();
    if (!n) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('contract_modalidades')
        .insert({ nome: n })
        .select('id, nome, ativo')
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['contract_modalidades'] });
      onChange(data.id);
      toast.success('Modalidade criada');
      setNome('');
      setNovoOpen(false);
    } catch (e: any) {
      toast.error(
        e?.code === '23505' ? 'Já existe uma modalidade com esse nome' : e.message || 'Erro ao criar modalidade',
      );
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (m: Modalidade) => {
    setRemovendo(m.id);
    try {
      const { count, error: cErr } = await supabase
        .from('contract_contratos')
        .select('id', { count: 'exact', head: true })
        .eq('modalidade_id', m.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        toast.error(`Não é possível excluir — esta modalidade já está em uso em ${count} contrato(s).`);
        return;
      }
      const { error } = await supabase.from('contract_modalidades').delete().eq('id', m.id);
      if (error) throw error;
      if (value === m.id) onChange(null);
      await qc.invalidateQueries({ queryKey: ['contract_modalidades'] });
      toast.success('Modalidade excluída');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir modalidade');
    } finally {
      setRemovendo(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={value ?? undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={isLoading ? 'Carregando…' : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {modalidades.map((m) => (
              <div key={m.id} className="flex items-center">
                <SelectItem value={m.id} className="flex-1">{m.nome}</SelectItem>
                {isAdmMaster && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mr-1 text-muted-foreground hover:text-destructive"
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); excluir(m); }}
                    disabled={removendo === m.id}
                    aria-label={`Excluir modalidade ${m.nome}`}
                  >
                    {removendo === m.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            ))}
            {modalidades.length === 0 && (
              <div className="px-2 py-3 text-sm text-muted-foreground">Nenhuma modalidade cadastrada</div>
            )}
          </SelectContent>
        </Select>
        {isAdmMaster && (
          <Button type="button" variant="outline" size="icon" onClick={() => setNovoOpen(true)} aria-label="Nova modalidade">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Modalidade</DialogTitle>
            <DialogDescription>Cadastre uma nova modalidade de contrato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Nome da modalidade</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Gestão Ocupacional com eSocial"
              onKeyDown={(e) => { if (e.key === 'Enter') criar(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criar} disabled={saving || !nome.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
