import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, FlaskConical, Search } from "lucide-react";
import { toast } from "sonner";

type Exame = {
  id: string; origem: string; sequencial_ficha: string; data_ficha: string | null; tipo_ficha: string | null;
  cpf: string; funcionario_nome: string | null; funcionario_codigo: string | null; empresa_codigo: string | null; empresa_nome: string | null;
  assessoria_nome: string | null; exame_nome: string; prestador_codigo: string | null; prestador_nome: string | null;
  nao_compareceu_em: string | null; nao_compareceu_por: string | null; nao_compareceu_obs: string | null;
  atendido_depois?: string | null;
};
type Contato = { id: string; texto: string; user_id: string; created_at: string };
type Motivo = { sequencial_ficha: string; motivo: string; observacao: string | null; atualizado_por: string; atualizado_em: string };

export const MOTIVOS: Record<string, { label: string; cor: string }> = {
  aguardando_laudo: { label: "Aguardando Laudo", cor: "bg-primary/10 text-primary border-primary/30" },
  aguardando_empresa: { label: "Aguardando Empresa", cor: "bg-warning/15 text-warning border-warning/30" },
  aguardando_colaborador: { label: "Aguardando Colaborador", cor: "bg-accent text-accent-foreground border-border" },
  em_analise_medica: { label: "Em Análise Médica", cor: "bg-success/15 text-success border-success/30" },
  outro: { label: "Outro", cor: "bg-muted text-muted-foreground border-border" },
};

const db = supabase as any;
const sel = "h-8 rounded-md border border-input bg-background px-2 text-xs";
const titulo = (t: string | null) => (t ?? "").toUpperCase();
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const cpfMask = (c: string) => `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
// Prestador de referência vem da base de origem (SOCNET), sem código nosso: unidade é deduzida pelo nome
export const unidadeDoPrestador = (nome: string | null): "lapa" | "osasco" | null =>
  /LAPA/i.test(nome ?? "") ? "lapa" : /OSASCO/i.test(nome ?? "") ? "osasco" : null;
export const diasEspera = (dataFicha: string | null, hoje = new Date()) => {
  if (!dataFicha) return 0;
  const [a, m, d] = dataFicha.split("-").map(Number);
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((h - Date.UTC(a, m - 1, d)) / 864e5));
};
export const faixa = (dias: number) => (dias <= 2 ? "recente" : dias <= 5 ? "atencao" : "atrasado");
const FAIXA_COR: Record<string, string> = {
  recente: "bg-success/15 text-success border-success/30",
  atencao: "bg-warning/15 text-warning border-warning/30",
  atrasado: "bg-destructive/15 text-destructive border-destructive/30",
};
const UNID: Record<string, string> = { lapa: "Lapa", osasco: "Osasco" };

// Carteira própria: só entram prestadores classificados como Lapa/Osasco/Ambas em Admin > Prestadores
// (credenciados e In Loco ficam fora). SOCNET: só entra quando o prestador de referência é PreverMed (Lapa/Osasco); Imtep, Focus etc. ficam fora.
// Nada sai do painel sozinho: atendimento posterior na carteira própria vira só um aviso (atendido_depois).
async function carregar(): Promise<Exame[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: prs, error: ep } = await db.from("soc_prestadores").select("codigo,unidade_responsavel").not("unidade_responsavel", "is", null);
  if (ep) throw ep;
  const mapa = new Map<string, string>((prs ?? []).map((p: any) => [String(p.codigo), p.unidade_responsavel]));
  const atendido = new Map<string, string>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("soc_exames_pendentes").select("cpf,data_ficha")
      .eq("origem", "propria").not("data_resultado", "is", null).order("id").range(de, de + 999);
    if (error) throw error;
    for (const r of data) if (r.data_ficha && (atendido.get(r.cpf) ?? "") < r.data_ficha) atendido.set(r.cpf, r.data_ficha);
    if (data.length < 1000) break;
  }
  const out: Exame[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("soc_exames_pendentes")
      .select("id,origem,sequencial_ficha,data_ficha,tipo_ficha,cpf,funcionario_nome,funcionario_codigo,empresa_codigo,empresa_nome,assessoria_nome,exame_nome,prestador_codigo,prestador_nome,nao_compareceu_em,nao_compareceu_por,nao_compareceu_obs")
      .is("data_resultado", null).is("resolvido_em", null).lte("data_ficha", hoje).order("data_ficha").range(de, de + 999);
    if (error) throw error;
    for (const e of data) {
      if (e.origem === "socnet") {
        if (!/PREVER/i.test(e.prestador_nome ?? "")) continue;
        const a = atendido.get(e.cpf);
        out.push({ ...e, atendido_depois: a && e.data_ficha && a > e.data_ficha ? a : null }); continue;
      }
      const u = mapa.get(String(e.prestador_codigo ?? ""));
      if (u) out.push({ ...e, unidade_cadastro: u });
    }
    if (data.length < 1000) return out;
  }
}

async function carregarMotivos(): Promise<Map<string, Motivo>> {
  const m = new Map<string, Motivo>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("soc_exames_pendentes_motivos").select("*").range(de, de + 999);
    if (error) throw error;
    for (const r of data) m.set(r.sequencial_ficha, r);
    if (data.length < 1000) return m;
  }
}

export default function ExamesPendentes() {
  const [sp, setSp] = useSearchParams();
  const busca = sp.get("q") ?? "";
  const unidade = sp.get("u") ?? "";
  const origem = sp.get("o") ?? "";
  const prest = sp.get("p") ?? "";
  const exameF = sp.get("e") ?? "";
  const faixaF = sp.get("f") ?? "";
  const aberto = sp.get("ficha");
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };

  const aba = sp.get("aba") === "nc" ? "nc" : "";
  const motivoF = sp.get("m") ?? "";
  const { data = [], isLoading } = useQuery({ queryKey: ["exames-pendentes"], queryFn: carregar });
  const { data: motivos = new Map<string, Motivo>() } = useQuery({ queryKey: ["exames-pendentes-motivos"], queryFn: carregarMotivos });

  const todos = useMemo(() => data.map((e) => {
    const dias = diasEspera(e.data_ficha);
    const uc = (e as any).unidade_cadastro as string | undefined;
    const u = uc === "ambas" ? unidadeDoPrestador(e.prestador_nome) : (uc as "lapa" | "osasco" | undefined) ?? unidadeDoPrestador(e.prestador_nome);
    return { ...e, dias, faixa: faixa(dias), unidade: u, motivo: motivos.get(e.sequencial_ficha)?.motivo ?? "" };
  }), [data, motivos]);
  const fichasNc = useMemo(() => new Set(todos.filter((e) => e.nao_compareceu_em).map((e) => e.sequencial_ficha)).size, [todos]);
  const enriquecidos = useMemo(() => todos.filter((e) => (aba === "nc") === !!e.nao_compareceu_em), [todos, aba]);

  const prestadores = useMemo(() => [...new Set(enriquecidos.map((e) => e.prestador_nome ?? ""))].filter(Boolean).sort(), [enriquecidos]);
  const examesLista = useMemo(() => [...new Set(enriquecidos.map((e) => e.exame_nome))].sort(), [enriquecidos]);

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const qd = q.replace(/\D/g, "");
    return enriquecidos.filter((e) =>
      (!unidade || (unidade === "nd" ? !e.unidade : e.unidade === unidade)) &&
      (!origem || e.origem === origem) && (!prest || e.prestador_nome === prest) &&
      (!exameF || e.exame_nome === exameF) && (!faixaF || e.faixa === faixaF) &&
      (!motivoF || (motivoF === "sem" ? !e.motivo : e.motivo === motivoF)) &&
      (!q || (e.funcionario_nome ?? "").toUpperCase().includes(q) || (e.empresa_nome ?? "").toUpperCase().includes(q)
        || e.sequencial_ficha.includes(q) || (qd.length >= 3 && e.cpf.includes(qd))))
      .sort((a, b) => b.dias - a.dias);
  }, [enriquecidos, busca, unidade, origem, prest, exameF, faixaF, motivoF]);

  const visao = sp.get("v") ?? "";
  const fichas = useMemo(() => {
    const m = new Map<string, typeof lista>();
    for (const e of lista) { const a = m.get(e.sequencial_ficha); a ? a.push(e) : m.set(e.sequencial_ficha, [e]); }
    return [...m.values()].map((itens) => ({
      e: itens[0], itens,
      prestadores: [...new Set(itens.map((x) => x.prestador_nome ?? ""))].filter(Boolean),
      unidades: [...new Set(itens.map((x) => x.unidade).filter(Boolean))] as string[],
    }));
  }, [lista]);

  const cont = useMemo(() => ({
    total: enriquecidos.length,
    lapa: enriquecidos.filter((e) => e.unidade === "lapa").length,
    osasco: enriquecidos.filter((e) => e.unidade === "osasco").length,
    socnet: enriquecidos.filter((e) => e.origem === "socnet").length,
    atrasado: enriquecidos.filter((e) => e.faixa === "atrasado").length,
  }), [enriquecidos]);

  const cards: { k: string; label: string; v: number; on: boolean; click: () => void }[] = [
    { k: "t", label: aba === "nc" ? "Total não compareceu" : "Total pendente", v: cont.total, on: !unidade && !origem && !faixaF, click: () => setSp(new URLSearchParams(aba ? { aba } : {}), { replace: true }) },
    { k: "l", label: "Unidade Lapa", v: cont.lapa, on: unidade === "lapa", click: () => setParam("u", unidade === "lapa" ? "" : "lapa") },
    { k: "os", label: "Unidade Osasco", v: cont.osasco, on: unidade === "osasco", click: () => setParam("u", unidade === "osasco" ? "" : "osasco") },
    { k: "s", label: "SOCNET", v: cont.socnet, on: origem === "socnet", click: () => setParam("o", origem === "socnet" ? "" : "socnet") },
    { k: "a", label: "Espera", v: cont.atrasado, on: faixaF === "atrasado", click: () => setParam("f", faixaF === "atrasado" ? "" : "atrasado") },
  ];

  const fichaAberta = aberto ? todos.filter((e) => e.sequencial_ficha === aberto) : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Exames Pendentes</h1>
          <p className="text-xs text-muted-foreground">Exames sem data de resultado no sistema SOC.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {[["", "Pendentes"], ["nc", `Não Compareceram (${fichasNc})`]].map(([k, l]) => (
          <button key={k} onClick={() => setSp(new URLSearchParams(k ? { aba: k } : {}), { replace: true })}
            className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-sm ${aba === k ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {cards.map((c) => (
          <button key={c.k} onClick={c.click} className={`rounded-lg border p-3 text-left transition ${c.on ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"}`}>
            <div className="whitespace-nowrap text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold">{c.v}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setParam("q", e.target.value)} placeholder="CPF, nome, empresa ou ficha" className="h-8 w-60 pl-8 text-xs" />
            </div>
            <select className={sel} value={unidade} onChange={(e) => setParam("u", e.target.value)}>
              <option value="">Todas as unidades</option><option value="lapa">Lapa</option><option value="osasco">Osasco</option><option value="nd">Não identificada</option>
            </select>
            <select className={sel} value={origem} onChange={(e) => setParam("o", e.target.value)}>
              <option value="">Todas as origens</option><option value="propria">Carteira própria</option><option value="socnet">SOCNET</option>
            </select>
            {aba !== "nc" && (
              <select className={sel} value={motivoF} onChange={(e) => setParam("m", e.target.value)}>
                <option value="">Todos os motivos</option><option value="sem">Sem motivo</option>
                {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            )}
            <select className={`${sel} max-w-56`} value={prest} onChange={(e) => setParam("p", e.target.value)}>
              <option value="">Todos os prestadores</option>{prestadores.map((p) => <option key={p} value={p}>{titulo(p)}</option>)}
            </select>
            <select className={`${sel} max-w-56`} value={exameF} onChange={(e) => setParam("e", e.target.value)}>
              <option value="">Todos os exames</option>{examesLista.map((p) => <option key={p} value={p}>{titulo(p)}</option>)}
            </select>
            <select className={sel} value={faixaF} onChange={(e) => setParam("f", e.target.value)}>
              <option value="">Qualquer espera</option><option value="recente">Até 2 dias</option><option value="atencao">3 a 5 dias</option><option value="atrasado">Mais de 5 dias</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-md border p-0.5">
                {[["", "Por exame"], ["ficha", "Por atendimento"]].map(([k, l]) => (
                  <button key={k} onClick={() => setParam("v", k)} className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-normal ${visao === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
                ))}
              </div>
              <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">{visao === "ficha" ? `${fichas.length} atendimentos · ` : ""}{lista.length} exames</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            {visao === "ficha" ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-left">
                  {["Colaborador", "Maior espera", "Situação", "Empresa", "Exames pendentes", "Prestadores", "Unidade", "Origem", "Data da ficha"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "sticky left-0 bg-muted" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && fichas.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum atendimento com esses filtros.</td></tr>}
                {fichas.map(({ e, itens, prestadores: ps, unidades }) => (
                  <tr key={e.sequencial_ficha} onClick={() => setParam("ficha", e.sequencial_ficha)} className="h-9 cursor-pointer border-t hover:bg-muted/50">
                    <td className="sticky left-0 max-w-48 bg-card px-2"><div className="truncate" title={titulo(e.funcionario_nome)}>{titulo(e.funcionario_nome)}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{cpfMask(e.cpf)}</div></td>
                    <td className="px-2"><Badge variant="outline" className={`whitespace-nowrap ${FAIXA_COR[e.faixa]}`}>{e.dias} {e.dias === 1 ? "dia" : "dias"}</Badge></td>
                    <td className="px-2"><Situacao e={e} obs={motivos.get(e.sequencial_ficha)?.observacao} /></td>
                    <td className="max-w-48 truncate px-2" title={titulo(e.empresa_nome)}>{titulo(e.empresa_nome)}</td>
                    <td className="max-w-56 truncate px-2" title={itens.map((x) => titulo(x.exame_nome)).join(", ")}><span className="font-medium">{itens.length}</span> · {itens.map((x) => titulo(x.exame_nome)).join(", ")}</td>
                    <td className="max-w-56 truncate px-2" title={ps.map(titulo).join(", ")}>{ps.length > 1 ? `${ps.length} prestadores` : titulo(ps[0]) || "—"}</td>
                    <td className="whitespace-nowrap px-2">{unidades.length ? unidades.map((u) => <Badge key={u} variant="secondary" className="mr-1 whitespace-nowrap">{UNID[u]}</Badge>) : <span className="text-muted-foreground">Não identificada</span>}</td>
                    <td className="px-2"><Badge variant="outline" className="whitespace-nowrap">{e.origem === "socnet" ? "SOCNET" : "Própria"}</Badge></td>
                    <td className="whitespace-nowrap px-2">{br(e.data_ficha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="text-left">
                  {["Colaborador", "Espera", "Situação", "Empresa", "Exame", "Prestador", "Unidade", "Origem", "Data da ficha"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "sticky left-0 bg-muted" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && lista.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum exame com esses filtros.</td></tr>}
                {lista.map((e) => (
                  <tr key={e.id} onClick={() => setParam("ficha", e.sequencial_ficha)} className="h-9 cursor-pointer border-t hover:bg-muted/50">
                    <td className="sticky left-0 max-w-48 bg-card px-2"><div className="truncate" title={titulo(e.funcionario_nome)}>{titulo(e.funcionario_nome)}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{cpfMask(e.cpf)}</div></td>
                    <td className="px-2"><Badge variant="outline" className={`whitespace-nowrap ${FAIXA_COR[e.faixa]}`}>{e.dias} {e.dias === 1 ? "dia" : "dias"}</Badge></td>
                    <td className="px-2"><Situacao e={e} obs={motivos.get(e.sequencial_ficha)?.observacao} /></td>
                    <td className="max-w-48 truncate px-2" title={titulo(e.empresa_nome)}>{titulo(e.empresa_nome)}</td>
                    <td className="max-w-48 truncate px-2" title={titulo(e.exame_nome)}>{titulo(e.exame_nome)}</td>
                    <td className="max-w-56 truncate px-2" title={titulo(e.prestador_nome)}>{titulo(e.prestador_nome) || "—"}</td>
                    <td className="px-2">{e.unidade ? <Badge variant="secondary" className="whitespace-nowrap">{UNID[e.unidade]}</Badge> : <span className="whitespace-nowrap text-muted-foreground">Não identificada</span>}</td>
                    <td className="px-2"><Badge variant="outline" className="whitespace-nowrap">{e.origem === "socnet" ? "SOCNET" : "Própria"}</Badge></td>
                    <td className="whitespace-nowrap px-2">{br(e.data_ficha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!aberto} onOpenChange={(o) => !o && setParam("ficha", "")}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {aberto && <DetalheFicha key={aberto + (motivos.get(aberto)?.atualizado_em ?? "")} seq={aberto} exames={fichaAberta} motivo={motivos.get(aberto)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Situacao({ e, obs }: { e: Exame & { motivo?: string }; obs?: string | null }) {
  if (e.nao_compareceu_em) return <Badge variant="outline" className="whitespace-nowrap border-destructive/30 bg-destructive/10 text-destructive" title={e.nao_compareceu_obs ?? ""}>Não Compareceu</Badge>;
  const m = e.motivo ? MOTIVOS[e.motivo] : null;
  return (
    <div className="flex items-center gap-1">
      {m ? <Badge variant="outline" className={`whitespace-nowrap ${m.cor}`} title={obs ?? ""}>{m.label}</Badge> : <span className="whitespace-nowrap text-muted-foreground">Sem motivo</span>}
      {e.atendido_depois && <Badge variant="outline" className="whitespace-nowrap border-primary/30 bg-primary/10 text-primary" title="Colaborador atendido depois na carteira própria — confira e dê baixa se for o caso">Atendido {br(e.atendido_depois)}</Badge>}
    </div>
  );
}

function DetalheFicha({ seq, exames, motivo }: { seq: string; exames: (Exame & { dias: number })[]; motivo?: Motivo }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [obsNc, setObsNc] = useState("");
  const [salvandoNc, setSalvandoNc] = useState(false);
  const [motivoSel, setMotivoSel] = useState(motivo?.motivo ?? "");
  const [motivoObs, setMotivoObs] = useState(motivo?.observacao ?? "");
  const [obsReabrir, setObsReabrir] = useState("");
  const e = exames[0];
  const autores = [motivo?.atualizado_por, e?.nao_compareceu_por].filter(Boolean) as string[];
  const { data: nomes = new Map<string, string>() } = useQuery({
    queryKey: ["exames-pendentes-autores", autores.join(",")],
    enabled: autores.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", autores);
      return new Map((data ?? []).map((p: any) => [p.id, p.full_name as string]));
    },
  });
  const { data: contatos = [] } = useQuery({
    queryKey: ["exames-pendentes-contatos", seq],
    queryFn: async () => {
      const { data, error } = await db.from("soc_exames_pendentes_contatos").select("id,texto,user_id,created_at").eq("sequencial_ficha", seq).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data as Contato[]).map((c) => c.user_id))];
      const { data: perfis } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] as any[] };
      const nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.full_name]));
      return (data as Contato[]).map((c) => ({ ...c, autor: nomes.get(c.user_id) ?? "—" }));
    },
  });

  if (!e) return <SheetHeader><SheetTitle>Ficha {seq}</SheetTitle><p className="text-sm text-muted-foreground">Esta ficha não tem mais exames pendentes.</p></SheetHeader>;

  const mensagem = `Olá! Poderiam verificar o resultado dos exames abaixo?\n\nColaborador: ${titulo(e.funcionario_nome)} (CPF ${e.cpf})\nEmpresa: ${titulo(e.empresa_nome)}\nFicha: ${seq} de ${br(e.data_ficha)}\nExames sem resultado:\n${exames.map((x) => `- ${titulo(x.exame_nome)}`).join("\n")}\n\nObrigado, PreverMed.`;
  const quando = (d: string) => new Date(d).toLocaleString("pt-BR");

  const naoCompareceu = async () => {
    const t = obsNc.trim();
    if (!t || !confirm("Confirmar que o colaborador não compareceu? A ficha vai para a aba Não Compareceram.")) return;
    setSalvandoNc(true);
    const { error } = await (supabase.rpc as any)("exames_pendentes_nao_compareceu", { _sequencial: seq, _obs: t });
    setSalvandoNc(false);
    if (error) return toast.error("Não foi possível marcar. Verifique sua permissão de edição neste módulo.");
    setObsNc("");
    qc.invalidateQueries({ queryKey: ["exames-pendentes"] });
    toast.success("Ficha movida para Não Compareceram.");
  };

  const reabrir = async () => {
    const t = obsReabrir.trim();
    if (!t) return;
    setSalvandoNc(true);
    const { error } = await (supabase.rpc as any)("exames_pendentes_reabrir", { _sequencial: seq, _obs: t });
    setSalvandoNc(false);
    if (error) return toast.error("Não foi possível reabrir. Somente quem tem permissão de aprovação neste módulo pode reabrir.");
    setObsReabrir("");
    qc.invalidateQueries({ queryKey: ["exames-pendentes"] });
    toast.success("Ficha reaberta e de volta aos Pendentes.");
  };

  const salvarMotivo = async () => {
    if (!motivoSel) return;
    if (motivoSel === "outro" && !motivoObs.trim()) return toast.error("Para \"Outro\" a justificativa é obrigatória.");
    setSalvando(true);
    const { error } = await (supabase.rpc as any)("exames_pendentes_definir_motivo", { _sequencial: seq, _motivo: motivoSel, _obs: motivoObs.trim() });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar. Verifique sua permissão de edição neste módulo.");
    qc.invalidateQueries({ queryKey: ["exames-pendentes-motivos"] });
    toast.success("Motivo da pendência salvo.");
  };

  const registrar = async () => {
    const t = texto.trim();
    if (!t) return;
    setSalvando(true);
    const { error } = await db.from("soc_exames_pendentes_contatos").insert({ sequencial_ficha: seq, texto: t.slice(0, 1000) });
    if (!error) await supabase.from("audit_log").insert({ user_id: user?.id, action_type: "exame_pendente_contato", object_type: "soc_exames_pendentes", object_id: null, details: { sequencial_ficha: seq } } as any);
    setSalvando(false);
    if (error) return toast.error("Não foi possível registrar. Verifique sua permissão neste módulo.");
    setTexto("");
    qc.invalidateQueries({ queryKey: ["exames-pendentes-contatos", seq] });
    toast.success("Contato registrado.");
  };

  return (
    <div className="space-y-4">
      <SheetHeader><SheetTitle>{titulo(e.funcionario_nome)}</SheetTitle></SheetHeader>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">CPF</span><div>{e.cpf}</div></div>
        <div><span className="text-muted-foreground">Código do funcionário</span><div>{e.funcionario_codigo ?? "—"}</div></div>
        <div><span className="text-muted-foreground">Ficha</span><div>{seq} · {e.tipo_ficha ?? "—"}</div></div>
        <div className="col-span-2"><span className="text-muted-foreground">Empresa</span><div>{titulo(e.empresa_nome)} {e.empresa_codigo ? `(${e.empresa_codigo})` : ""}</div></div>
        {e.assessoria_nome && <div className="col-span-2"><span className="text-muted-foreground">Base SOCNET de origem</span><div>{titulo(e.assessoria_nome)}</div></div>}
        <div className="col-span-2"><span className="text-muted-foreground">Unidade de atendimento</span><div>{(e as any).unidade ? `PreverMed ${UNID[(e as any).unidade]}` : "Não identificada"}</div></div>
        <div><span className="text-muted-foreground">Data da ficha</span><div>{br(e.data_ficha)}</div></div>
        <div><span className="text-muted-foreground">Espera</span><div>{e.dias} dias</div></div>
      </div>
      {e.atendido_depois && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
          Este colaborador tem atendimento com resultado na carteira própria em {br(e.atendido_depois)}. Confira no SOC; se este pedido não foi usado, marque "Não Compareceu".
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-medium">Exames sem resultado ({exames.length})</div>
        <ul className="space-y-1 text-xs">{exames.map((x) => (
          <li key={x.id} className="rounded border px-2 py-1">
            <div className="truncate font-medium">{titulo(x.exame_nome)}</div>
          </li>
        ))}</ul>
      </div>
      {e.nao_compareceu_em ? (
        <div className="space-y-2 rounded-md border border-destructive/30 p-3 text-xs">
          <div className="font-medium">Marcada como Não Compareceu</div>
          <div className="text-muted-foreground">{titulo(nomes.get(e.nao_compareceu_por ?? "") ?? "—")} · {quando(e.nao_compareceu_em)}</div>
          <div className="whitespace-pre-wrap">{e.nao_compareceu_obs}</div>
          <Textarea value={obsReabrir} onChange={(ev) => setObsReabrir(ev.target.value)} maxLength={1000} placeholder="Motivo da reabertura (ex.: cliente informou que o colaborador compareceu)" className="text-xs" />
          <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={reabrir} disabled={salvandoNc || !obsReabrir.trim()}>Reabrir ficha</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-xs font-medium">Motivo da pendência</div>
            {motivo && <div className="text-[10px] text-muted-foreground">Última atualização: {titulo(nomes.get(motivo.atualizado_por) ?? "—")} · {quando(motivo.atualizado_em)}</div>}
            <select className={`${sel} w-full`} value={motivoSel} onChange={(ev) => setMotivoSel(ev.target.value)}>
              <option value="">Selecione…</option>
              {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Textarea value={motivoObs} onChange={(ev) => setMotivoObs(ev.target.value)} maxLength={1000} placeholder={motivoSel === "outro" ? "Justificativa obrigatória" : "Justificativa (ex.: empresa não enviou a avaliação psicossocial)"} className="text-xs" />
            <Button size="sm" className="h-7 px-3 text-xs" onClick={salvarMotivo} disabled={salvando || !motivoSel}>Salvar motivo</Button>
          </div>
          <div className="space-y-2 rounded-md border border-destructive/30 p-3">
            <div className="text-xs font-medium">Não Compareceu</div>
            <p className="text-[10px] text-muted-foreground">Use quando a recepção confirmar que o colaborador não esteve na clínica. A ficha vai para a aba Não Compareceram e pode ser reaberta.</p>
            <Textarea value={obsNc} onChange={(ev) => setObsNc(ev.target.value)} maxLength={1000} placeholder="Observação obrigatória (ex.: recepção da Lapa confirmou que não houve atendimento)" className="text-xs" />
            <Button size="sm" variant="destructive" className="h-7 w-auto self-start px-3 text-xs" onClick={naoCompareceu} disabled={salvandoNc || !obsNc.trim()}>Não Compareceu</Button>
          </div>
        </>
      )}
      <div className="space-y-2">
        <div className="text-xs font-medium">Registro de contatos</div>
        <Textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} maxLength={1000} placeholder="Ex.: Cobrado por e-mail com a Carla" className="text-xs" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-7 px-3 text-xs" onClick={registrar} disabled={salvando || !texto.trim()}>Registrar contato</Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { navigator.clipboard.writeText(mensagem); toast.success("Texto de cobrança copiado."); }}>
            <Copy className="mr-1 h-3 w-3" /> Copiar texto de cobrança
          </Button>
        </div>
        <ul className="space-y-2">
          {contatos.map((c: any) => (
            <li key={c.id} className="rounded border p-2 text-xs">
              <div className="text-[10px] text-muted-foreground">{titulo(c.autor)} · {new Date(c.created_at).toLocaleString("pt-BR")}</div>
              <div className="whitespace-pre-wrap">{c.texto}</div>
            </li>
          ))}
          {contatos.length === 0 && <li className="text-xs text-muted-foreground">Nenhum contato registrado ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
