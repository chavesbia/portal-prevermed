import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarCheck, Loader2 } from "lucide-react";
import logo from "@/assets/logo-prevermed.png";

type Unidade = { id: string; nome: string; codigo_agenda: string };
const TIPOS = ["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Risco"] as const;
const dig = (v: string) => v.replace(/\D/g, "");
const br = (d: Date) => d.toLocaleDateString("pt-BR");
const toIso = (b: string) => b.split("/").reverse().join("-");
const PASSOS = ["Empresa", "Colaborador", "Exame", "Data e hora"];

export default function AgendamentoPublico() {
  const [passo, setPasso] = useState(0);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [f, setF] = useState({ empresaNome: "", empresaCnpj: "", colaboradorNome: "", colaboradorCpf: "", tipoExame: "", observacoes: "" });
  const [unidadeId, setUnidadeId] = useState("");
  const [porData, setPorData] = useState<Record<string, string[]>>({});
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [protocolo, setProtocolo] = useState("");

  useEffect(() => {
    document.title = "Agendamento de Exames | PreverMed";
    supabase.functions.invoke("soc-agenda-horarios", { body: { listarUnidades: true } })
      .then(({ data }) => setUnidades(data?.unidades ?? []));
  }, []);

  const unidade = unidades.find((u) => u.id === unidadeId);
  useEffect(() => {
    if (!unidade) return;
    setCarregando(true); setPorData({}); setDia(""); setHora(""); setErro("");
    const ini = new Date(); ini.setDate(ini.getDate() + 1);
    const fim = new Date(); fim.setDate(fim.getDate() + 14);
    supabase.functions.invoke("soc-agenda-horarios", {
      body: { codigoAgenda: unidade.codigo_agenda, dataInicio: br(ini), dataFim: br(fim) },
    }).then(({ data, error }) => {
      if (error || data?.error) setErro("Não foi possível consultar os horários agora. Tente novamente.");
      else setPorData(data.porData ?? {});
      setCarregando(false);
    });
  }, [unidadeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dias = useMemo(() => Object.keys(porData).sort((a, b) => toIso(a).localeCompare(toIso(b))), [porData]);

  const valido = [
    f.empresaNome.trim().length >= 2 && dig(f.empresaCnpj).length === 14,
    f.colaboradorNome.trim().length >= 3 && dig(f.colaboradorCpf).length === 11,
    !!f.tipoExame,
    !!unidadeId && !!dia && !!hora,
  ];

  const enviar = async () => {
    setCarregando(true); setErro("");
    const { data, error } = await supabase.functions.invoke("soc-agenda-solicitar", {
      body: {
        unidadeId, empresaNome: f.empresaNome, empresaCnpj: dig(f.empresaCnpj),
        colaboradorNome: f.colaboradorNome, colaboradorCpf: dig(f.colaboradorCpf),
        tipoExame: f.tipoExame, data: toIso(dia), hora, observacoes: f.observacoes || undefined,
      },
    });
    setCarregando(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      return setErro(msg ?? "Não foi possível concluir. Tente novamente.");
    }
    setProtocolo(data.protocolo);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="PreverMed" className="h-12" />
          <h1 className="text-2xl font-semibold">Agendamento de Exames</h1>
        </div>

        {protocolo ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <CalendarCheck className="mx-auto h-12 w-12 text-primary" />
              <p className="text-lg font-semibold">Solicitação registrada!</p>
              <p className="font-mono text-2xl">{protocolo}</p>
              <p className="text-sm text-muted-foreground">
                {f.colaboradorNome} — {unidade?.nome} — {dia} às {hora}
              </p>
              <p className="text-sm text-muted-foreground">Guarde o protocolo. Nossa recepção confirmará o agendamento.</p>
              <Button variant="outline" onClick={() => window.print()}>Imprimir comprovante</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex gap-1">
                {PASSOS.map((p, i) => (
                  <div key={p} className={`h-1.5 flex-1 rounded ${i <= passo ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
              <CardTitle className="pt-2 text-lg">{passo + 1}. {PASSOS[passo]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {passo === 0 && (<>
                <div><Label>CNPJ da empresa</Label><Input inputMode="numeric" value={f.empresaCnpj} onChange={set("empresaCnpj")} placeholder="Somente números" /></div>
                {buscandoEmp && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                {empresas && empresas.length === 0 && (
                  <p className="text-sm text-destructive">CNPJ não encontrado entre os clientes ativos. Fale com a PreverMed.</p>
                )}
                {empresas && empresas.length > 1 && <p className="text-sm text-muted-foreground">Encontramos {empresas.length} operações para este CNPJ. Selecione a correta:</p>}
                {empresas?.map((e) => (
                  <button key={e.soc_code} type="button" onClick={() => setSoc(e)}
                    className={`flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm ${socCode === e.soc_code ? "border-primary bg-primary/5" : ""}`}>
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${socCode === e.soc_code ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1">{e.razao_social}{e.cidade ? ` — ${e.cidade}/${e.estado ?? ""}` : ""}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">SOC {e.soc_code}</span>
                  </button>
                ))}
              </>)}
              {passo === 1 && (<>
                <div><Label>CPF do colaborador</Label><Input inputMode="numeric" value={f.colaboradorCpf} onChange={set("colaboradorCpf")} placeholder="Somente números" /></div>
                {buscandoFunc && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                {func?.encontrado && (
                  <div className="space-y-1 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                    <p className="font-semibold">{func.funcionario.nome}</p>
                    {func.funcionario.cargo && <p>Cargo: {func.funcionario.cargo}</p>}
                    {func.funcionario.setor && <p>Setor: {func.funcionario.setor}</p>}
                    {func.funcionario.unidade && <p>Unidade: {func.funcionario.unidade}</p>}
                  </div>
                )}
                {func && !func.encontrado && (<>
                  <p className="text-sm text-muted-foreground">
                    {func.indisponivel ? "Não foi possível consultar o cadastro agora. Preencha os dados abaixo." : "Colaborador ainda não cadastrado nesta empresa (provável Admissional). Preencha os dados abaixo."}
                  </p>
                  <div><Label>Nome completo</Label><Input value={f.colaboradorNome} onChange={set("colaboradorNome")} /></div>
                  <div><Label>Cargo pretendido</Label><Input value={f.cargo} onChange={set("cargo")} /></div>
                </>)}
              </>)}
              {passo === 2 && (<>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <Button key={t} type="button" variant={f.tipoExame === t ? "default" : "outline"} onClick={() => setF({ ...f, tipoExame: t })}>{t}</Button>
                  ))}
                </div>
                <div><Label>Observações (opcional)</Label><Textarea value={f.observacoes} onChange={set("observacoes")} maxLength={1000} /></div>
              </>)}
              {passo === 3 && (<>
                <div className="grid grid-cols-2 gap-2">
                  {unidades.map((u) => (
                    <Button key={u.id} variant={unidadeId === u.id ? "default" : "outline"} onClick={() => setUnidadeId(u.id)}>
                      {u.nome.replace("PreverMed - ", "")}
                    </Button>
                  ))}
                </div>
                {carregando && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                {unidade && !carregando && dias.length === 0 && !erro && (
                  <p className="text-sm text-muted-foreground">Sem horários livres nos próximos 14 dias.</p>
                )}
                {dias.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dias.map((d) => (
                      <Button key={d} size="sm" className="whitespace-nowrap" variant={dia === d ? "default" : "outline"} onClick={() => { setDia(d); setHora(""); }}>
                        {d.slice(0, 5)}
                      </Button>
                    ))}
                  </div>
                )}
                {dia && (
                  <div className="grid grid-cols-4 gap-2">
                    {porData[dia].map((h) => (
                      <Button key={h} size="sm" variant={hora === h ? "default" : "outline"} onClick={() => setHora(h)}>{h}</Button>
                    ))}
                  </div>
                )}
              </>)}

              {erro && <p className="text-sm text-destructive">{erro}</p>}

              <div className="flex justify-between pt-2">
                <Button variant="ghost" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>Voltar</Button>
                {passo < 3 ? (
                  <Button disabled={!valido[passo]} onClick={() => setPasso(passo + 1)}>Continuar</Button>
                ) : (
                  <Button disabled={!valido[3] || carregando} onClick={enviar}>Confirmar agendamento</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
