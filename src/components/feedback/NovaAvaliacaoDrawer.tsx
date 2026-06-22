import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, ChevronLeft, ChevronRight, Sparkles, Check, Loader2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCompetencias, useNiveis, useStatusColaboradores, useSaveAvaliacao,
  useAvaliacaoDetalhe, useReabrirAvaliacao, CLASS_COLORS, classificar, type FbAcaoStatus,
} from "@/hooks/useFeedback";
import { useAuth } from "@/contexts/AuthContext";
import { generateFeedbackPDF } from "@/lib/feedback-pdf";
import { FileDown, Lock, Unlock } from "lucide-react";
import { VelocimetroDesempenho } from "./VelocimetroDesempenho";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradorId: string | null;
  avaliacaoId?: string | null;
  mode?: "edit" | "view";
}

interface AcaoLinha { acao: string; responsavel: string; prazo: string; status: FbAcaoStatus; competencia_id?: string | null }

const STATUS_LABELS: Record<FbAcaoStatus, string> = {
  nao_iniciado: "Não Iniciado", em_andamento: "Em Andamento", concluido: "Concluído", atrasado: "Atrasado",
};

export function NovaAvaliacaoDrawer({ open, onOpenChange, colaboradorId, avaliacaoId, mode = "edit" }: Props) {
  const { data: comps = [] } = useCompetencias();
  const { data: niveis = [] } = useNiveis();
  const { data: status = [] } = useStatusColaboradores();
  const { data: detalhe } = useAvaliacaoDetalhe(avaliacaoId ?? null);
  const save = useSaveAvaliacao();
  const reabrir = useReabrirAvaliacao();
  const { isAdmMaster } = useAuth();
  const concluida = !!detalhe?.avaliacao?.concluida;
  const readOnly = mode === "view" || concluida;

  const colab = status.find((c) => c.colaborador_id === colaboradorId);

  const [step, setStep] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(avaliacaoId ?? null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const skipAutosaveRef = useRef(true);
  const [dataAval, setDataAval] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dataProx, setDataProx] = useState<string>("");
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [campos, setCampos] = useState({ atividades: "", pontos_positivos: "", pontos_melhora: "", acoes_melhoria: "", observacoes: "" });
  const [feedforward, setFeedforward] = useState<AcaoLinha[]>([]);
  const [pdi, setPdi] = useState<AcaoLinha[]>([]);

  // Reset when drawer opens for a brand-new evaluation
  useEffect(() => {
    if (open && colab && !avaliacaoId) {
      skipAutosaveRef.current = true;
      setStep(0);
      setCurrentId(null);
      setSaveStatus("idle");
      setLastSavedAt(null);
      setNotas({});
      setCampos({ atividades: "", pontos_positivos: "", pontos_melhora: "", acoes_melhoria: "", observacoes: "" });
      setFeedforward([]);
      setPdi([]);
      setDataAval(new Date().toISOString().slice(0, 10));
      const periodo = colab.periodicidade_dias || 90;
      const prox = new Date(); prox.setDate(prox.getDate() + periodo);
      setDataProx(prox.toISOString().slice(0, 10));
      // Permitir autosave após hidratação inicial
      setTimeout(() => { skipAutosaveRef.current = false; }, 500);
    }
    if (open && avaliacaoId) {
      skipAutosaveRef.current = true;
      setCurrentId(avaliacaoId);
    }
    if (!open) {
      skipAutosaveRef.current = true;
    }
  }, [open, colab, avaliacaoId]);

  useEffect(() => {
    if (detalhe) {
      skipAutosaveRef.current = true;
      setDataAval(detalhe.avaliacao.data_avaliacao);
      setDataProx(detalhe.avaliacao.data_proximo_feedback ?? "");
      setCampos({
        atividades: detalhe.avaliacao.atividades ?? "",
        pontos_positivos: detalhe.avaliacao.pontos_positivos ?? "",
        pontos_melhora: detalhe.avaliacao.pontos_melhora ?? "",
        acoes_melhoria: detalhe.avaliacao.acoes_melhoria ?? "",
        observacoes: detalhe.avaliacao.observacoes ?? "",
      });
      const map: Record<string, number> = {};
      detalhe.notas.forEach((n) => (map[n.competencia_id] = n.nota));
      setNotas(map);
      setFeedforward(detalhe.feedforward.map((f) => ({ acao: f.acao, responsavel: f.responsavel ?? "", prazo: f.prazo ?? "", status: f.status })));
      setPdi(detalhe.pdi.map((p) => ({ acao: p.acao, responsavel: p.responsavel ?? "", prazo: p.prazo ?? "", status: p.status, competencia_id: (p as any).competencia_id })));
      setTimeout(() => { skipAutosaveRef.current = false; }, 500);
    }
  }, [detalhe]);

  const total = useMemo(() => Object.values(notas).reduce((s, n) => s + (n || 0), 0), [notas]);
  const todasNotas = comps.length > 0 && comps.every((c) => notas[c.id]);
  const classif = todasNotas ? classificar(total) : null;

  // Auto-suggest PDI for low scores
  useEffect(() => {
    if (step === 4 && comps.length > 0) {
      setPdi((cur) => {
        const novos = comps.filter((c) => notas[c.id] && notas[c.id] <= 2)
          .filter((c) => !cur.some((p) => p.competencia_id === c.id))
          .map<AcaoLinha>((c) => ({ acao: "", responsavel: "", prazo: "", status: "nao_iniciado", competencia_id: c.id }));
        return [...cur, ...novos];
      });
    }
  }, [step, comps, notas]);

  // ============ AUTOSAVE (debounced) ============
  useEffect(() => {
    if (!open || !colaboradorId || skipAutosaveRef.current) return;
    const t = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        const res = await save.mutateAsync({
          id: currentId ?? undefined,
          colaborador_id: colaboradorId,
          data_avaliacao: dataAval,
          data_proximo_feedback: dataProx || null,
          ...campos,
          concluida: false,
          notas: Object.entries(notas).map(([competencia_id, nota]) => ({ competencia_id, nota })),
          feedforward: feedforward.filter((f) => f.acao.trim()).map((f) => ({ acao: f.acao, responsavel: f.responsavel || null, prazo: f.prazo || null, status: f.status })),
          pdi: pdi.filter((p) => p.acao.trim()).map((p) => ({ competencia_id: p.competencia_id ?? null, acao: p.acao, responsavel: p.responsavel || null, prazo: p.prazo || null, status: p.status })),
          silent: true,
        });
        if (!currentId) setCurrentId(res.id);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAval, dataProx, campos, notas, feedforward, pdi]);

  const handleConcluir = async () => {
    if (!colaboradorId) return;
    if (!todasNotas) {
      alert("Para concluir, é necessário avaliar todas as 10 competências.");
      return;
    }
    await save.mutateAsync({
      id: currentId ?? undefined,
      colaborador_id: colaboradorId,
      data_avaliacao: dataAval,
      data_proximo_feedback: dataProx || null,
      ...campos,
      concluida: true,
      notas: Object.entries(notas).map(([competencia_id, nota]) => ({ competencia_id, nota })),
      feedforward: feedforward.filter((f) => f.acao.trim()).map((f) => ({ acao: f.acao, responsavel: f.responsavel || null, prazo: f.prazo || null, status: f.status })),
      pdi: pdi.filter((p) => p.acao.trim()).map((p) => ({ competencia_id: p.competencia_id ?? null, acao: p.acao, responsavel: p.responsavel || null, prazo: p.prazo || null, status: p.status })),
    });
    onOpenChange(false);
  };

  const steps = ["Cabeçalho", "Competências", "Qualitativos", "Feedforward", "PDI", "Resumo"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Avaliação de Desempenho — {colab?.nome ?? "—"}</span>
            <Badge variant="outline">{steps[step]}</Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 my-4">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Colaborador</Label><Input value={colab?.nome ?? ""} disabled /></div>
              <div><Label>Setor (lotação)</Label><Input value={colab?.setor_nome ?? "—"} disabled /></div>
              <div><Label>Cargo</Label><Input value={colab?.cargo ?? ""} disabled /></div>
              <div><Label>Periodicidade (dias)</Label><Input value={String(colab?.periodicidade_dias ?? "")} disabled /></div>
              <div><Label>Líder Direto</Label><Input value={colab?.lider_nome ?? "—"} disabled /></div>
              <div><Label>Gestor Direto</Label><Input value={colab?.gestor_nome ?? "—"} disabled /></div>
              <div><Label>Data do Feedback *</Label><Input type="date" value={dataAval} onChange={(e) => setDataAval(e.target.value)} /></div>
              <div><Label>Próximo Feedback</Label><Input type="date" value={dataProx} onChange={(e) => setDataProx(e.target.value)} /></div>
            </div>
            <div>
              <Label>Atividades Realizadas</Label>
              <Textarea
                value={campos.atividades}
                onChange={(e) => setCampos({ ...campos, atividades: e.target.value })}
                rows={4}
                placeholder="Descreva as principais atividades realizadas no período avaliado..."
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione uma nota de 1 a 4 para cada competência. A descrição oficial será exibida automaticamente.</p>
            {comps.map((c) => {
              const nota = notas[c.id];
              const nivel = nota ? niveis.find((n) => n.competencia_id === c.id && n.nota === nota) : null;
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{c.ordem}. {c.nome}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <button key={n} type="button" onClick={() => setNotas({ ...notas, [c.id]: n })}
                                  className={`w-9 h-9 rounded-md text-sm font-bold border transition ${nota === n ? "text-white" : "hover:bg-muted"}`}
                                  style={nota === n ? { backgroundColor: ["", "hsl(0 84% 50%)", "hsl(25 95% 53%)", "hsl(217 91% 55%)", "hsl(142 76% 40%)"][n], borderColor: "transparent" } : {}}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {nivel && (
                    <CardContent className="pt-0">
                      <div className="text-sm bg-muted/40 rounded p-3 border-l-4" style={{ borderLeftColor: ["", "hsl(0 84% 50%)", "hsl(25 95% 53%)", "hsl(217 91% 55%)", "hsl(142 76% 40%)"][nota!] }}>
                        {nivel.descricao_oficial?.trim()
                          ? <span className="whitespace-pre-wrap">{nivel.descricao_oficial}</span>
                          : <span className="italic text-muted-foreground">Descrição oficial ainda não cadastrada pelo RH em Configurações.</span>}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {([
              ["pontos_positivos", "Pontos Positivos"],
              ["pontos_melhora", "Pontos de Melhora"],
              ["acoes_melhoria", "Ações de Melhoria"],
              ["observacoes", "Observações do Gestor"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Textarea value={(campos as any)[k]} onChange={(e) => setCampos({ ...campos, [k]: e.target.value })} rows={3} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" />A IA assistente apenas sugere redação — nunca altera notas nem descrições oficiais.</p>
          </div>
        )}

        {step === 3 && (
          <AcaoEditor titulo="Combinados para o Próximo Ciclo" linhas={feedforward} setLinhas={setFeedforward} />
        )}

        {step === 4 && (
          <AcaoEditor titulo="Plano de Desenvolvimento Individual (PDI)" linhas={pdi} setLinhas={setPdi}
                     comps={comps} showCompetencia descricao="Linhas pré-criadas para competências com nota 1 ou 2." />
        )}

        {step === 5 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="py-6 flex flex-col items-center">
                <VelocimetroDesempenho pontuacao={todasNotas ? total : null} classificacao={classif} />
                <div className="mt-4 text-sm text-muted-foreground">Data: {new Date(dataAval).toLocaleDateString("pt-BR")}</div>
              </CardContent>
            </Card>
            {!todasNotas && <p className="text-sm text-destructive">Avalie todas as {comps.length} competências para concluir.</p>}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t sticky bottom-0 bg-background">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-[120px] justify-end">
              {saveStatus === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" />Salvando…</>)}
              {saveStatus === "saved" && (<><Check className="h-3 w-3 text-green-600" />Salvo automaticamente{lastSavedAt ? ` às ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</>)}
              {saveStatus === "error" && (<><AlertCircle className="h-3 w-3 text-destructive" />Falha ao salvar — tentando novamente</>)}
              {saveStatus === "idle" && <span className="opacity-0">.</span>}
            </div>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Próximo<ChevronRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleConcluir} disabled={!todasNotas || save.isPending}>
                Concluir Avaliação
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AcaoEditor({
  titulo, linhas, setLinhas, comps, showCompetencia, descricao,
}: {
  titulo: string;
  linhas: AcaoLinha[];
  setLinhas: (v: AcaoLinha[]) => void;
  comps?: { id: string; nome: string }[];
  showCompetencia?: boolean;
  descricao?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{titulo}</h3>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setLinhas([...linhas, { acao: "", responsavel: "", prazo: "", status: "nao_iniciado" }])}>
          <Plus className="h-4 w-4 mr-1" />Adicionar
        </Button>
      </div>
      {linhas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6 border rounded">Nenhuma ação adicionada.</p>}
      {linhas.map((l, i) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-2">
            {showCompetencia && comps && (
              <Select value={l.competencia_id ?? "_"} onValueChange={(v) => {
                const arr = [...linhas]; arr[i] = { ...l, competencia_id: v === "_" ? null : v }; setLinhas(arr);
              }}>
                <SelectTrigger><SelectValue placeholder="Competência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Geral</SelectItem>
                  {comps.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Textarea placeholder="Ação" value={l.acao} onChange={(e) => { const a = [...linhas]; a[i] = { ...l, acao: e.target.value }; setLinhas(a); }} rows={2} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Responsável" value={l.responsavel} onChange={(e) => { const a = [...linhas]; a[i] = { ...l, responsavel: e.target.value }; setLinhas(a); }} />
              <Input type="date" value={l.prazo} onChange={(e) => { const a = [...linhas]; a[i] = { ...l, prazo: e.target.value }; setLinhas(a); }} />
              <div className="flex gap-1">
                <Select value={l.status} onValueChange={(v) => { const a = [...linhas]; a[i] = { ...l, status: v as FbAcaoStatus }; setLinhas(a); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as FbAcaoStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => setLinhas(linhas.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
