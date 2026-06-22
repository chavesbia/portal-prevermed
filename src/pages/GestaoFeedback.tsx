import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, ClipboardCheck, AlertTriangle, CheckCircle2, Clock, TrendingUp, Plus,
  Edit, Target, BarChart3, Settings, MessageSquareHeart,
} from "lucide-react";
import {
  useColaboradores, useSetores, useStatusColaboradores, useCompetencias, useNiveis,
  useUpsertColaborador, useUpsertSetor, useUpdateNivelDescricao, usePlanosConsolidados,
  useUpdateAcaoStatus, useUpsertColaboradorByUser,
  CLASS_LABELS, CLASS_COLORS, RISCO_LABELS,
  type FbStatusColab, type FbColaborador, type FbAcaoStatus,
} from "@/hooks/useFeedback";
import { Switch } from "@/components/ui/switch";
import { NovaAvaliacaoDrawer } from "@/components/feedback/NovaAvaliacaoDrawer";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const STATUS_LABELS = {
  em_dia: { label: "Em Dia", icon: "🟢", color: "text-green-600 bg-green-50" },
  proximo: { label: "Próximo do Vencimento", icon: "🟡", color: "text-yellow-700 bg-yellow-50" },
  atrasado: { label: "Atrasado", icon: "🔴", color: "text-red-600 bg-red-50" },
  sem_feedback: { label: "Sem Feedback", icon: "⚪", color: "text-gray-600 bg-gray-50" },
} as const;

const ACAO_STATUS: Record<FbAcaoStatus, string> = {
  nao_iniciado: "Não Iniciado", em_andamento: "Em Andamento", concluido: "Concluído", atrasado: "Atrasado",
};

export default function GestaoFeedback() {
  const { data: status = [] } = useStatusColaboradores();
  const { data: setores = [] } = useSetores();
  const { data: comps = [] } = useCompetencias();
  const { data: niveis = [] } = useNiveis();
  const { data: colabs = [] } = useColaboradores();
  const planos = usePlanosConsolidados();

  const [tab, setTab] = useState("dashboard");
  const [filtroSetor, setFiltroSetor] = useState<string>("_");
  const [filtroStatus, setFiltroStatus] = useState<string>("_");
  const [filtroCiclo, setFiltroCiclo] = useState<"ciclo" | "todos" | "fora">("ciclo");
  const [busca, setBusca] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selColab, setSelColab] = useState<string | null>(null);
  const [selAvaliacao, setSelAvaliacao] = useState<string | null>(null);

  // KPIs consideram apenas colaboradores incluídos no ciclo
  const noCiclo = useMemo(() => status.filter((s) => s.incluido_no_ciclo), [status]);

  const kpis = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.toISOString().slice(0, 7);
    return {
      total: noCiclo.length,
      pendentes: noCiclo.filter((s) => s.status_feedback === "sem_feedback").length,
      atrasados: noCiclo.filter((s) => s.status_feedback === "atrasado").length,
      proximos: noCiclo.filter((s) => s.status_feedback === "proximo").length,
      noMes: noCiclo.filter((s) => s.ultimo_feedback?.startsWith(mesAtual)).length,
      mediaGeral: (() => {
        const com = noCiclo.filter((s) => s.pontuacao_total);
        return com.length ? Math.round((com.reduce((sum, s) => sum + (s.pontuacao_total || 0), 0) / com.length) * 10) / 10 : 0;
      })(),
      emRisco: noCiclo.filter((s) => s.risco === "alto").length,
    };
  }, [noCiclo]);

  const filtrados = useMemo(() => {
    return status.filter((s) => {
      if (filtroCiclo === "ciclo" && !s.incluido_no_ciclo) return false;
      if (filtroCiclo === "fora" && s.incluido_no_ciclo) return false;
      if (filtroSetor !== "_" && s.setor_nome !== filtroSetor) return false;
      if (filtroStatus !== "_" && s.status_feedback !== filtroStatus) return false;
      if (busca && !s.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [status, filtroCiclo, filtroSetor, filtroStatus, busca]);

  const distClassif = useMemo(() => {
    const counts: Record<string, number> = { insuficiente: 0, fraco: 0, razoavel: 0, bom: 0, excelente: 0 };
    status.forEach((s) => { if (s.classificacao) counts[s.classificacao]++; });
    return Object.entries(counts).map(([k, v]) => ({
      name: CLASS_LABELS[k as keyof typeof CLASS_LABELS], value: v, color: CLASS_COLORS[k as keyof typeof CLASS_COLORS],
    }));
  }, [status]);

  const rankingSetores = useMemo(() => {
    const map = new Map<string, { soma: number; n: number }>();
    status.forEach((s) => {
      if (!s.pontuacao_total || !s.setor_nome) return;
      const cur = map.get(s.setor_nome) ?? { soma: 0, n: 0 };
      cur.soma += s.pontuacao_total; cur.n += 1; map.set(s.setor_nome, cur);
    });
    return Array.from(map.entries())
      .map(([nome, { soma, n }]) => ({ nome, media: Math.round((soma / n) * 10) / 10 }))
      .sort((a, b) => b.media - a.media);
  }, [status]);

  const handleNovaAvaliacao = async (colabId: string, avalId?: string) => {
    let idToOpen = avalId ?? null;
    // Ao clicar em "Avaliar", retomar rascunho em andamento (não concluído) se existir,
    // em vez de criar uma nova avaliação em branco a cada clique.
    if (!idToOpen) {
      const { data } = await supabase
        .from("fb_avaliacoes")
        .select("id")
        .eq("colaborador_id", colabId)
        .eq("concluida", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) idToOpen = data.id;
    }
    setSelColab(colabId); setSelAvaliacao(idToOpen); setDrawerOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquareHeart className="h-8 w-8 text-primary" />Gestão de Feedback
          </h1>
          <p className="text-muted-foreground">Avaliação de desempenho, PDI e indicadores de pessoas.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="colaboradores"><Users className="h-4 w-4 mr-1" />Colaboradores</TabsTrigger>
          <TabsTrigger value="feedbacks"><ClipboardCheck className="h-4 w-4 mr-1" />Feedbacks</TabsTrigger>
          <TabsTrigger value="planos"><Target className="h-4 w-4 mr-1" />Planos</TabsTrigger>
          <TabsTrigger value="indicadores"><TrendingUp className="h-4 w-4 mr-1" />Indicadores</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" />Configurações</TabsTrigger>
        </TabsList>

        {/* ============= DASHBOARD ============= */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KpiCard icon={Users} label="Colaboradores" value={kpis.total} color="text-primary" />
            <KpiCard icon={Clock} label="Pendentes" value={kpis.pendentes} color="text-gray-600" />
            <KpiCard icon={CheckCircle2} label="No Mês" value={kpis.noMes} color="text-green-600" />
            <KpiCard icon={AlertTriangle} label="Vencidos" value={kpis.atrasados} color="text-red-600" />
            <KpiCard icon={Clock} label="A vencer" value={kpis.proximos} color="text-yellow-600" />
            <KpiCard icon={TrendingUp} label="Média Geral" value={kpis.mediaGeral} color="text-blue-600" />
            <KpiCard icon={AlertTriangle} label="Em Risco" value={kpis.emRisco} color="text-red-700" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Distribuição de Desempenho</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={distClassif} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                      {distClassif.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ranking de Setores (média)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rankingSetores} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" domain={[10, 40]} />
                    <YAxis type="category" dataKey="nome" width={120} />
                    <Tooltip />
                    <Bar dataKey="media" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============= COLABORADORES (vinculados aos usuários do portal) ============= */}
        <TabsContent value="colaboradores" className="space-y-3">
          <Card>
            <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
              <Input placeholder="Buscar colaborador..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
              <Select value={filtroCiclo} onValueChange={(v: any) => setFiltroCiclo(v)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ciclo">No ciclo de feedback</SelectItem>
                  <SelectItem value="fora">Fora do ciclo</SelectItem>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Todos os setores</SelectItem>
                  {Array.from(new Set(status.map((s) => s.setor_nome).filter(Boolean) as string[])).sort().map((nome) => (
                    <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Todos os status</SelectItem>
                  <SelectItem value="em_dia">🟢 Em Dia</SelectItem>
                  <SelectItem value="proximo">🟡 Próximo do Vencimento</SelectItem>
                  <SelectItem value="atrasado">🔴 Atrasado</SelectItem>
                  <SelectItem value="sem_feedback">⚪ Sem Feedback</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto text-xs text-muted-foreground max-w-sm">
                Os colaboradores vêm de <strong>Gerenciar Usuários</strong>. Aqui o RH escolhe quem entra no ciclo e complementa matrícula, CPF e periodicidade.
              </div>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No ciclo</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Último Feedback</TableHead>
                  <TableHead>Próximo Feedback</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((s) => (
                  <ColabRow key={s.colaborador_id} s={s} setores={setores}
                            onAvaliar={() => handleNovaAvaliacao(s.colaborador_id)}
                            onAbrir={() => s.ultima_avaliacao_id && handleNovaAvaliacao(s.colaborador_id, s.ultima_avaliacao_id)} />
                ))}
                {filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>


        {/* ============= FEEDBACKS ============= */}
        <TabsContent value="feedbacks">
          <FeedbacksRecentes status={status} onAbrir={(c, a) => handleNovaAvaliacao(c, a)} />
        </TabsContent>

        {/* ============= PLANOS ============= */}
        <TabsContent value="planos">
          <PlanosTab data={planos.data} />
        </TabsContent>

        {/* ============= INDICADORES ============= */}
        <TabsContent value="indicadores">
          <IndicadoresTab status={status} setores={setores} comps={comps} />
        </TabsContent>

        {/* ============= CONFIGURAÇÕES ============= */}
        <TabsContent value="config">
          <ConfigTab comps={comps} niveis={niveis} setores={setores} />
        </TabsContent>
      </Tabs>

      <NovaAvaliacaoDrawer open={drawerOpen} onOpenChange={setDrawerOpen}
                           colaboradorId={selColab} avaliacaoId={selAvaliacao} />
    </div>
  );
}

// ============= Subcomponents =============
function KpiCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function ColabRow({ s, setores, onAvaliar, onAbrir }: {
  s: FbStatusColab; setores: { id: string; nome: string }[];
  onAvaliar: () => void; onAbrir: () => void;
}) {
  const st = STATUS_LABELS[s.status_feedback];
  const upsertByUser = useUpsertColaboradorByUser();
  const [editOpen, setEditOpen] = useState(false);

  const toggleCiclo = async (checked: boolean) => {
    if (!s.user_id) return;
    await upsertByUser.mutateAsync({
      user_id: s.user_id,
      incluido_no_ciclo: checked,
      periodicidade_dias: s.periodicidade_dias ?? 90,
    });
  };

  return (
    <TableRow className={!s.incluido_no_ciclo ? "opacity-60" : ""}>
      <TableCell>
        <Switch checked={s.incluido_no_ciclo} disabled={!s.user_id || upsertByUser.isPending}
                onCheckedChange={toggleCiclo} />
      </TableCell>
      <TableCell className="font-medium">
        {s.nome}
        <div className="text-xs text-muted-foreground">{s.matricula ?? "sem matrícula"}</div>
      </TableCell>
      <TableCell>{s.setor_nome ?? "—"}</TableCell>
      <TableCell>{s.cargo ?? "—"}</TableCell>
      <TableCell>{s.ultimo_feedback ? new Date(s.ultimo_feedback).toLocaleDateString("pt-BR") : "—"}</TableCell>
      <TableCell>{s.proximo_feedback ? new Date(s.proximo_feedback).toLocaleDateString("pt-BR") : "—"}</TableCell>
      <TableCell className="text-center">
        {s.pontuacao_total != null && s.classificacao ? (
          <Badge
            className="font-semibold justify-center min-w-[96px] px-3 py-1"
            style={{ backgroundColor: CLASS_COLORS[s.classificacao] + "22", color: CLASS_COLORS[s.classificacao] }}
          >
            {s.pontuacao_total} · {CLASS_LABELS[s.classificacao]}
          </Badge>
        ) : "—"}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${st.color}`}>
          {st.icon} {st.label}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={s.risco === "alto" ? "destructive" : s.risco === "medio" ? "default" : "secondary"}>
          {RISCO_LABELS[s.risco]}
        </Badge>
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!s.user_id}>
          <Edit className="h-3.5 w-3.5 mr-1" />Dados
        </Button>
        {s.ultima_avaliacao_id && (
          <Button size="sm" variant="ghost" onClick={onAbrir}><Edit className="h-3.5 w-3.5" /></Button>
        )}
        {s.incluido_no_ciclo && s.fb_colaborador_id && (
          <Button size="sm" onClick={onAvaliar}><Plus className="h-3.5 w-3.5 mr-1" />Avaliar</Button>
        )}
      </TableCell>
      <EditColaboradorDialog open={editOpen} onOpenChange={setEditOpen} s={s} setores={setores} />
    </TableRow>
  );
}

function EditColaboradorDialog({ open, onOpenChange, s, setores }: {
  open: boolean; onOpenChange: (b: boolean) => void; s: FbStatusColab;
  setores: { id: string; nome: string }[];
}) {
  const upsert = useUpsertColaboradorByUser();
  const [form, setForm] = useState({
    matricula: s.matricula ?? "",
    cpf: s.cpf ?? "",
    periodicidade_dias: s.periodicidade_dias ?? 90,
  });

  const save = async () => {
    if (!s.user_id) return;
    await upsert.mutateAsync({
      user_id: s.user_id,
      matricula: form.matricula || null,
      cpf: form.cpf || null,
      periodicidade_dias: form.periodicidade_dias,
      incluido_no_ciclo: s.incluido_no_ciclo,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complementar dados — {s.nome}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground mb-2">
          Nome, cargo, unidade, setor (lotação), líder e gestor vêm de <strong>Gerenciar Usuários</strong>.
          Aqui você complementa apenas matrícula, CPF e periodicidade do ciclo.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Setor (lotação)</Label><Input value={s.setor_nome ?? "—"} disabled /></div>
          <div><Label>Cargo</Label><Input value={s.cargo ?? "—"} disabled /></div>
          <div><Label>Líder Direto</Label><Input value={s.lider_nome ?? "—"} disabled /></div>
          <div><Label>Gestor Direto</Label><Input value={s.gestor_nome ?? "—"} disabled /></div>
          <div><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
          <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>Periodicidade (dias)</Label>
            <Input type="number" value={form.periodicidade_dias}
                   onChange={(e) => setForm({ ...form, periodicidade_dias: parseInt(e.target.value) || 90 })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={upsert.isPending} onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function FeedbacksRecentes({ status, onAbrir }: { status: FbStatusColab[]; onAbrir: (colab: string, aval: string) => void }) {
  const comAvaliacao = status.filter((s) => s.ultima_avaliacao_id).sort((a, b) => (b.ultimo_feedback ?? "").localeCompare(a.ultimo_feedback ?? ""));
  return (
    <Card>
      <CardHeader><CardTitle>Avaliações Concluídas</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead><TableHead>Setor</TableHead>
              <TableHead>Data</TableHead><TableHead>Pontuação</TableHead><TableHead>Classificação</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comAvaliacao.map((s) => (
              <TableRow key={s.colaborador_id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{s.setor_nome}</TableCell>
                <TableCell>{s.ultimo_feedback && new Date(s.ultimo_feedback).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{s.pontuacao_total}</TableCell>
                <TableCell>
                  {s.classificacao && (
                    <Badge style={{ backgroundColor: CLASS_COLORS[s.classificacao] + "22", color: CLASS_COLORS[s.classificacao] }}>
                      {CLASS_LABELS[s.classificacao]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => onAbrir(s.colaborador_id, s.ultima_avaliacao_id!)}>Abrir</Button></TableCell>
              </TableRow>
            ))}
            {comAvaliacao.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma avaliação concluída ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlanosTab({ data }: { data?: { feedforward: any[]; pdi: any[] } }) {
  const upd = useUpdateAcaoStatus();
  if (!data) return <div className="text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Feedforward (Combinados Próximo Ciclo)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Ação</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.feedforward.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.fb_avaliacoes?.fb_colaboradores?.nome}</TableCell>
                  <TableCell className="max-w-md">{f.acao}</TableCell>
                  <TableCell>{f.responsavel ?? "—"}</TableCell>
                  <TableCell>{f.prazo ? new Date(f.prazo).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Select value={f.status} onValueChange={(v) => upd.mutate({ table: "fb_feedforward", id: f.id, status: v as FbAcaoStatus })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(ACAO_STATUS) as FbAcaoStatus[]).map(s => <SelectItem key={s} value={s}>{ACAO_STATUS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {data.feedforward.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum combinado registrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>PDI (Plano de Desenvolvimento Individual)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Competência</TableHead><TableHead>Ação</TableHead><TableHead>Prazo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.pdi.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.fb_avaliacoes?.fb_colaboradores?.nome}</TableCell>
                  <TableCell>{p.fb_competencias?.nome ?? "Geral"}</TableCell>
                  <TableCell className="max-w-md">{p.acao}</TableCell>
                  <TableCell>{p.prazo ? new Date(p.prazo).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={(v) => upd.mutate({ table: "fb_pdi", id: p.id, status: v as FbAcaoStatus })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(ACAO_STATUS) as FbAcaoStatus[]).map(s => <SelectItem key={s} value={s}>{ACAO_STATUS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {data.pdi.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum PDI registrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function IndicadoresTab({ status, setores, comps }: { status: FbStatusColab[]; setores: any[]; comps: any[] }) {
  const matriz = useMemo(() => {
    const por: Record<string, { alto: number; medio: number; baixo: number }> = {};
    status.forEach((s) => {
      const k = s.setor_nome ?? "—";
      por[k] = por[k] ?? { alto: 0, medio: 0, baixo: 0 };
      por[k][s.risco] += 1;
    });
    return Object.entries(por).map(([nome, v]) => ({ nome, ...v }));
  }, [status]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Matriz de Risco por Setor</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={matriz}>
              <XAxis dataKey="nome" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="alto" stackId="r" fill="hsl(0 84% 50%)" name="Alto Risco" />
              <Bar dataKey="medio" stackId="r" fill="hsl(48 96% 53%)" name="Médio Risco" />
              <Bar dataKey="baixo" stackId="r" fill="hsl(142 76% 40%)" name="Baixo Risco" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Colaboradores em Alto Risco</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Setor</TableHead><TableHead>Pontuação</TableHead><TableHead>Último Feedback</TableHead></TableRow></TableHeader>
            <TableBody>
              {status.filter((s) => s.risco === "alto" && s.pontuacao_total).map((s) => (
                <TableRow key={s.colaborador_id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{s.setor_nome}</TableCell>
                  <TableCell>{s.pontuacao_total}</TableCell>
                  <TableCell>{s.ultimo_feedback && new Date(s.ultimo_feedback).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {status.filter((s) => s.risco === "alto" && s.pontuacao_total).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Nenhum colaborador em alto risco.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigTab({ comps, niveis, setores }: { comps: any[]; niveis: any[]; setores: any[] }) {
  const upd = useUpdateNivelDescricao();
  const setor = useUpsertSetor();
  const [novoSetor, setNovoSetor] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Setores</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Novo setor" value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)} />
            <Button disabled={!novoSetor} onClick={async () => { await setor.mutateAsync({ nome: novoSetor }); setNovoSetor(""); }}>Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {setores.map((s) => <Badge key={s.id} variant="outline">{s.nome}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competências e Descrições Oficiais</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cadastre as descrições exatas do documento oficial da PreverMed. <strong>Nunca</strong> use geração por IA — as descrições devem ser fiéis ao documento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {comps.map((c) => (
            <div key={c.id} className="border rounded p-3">
              <div className="font-semibold mb-2">{c.ordem}. {c.nome}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((n) => {
                  const nivel = niveis.find((nv) => nv.competencia_id === c.id && nv.nota === n);
                  if (!nivel) return null;
                  const label = { 1: "1 - Insuficiente", 2: "2 - Abaixo do Esperado", 3: "3 - Adequado", 4: "4 - Excelente" }[n];
                  const valor = edits[nivel.id] ?? nivel.descricao_oficial ?? "";
                  return (
                    <div key={n} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Textarea rows={3} value={valor}
                        onChange={(e) => setEdits({ ...edits, [nivel.id]: e.target.value })}
                        onBlur={() => {
                          if (valor !== nivel.descricao_oficial) upd.mutate({ id: nivel.id, descricao_oficial: valor });
                        }}
                        placeholder="Cole aqui o texto oficial..."
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
