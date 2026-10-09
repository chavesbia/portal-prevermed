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
import { CalendarCheck, FileText, Loader2, Paperclip } from "lucide-react";
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
    const conta = (f: (a: any) => string) => Object.entries(lista.reduce((m: Record<string, number>, a: any) => ((m[f(a)] = (m[f(a)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
    return {
      total: lista.length,
      colaboradores: new Set(lista.map((a: any) => a.colaborador_cpf)).size,
      exames: lista.reduce((s: number, a: any) => s + (Array.isArray(a.exames) ? a.exames.length : 0), 0),
      porDia: conta((a) => fmtData(a.data_agendada)),
      porUnidade: conta((a) => a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "-"),
      porTipo: conta((a) => a.tipo_exame),
    };
  }, [lista]);

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

  const Ranking = ({ titulo, dados }: { titulo: string; dados: [string, number][] }) => (
    <Card><CardHeader><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        {dados.length ? dados.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span>{k}</span><span className="font-semibold">{v}</span></div>) : <p className="text-muted-foreground">Sem dados no período.</p>}
      </CardContent></Card>
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
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Agendamentos", dash.total], ["Colaboradores", dash.colaboradores], ["Exames", dash.exames]].map(([k, v]) => (
              <Card key={k as string}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{k}</p><p className="text-3xl font-semibold">{v}</p></CardContent></Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Ranking titulo="Por dia" dados={dash.porDia} />
            <Ranking titulo="Por unidade" dados={dash.porUnidade} />
            <Ranking titulo="Por tipo de ficha" dados={dash.porTipo} />
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detalhe && (<>
            <SheetHeader><SheetTitle>{detalhe.colaborador_nome}</SheetTitle></SheetHeader>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Protocolo</dt><dd className="font-mono">{detalhe.protocolo}</dd>
              <dt className="text-muted-foreground">CPF</dt><dd>{fmtCpf(detalhe.colaborador_cpf)}</dd>
              <dt className="text-muted-foreground">Empresa</dt><dd>{detalhe.empresa_nome}</dd>
              <dt className="text-muted-foreground">Data</dt><dd>{fmtData(detalhe.data_agendada)} às {detalhe.hora_agendada.slice(0, 5)}</dd>
              <dt className="text-muted-foreground">Unidade</dt><dd>{detalhe.soc_agenda_unidades?.nome}</dd>
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
                <Button key={x.id} variant="outline" size="sm" className="w-full justify-start" onClick={() => abrirArquivo(x.path)}>
                  <FileText className="mr-2 h-4 w-4" />{x.tipo_documento}<span className="ml-auto text-xs text-muted-foreground">{new Date(x.enviado_em).toLocaleDateString("pt-BR")}</span>
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
