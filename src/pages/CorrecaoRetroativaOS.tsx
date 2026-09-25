import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, Wrench, CheckCircle2 } from 'lucide-react';

interface Item {
  id: string; numero_os: string; empresa: string; tipo: string; status_os: string;
  data_conclusao: string | null; precisa_executor: boolean; precisa_laudo: boolean;
}
interface Opt { id: string; nome: string; conselho?: string; registro?: string }
interface Data { total: number; resolvidos: number; itens: Item[]; profissionais: Opt[]; responsaveis: Opt[]; tipos_laudo: Opt[] }

const fmt = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—');

function Row({ item, data, onSaved }: { item: Item; data: Data; onSaved: () => void }) {
  const [exec, setExec] = useState('');
  const [tipo, setTipo] = useState('');
  const [rt, setRt] = useState('');
  const [emissao, setEmissao] = useState('');
  const [validade, setValidade] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (item.precisa_executor && !exec) return toast({ title: 'Selecione o executor', variant: 'destructive' });
    if (item.precisa_laudo && (!tipo || !rt || !emissao || !validade))
      return toast({ title: 'Preencha todos os dados do laudo', variant: 'destructive' });
    setSaving(true);
    const { data: res, error } = await supabase.rpc('correcao_retroativa_salvar' as any, {
      _item_id: item.id,
      _responsavel_id: item.precisa_executor ? exec : null,
      _laudo: item.precisa_laudo ? { tipo_laudo_id: tipo, responsavel_tecnico_id: rt, data_emissao: emissao, data_validade: validade } : null,
    });
    setSaving(false);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: (res as any)?.resolvido ? 'Item resolvido' : 'Dados salvos' });
    onSaved();
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">OS #{item.numero_os}</span>
          <span className="text-muted-foreground">{item.empresa}</span>
          <Badge variant="outline" className="whitespace-nowrap">{item.tipo}</Badge>
          <Badge variant="secondary" className="whitespace-nowrap">Concluído em {fmt(item.data_conclusao)}</Badge>
          {item.precisa_executor && <Badge variant="destructive" className="whitespace-nowrap">Falta executor</Badge>}
          {item.precisa_laudo && <Badge variant="destructive" className="whitespace-nowrap">Falta laudo</Badge>}
        </div>
        <div className="grid gap-3 md:grid-cols-5 items-end">
          {item.precisa_executor && (
            <div className="space-y-1">
              <Label>Executor</Label>
              <Select value={exec} onValueChange={setExec}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{data.profissionais.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {item.precisa_laudo && (
            <>
              <div className="space-y-1">
                <Label>Tipo de laudo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{data.tipos_laudo.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Responsável técnico</Label>
                <Select value={rt} onValueChange={setRt}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{data.responsaveis.map(r => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.conselho} {r.registro})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Data de emissão</Label><Input type="date" value={emissao} onChange={e => setEmissao(e.target.value)} /></div>
              <div className="space-y-1"><Label>Data de validade</Label><Input type="date" value={validade} onChange={e => setValidade(e.target.value)} /></div>
            </>
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CorrecaoRetroativaOS() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('correcao_retroativa_listar' as any);
    if (error) { setLoadError(error.message); toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' }); return; }
    setLoadError(null);
    setData(d as unknown as Data);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data && loadError) return <div className="flex justify-center h-64 items-center text-muted-foreground">Não foi possível carregar a lista: {loadError}</div>;
  if (!data) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const q = search.trim().toLowerCase();
  const itens = data.itens.filter(i => !q || `${i.numero_os} ${i.empresa} ${i.tipo}`.toLowerCase().includes(q));
  const pct = data.total ? Math.round((data.resolvidos / data.total) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wrench className="h-6 w-6" /> Correção Retroativa de OS</h1>
        <p className="text-muted-foreground">Preencha executor e/ou laudo dos serviços encerrados identificados na varredura. O status da OS não é alterado por esta tela.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Progresso: {data.resolvidos} de {data.total} resolvidos</CardTitle></CardHeader>
        <CardContent><Progress value={pct} /></CardContent>
      </Card>
      {data.itens.length > 0 && <Input placeholder="Buscar por nº OS, empresa ou serviço" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />}
      {data.itens.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Todos os itens foram resolvidos. Nada pendente.</p>
      ) : (
        <div className="space-y-3">{itens.map(i => <Row key={i.id} item={i} data={data} onSaved={load} />)}</div>
      )}
    </div>
  );
}
