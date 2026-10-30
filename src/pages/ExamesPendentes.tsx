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
};
type Contato = { id: string; texto: string; user_id: string; created_at: string };

const db = supabase as any;
const sel = "h-8 rounded-md border border-input bg-background px-2 text-xs";
const titulo = (t: string | null) => (t ?? "").toLowerCase().replace(/(^|\s|\()\S/g, (c) => c.toUpperCase());
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
// (credenciados e In Loco ficam fora). SOCNET mantém a regra pelo nome do prestador da base de origem.
async function carregar(): Promise<Exame[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: prs, error: ep } = await db.from("soc_prestadores").select("codigo,unidade_responsavel").not("unidade_responsavel", "is", null);
  if (ep) throw ep;
  const mapa = new Map<string, string>((prs ?? []).map((p: any) => [String(p.codigo), p.unidade_responsavel]));
  const out: Exame[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("soc_exames_pendentes")
      .select("id,origem,sequencial_ficha,data_ficha,tipo_ficha,cpf,funcionario_nome,funcionario_codigo,empresa_codigo,empresa_nome,assessoria_nome,exame_nome,prestador_codigo,prestador_nome")
      .is("data_resultado", null).is("resolvido_em", null).is("nao_compareceu_em", null).lte("data_ficha", hoje).order("data_ficha").range(de, de + 999);
    if (error) throw error;
    for (const e of data) {
      if (e.origem === "socnet") { out.push(e); continue; }
      const u = mapa.get(String(e.prestador_codigo ?? ""));
      if (u) out.push({ ...e, unidade_cadastro: u });
    }
    if (data.length < 1000) return out;
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

  const { data = [], isLoading } = useQuery({ queryKey: ["exames-pendentes"], queryFn: carregar });

  const enriquecidos = useMemo(() => data.map((e) => {
    const dias = diasEspera(e.data_ficha);
    const uc = (e as any).unidade_cadastro as string | undefined;
    const u = uc === "ambas" ? unidadeDoPrestador(e.prestador_nome) : (uc as "lapa" | "osasco" | undefined) ?? unidadeDoPrestador(e.prestador_nome);
    return { ...e, dias, faixa: faixa(dias), unidade: u };
  }), [data]);

  const prestadores = useMemo(() => [...new Set(enriquecidos.map((e) => e.prestador_nome ?? ""))].filter(Boolean).sort(), [enriquecidos]);
  const examesLista = useMemo(() => [...new Set(enriquecidos.map((e) => e.exame_nome))].sort(), [enriquecidos]);

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const qd = q.replace(/\D/g, "");
    return enriquecidos.filter((e) =>
      (!unidade || (unidade === "nd" ? !e.unidade : e.unidade === unidade)) &&
      (!origem || e.origem === origem) && (!prest || e.prestador_nome === prest) &&
      (!exameF || e.exame_nome === exameF) && (!faixaF || e.faixa === faixaF) &&
      (!q || (e.funcionario_nome ?? "").toUpperCase().includes(q) || (e.empresa_nome ?? "").toUpperCase().includes(q)
        || e.sequencial_ficha.includes(q) || (qd.length >= 3 && e.cpf.includes(qd))))
      .sort((a, b) => b.dias - a.dias);
  }, [enriquecidos, busca, unidade, origem, prest, exameF, faixaF]);

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
    { k: "t", label: "Total pendente", v: cont.total, on: !unidade && !origem && !faixaF, click: () => setSp(new URLSearchParams(), { replace: true }) },
    { k: "l", label: "Unidade Lapa", v: cont.lapa, on: unidade === "lapa", click: () => setParam("u", unidade === "lapa" ? "" : "lapa") },
    { k: "os", label: "Unidade Osasco", v: cont.osasco, on: unidade === "osasco", click: () => setParam("u", unidade === "osasco" ? "" : "osasco") },
    { k: "s", label: "SOCNET", v: cont.socnet, on: origem === "socnet", click: () => setParam("o", origem === "socnet" ? "" : "socnet") },
    { k: "a", label: "Espera", v: cont.atrasado, on: faixaF === "atrasado", click: () => setParam("f", faixaF === "atrasado" ? "" : "atrasado") },
  ];

  const fichaAberta = aberto ? enriquecidos.filter((e) => e.sequencial_ficha === aberto) : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Exames Pendentes</h1>
          <p className="text-xs text-muted-foreground">Exames sem data de resultado no sistema SOC.</p>
        </div>
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
                  {["Colaborador", "Maior espera", "Empresa", "Exames pendentes", "Prestadores", "Unidade", "Origem", "Data da ficha"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "sticky left-0 bg-muted" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && fichas.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum atendimento pendente com esses filtros.</td></tr>}
                {fichas.map(({ e, itens, prestadores: ps, unidades }) => (
                  <tr key={e.sequencial_ficha} onClick={() => setParam("ficha", e.sequencial_ficha)} className="h-9 cursor-pointer border-t hover:bg-muted/50">
                    <td className="sticky left-0 max-w-48 bg-card px-2"><div className="truncate" title={titulo(e.funcionario_nome)}>{titulo(e.funcionario_nome)}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{cpfMask(e.cpf)}</div></td>
                    <td className="px-2"><Badge variant="outline" className={`whitespace-nowrap ${FAIXA_COR[e.faixa]}`}>{e.dias} {e.dias === 1 ? "dia" : "dias"}</Badge></td>
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
                  {["Colaborador", "Espera", "Empresa", "Exame", "Prestador", "Unidade", "Origem", "Data da ficha"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "sticky left-0 bg-muted" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && lista.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum exame pendente com esses filtros.</td></tr>}
                {lista.map((e) => (
                  <tr key={e.id} onClick={() => setParam("ficha", e.sequencial_ficha)} className="h-9 cursor-pointer border-t hover:bg-muted/50">
                    <td className="sticky left-0 max-w-48 bg-card px-2"><div className="truncate" title={titulo(e.funcionario_nome)}>{titulo(e.funcionario_nome)}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{cpfMask(e.cpf)}</div></td>
                    <td className="px-2"><Badge variant="outline" className={`whitespace-nowrap ${FAIXA_COR[e.faixa]}`}>{e.dias} {e.dias === 1 ? "dia" : "dias"}</Badge></td>
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
          {aberto && <DetalheFicha seq={aberto} exames={fichaAberta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetalheFicha({ seq, exames }: { seq: string; exames: (Exame & { dias: number })[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [obsNc, setObsNc] = useState("");
  const [salvandoNc, setSalvandoNc] = useState(false);
  const e = exames[0];
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

  const naoCompareceu = async () => {
    const t = obsNc.trim();
    if (!t || !confirm("Confirmar que o colaborador não compareceu? Todos os exames desta ficha sairão do painel.")) return;
    setSalvandoNc(true);
    const { error } = await (supabase.rpc as any)("exames_pendentes_nao_compareceu", { _sequencial: seq, _obs: t });
    setSalvandoNc(false);
    if (error) return toast.error("Não foi possível marcar. Verifique sua permissão de edição neste módulo.");
    setObsNc("");
    qc.invalidateQueries({ queryKey: ["exames-pendentes"] });
    toast.success("Ficha marcada como Não Compareceu.");
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
        <div className="col-span-2"><span className="text-muted-foreground">Prestador</span><div>{titulo(e.prestador_nome) || "—"}</div></div>
        <div><span className="text-muted-foreground">Data da ficha</span><div>{br(e.data_ficha)}</div></div>
        <div><span className="text-muted-foreground">Espera</span><div>{e.dias} dias</div></div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium">Exames sem resultado ({exames.length})</div>
        <ul className="space-y-1 text-xs">{exames.map((x) => (
          <li key={x.id} className="rounded border px-2 py-1">
            <div className="truncate font-medium">{titulo(x.exame_nome)}</div>
            <div className="truncate text-[10px] text-muted-foreground">{titulo(x.prestador_nome) || "Sem prestador"} · {x.dias} dias</div>
          </li>
        ))}</ul>
      </div>
      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(mensagem); toast.success("Texto de cobrança copiado."); }}>
        <Copy className="mr-1 h-4 w-4" /> Copiar texto de cobrança
      </Button>
      <div className="space-y-2 rounded-md border border-destructive/30 p-3">
        <div className="text-xs font-medium">Não Compareceu</div>
        <p className="text-[10px] text-muted-foreground">Use quando a recepção confirmar que o colaborador não esteve na clínica. A ficha inteira sai do painel.</p>
        <Textarea value={obsNc} onChange={(ev) => setObsNc(ev.target.value)} maxLength={1000} placeholder="Observação obrigatória (ex.: recepção da Lapa confirmou que não houve atendimento)" className="text-xs" />
        <Button size="sm" variant="destructive" onClick={naoCompareceu} disabled={salvandoNc || !obsNc.trim()}>Marcar como Não Compareceu</Button>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium">Registro de contatos</div>
        <Textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} maxLength={1000} placeholder="Ex.: Cobrado por e-mail com a Carla" className="text-xs" />
        <Button size="sm" onClick={registrar} disabled={salvando || !texto.trim()}>Registrar contato</Button>
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
