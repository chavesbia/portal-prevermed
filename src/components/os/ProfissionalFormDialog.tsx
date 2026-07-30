import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PROFISSIONAL_CATEGORIAS, Profissional, ProfissionalCategoria, ProfissionalTipo } from '@/types/profissionais';
import { useConselhosClasse } from '@/hooks/useConselhosClasse';
import { useProfissionais } from '@/hooks/useProfissionais';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profissional?: Profissional | null;
  onSaved?: (p: Profissional | null) => void;
  /** Pré-preencher nome ao criar (útil para "novo" inline). */
  defaultNome?: string;
  /** Pré-marcar "Pode ser Responsável Técnico" ao criar. */
  defaultPodeRT?: boolean;
}

export function ProfissionalFormDialog({ open, onOpenChange, profissional, onSaved, defaultNome, defaultPodeRT }: Props) {
  const { conselhos } = useConselhosClasse();
  const { add, update } = useProfissionais();

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ProfissionalTipo>('interno');
  const [categoria, setCategoria] = useState<ProfissionalCategoria>('Médico');
  const [conselhoId, setConselhoId] = useState<string>('');
  const [numero, setNumero] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [custo, setCusto] = useState<string>('');
  const [ativo, setAtivo] = useState(true);
  const [podeRT, setPodeRT] = useState(false);
  const [especialidade, setEspecialidade] = useState('');

  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (profissional) {
      setNome(profissional.nome);
      setTipo(profissional.tipo);
      setCategoria(profissional.categoria);
      setConselhoId(profissional.conselho_id || '');
      setNumero(profissional.numero_conselho || '');
      setEmail(profissional.email || '');
      setTelefone(profissional.telefone || '');
      setCusto(profissional.custo_padrao != null ? String(profissional.custo_padrao) : '');
      setAtivo(profissional.ativo);
      setObs(profissional.observacoes || '');
      setPodeRT(!!profissional.pode_ser_responsavel_tecnico);
      setEspecialidade(profissional.especialidade || '');
    } else {
      setNome(defaultNome || '');
      setTipo('interno');
      setCategoria('Médico');
      setConselhoId('');
      setNumero('');
      setEmail('');
      setTelefone('');
      setCusto('');
      setAtivo(true);
      setObs('');
      setPodeRT(false);
      setEspecialidade('');
    }
  }, [open, profissional, defaultNome]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: 'Atenção', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    if (podeRT && (!conselhoId || !numero.trim())) {
      toast({ title: 'Atenção', description: 'Para Responsável Técnico, informe conselho e número de registro.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      tipo,
      categoria,
      conselho_id: conselhoId || null,
      numero_conselho: numero.trim() || null,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      custo_padrao: custo ? Number(custo) : null,
      user_id: null,
      ativo,
      observacoes: obs.trim() || null,
      pode_ser_responsavel_tecnico: podeRT,
      especialidade: especialidade.trim() || null,
    };

    let result: Profissional | null = null;
    if (profissional) {
      const ok = await update(profissional.id, payload);
      if (ok) result = { ...profissional, ...payload } as Profissional;
    } else {
      result = await add(payload as any);
    }
    setSaving(false);
    if (result) {
      onSaved?.(result);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profissional ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          <DialogDescription>Profissionais internos ou externos que executam serviços das OS.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as ProfissionalTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="externo">Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={v => setCategoria(v as ProfissionalCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROFISSIONAL_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch checked={podeRT} onCheckedChange={setPodeRT} id="prof-rt" />
              <Label htmlFor="prof-rt" className="cursor-pointer">Pode ser Responsável Técnico?</Label>
            </div>
            {podeRT && (
              <>
                <p className="text-xs text-muted-foreground">
                  Ao salvar, este profissional é mantido automaticamente no cadastro de Responsáveis Técnicos usado nos Laudos e nas OS.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conselho *</Label>
                    <Select value={conselhoId || 'none'} onValueChange={v => setConselhoId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {conselhos.map(c => <SelectItem key={c.id} value={c.id}>{c.sigla}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nº do Registro *</Label>
                    <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 12345/UF" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Especialidade</Label>
                  <Input value={especialidade} onChange={e => setEspecialidade(e.target.value)} placeholder="Ex: Técnico em Segurança do Trabalho" />
                </div>
              </>
            )}
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Custo padrão (R$)</Label>
              <Input type="number" step="0.01" value={custo} onChange={e => setCusto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={ativo} onCheckedChange={setAtivo} id="prof-ativo" />
                <Label htmlFor="prof-ativo">Ativo</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
