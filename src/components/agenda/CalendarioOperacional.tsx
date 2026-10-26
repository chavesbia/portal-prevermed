import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { temKitAgenda } from "@/lib/agendaPainel";
import { toTitleCase } from "@/lib/guias/blocklist";

const db = supabase as any;
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
const nomeUn = (a: any) => a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "Sem unidade";
const STATUS: Record<string, string> = { agendado_soc: "No SOC", solicitado: "Não entrou no SOC", aguardando_aprovacao: "Aguardando aprovação", documentacao_devolvida: "Devolvido" };

/** Calendário mensal: total por dia e unidade, filtro de unidade e gaveta com a lista do dia. */
export function CalendarioOperacional({ hoje, onDia }: { hoje: string; onDia: (iso: string) => void }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [unSel, setUnSel] = useState("todas");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["agendamentos", "calendario", mes],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("soc_agendamentos")
        .select("id, data_agendada, hora_agendada, status, colaborador_nome, empresa_nome, tipo_exame, guia_path, soc_agenda_unidades(nome), soc_agendamento_anexos(tipo_documento)")
        .gte("data_agendada", `${mes}-01`).lte("data_agendada", `${mes}-${pad(ultimo)}`).neq("status", "cancelado").limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unidades = useMemo(() => [...new Set((itens as any[]).map(nomeUn))].sort(), [itens]);
  const visiveis = useMemo(() => (itens as any[]).filter((a) => unSel === "todas" || nomeUn(a) === unSel), [itens, unSel]);
  const porDia = useMemo(() => {
    const r: Record<string, any[]> = {};
    for (const a of visiveis) (r[a.data_agendada] ??= []).push(a);
    return r;
  }, [visiveis]);
  const maxDia = Math.max(1, ...Object.values(porDia).map((l) => l.length));

  const navegar = (d: number) => { const n = new Date(ano, m - 1 + d, 1); setMes(`${n.getFullYear()}-${pad(n.getMonth() + 1)}`); };
  const offset = new Date(ano, m - 1, 1).getDay();
  const celulas = [...Array(offset).fill(null), ...Array.from({ length: ultimo }, (_, i) => `${mes}-${pad(i + 1)}`)];
  const nivel = (n: number) => (n / maxDia >= 0.75 ? "bg-destructive/10 border-destructive/40" : n / maxDia >= 0.4 ? "bg-primary/15 border-primary/40" : n ? "bg-primary/5" : "");
  const lista = diaAberto ? [...(porDia[diaAberto] ?? [])].sort((x, y) => x.hora_agendada.localeCompare(y.hora_agendada)) : [];
  const fmt = (iso: string) => iso.split("-").reverse().join("/");

  return (
    <Card><CardContent className="pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => navegar(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold min-w-[160px] text-center">{MESES[m - 1]} {ano}</h2>
        <Button size="icon" variant="outline" onClick={() => navegar(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setMes(hoje.slice(0, 7))}>Mês atual</Button>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {["todas", ...unidades].map((u) => (
            <Button key={u} size="sm" variant={unSel === u ? "default" : "outline"} onClick={() => setUnSel(u)} className="whitespace-nowrap">
              {u === "todas" ? "Todas" : u} <span className="ml-1 opacity-70">{u === "todas" ? itens.length : (itens as any[]).filter((a) => nomeUn(a) === u).length}</span>
            </Button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Cor mais forte = dia mais cheio. Ponto âmbar = há agendamento sem kit anexado. Clique no dia para ver quem vem.</p>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[720px]">
          {SEMANA.map((s) => <div key={s} className="text-center text-xs font-medium text-muted-foreground py-1">{s}</div>)}
          {celulas.map((iso, i) => {
            if (!iso) return <div key={`v${i}`} />;
            const dia = porDia[iso] ?? [];
            const porUn: Record<string, number> = {};
            dia.forEach((a) => { porUn[nomeUn(a)] = (porUn[nomeUn(a)] ?? 0) + 1; });
            const semKit = dia.some((a) => !temKitAgenda(a));
            return (
              <button key={iso} onClick={() => setDiaAberto(iso)} title="Ver agendamentos do dia"
                className={cn("min-h-[80px] rounded-md border p-1.5 text-left text-xs transition-colors hover:border-primary", nivel(dia.length), iso === hoje && "ring-2 ring-primary")}>
                <div className="flex items-center justify-between font-semibold text-muted-foreground">
                  <span>{Number(iso.slice(8))}</span>
                  {semKit && <span className="h-2 w-2 rounded-full bg-warning" aria-label="Há agendamento sem kit" />}
                </div>
                {Object.entries(porUn).sort().map(([u, n]) => (
                  <div key={u} className="mt-1 whitespace-nowrap"><span className="text-muted-foreground">{u}</span> <b>{n}</b></div>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={!!diaAberto} onOpenChange={(o) => !o && setDiaAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {diaAberto && (<>
            <SheetHeader><SheetTitle className="text-lg">{fmt(diaAberto)} · {lista.length} agendamento{lista.length === 1 ? "" : "s"}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-2">
              {lista.length ? lista.map((a) => (
                <div key={a.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{a.hora_agendada.slice(0, 5)}</span>
                    <span className="truncate font-medium" title={toTitleCase(a.colaborador_nome) ?? ""}>{toTitleCase(a.colaborador_nome)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{toTitleCase(a.empresa_nome)} · {a.tipo_exame}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="whitespace-nowrap">{nomeUn(a)}</Badge>
                    <Badge variant={a.status === "agendado_soc" ? "secondary" : "destructive"} className="whitespace-nowrap">{STATUS[a.status] ?? a.status}</Badge>
                    {!temKitAgenda(a) && <Badge variant="outline" className="whitespace-nowrap">Sem kit</Badge>}
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>}
            </div>
            {lista.length > 0 && <Button variant="link" className="mt-3 px-0" onClick={() => { onDia(diaAberto); setDiaAberto(null); }}>Abrir na lista completa</Button>}
          </>)}
        </SheetContent>
      </Sheet>
    </CardContent></Card>
  );
}
