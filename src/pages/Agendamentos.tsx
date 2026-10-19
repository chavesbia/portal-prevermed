import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, FileText, Loader2, Paperclip, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;
const fmtData = (d: string) => d.split("-").reverse().join("/");
const fmtCpf = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const hojeIso = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const LS_KEY = "agendamentos:filtro";
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendado_soc: { label: "Agendado no SOC", variant: "default" },
  solicitado: { label: "Pendente no SOC", variant: "destructive" },
  aguardando_aprovacao: { label: "Aguardando aprovação", variant: "secondary" },
  documentacao_devolvida: { label: "Documentação devolvida", variant: "outline" },
};

const fmtDataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const nomeUnidade = (a: any) => a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "Sem unidade";
const canal = (a: any) => {
  const o = String(a.observacoes ?? "").toUpperCase();
  if (o.includes("VIA WHATSAPP")) return "WhatsApp";
  if (o.startsWith("SOCNET:") || o.includes("\nSOCNET:")) return "SOCNET";
  return "Link público";
};
const ehClinico = (e: string) => /CL[IÍ]NIC/i.test(e);
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const faixa = (h: string) => { const n = Number(h.slice(0, 2)); return n < 9 ? "07h–09h" : n < 11 ? "09h–11h" : n < 13 ? "11h–13h" : n < 16 ? "13h–16h" : "16h+"; };

const abrirArquivo = async (path: string) => {
  const { data, error } = await supabase.storage.from("os-anexos").createSignedUrl(path, 300);
  if (error || !data) return toast.error("Não foi possível abrir o arquivo");
  window.open(data.signedUrl, "_blank", "noopener");
};

export default function Agendamentos() {
  const qc = useQueryClient();
  const { isAdmMaster } = useAuth();
  const { hasPermission } = useModulePermissions();
  const podeAprovar = isAdmMaster || hasPermission("/agendamentos", "approve");

  // Filtros na URL; última unidade/período lembrados no navegador
  const salvo = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; } })();
  const [sp, setSp] = useSearchParams();
  const aba = sp.get("tab") ?? "lista";
  const de = sp.get("de") ?? salvo.de ?? hojeIso();
  const ate = sp.get("ate") ?? salvo.ate ?? de;
  const unidade = sp.get("unidade") ?? salvo.unidade ?? "";
  const setFiltro = (patch: Record<string, string>) => {
    const n = { tab: aba, de, ate, unidade, ...patch };
    if (n.ate < n.de) n.ate = n.de;
    localStorage.setItem(LS_KEY, JSON.stringify({ de: n.de, ate: n.ate, unidade: n.unidade }));
    setSp(n, { replace: true });
  };

  const { data: unidades = [] } = useQuery({
    queryKey: ["soc-agenda-unidades"],
    queryFn: async () => (await db.from("soc_agenda_unidades").select("id, nome").order("nome")).data ?? [],
  });

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["agendamentos", de, ate, unidade],
    queryFn: async () => {
      let q = db.from("soc_agendamentos").select("*, soc_agenda_unidades(nome), soc_agendamento_anexos(id, tipo_documento, nome_arquivo, path, enviado_em)")
        .gte("data_agendada", de).lte("data_agendada", ate).order("data_agendada").order("hora_agendada").limit(1000);
      if (unidade) q = q.eq("unidade_id", unidade);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: pendentes = [] } = useQuery({
    queryKey: ["agendamentos-pendentes"],
    queryFn: async () => {
      const { data, error } = await db.from("soc_agendamentos").select("*, soc_agenda_unidades(nome), soc_agendamento_anexos(id, tipo_documento, nome_arquivo, path, enviado_em)")
        .in("aprovacao_status", ["pendente", "devolvido"]).order("data_agendada");
      if (error) throw error;
      return data;
    },
  });

  const codigos = useMemo(() => [...new Set([...lista, ...pendentes].map((a: any) => a.codigo_empresa_soc).filter(Boolean))] as string[], [lista, pendentes]);
  const { data: subgrupos = {} } = useQuery({
    queryKey: ["agendamentos-subgrupos", codigos.join(",")],
    enabled: codigos.length > 0,
    queryFn: async () => {
      const m: Record<string, string> = {};
      for (let i = 0; i < codigos.length; i += 200) {
        const { data } = await db.from("companies").select("soc_code, subgrupo").in("soc_code", codigos.slice(i, i + 200));
        (data ?? []).forEach((c: any) => { if (c.subgrupo) m[c.soc_code] = c.subgrupo; });
      }
      return m;
    },
  });
  const subgrupoDe = (a: any) => (a.codigo_empresa_soc && (subgrupos as any)[a.codigo_empresa_soc]) || (canal(a) === "SOCNET" ? "SOCNET (outra assessoria)" : a.codigo_empresa_soc ? "Sem subgrupo" : "Externa / Parceira avulsa");

  // Atualiza ao vivo quando chegam agendamentos ou anexos
  useEffect(() => {
    const ch = supabase.channel("agendamentos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "soc_agendamentos" }, () => {
        qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");
  // Nome/telefone de quem agendou pelo WhatsApp: só ADM Master lê (protegido no servidor)
  const { data: solicitante } = useQuery({
    queryKey: ["agendamento-solicitante", detalhe?.protocolo],
    enabled: !!detalhe && isAdmMaster && canal(detalhe) === "WhatsApp",
    queryFn: async () => (await db.from("whatsapp_registros").select("nome_whatsapp, telefone, created_at").eq("protocolo", detalhe.protocolo).maybeSingle()).data,
  });
  const [enviando, setEnviando] = useState(false);
  const decidir = async (decisao: "aprovar" | "devolver") => {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("agenda-aprovacao", { body: { agendamentoId: detalhe.id, decisao, motivo: motivo.trim() || undefined } });
    setEnviando(false);
    let msg = data?.error;
    if (error && !msg) { try { msg = (await (error as any).context?.json())?.error; } catch { /* */ } }
    if (error || msg) return toast.error(msg ?? "Não foi possível concluir");
    if (data?.erro) toast.warning(data.erro); else toast.success(decisao === "aprovar" ? "Aprovado e agendado no SOC" : "Documentação devolvida ao cliente");
    setDetalhe(null); setMotivo("");
    qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] });
  };

  const dash = useMemo(() => {
    const conta = (itens: any[], f: (a: any) => string | string[]): [string, number][] => {
      const m: Record<string, number> = {};
      itens.forEach((a) => { const k = f(a); (Array.isArray(k) ? k : [k]).forEach((x) => (m[x] = (m[x] ?? 0) + 1)); });
      return Object.entries(m).sort((x, y) => y[1] - x[1]);
    };
    const exames = (a: any): string[] => (Array.isArray(a.exames) ? a.exames : []).map((e: string) => String(e).toUpperCase());
    const nomesUn = [...new Set(lista.map(nomeUnidade))].sort();
    const dias = [...new Set(lista.map((a: any) => a.data_agendada))].sort() as string[];
    const porDiaUn = dias.map((d) => {
      const doDia = lista.filter((a: any) => a.data_agendada === d);
      const r: Record<string, number> = {};
      nomesUn.forEach((u) => (r[u] = doDia.filter((a: any) => nomeUnidade(a) === u).length));
      return { dia: d, total: doDia.length, porUn: r };
    });
    const ordenados = [...porDiaUn].sort((x, y) => y.total - x.total);
    const semana = DIAS_SEMANA.map((nome, i) => {
      const ds = porDiaUn.filter((p) => new Date(p.dia + "T12:00:00").getDay() === i);
      return [nome, ds.length ? Math.round(ds.reduce((s, p) => s + p.total, 0) / ds.length) : 0] as [string, number];
    }).filter(([, v]) => v > 0);
    const totExames = lista.reduce((s: number, a: any) => s + exames(a).length, 0);
    const clinicos = lista.reduce((s: number, a: any) => s + exames(a).filter(ehClinico).length, 0);
    return {
      total: lista.length,
      colaboradores: new Set(lista.map((a: any) => a.colaborador_cpf)).size,
      exames: totExames, clinicos, complementares: totExames - clinicos,
      mediaDia: dias.length ? (lista.length / dias.length).toFixed(1) : "0",
      nomesUn, porDiaUn, pico: ordenados.slice(0, 3), calmo: ordenados.slice(-3).reverse(), semana,
      porUnidade: conta(lista, nomeUnidade),
      porTipo: conta(lista, (a) => a.tipo_exame),
      topExames: conta(lista, exames).slice(0, 10),
      complementaresRank: conta(lista, (a) => exames(a).filter((e) => !ehClinico(e))).slice(0, 10),
      porSubgrupo: conta(lista, subgrupoDe),
      porCanal: conta(lista, canal),
      porStatus: conta(lista, (a) => STATUS[a.status]?.label ?? a.status),
      porFaixa: conta(lista, (a) => faixa(a.hora_agendada)).sort((x, y) => x[0].localeCompare(y[0])),
      topEmpresas: conta(lista, (a) => a.empresa_nome ?? "-").slice(0, 10),
    };
  }, [lista, subgrupos]);

  const Linhas = ({ itens }: { itens: any[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Colaborador</TableHead><TableHead>Empresa</TableHead>
            <TableHead>Tipo</TableHead><TableHead>Unidade</TableHead><TableHead>Kit/anexos</TableHead><TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((a) => {
            const st = STATUS[a.status] ?? { label: a.status, variant: "secondary" as const };
            return (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => { setDetalhe(a); setMotivo(""); }}>
                <TableCell className="whitespace-nowrap">{fmtData(a.data_agendada)}</TableCell>
                <TableCell>{a.hora_agendada.slice(0, 5)}</TableCell>
                <TableCell><p className="font-medium">{a.colaborador_nome}</p><p className="text-xs text-muted-foreground">{fmtCpf(a.colaborador_cpf)}</p></TableCell>
                <TableCell className="max-w-[220px] truncate">{a.empresa_nome}</TableCell>
                <TableCell className="whitespace-nowrap">{a.tipo_exame}</TableCell>
                <TableCell className="whitespace-nowrap">{a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "-"}</TableCell>
                <TableCell>{a.soc_agendamento_anexos?.length ? <Badge variant="outline" className="whitespace-nowrap"><Paperclip className="mr-1 h-3 w-3" />{a.soc_agendamento_anexos.length}</Badge> : <span className="text-xs text-muted-foreground whitespace-nowrap">Sem anexo</span>}</TableCell>
                <TableCell><Badge variant={st.variant} className="whitespace-nowrap">{st.label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const Ranking = ({ titulo, dados, sub }: { titulo: string; dados: [string, number][]; sub?: string }) => {
    const max = Math.max(1, ...dados.map(([, v]) => v));
    return (
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{titulo}</CardTitle>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</CardHeader>
        <CardContent className="space-y-2 text-sm">
          {dados.length ? dados.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between gap-2"><span className="truncate" title={k}>{k}</span><span className="font-semibold">{v}</span></div>
              <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
            </div>
          )) : <p className="text-muted-foreground">Sem dados no período.</p>}
        </CardContent></Card>
    );
  };
  const Kpi = ({ k, v, sub }: { k: string; v: string | number; sub?: string }) => (
    <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{k}</p><p className="text-3xl font-semibold">{v}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</CardContent></Card>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2"><CalendarCheck className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Agendamentos</h1></div>

      <div className="flex flex-wrap items-end gap-2">
        <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setFiltro({ de: e.target.value })} /></div>
        <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setFiltro({ ate: e.target.value })} /></div>
        <div><Label>Unidade</Label>
          <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={unidade} onChange={(e) => setFiltro({ unidade: e.target.value })}>
            <option value="">Todas</option>{unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select></div>
        <Button variant="outline" onClick={() => setFiltro({ de: hojeIso(), ate: hojeIso() })}>Hoje</Button>
      </div>

      <Tabs value={aba} onValueChange={(v) => setFiltro({ tab: v })}>
        <TabsList>
          <TabsTrigger value="lista">Agendamentos ({lista.length})</TabsTrigger>
          <TabsTrigger value="aprovacao">Aprovação de documentação{pendentes.filter((p: any) => p.aprovacao_status === "pendente").length ? ` (${pendentes.filter((p: any) => p.aprovacao_status === "pendente").length})` : ""}</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="lista">
          <Card><CardContent className="pt-4">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : lista.length ? <Linhas itens={lista} /> : <p className="text-sm text-muted-foreground">Nenhum agendamento no período.</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="aprovacao">
          <Card><CardContent className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground">Retorno ao Trabalho: confira se a documentação está completa e legível. Ao aprovar, o horário é gravado no SOC; ao devolver, o cliente vê o motivo e reenvia pelo protocolo.</p>
            {pendentes.length ? <Linhas itens={pendentes} /> : <p className="text-sm text-muted-foreground">Nenhuma documentação aguardando.</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="dashboard" className="space-y-4">
          <p className="text-xs text-muted-foreground">Período: {fmtData(de)} a {fmtData(ate)}. Atualiza sozinho quando entra um agendamento novo. Para ver tendências, use um período maior (ex.: o mês).</p>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Kpi k="Agendamentos" v={dash.total} sub={`média de ${dash.mediaDia} por dia`} />
            <Kpi k="Colaboradores" v={dash.colaboradores} />
            <Kpi k="Exames" v={dash.exames} />
            <Kpi k="Exames clínicos" v={dash.clinicos} sub="demanda médica" />
            <Kpi k="Complementares" v={dash.complementares} sub="demanda de enfermagem/técnicos" />
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fluxo por dia e unidade</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {dash.porDiaUn.length ? (
                <Table><TableHeader><TableRow><TableHead>Dia</TableHead>{dash.nomesUn.map((u) => <TableHead key={u} className="text-right">{u}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>{dash.porDiaUn.map((p) => (
                    <TableRow key={p.dia}><TableCell className="whitespace-nowrap">{fmtData(p.dia)} <span className="text-xs text-muted-foreground">{DIAS_SEMANA[new Date(p.dia + "T12:00:00").getDay()]}</span></TableCell>
                      {dash.nomesUn.map((u) => <TableCell key={u} className="text-right">{p.porUn[u]}</TableCell>)}<TableCell className="text-right font-semibold">{p.total}</TableCell></TableRow>
                  ))}</TableBody></Table>
              ) : <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
            </CardContent></Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="Dias de maior fluxo" dados={dash.pico.map((p) => [fmtData(p.dia), p.total])} />
            <Ranking titulo="Dias mais tranquilos" dados={dash.calmo.map((p) => [fmtData(p.dia), p.total])} />
            <Ranking titulo="Média por dia da semana" dados={dash.semana} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="Por unidade" dados={dash.porUnidade} />
            <Ranking titulo="Faixa de horário de chegada" dados={dash.porFaixa} sub="ajuda a organizar a recepção e triagem" />
            <Ranking titulo="Por tipo de exame" dados={dash.porTipo} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Ranking titulo="10 exames mais solicitados" dados={dash.topExames} />
            <Ranking titulo="Exames complementares mais solicitados" dados={dash.complementaresRank} sub="impacto na escala de enfermagem" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Ranking titulo="Por subgrupo da empresa" dados={dash.porSubgrupo} />
            <Ranking titulo="Canal de entrada" dados={dash.porCanal} />
            <Ranking titulo="Situação no SOC" dados={dash.porStatus} />
            <Ranking titulo="Empresas que mais agendam" dados={dash.topEmpresas} />
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detalhe && (<>
            <SheetHeader><SheetTitle>{detalhe.colaborador_nome}</SheetTitle></SheetHeader>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="whitespace-nowrap">{nomeUnidade(detalhe)}</Badge>
              <Badge variant="secondary" className="whitespace-nowrap">{subgrupoDe(detalhe)}</Badge>
              <Badge variant="outline" className="whitespace-nowrap">{canal(detalhe)}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Protocolo</dt><dd className="font-mono">{detalhe.protocolo}</dd>
              <dt className="text-muted-foreground">CPF</dt><dd>{fmtCpf(detalhe.colaborador_cpf)}</dd>
              <dt className="text-muted-foreground">Emitido em</dt><dd>{fmtDataHora(detalhe.created_at)}</dd>
              {canal(detalhe) === "WhatsApp" && (<><dt className="text-muted-foreground">Solicitante</dt><dd>
                {!isAdmMaster ? <span className="text-muted-foreground">Via WhatsApp (contato visível para ADM Master)</span>
                  : solicitante ? (<div className="space-y-1"><p>{solicitante.nome_whatsapp || "Sem nome no WhatsApp"}</p>
                    <a className="inline-flex items-center gap-1 text-primary underline" href={`https://wa.me/${solicitante.telefone}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3" />{solicitante.telefone}</a></div>)
                  : <span className="text-muted-foreground">Não localizado</span>}
              </dd></>)}
              <dt className="text-muted-foreground">Empresa</dt><dd>{detalhe.empresa_nome}{detalhe.codigo_empresa_soc ? <span className="text-xs text-muted-foreground"> · SOC {detalhe.codigo_empresa_soc}</span> : null}</dd>
              <dt className="text-muted-foreground">Data</dt><dd>{fmtData(detalhe.data_agendada)} às {detalhe.hora_agendada.slice(0, 5)}</dd>
              <dt className="text-muted-foreground">Unidade</dt><dd>{nomeUnidade(detalhe)}</dd>
              <dt className="text-muted-foreground">Subgrupo</dt><dd>{subgrupoDe(detalhe)}</dd>
              <dt className="text-muted-foreground">Tipo</dt><dd>{detalhe.tipo_exame}</dd>
              <dt className="text-muted-foreground">Exames</dt><dd>{(detalhe.exames ?? []).join(", ") || "-"}</dd>
              {detalhe.motivo_retorno && (<><dt className="text-muted-foreground">Motivo do retorno</dt><dd className="whitespace-pre-wrap">{detalhe.motivo_retorno}</dd></>)}
              {detalhe.observacoes && (<><dt className="text-muted-foreground">Observações</dt><dd className="whitespace-pre-wrap">{detalhe.observacoes}</dd></>)}
              {detalhe.soc_erro && (<><dt className="text-muted-foreground">Erro SOC</dt><dd className="text-destructive">{detalhe.soc_erro}</dd></>)}
              {detalhe.devolucao_motivo && (<><dt className="text-muted-foreground">Devolvido</dt><dd>{detalhe.devolucao_motivo}</dd></>)}
            </dl>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Kit e documentos</p>
              {detalhe.soc_agendamento_anexos?.length ? detalhe.soc_agendamento_anexos.map((x: any) => (
                <Button key={x.id} variant="outline" size="sm" className="w-full justify-start min-w-0" onClick={() => abrirArquivo(x.path)}>
                  <FileText className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{x.tipo_documento}{x.nome_arquivo ? `: ${x.nome_arquivo}` : ""}</span><span className="ml-auto text-xs text-muted-foreground">{new Date(x.enviado_em).toLocaleDateString("pt-BR")}</span>
                </Button>
              )) : <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>}
            </div>
            {podeAprovar && detalhe.aprovacao_status === "pendente" && (
              <div className="mt-6 space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Decisão da equipe de saúde</p>
                <Textarea placeholder="Motivo da devolução (obrigatório para devolver). Ex.: laudo ilegível, falta alta médica." value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={enviando || motivo.trim().length < 5} onClick={() => decidir("devolver")}>Devolver</Button>
                  <Button disabled={enviando} onClick={() => decidir("aprovar")}>{enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Aprovar e agendar</Button>
                </div>
              </div>
            )}
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
