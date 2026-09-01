import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarClock, ClipboardCheck, Target, TrendingUp, CheckCircle2, Clock, Send, Eye } from "lucide-react";
import {
  useMinhaArea, useSolicitarValidacaoAcao, useCompetencias,
  CLASS_COLORS, CLASS_LABELS, type FbAcao,
} from "@/hooks/useFeedback";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  nao_iniciado: { label: "Não Iniciado", color: "bg-gray-100 text-gray-700" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700" },
  atrasado: { label: "Atrasado", color: "bg-red-100 text-red-700" },
};

export function MinhaAreaFeedback() {
  const { data, isLoading } = useMinhaArea();
  const { data: comps = [] } = useCompetencias();
  const solicitar = useSolicitarValidacaoAcao();
  const [validarAcao, setValidarAcao] = useState<{ tabela: "fb_pdi" | "fb_feedforward"; id: string; nome: string } | null>(null);
  const [evidencia, setEvidencia] = useState("");
  const [verAvaliacao, setVerAvaliacao] = useState(false);

  if (isLoading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!data?.colaborador?.fb_colaborador_id) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Você ainda não foi incluído no ciclo de feedback. Fale com o RH.
        </CardContent>
      </Card>
    );
  }

  const c = data.colaborador;
  const ultima = data.ultimaDetalhe;
  const compMap = new Map(comps.map((x) => [x.id, x.nome]));

  const abrirSolicitar = (acao: FbAcao, tabela: "fb_pdi" | "fb_feedforward") => {
    setValidarAcao({ tabela, id: acao.id, nome: acao.acao });
    setEvidencia(acao.evidencia ?? "");
  };

  const enviarSolicitacao = async () => {
    if (!validarAcao) return;
    await solicitar.mutateAsync({ tabela: validarAcao.tabela, id: validarAcao.id, evidencia });
    setValidarAcao(null);
    setEvidencia("");
  };

  return (
    <div className="space-y-4">
      {/* Resumo pessoal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{c.pontuacao_total ?? "—"}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pontuação Atual</div>
            {c.classificacao && (
              <Badge className="mt-2 text-white border-transparent" style={{ backgroundColor: CLASS_COLORS[c.classificacao] }}>
                {CLASS_LABELS[c.classificacao]}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{data.avaliacoes.filter((a) => a.concluida).length}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Feedbacks Recebidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Target className="h-5 w-5 text-orange-600" />
              <span className="text-2xl font-bold">{data.pdiAtivo.length + data.feedforwardAtivo.length}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ações Ativas (PDI + Feedforward)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <CalendarClock className="h-5 w-5 text-green-600" />
              <span className="text-lg font-bold">
                {c.proximo_feedback ? new Date(c.proximo_feedback).toLocaleDateString("pt-BR") : "—"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Próximo Feedback</div>
          </CardContent>
        </Card>
      </div>

      {/* Última avaliação (conteúdo completo) */}
      {ultima ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Última Avaliação — {new Date(ultima.avaliacao.data_avaliacao).toLocaleDateString("pt-BR")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Total: {ultima.avaliacao.pontuacao_total ?? "—"} · {ultima.avaliacao.classificacao ? CLASS_LABELS[ultima.avaliacao.classificacao] : "—"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setVerAvaliacao(true)}>
              <Eye className="h-3.5 w-3.5 mr-1" />Ver detalhes
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="font-semibold text-muted-foreground text-xs mb-1">Pontos Positivos</div>
                <p className="whitespace-pre-wrap">{ultima.avaliacao.pontos_positivos ?? "—"}</p>
              </div>
              <div>
                <div className="font-semibold text-muted-foreground text-xs mb-1">Pontos de Melhoria</div>
                <p className="whitespace-pre-wrap">{ultima.avaliacao.pontos_melhora ?? "—"}</p>
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold text-muted-foreground text-xs mb-1">Ações Combinadas</div>
                <p className="whitespace-pre-wrap">{ultima.avaliacao.acoes_melhoria ?? "—"}</p>
              </div>
              {ultima.avaliacao.observacoes && (
                <div className="md:col-span-2">
                  <div className="font-semibold text-muted-foreground text-xs mb-1">Observações</div>
                  <p className="whitespace-pre-wrap">{ultima.avaliacao.observacoes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Você ainda não recebeu nenhum feedback.
          </CardContent>
        </Card>
      )}

      {/* PDI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />Meu PDI</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ao concluir uma ação, envie a evidência para o seu líder validar.
          </p>
        </CardHeader>
        <CardContent>
          <AcoesTable
            data={data.pdiAtivo.concat(ultima?.pdi.filter((p) => p.status === "concluido") ?? [])}
            tabela="fb_pdi"
            compMap={compMap}
            onSolicitar={abrirSolicitar}
          />
        </CardContent>
      </Card>

      {/* Feedforward */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Meus Combinados (Feedforward)</CardTitle>
        </CardHeader>
        <CardContent>
          <AcoesTable
            data={data.feedforwardAtivo.concat(ultima?.feedforward.filter((f) => f.status === "concluido") ?? [])}
            tabela="fb_feedforward"
            onSolicitar={abrirSolicitar}
          />
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle>Histórico de Avaliações</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Pontuação</TableHead>
                <TableHead>Classificação</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.avaliacoes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{new Date(a.data_avaliacao).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="font-semibold">{a.pontuacao_total ?? "—"}</TableCell>
                  <TableCell>
                    {a.classificacao && (
                      <Badge className="text-white border-transparent" style={{ backgroundColor: CLASS_COLORS[a.classificacao] }}>
                        {CLASS_LABELS[a.classificacao]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{a.concluida ? <Badge variant="secondary">Concluída</Badge> : <Badge>Rascunho</Badge>}</TableCell>
                </TableRow>
              ))}
              {data.avaliacoes.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Sem avaliações.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: solicitar validação */}
      <Dialog open={!!validarAcao} onOpenChange={(o) => !o && setValidarAcao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar validação da conclusão</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ação: <strong>{validarAcao?.nome}</strong></p>
            <div>
              <Label>Evidência / observação (opcional)</Label>
              <Textarea rows={4} value={evidencia} onChange={(e) => setEvidencia(e.target.value)}
                        placeholder="Descreva como concluiu ou anexe links..." />
            </div>
            <p className="text-xs text-muted-foreground">
              Seu líder receberá a solicitação e validará (ou não) a conclusão.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidarAcao(null)}>Cancelar</Button>
            <Button onClick={enviarSolicitacao} disabled={solicitar.isPending}>
              <Send className="h-4 w-4 mr-1" />Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ver notas por competência */}
      <Dialog open={verAvaliacao} onOpenChange={setVerAvaliacao}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Notas por Competência</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Competência</TableHead><TableHead>Nota</TableHead><TableHead>Comentário</TableHead></TableRow></TableHeader>
            <TableBody>
              {ultima?.notas.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{compMap.get(n.competencia_id) ?? "—"}</TableCell>
                  <TableCell className="text-center font-semibold">{n.nota}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{n.comentario ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!ultima?.notas.length && <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Sem notas registradas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AcoesTable({
  data, tabela, compMap, onSolicitar,
}: {
  data: FbAcao[];
  tabela: "fb_pdi" | "fb_feedforward";
  compMap?: Map<string, string>;
  onSolicitar: (a: FbAcao, tabela: "fb_pdi" | "fb_feedforward") => void;
}) {
  if (!data.length) return <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação registrada.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {compMap && <TableHead>Competência</TableHead>}
          <TableHead>Ação</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((a) => {
          const st = STATUS_LABEL[a.status] ?? STATUS_LABEL.nao_iniciado;
          return (
            <TableRow key={a.id}>
              {compMap && <TableCell className="text-sm">{a.competencia_id ? compMap.get(a.competencia_id) ?? "Geral" : "Geral"}</TableCell>}
              <TableCell className="max-w-md text-sm">{a.acao}</TableCell>
              <TableCell>{a.prazo ? new Date(a.prazo).toLocaleDateString("pt-BR") : "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${st.color} whitespace-nowrap`}>{st.label}</span>
                  {a.aguardando_validacao && (
                    <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />aguard. validação</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {a.status !== "concluido" && !a.aguardando_validacao && (
                  <Button size="sm" variant="outline" onClick={() => onSolicitar(a, tabela)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Marcar concluída
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
