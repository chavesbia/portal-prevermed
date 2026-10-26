import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Paleta institucional (tokens do tema)
const CORES = ["hsl(var(--primary))", "hsl(var(--chart-2, 199 89% 48%))", "hsl(var(--chart-3, 160 60% 40%))", "hsl(var(--chart-4, 38 92% 50%))", "hsl(var(--chart-5, 220 9% 60%))"];
const tip = { contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const eixo = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

type Par = [string, number];
interface Props {
  nomesUn: string[];
  porDiaUn: { dia: string; total: number; porUn: Record<string, number> }[];
  porFaixa: Par[];
  porCanal: Par[];
  porSubgrupo: Par[];
}

const Vazio = () => <p className="py-10 text-center text-sm text-muted-foreground">Sem dados no período.</p>;

const Rosca = ({ titulo, dados }: { titulo: string; dados: Par[] }) => (
  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{titulo}</CardTitle></CardHeader>
    <CardContent className="h-64">
      {dados.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {dados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
            </Pie>
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : <Vazio />}
    </CardContent></Card>
);

export function AgendaGraficos({ nomesUn, porDiaUn, porFaixa, porCanal, porSubgrupo }: Props) {
  const diario = porDiaUn.map((p) => ({ dia: p.dia.slice(8, 10) + "/" + p.dia.slice(5, 7), ...p.porUn }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">Fluxo diário por unidade</CardTitle></CardHeader>
          <CardContent className="h-64">
            {diario.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={eixo} /><YAxis allowDecimals={false} tick={eixo} width={30} />
                  <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  {nomesUn.map((u, i) => <Bar key={u} dataKey={u} stackId="a" fill={CORES[i % CORES.length]} radius={i === nomesUn.length - 1 ? [4, 4, 0, 0] : 0} />)}
                </BarChart>
              </ResponsiveContainer>
            ) : <Vazio />}
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Faixa de horário de chegada</CardTitle></CardHeader>
          <CardContent className="h-64">
            {porFaixa.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porFaixa.map(([faixa, total]) => ({ faixa, total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="faixa" tick={eixo} /><YAxis allowDecimals={false} tick={eixo} width={30} />
                  <Tooltip {...tip} /><Bar dataKey="total" name="Agendamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Vazio />}
          </CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Rosca titulo="Canal de entrada" dados={porCanal} />
        <Rosca titulo="Por subgrupo da empresa" dados={porSubgrupo} />
      </div>
    </div>
  );
}
