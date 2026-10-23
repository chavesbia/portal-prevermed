import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Stethoscope, Syringe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const db = supabase as any;
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ehClinico = (e: string) => /CL[IÍ]NIC/i.test(e);
const pad = (n: number) => String(n).padStart(2, "0");

type Tot = { total: number; clinicos: number; complementares: number; pendentes: number };
const vazio = (): Tot => ({ total: 0, clinicos: 0, complementares: 0, pendentes: 0 });

/** Calendário mensal com o total de colaboradores por dia em cada unidade (atualiza ao vivo e a cada minuto). */
export function CalendarioOperacional({ hoje, onDia }: { hoje: string; onDia: (iso: string) => void }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [ano, m] = mes.split("-").map(Number);
  const ini = `${mes}-01`;
  const ultimo = new Date(ano, m, 0).getDate();
  const fim = `${mes}-${pad(ultimo)}`;

  const { data: itens = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["agendamentos", "calendario", mes],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("soc_agendamentos").select("data_agendada, status, exames, soc_agenda_unidades(nome)")
        .gte("data_agendada", ini).lte("data_agendada", fim).neq("status", "cancelado").limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { unidades, mapa, totaisUn, maxDia } = useMemo(() => {
    const mapa: Record<string, Record<string, Tot>> = {};
    const totaisUn: Record<string, number> = {};
    for (const a of itens as any[]) {
      const u = a.soc_agenda_unidades?.nome?.replace("PreverMed - ", "") ?? "Sem unidade";
      const t = ((mapa[a.data_agendada] ??= {})[u] ??= vazio());
      const ex: string[] = Array.isArray(a.exames) ? a.exames : [];
      t.total++; t.clinicos += ex.filter(ehClinico).length; t.complementares += ex.filter((e) => !ehClinico(e)).length;
      if (a.status !== "agendado_soc") t.pendentes++;
      totaisUn[u] = (totaisUn[u] ?? 0) + 1;
    }
    const maxDia = Math.max(1, ...Object.values(mapa).map((d) => Object.values(d).reduce((s, t) => s + t.total, 0)));
    return { unidades: Object.keys(totaisUn).sort(), mapa, totaisUn, maxDia };
  }, [itens]);

  const navegar = (d: number) => { const n = new Date(ano, m - 1 + d, 1); setMes(`${n.getFullYear()}-${pad(n.getMonth() + 1)}`); };
  const offset = new Date(ano, m - 1, 1).getDay();
  const celulas = [...Array(offset).fill(null), ...Array.from({ length: ultimo }, (_, i) => `${mes}-${pad(i + 1)}`)];
  const nivel = (n: number) => (n / maxDia >= 0.75 ? "bg-destructive/15 border-destructive/40" : n / maxDia >= 0.4 ? "bg-primary/15 border-primary/40" : n ? "bg-primary/5" : "");

  return (
    <Card><CardContent className="pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => navegar(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold min-w-[160px] text-center">{MESES[m - 1]} {ano}</h2>
        <Button size="icon" variant="outline" onClick={() => navegar(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setMes(hoje.slice(0, 7))}>Mês atual</Button>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <div className="ml-auto flex flex-wrap gap-3 text-sm">
          {unidades.map((u) => <span key={u} className="whitespace-nowrap"><b>{u}:</b> {totaisUn[u]} no mês</span>)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Colaboradores agendados por unidade. Cor mais forte = dia mais cheio. Clique no dia para ver a lista.</p>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[720px]">
          {SEMANA.map((s) => <div key={s} className="text-center text-xs font-medium text-muted-foreground py-1">{s}</div>)}
          {celulas.map((iso, i) => {
            if (!iso) return <div key={`v${i}`} />;
            const dia = mapa[iso] ?? {};
            const tot = Object.values(dia).reduce((s, t) => s + t.total, 0);
            return (
              <button key={iso} onClick={() => onDia(iso)} title="Ver agendamentos do dia"
                className={cn("min-h-[80px] rounded-md border p-1.5 text-left text-xs transition-colors hover:border-primary", nivel(tot), iso === hoje && "ring-2 ring-primary")}>
                <div className="font-semibold text-muted-foreground">{Number(iso.slice(8))}</div>
                {unidades.filter((u) => dia[u]).map((u) => (
                  <div key={u} className="mt-1 whitespace-nowrap"><span className="text-muted-foreground">{u}</span> <b>{dia[u].total}</b></div>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </CardContent></Card>
  );
}
