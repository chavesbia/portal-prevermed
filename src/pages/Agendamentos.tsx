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
import { ArrowUpDown, CalendarCheck, FileText, Loader2, Paperclip, MessageCircle, Printer, Search, Send, Stethoscope, HardHat } from "lucide-react";
import { toast } from "sonner";
import { periodoAgenda, temKitAgenda } from "@/lib/agendaPainel";
import { toTitleCase } from "@/lib/guias/blocklist";
import { CalendarioOperacional } from "@/components/agenda/CalendarioOperacional";
import { AgendaGraficos } from "@/components/agenda/AgendaGraficos";

const db = supabase as any;
const fmtData = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const fmtCpf = (c: string) => c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const hojeIso = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const LS_KEY = "agendamentos:filtro";
const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendado_soc: { label: "Agendado no SOC", variant: "default" },
  solicitado: { label: "Pendente no SOC", variant: "destructive" },
  aguardando_aprovacao: { label: "Aguardando aprovação", variant: "secondary" },
  documentacao_devolvida: { label: "Documentação devolvida", variant: "outline" },
  estrutura_cadastrada: { label: "Estrutura cadastrada", variant: "default" },
  documentacao_aprovada: { label: "Documentação aprovada", variant: "default" },
};

const fmtDataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const nomeUnidade = (a: any) => a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "Sem unidade";
const canal = (a: any) => {
  const o = String(a.observacoes ?? "").toUpperCase();
  return o.includes("VIA WHATSAPP") ? "WhatsApp" : "Link público";
};
const ehSocnet = (a: any) => { const o = String(a.observacoes ?? "").toUpperCase(); return o.startsWith("SOCNET:") || o.includes("\nSOCNET:"); };
const Selos = ({ a }: { a: any }) => <span className="inline-flex gap-1"><Badge variant="outline" className="whitespace-nowrap">{canal(a)}</Badge>{ehSocnet(a) && <Badge variant="secondary" className="whitespace-nowrap">SOCNET</Badge>}</span>;
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
  const padrao = periodoAgenda(hojeIso());
  const de = sp.get("de") ?? padrao.de;
  const ate = sp.get("ate") ?? padrao.ate;
  const busca = sp.get("busca") ?? "";
  const kit = sp.get("kit") ?? "todos";
  const filtroCanal = sp.get("canal") ?? "todos";
  const ordem = sp.get("ordem") ?? "data:asc";
  const podeEditar = isAdmMaster || hasPermission("/agendamentos", "edit");
  const unidade = sp.get("unidade") ?? salvo.unidade ?? "";
  const setFiltro = (patch: Record<string, string>) => {
    const n = { ...Object.fromEntries(sp), tab: aba, de, ate, unidade, ...patch };
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
        .or("aprovacao_status.in.(pendente,devolvido),and(fila_aprovacao.eq.engenharia,aprovacao_status.eq.aprovado)").order("created_at", { ascending: false });
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
  const subgrupoDe = (a: any) => (a.codigo_empresa_soc && (subgrupos as any)[a.codigo_empresa_soc]) || (ehSocnet(a) ? "SOCNET (outra assessoria)" : a.codigo_empresa_soc ? "Sem subgrupo" : "Externa / Parceira avulsa");

  // Atualiza ao vivo quando chegam agendamentos ou anexos
  useEffect(() => {
    const ch = supabase.channel("agendamentos-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "soc_agendamentos" }, () => {
        qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "soc_agendamento_anexos" }, () => { qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] }); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [detalhe, setDetalhe] = useState<any | null>(null);
  const excluirProtocolo = async () => {
    if (!detalhe || !window.confirm(`Excluir definitivamente o protocolo ${detalhe.protocolo}?`)) return;
    const { error } = await (supabase as any).rpc("agenda_excluir_protocolo", { _agendamento_id: detalhe.id });
    if (error) return toast.error(error.message);
    toast.success(`Protocolo ${detalhe.protocolo} excluído`);
    setDetalhe(null);
    qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] });
  };
  const conf = sp.get("conf") ?? "todos";
  const setConf = (v: string) => { const n = new URLSearchParams(sp); n.set("conf", v); setSp(n, { replace: true }); };
  const [agora, setAgora] = useState(() => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  useEffect(() => { setAgora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); }, [lista]);
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
    const eng = detalhe.fila_aprovacao === "engenharia";
    if (data?.erro) toast.warning(data.erro); else toast.success(decisao === "aprovar" ? (eng ? "Cadastro de estrutura confirmado no SOC" : "Aprovado e agendado no SOC") : (eng ? "Solicitação devolvida ao cliente" : "Documentação devolvida ao cliente"));
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
    const nomesUn = [...new Set(lista.map(nomeUnidade))].sort() as string[];
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
      porCanal: conta(lista, (a) => ehSocnet(a) ? `${canal(a)} · SOCNET` : canal(a)),
      porStatus: conta(lista, (a) => STATUS[a.status]?.label ?? a.status),
      porFaixa: conta(lista, (a) => faixa(a.hora_agendada)).sort((x, y) => x[0].localeCompare(y[0])),
      topEmpresas: conta(lista, (a) => a.empresa_nome ?? "-").slice(0, 10),
      semKit: lista.filter((a: any) => !temKitAgenda(a)).length,
      kitPct: lista.length ? Math.round((lista.filter((a: any) => temKitAgenda(a)).length / lista.length) * 100) : 0,
    };
  }, [lista, subgrupos]);

  const visiveis = useMemo(() => {
    const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = normalizar(busca.trim());
    return lista.filter((a: any) => {
      const texto = normalizar([a.colaborador_nome, a.colaborador_cpf, fmtCpf(a.colaborador_cpf), a.empresa_nome, a.empresa_cnpj, a.protocolo, a.tipo_exame].join(" "));
      return (!q || texto.includes(q)) && (filtroCanal === "todos" || (filtroCanal === "SOCNET" ? ehSocnet(a) : canal(a) === filtroCanal)) &&
        (kit === "todos" || (kit === "sem" ? !temKitAgenda(a) : kit === "impresso" ? !!a.kit_impresso_em : kit === "imprimir" ? temKitAgenda(a) && !a.kit_impresso_em : temKitAgenda(a)));
    }).sort((a: any, b: any) => {
      const [campo, dir] = ordem.split(":");
      const val = (x: any) => campo === "colaborador" ? x.colaborador_nome : campo === "empresa" ? x.empresa_nome ?? "" : campo === "tipo" ? x.tipo_exame : campo === "unidade" ? nomeUnidade(x) : campo === "status" ? STATUS[x.status]?.label ?? x.status : campo === "emitido" ? x.created_at ?? "" : campo === "canal" ? canal(x) + (ehSocnet(x) ? " SOCNET" : "") : campo === "kit" ? (x.kit_impresso_em ? "2" : temKitAgenda(x) ? "1" : "0") : `${x.data_agendada ?? ""} ${x.hora_agendada ?? ""}`;
      return String(val(a)).localeCompare(String(val(b))) * (dir === "desc" ? -1 : 1);
    });
  }, [lista, busca, filtroCanal, kit, ordem]);
  const marcarKit = async () => {
    if (!detalhe || !podeEditar) return;
    setEnviando(true);
    const { error } = await db.rpc("agenda_marcar_kit_impresso", { _agendamento_id: detalhe.id, _impresso: !detalhe.kit_impresso_em });
    setEnviando(false);
    if (error) return toast.error(error.message);
    setDetalhe({ ...detalhe, kit_impresso_em: detalhe.kit_impresso_em ? null : new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["agendamentos-pendentes"] });
    toast.success("Controle de impressão atualizado");
  };

  const Th = ({ c, children, className = "" }: { c: string; children: React.ReactNode; className?: string }) => {
    const [campo, dir] = ordem.split(":");
    const ativo = (campo || "data") === c;
    return (
      <TableHead className={`cursor-pointer select-none whitespace-nowrap hover:text-foreground ${className}`} onClick={() => setFiltro({ ordem: `${c}:${ativo && dir !== "desc" ? "desc" : "asc"}` })}>
        <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className={`h-3 w-3 ${ativo ? "text-foreground" : "text-muted-foreground/40"}`} /></span>
      </TableHead>
    );
  };

  const Linhas = ({ itens }: { itens: any[] }) => (
    <div className="max-h-[60vh] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <Th c="emitido">Emitido em</Th><Th c="data">Data</Th><Th c="data">Hora</Th><Th c="colaborador" className="sticky left-0 z-20 bg-background">Colaborador</Th><Th c="empresa">Empresa</Th>
            <Th c="tipo">Tipo</Th><Th c="unidade">Unidade</Th><Th c="canal">Canal</Th><Th c="kit">Kit</Th><Th c="status">Status</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((a) => {
            const st = STATUS[a.status] ?? { label: a.status, variant: "secondary" as const };
            return (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => { setDetalhe(a); setMotivo(""); }}>
                <TableCell className="whitespace-nowrap text-xs">{a.created_at ? fmtDataHora(a.created_at) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtData(a.data_agendada)}</TableCell>
                <TableCell>{a.hora_agendada?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell className="sticky left-0 z-10 max-w-[220px] bg-background"><p className="truncate whitespace-nowrap font-medium" title={toTitleCase(a.colaborador_nome) ?? ""}>{toTitleCase(a.colaborador_nome)}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{fmtCpf(a.colaborador_cpf)}</p></TableCell>
                <TableCell className="max-w-[220px] truncate">{a.empresa_nome}</TableCell>
                <TableCell className="whitespace-nowrap">{a.tipo_exame}</TableCell>
                <TableCell className="whitespace-nowrap">{a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "-"}</TableCell>
                <TableCell><Selos a={a} /></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{temKitAgenda(a) ? <span className="inline-flex items-center gap-1" title={a.kit_impresso_em ? "Kit impresso" : "Kit anexado, não impresso"}><Paperclip className="h-3 w-3" />{a.kit_impresso_em && <Printer className="h-3 w-3 text-primary" />}</span> : "-"}</TableCell>
                <TableCell><Badge variant={st.variant} className="whitespace-nowrap">{st.label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const fmtEmissao = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
  const SIT_ENG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pendente: { label: "Pendente", variant: "destructive" },
    devolvido: { label: "Devolvido", variant: "outline" },
    aprovado: { label: "Realizado", variant: "default" },
  };
  const LinhasEng = ({ itens }: { itens: any[] }) => (
    <div className="max-h-[60vh] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="sticky left-0 z-20 whitespace-nowrap bg-background">Emitido em</TableHead><TableHead>Empresa</TableHead>
            <TableHead className="whitespace-nowrap">Estrutura solicitada</TableHead><TableHead>Solicitante</TableHead><TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((a) => {
            const es = a.estrutura_solicitada ?? {};
            const st = SIT_ENG[a.aprovacao_status] ?? { label: a.aprovacao_status, variant: "secondary" as const };
            return (
              <TableRow key={a.id} className="cursor-pointer" onClick={() => { setDetalhe(a); setMotivo(""); }}>
                <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-background">{fmtEmissao(a.created_at)}<p className="font-mono text-xs text-muted-foreground">{a.protocolo}</p></TableCell>
                <TableCell className="max-w-[220px] truncate">{toTitleCase(a.empresa_nome)}</TableCell>
                <TableCell className="max-w-[260px] text-sm">{[es.unidade, es.setor, es.cargo].filter(Boolean).map((x: string) => toTitleCase(x)).join(" / ") || "—"}</TableCell>
                <TableCell className="max-w-[220px]"><p className="truncate">{toTitleCase(a.solicitante?.nome ?? "") || "—"}</p><p className="truncate text-xs text-muted-foreground">{a.solicitante?.email ?? ""}</p></TableCell>
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

      <Tabs value={aba} onValueChange={(v) => setFiltro({ tab: v })}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="lista">Agendamentos ({lista.length})</TabsTrigger>
          <TabsTrigger value="aprovacao">Aprovações{pendentes.filter((p: any) => p.aprovacao_status === "pendente").length ? ` (${pendentes.filter((p: any) => p.aprovacao_status === "pendente").length})` : ""}</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
        </TabsList>
        {aba !== "calendario" && aba !== "aprovacao" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {aba === "lista" && <>
              <div className="min-w-[200px] flex-1 space-y-2"><Label htmlFor="busca-agenda" className="block">Busca</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="busca-agenda" className="pl-9" placeholder="Colaborador, CPF, empresa ou protocolo" value={busca} onChange={(e) => setFiltro({ busca: e.target.value })} /></div></div>
              <div className="space-y-2"><Label className="block">Canal</Label><select aria-label="Canal" className="h-10 rounded-md border bg-background px-3 text-sm" value={filtroCanal} onChange={(e) => setFiltro({ canal: e.target.value })}><option value="todos">Todos</option>{["Link público", "WhatsApp", "SOCNET"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="space-y-2"><Label className="block">Kit</Label><select aria-label="Kit" className="h-10 rounded-md border bg-background px-3 text-sm" value={kit} onChange={(e) => setFiltro({ kit: e.target.value })}><option value="todos">Todos</option><option value="sem">Sem kit</option><option value="enviado">Com kit</option><option value="imprimir">Kit não impresso</option><option value="impresso">Kit impresso</option></select></div>
            </>}
            <div className="space-y-2"><Label className="block">Unidade</Label>
              <select aria-label="Unidade" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={unidade} onChange={(e) => setFiltro({ unidade: e.target.value })}>
                <option value="">Todas</option>{unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>
            <div className="space-y-2"><Label className="block">De</Label><Input type="date" value={de} onChange={(e) => setFiltro({ de: e.target.value })} /></div>
            <div className="space-y-2"><Label className="block">Até</Label><Input type="date" value={ate} onChange={(e) => setFiltro({ ate: e.target.value })} /></div>
            <Button variant="outline" onClick={() => setFiltro({ de: hojeIso(), ate: hojeIso() })}>Hoje</Button>
          </div>
        )}
        <TabsContent value="calendario">
          <CalendarioOperacional hoje={hojeIso()} onDia={(d) => setFiltro({ tab: "lista", de: d, ate: d })} />
        </TabsContent>
        <TabsContent value="conferencia" className="space-y-4">
          {(() => {
            const semKit = (a: any) => !temKitAgenda(a);
            const filtros: Record<string, { label: string; f: (a: any) => boolean }> = {
              todos: { label: "Todos", f: () => true },
              soc: { label: "Gravados no SOC", f: (a) => a.status === "agendado_soc" },
              pendente: { label: "Não entraram no SOC", f: (a) => a.status === "solicitado" },
              aprovacao: { label: "Aguardando aprovação", f: (a) => a.status === "aguardando_aprovacao" || a.status === "documentacao_devolvida" },
              semkit: { label: "Sem kit", f: semKit },
            };
            const fsel = filtros[conf] ? conf : "todos";
            const itens = [...lista].filter(filtros[fsel].f).sort((x: any, y: any) => y.created_at.localeCompare(x.created_at));
            const novo = (a: any) => Date.now() - new Date(a.created_at).getTime() < 30 * 60_000;
            return (<>
              <p className="text-xs text-muted-foreground">Agendamentos do link público e WhatsApp no período ({fmtData(de)} a {fmtData(ate)}), do mais recente para o mais antigo. Atualiza sozinho ao entrar um novo pedido · última atualização {agora}.</p>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                {Object.entries(filtros).map(([k, v]) => (
                  <button key={k} onClick={() => setConf(k)} className={`rounded-lg border p-4 text-left transition-colors ${fsel === k ? "border-primary bg-primary/5" : "bg-card hover:bg-muted"}`}>
                    <p className="text-sm text-muted-foreground whitespace-nowrap">{v.label}</p>
                    <p className={`text-3xl font-semibold ${k === "pendente" && lista.filter(v.f).length ? "text-destructive" : ""}`}>{lista.filter(v.f).length}</p>
                  </button>
                ))}
              </div>
              <Card><CardContent className="pt-4 overflow-x-auto">
                {itens.length ? (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background"><TableRow>
                      <TableHead>Emitido em</TableHead><TableHead>Atendimento</TableHead><TableHead>Colaborador</TableHead><TableHead>Empresa</TableHead>
                      <TableHead>Unidade</TableHead><TableHead>Canal</TableHead><TableHead>Kit</TableHead><TableHead>Situação</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{itens.map((a: any) => {
                      const st = STATUS[a.status] ?? { label: a.status, variant: "secondary" as const };
                      return (
                        <TableRow key={a.id} className="cursor-pointer" onClick={() => { setDetalhe(a); setMotivo(""); }}>
                          <TableCell className="whitespace-nowrap">{fmtDataHora(a.created_at)}{novo(a) && <Badge className="ml-2 whitespace-nowrap">Novo</Badge>}</TableCell>
                          <TableCell className="whitespace-nowrap">{a.data_agendada ? `${fmtData(a.data_agendada)} ${a.hora_agendada?.slice(0, 5) ?? ""}` : "Sem data (estrutura)"}</TableCell>
                          <TableCell className="max-w-[220px]"><p className="truncate whitespace-nowrap font-medium" title={toTitleCase(a.colaborador_nome) ?? ""}>{toTitleCase(a.colaborador_nome)}</p><p className="text-xs text-muted-foreground">{a.tipo_exame}</p></TableCell>
                          <TableCell className="max-w-[220px] truncate">{a.empresa_nome}</TableCell>
                          <TableCell className="whitespace-nowrap">{nomeUnidade(a)}</TableCell>
                          <TableCell><Selos a={a} /></TableCell>
                          <TableCell>{semKit(a) ? <Badge variant="secondary" className="whitespace-nowrap">Sem kit</Badge> : <Badge variant="outline" className="whitespace-nowrap"><Paperclip className="mr-1 h-3 w-3" />{a.soc_agendamento_anexos.length}</Badge>}</TableCell>
                          <TableCell><Badge variant={st.variant} className="whitespace-nowrap">{st.label}</Badge>{a.soc_erro && <p className="mt-1 max-w-[220px] truncate text-xs text-destructive" title={a.soc_erro}>{a.soc_erro}</p>}</TableCell>
                        </TableRow>
                      );
                    })}</TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">Nada para conferir neste filtro.</p>}
              </CardContent></Card>
            </>);
          })()}
        </TabsContent>
        <TabsContent value="lista" className="space-y-3">
          <Card><CardContent className="pt-4">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : visiveis.length ? <Linhas itens={visiveis} /> : <p className="text-sm text-muted-foreground">Nenhum agendamento no período.</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="aprovacao">
          {(() => {
            const fila = sp.get("fila") === "engenharia" ? "engenharia" : "saude";
            const daFila = (k: string) => pendentes.filter((p: any) => (p.fila_aprovacao ?? "saude") === k);
            const n = (k: string) => daFila(k).filter((p: any) => p.aprovacao_status === "pendente").length;
            const sit = sp.get("sit") === "realizado" ? "realizado" : "pendente";
            const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const qEng = norm((sp.get("beng") ?? "").trim());
            const itens = fila === "saude" ? daFila("saude").filter((p: any) => p.aprovacao_status !== "aprovado")
              : daFila("engenharia").filter((p: any) => (sit === "realizado") === (p.aprovacao_status === "aprovado"))
                .filter((p: any) => !qEng || norm([p.empresa_nome, p.protocolo, p.solicitante?.nome, p.solicitante?.email].join(" ")).includes(qEng));
            return (
              <Tabs value={fila} onValueChange={(v) => setFiltro({ fila: v })}>
                <TabsList>
                  <TabsTrigger value="saude" className="whitespace-nowrap"><Stethoscope className="mr-1 h-4 w-4" />Saúde{n("saude") ? ` (${n("saude")})` : ""}</TabsTrigger>
                  <TabsTrigger value="engenharia" className="whitespace-nowrap"><HardHat className="mr-1 h-4 w-4" />Engenharia{n("engenharia") ? ` (${n("engenharia")})` : ""}</TabsTrigger>
                </TabsList>
                <Card className="mt-3"><CardContent className="pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">{fila === "saude"
                    ? "Documentação de saúde (Retorno ao Trabalho e outras): confira se está completa e legível. Ao aprovar, o horário é gravado no SOC; ao devolver, o cliente vê o motivo e reenvia pelo protocolo."
                    : "Solicitações de inclusão de unidade, setor ou cargo. Cadastre a estrutura no SOC e clique em \"Confirmar cadastro no SOC\". O cliente agenda depois que a estrutura existir."}</p>
                  {fila === "engenharia" && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[220px] flex-1"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar solicitação" className="pl-9" placeholder="Empresa, protocolo, solicitante ou e-mail" value={sp.get("beng") ?? ""} onChange={(e) => setFiltro({ beng: e.target.value })} /></div></div>
                      <div className="flex gap-1">
                        <Button size="sm" variant={sit === "pendente" ? "default" : "outline"} onClick={() => setFiltro({ sit: "pendente" })}>Pendentes{n("engenharia") ? ` (${n("engenharia")})` : ""}</Button>
                        <Button size="sm" variant={sit === "realizado" ? "default" : "outline"} onClick={() => setFiltro({ sit: "realizado" })}>Realizados</Button>
                      </div>
                    </div>
                  )}
                  {itens.length ? (fila === "engenharia" ? <LinhasEng itens={itens} /> : <Linhas itens={itens} />)
                    : <p className="text-sm text-muted-foreground">{fila === "engenharia" && sit === "realizado" ? "Nenhuma solicitação realizada encontrada." : "Nada aguardando nesta fila."}</p>}
                </CardContent></Card>
              </Tabs>
            );
          })()}
        </TabsContent>
        <TabsContent value="dashboard" className="space-y-4">
          {(() => {
            const h = hojeIso();
            const menos = (n: number) => new Date(new Date(h + "T12:00:00").getTime() - n * 86400_000).toISOString().slice(0, 10);
            const fimMes = (() => { const d = new Date(h + "T12:00:00"); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10); })();
            const atalhos: [string, string, string][] = [["Hoje", h, h], ["7 dias", menos(6), h], ["Mês atual", h.slice(0, 8) + "01", fimMes], ["30 dias", menos(29), h]];
            return (
              <div className="flex flex-wrap items-center gap-2">
                {atalhos.map(([r, d1, d2]) => <Button key={r} size="sm" variant={de === d1 && ate === d2 ? "default" : "outline"} onClick={() => setFiltro({ de: d1, ate: d2 })}>{r}</Button>)}
                <span className="text-xs text-muted-foreground">Período: {fmtData(de)} a {fmtData(ate)} · atualiza sozinho</span>
              </div>
            );
          })()}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
            <Kpi k="Agendamentos" v={dash.total} sub={`média de ${dash.mediaDia} por dia`} />
            <Kpi k="Colaboradores" v={dash.colaboradores} />
            <Kpi k="Exames" v={dash.exames} />
            <Kpi k="Exames clínicos" v={dash.clinicos} sub="demanda médica" />
            <Kpi k="Complementares" v={dash.complementares} sub="enfermagem/técnicos" />
            <Kpi k="Com kit" v={`${dash.kitPct}%`} sub={`${dash.semKit} sem kit anexado`} />
          </div>
          <AgendaGraficos nomesUn={dash.nomesUn} porDiaUn={dash.porDiaUn} porFaixa={dash.porFaixa} porCanal={dash.porCanal} porSubgrupo={dash.porSubgrupo} />
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="Dias de maior fluxo" dados={dash.pico.map((p) => [fmtData(p.dia), p.total])} />
            <Ranking titulo="Dias mais tranquilos" dados={dash.calmo.map((p) => [fmtData(p.dia), p.total])} />
            <Ranking titulo="Média por dia da semana" dados={dash.semana} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="10 exames mais solicitados" dados={dash.topExames} />
            <Ranking titulo="Exames complementares mais solicitados" dados={dash.complementaresRank} sub="impacto na escala de enfermagem" />
            <Ranking titulo="Empresas que mais agendam" dados={dash.topEmpresas} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="Por unidade" dados={dash.porUnidade} />
            <Ranking titulo="Por tipo de exame" dados={dash.porTipo} />
            <Ranking titulo="Situação no SOC" dados={dash.porStatus} />
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detalhe && (<>
            <SheetHeader><SheetTitle className="text-lg">{detalhe.fila_aprovacao === "engenharia" ? "Solicitação de estrutura" : toTitleCase(detalhe.colaborador_nome)}</SheetTitle></SheetHeader>
            {detalhe.fila_aprovacao !== "engenharia" && <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="whitespace-nowrap">{nomeUnidade(detalhe)}</Badge>
              <Badge variant="secondary" className="whitespace-nowrap">{subgrupoDe(detalhe)}</Badge>
              <Selos a={detalhe} />
            </div>}
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Protocolo</dt><dd className="font-mono">{detalhe.protocolo}</dd>
              {detalhe.fila_aprovacao !== "engenharia" && (<><dt className="text-muted-foreground">CPF</dt><dd>{fmtCpf(detalhe.colaborador_cpf)}</dd></>)}
              <dt className="text-muted-foreground">Emitido em</dt><dd>{detalhe.fila_aprovacao === "engenharia" ? fmtEmissao(detalhe.created_at) : fmtDataHora(detalhe.created_at)}</dd>
              {detalhe.fila_aprovacao !== "engenharia" && canal(detalhe) === "WhatsApp" && (<><dt className="text-muted-foreground">Solicitante</dt><dd>
                {!isAdmMaster ? <span className="text-muted-foreground">Via WhatsApp (contato visível para ADM Master)</span>
                  : solicitante ? (<div className="space-y-1"><p>{solicitante.nome_whatsapp || "Sem nome no WhatsApp"}</p>
                    <a className="inline-flex items-center gap-1 text-primary underline" href={`https://wa.me/${solicitante.telefone}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3" />{solicitante.telefone}</a></div>)
                  : <span className="text-muted-foreground">Não localizado</span>}
              </dd></>)}
              <dt className="text-muted-foreground">Empresa</dt><dd>{toTitleCase(detalhe.empresa_nome)}{detalhe.codigo_empresa_soc ? <span className="text-xs text-muted-foreground"> · SOC {detalhe.codigo_empresa_soc}</span> : null}</dd>
              {detalhe.data_agendada && (<><dt className="text-muted-foreground">Data</dt><dd>{fmtData(detalhe.data_agendada)} às {detalhe.hora_agendada?.slice(0, 5)}</dd></>)}
              {detalhe.fila_aprovacao !== "engenharia" && (<><dt className="text-muted-foreground">Unidade</dt><dd>{nomeUnidade(detalhe)}</dd>
              <dt className="text-muted-foreground">Subgrupo</dt><dd>{subgrupoDe(detalhe)}</dd>
              <dt className="text-muted-foreground">Tipo</dt><dd>{detalhe.tipo_exame}</dd>
              <dt className="text-muted-foreground">Exames</dt><dd>{(detalhe.exames ?? []).join(", ") || "-"}</dd></>)}
              {detalhe.solicitante && detalhe.fila_aprovacao !== "engenharia" && (<><dt className="text-muted-foreground">Solicitante</dt><dd>{toTitleCase(detalhe.solicitante.nome ?? "")} · {detalhe.solicitante.email} · {detalhe.solicitante.celular}</dd></>)}
              {detalhe.motivo_retorno && (<><dt className="text-muted-foreground">Motivo do retorno</dt><dd className="whitespace-pre-wrap">{detalhe.motivo_retorno}</dd></>)}
              {detalhe.observacoes && (<><dt className="text-muted-foreground">Observações</dt><dd className="whitespace-pre-wrap">{detalhe.observacoes}</dd></>)}
              {detalhe.soc_erro && (<><dt className="text-muted-foreground">Erro SOC</dt><dd className="text-destructive">{detalhe.soc_erro}</dd></>)}
              {detalhe.devolucao_motivo && (<><dt className="text-muted-foreground">Devolvido</dt><dd>{detalhe.devolucao_motivo}</dd></>)}
              {detalhe.estrutura_solicitada && (<>
                <dt className="text-muted-foreground">Estrutura solicitada</dt>
                <dd>{[detalhe.estrutura_solicitada.unidade, detalhe.estrutura_solicitada.setor, detalhe.estrutura_solicitada.cargo].map((x: string) => toTitleCase(x)).join(" · ")}</dd>
                {detalhe.estrutura_solicitada.atividades && (<><dt className="text-muted-foreground">Atividades do cargo</dt><dd className="whitespace-pre-wrap rounded-md bg-muted p-2">{detalhe.estrutura_solicitada.atividades}</dd></>)}
                {detalhe.fila_aprovacao !== "engenharia" && detalhe.estrutura_solicitada.nascimento && (<><dt className="text-muted-foreground">Pré-cadastro</dt><dd>Nasc. {fmtData(detalhe.estrutura_solicitada.nascimento)} · {toTitleCase(detalhe.estrutura_solicitada.sexo ?? "")} · Admissão {fmtData(detalhe.estrutura_solicitada.admissao ?? "")}</dd></>)}
              </>)}
              {detalhe.fila_aprovacao === "engenharia" && (<><dt className="text-muted-foreground">Solicitante</dt><dd className="space-y-0.5"><p>{toTitleCase(detalhe.solicitante?.nome ?? "") || "—"}</p><p className="text-muted-foreground">{detalhe.solicitante?.email ?? "—"}</p><p className="text-muted-foreground">{detalhe.solicitante?.celular ?? "—"}</p></dd></>)}
            </dl>
            {detalhe.fila_aprovacao !== "engenharia" && <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Anexos</p>
              {detalhe.kit_impresso_em && <p className="text-sm text-primary">Kit marcado como impresso em {fmtDataHora(detalhe.kit_impresso_em)}</p>}
              {detalhe.data_agendada && <button type="button" onClick={async () => {
                const email = window.prompt("Enviar comprovante para qual e-mail?", detalhe.solicitante?.email ?? "");
                if (!email) return;
                const { data, error } = await supabase.functions.invoke("agenda-enviar-comprovante", { body: { protocolo: detalhe.protocolo, cpf: detalhe.colaborador_cpf, email: email.trim() } });
                window.alert(error || data?.error ? (data?.error ?? "Não foi possível enviar agora.") : `Comprovante enviado para ${email.trim()}.`);
              }} className="mr-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Send className="h-3 w-3" />Enviar comprovante por e-mail</button>}
              {podeEditar && temKitAgenda(detalhe) && <button type="button" disabled={enviando} onClick={marcarKit} className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"><Printer className="h-3 w-3" />{detalhe.kit_impresso_em ? "Desmarcar impressão" : "Marcar como impresso"}</button>}
              {detalhe.soc_agendamento_anexos?.length ? detalhe.soc_agendamento_anexos.map((x: any) => (
                <Button key={x.id} variant="outline" size="sm" className="w-full justify-start min-w-0" onClick={() => abrirArquivo(x.path)}>
                  <FileText className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{x.tipo_documento}{x.nome_arquivo ? `: ${x.nome_arquivo}` : ""}</span><span className="ml-auto text-xs text-muted-foreground">{new Date(x.enviado_em).toLocaleDateString("pt-BR")}</span>
                </Button>
              )) : <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>}
            </div>}
            {podeAprovar && detalhe.aprovacao_status === "pendente" && (
              <div className="mt-6 space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">{detalhe.fila_aprovacao === "engenharia" ? "Decisão da Engenharia" : "Decisão da equipe de saúde"}</p>
                <Textarea placeholder={detalhe.fila_aprovacao === "engenharia" ? "Motivo da devolução (obrigatório para devolver). Ex.: cargo já existe com outro nome, informar atividades." : "Motivo da devolução (obrigatório para devolver). Ex.: laudo ilegível, falta alta médica."} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={enviando || motivo.trim().length < 5} onClick={() => decidir("devolver")}>Devolver</Button>
                  <Button disabled={enviando} onClick={() => decidir("aprovar")}>{enviando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{detalhe.fila_aprovacao === "engenharia" && !detalhe.data_agendada ? "Confirmar cadastro no SOC" : "Aprovar e agendar"}</Button>
                </div>
              </div>
            )}
            {isAdmMaster && (
              <div className="mt-6 rounded-md border border-destructive/40 p-3">
                <p className="text-sm font-medium text-destructive">Área ADM Master</p>
                <p className="mb-2 text-xs text-muted-foreground">Exclui definitivamente este protocolo (uso para testes). A ação fica registrada no log de auditoria.</p>
                <Button variant="destructive" size="sm" disabled={enviando} onClick={excluirProtocolo}>Excluir protocolo</Button>
              </div>
            )}
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
