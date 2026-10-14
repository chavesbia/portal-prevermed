import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { EXAMES_SOC } from "@/data/examesSoc";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const NAO_LAB = /RAIO|\bRX\b|AUDIO|ACUIDADE|ATESTADO|ELETRO|ESPIRO|AVALIA|CLINIC|TESTE|PSICO|ULTRA|TOMO|RESSON|OFTAL|DINAMOM|LAUDO|CONSULTA|MAMO|DENSIT|ERGOM|ECOCARD|HOLTER|MAPA|FOTO|RADIO/;
const GRUPOS: { nome: string; f: (n: string) => boolean }[] = [
  { nome: "Raio-X", f: (n) => /RAIO|\bRX\b|RADIO/.test(n) },
  { nome: "Audiometrias", f: (n) => n.includes("AUDIO") },
  { nome: "Visuais", f: (n) => /ACUIDADE|OFTAL/.test(n) },
  { nome: "Psicológicos", f: (n) => n.includes("PSICO") },
  { nome: "Laboratoriais", f: (n) => !NAO_LAB.test(n) },
];
const sel = "flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs";
const vazio = { unidade_id: "", dias_semana: [1, 2, 3, 4, 5] as number[], hora_inicio: "07:00", hora_fim: "16:00", antecedencia_dias: "0", parceiro: false, observacao: "", nao_agendavel: false };

type Props = {
  regras: any[]; unidades: any[]; nomeUn: (id: string | null) => string;
  salvar: (linhas: any[], editId?: string) => Promise<boolean>;
  ativar: (id: string, v: boolean) => void; remover: (id: string) => void;
};

export function RegrasExames({ regras, unidades, nomeUn, salvar, ativar, remover }: Props) {
  const [f, setF] = useState(vazio);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [visao, setVisao] = useState<"com" | "sem" | "nao">("com");
  const [fUn, setFUn] = useState("todas");
  const [fDia, setFDia] = useState("");
  const [fGrupo, setFGrupo] = useState("");
  const [fTipo, setFTipo] = useState("");
  const noGrupo = (n: string) => !fGrupo || !!GRUPOS.find((g) => g.nome === fGrupo)?.f(norm(n));
  const filtradas = regras.filter((r) => (visao === "nao") === !!r.nao_agendavel
    && (fUn === "todas" || (fUn === "" ? !r.unidade_id : r.unidade_id === fUn))
    && (!fDia || r.dias_semana.includes(Number(fDia)))
    && noGrupo(r.exame_nome)
    && (!fTipo || (fTipo === "parceiro" ? r.parceiro : fTipo === "inativa" ? !r.ativo : r.ativo)));
  const qtdNao = regras.filter((r) => r.nao_agendavel).length;

  const comRegra = useMemo(() => new Set(regras.map((r) => norm(r.exame_nome))), [regras]);
  const semRegra = EXAMES_SOC.filter((e) => !comRegra.has(norm(e.nome)));
  const lista = EXAMES_SOC.filter((e) => !busca || norm(e.nome).includes(norm(busca)));
  const toggle = (n: string) => setMarcados((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));
  const grupo = (g: (typeof GRUPOS)[number]) => {
    const nomes = EXAMES_SOC.map((e) => e.nome).filter((n) => g.f(norm(n)));
    const todos = nomes.every((n) => marcados.includes(n));
    setMarcados((m) => (todos ? m.filter((x) => !nomes.includes(x)) : [...new Set([...m, ...nomes])]));
  };
  const limpar = () => { setF(vazio); setMarcados([]); setEditId(null); };
  const editar = (r: any) => {
    setEditId(r.id); setMarcados([r.exame_nome]);
    setF({ unidade_id: r.unidade_id ?? "", dias_semana: r.dias_semana, hora_inicio: r.hora_inicio.slice(0, 5), hora_fim: r.hora_fim.slice(0, 5), antecedencia_dias: String(r.antecedencia_dias), parceiro: r.parceiro, observacao: r.observacao ?? "", nao_agendavel: !!r.nao_agendavel });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const gravar = async () => {
    const base = { unidade_id: f.unidade_id || null, dias_semana: f.dias_semana, hora_inicio: f.hora_inicio, hora_fim: f.hora_fim, antecedencia_dias: Number(f.antecedencia_dias) || 0, parceiro: f.parceiro, observacao: f.observacao.trim() || null, nao_agendavel: f.nao_agendavel };
    if (await salvar(marcados.map((n) => ({ ...base, exame_nome: n })), editId ?? undefined)) limpar();
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-md border p-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Exames {editId ? "(editando)" : "— marque um ou vários"}</Label>
            <Badge variant="secondary" className="whitespace-nowrap">{marcados.length} selecionado(s)</Badge>
          </div>
          {!editId && <div className="flex flex-wrap gap-1">{GRUPOS.map((g) => <Button key={g.nome} size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => grupo(g)}>{g.nome}</Button>)}
            {marcados.length > 0 && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setMarcados([])}>Limpar</Button>}</div>}
          {!editId && <Input className="h-8 text-xs" placeholder="Buscar exame..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {(editId ? marcados.map((nome) => ({ nome })) : lista).map((e) => (
              <label key={e.nome} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted cursor-pointer">
                <Checkbox checked={marcados.includes(e.nome)} disabled={!!editId} onCheckedChange={() => toggle(e.nome)} className="h-3.5 w-3.5" />
                <span className="flex-1">{e.nome}</span>
                {comRegra.has(norm(e.nome)) && <Badge variant="outline" className="h-4 px-1 text-[10px] whitespace-nowrap">com regra</Badge>}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-2 space-y-2">
          <label className="flex items-center gap-2 font-medium"><Switch checked={f.nao_agendavel} onCheckedChange={(v) => setF({ ...f, nao_agendavel: v })} />Não agendável</label>
          {f.nao_agendavel && <p className="text-[11px] text-muted-foreground">O exame sai da busca de exames do WhatsApp e da página de agendamento. Se vier do PCMSO, o agendamento segue e o cliente é avisado que a equipe entrará em contato.</p>}
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Unidade</Label><select className={sel} value={f.unidade_id} onChange={(e) => setF({ ...f, unidade_id: e.target.value })}><option value="">Todas</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
            {!f.nao_agendavel && <><div><Label className="text-xs">Antecedência (dias)</Label><Input type="number" min={0} className="h-8 text-xs" value={f.antecedencia_dias} onChange={(e) => setF({ ...f, antecedencia_dias: e.target.value })} /></div>
            <div><Label className="text-xs">Das</Label><Input type="time" className="h-8 text-xs" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
            <div><Label className="text-xs">Até</Label><Input type="time" className="h-8 text-xs" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} /></div></>}
          </div>
          {!f.nao_agendavel && <>
          <div><Label className="text-xs">Dias da semana</Label>
            <div className="flex flex-wrap gap-1">{DIAS.map((n, d) => (
              <Button key={d} type="button" size="sm" className="h-6 px-2 text-xs" variant={f.dias_semana.includes(d) ? "default" : "outline"} onClick={() => setF({ ...f, dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter((x) => x !== d) : [...f.dias_semana, d].sort() })}>{n}</Button>
            ))}</div></div>
          <label className="flex items-center gap-2"><Switch checked={f.parceiro} onCheckedChange={(v) => setF({ ...f, parceiro: v })} />Realizado em clínica parceira</label>
          <p className="text-[11px] text-muted-foreground">Use quando o exame não é feito na PreverMed. O cliente é avisado no agendamento.</p>
          <div><Label className="text-xs">Orientação ao cliente (preparo)</Label><Input className="h-8 text-xs" value={f.observacao} maxLength={200} placeholder="Ex.: Jejum de 8 horas / Repouso auditivo de 14 horas" onChange={(e) => setF({ ...f, observacao: e.target.value })} />
            <p className="mt-1 text-[11px] text-muted-foreground">Aparece para o cliente na página de agendamento e no WhatsApp, junto ao horário do exame.</p></div></>}
          <div className="flex gap-2">
            <Button size="sm" className="h-8" disabled={!marcados.length || (!f.nao_agendavel && (!f.dias_semana.length || f.hora_fim <= f.hora_inicio))} onClick={gravar}>
              {editId ? <><Pencil className="mr-1 h-3.5 w-3.5" />Salvar alteração</> : <><Plus className="mr-1 h-3.5 w-3.5" />Aplicar a {marcados.length} exame(s)</>}
            </Button>
            {editId && <Button size="sm" variant="ghost" className="h-8" onClick={limpar}><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        <Button size="sm" className="h-7 text-xs" variant={visao === "com" ? "default" : "outline"} onClick={() => setVisao("com")}>Com regra própria ({regras.length - qtdNao})</Button>
        <Button size="sm" className="h-7 text-xs" variant={visao === "sem" ? "default" : "outline"} onClick={() => setVisao("sem")}>Seguem horário da unidade ({semRegra.length})</Button>
        <Button size="sm" className="h-7 text-xs" variant={visao === "nao" ? "default" : "outline"} onClick={() => setVisao("nao")}>Não agendáveis ({qtdNao})</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {visao !== "sem" && <select className={sel + " w-36"} value={fUn} onChange={(e) => setFUn(e.target.value)}><option value="todas">Unidade: todas</option><option value="">Regra geral</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}
        {visao === "com" && <select className={sel + " w-32"} value={fDia} onChange={(e) => setFDia(e.target.value)}><option value="">Dia: todos</option>{DIAS.map((n, d) => <option key={d} value={d}>{n}</option>)}</select>}
        <select className={sel + " w-36"} value={fGrupo} onChange={(e) => setFGrupo(e.target.value)}><option value="">Grupo: todos</option>{GRUPOS.map((g) => <option key={g.nome}>{g.nome}</option>)}</select>
        {visao === "com" && <select className={sel + " w-32"} value={fTipo} onChange={(e) => setFTipo(e.target.value)}><option value="">Situação: todas</option><option value="parceiro">Parceiro</option><option value="ativa">Ativas</option><option value="inativa">Inativas</option></select>}
      </div>

      {visao !== "sem" ? (
        <Table className="text-xs">
          <TableHeader><TableRow><TableHead className="h-8">Exame</TableHead><TableHead className="h-8">Unidade</TableHead><TableHead className="h-8">Dias</TableHead><TableHead className="h-8">Horário</TableHead><TableHead className="h-8">Antec.</TableHead><TableHead className="h-8">Orientação</TableHead><TableHead className="h-8">Ativa</TableHead><TableHead className="h-8" /></TableRow></TableHeader>
          <TableBody>
            {filtradas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-1 font-medium">{r.exame_nome}{r.parceiro && <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px] whitespace-nowrap">Parceiro</Badge>}</TableCell>
                <TableCell className="py-1 whitespace-nowrap">{nomeUn(r.unidade_id)}</TableCell>
                <TableCell className="py-1 whitespace-nowrap">{r.nao_agendavel ? "-" : r.dias_semana.map((d: number) => DIAS[d]).join(", ")}</TableCell>
                <TableCell className="py-1 whitespace-nowrap">{r.nao_agendavel ? "-" : `${r.hora_inicio.slice(0, 5)}–${r.hora_fim.slice(0, 5)}`}</TableCell>
                <TableCell className="py-1 whitespace-nowrap">{r.nao_agendavel ? "-" : `${r.antecedencia_dias} d`}</TableCell>
                <TableCell className="py-1 text-muted-foreground">{r.observacao ?? "-"}</TableCell>
                <TableCell className="py-1"><Switch checked={r.ativo} onCheckedChange={(v) => ativar(r.id, v)} /></TableCell>
                <TableCell className="py-1 whitespace-nowrap">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editar(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remover(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!filtradas.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma regra encontrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      ) : (
        <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-3">{semRegra.filter((e) => noGrupo(e.nome)).map((e) => <div key={e.nome} className="truncate">{e.nome}</div>)}</div>
      )}
    </div>
  );
}
