import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CalendarCheck, Check, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import logo from "@/assets/logo-prevermed.png";
import { Checkbox } from "@/components/ui/checkbox";
import { EXAMES_SOC } from "@/data/examesSoc";

type Unidade = { id: string; nome: string; codigo_agenda: string };
type Empresa = { soc_code: string; razao_social: string; cidade: string | null; estado: string | null; podeCriar?: boolean };
type Item = { codigo: string; nome: string };
type Hier = { unidades: (Item & { setores: (Item & { cargos: Item[] })[] })[]; setores?: Item[]; cargos?: Item[]; podeCriar: boolean; indisponivel?: boolean };
type Func = { encontrado: boolean; indisponivel?: boolean; funcionario?: any; recemCadastrado?: boolean };
const TIPOS = ["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Risco", "Monitoração Pontual", "Consulta", "Consulta Assistencial"] as const;
const dig = (v: string) => v.replace(/\D/g, "");
const br = (d: Date) => d.toLocaleDateString("pt-BR");
const toIso = (b: string) => b.split("/").reverse().join("-");
const PASSOS = ["Empresa", "Colaborador", "Exame", "Data e hora"];
// Mais utilizados (nomes oficiais do catálogo SOC) — exibidos só quando não há PCMSO
const EXAMES = ["AUDIOMETRIA", "ACUIDADE VISUAL", "ELETROCARDIOGRAMA-ECG", "ELETROENCEFALOGRAMA-EEG", "ESPIROMETRIA", "GLICEMIA DE JEJUM (GLICOSE)", "HEMOGRAMA COMPLETO", "EXAME TOXICOLÓGICO (QUERATINA)"];
const CLINICO = "EXAME CLÍNICO";
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export default function AgendamentoPublico() {
  const [passo, setPasso] = useState(0);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [f, setF] = useState({ empresaNome: "", empresaCnpj: "", colaboradorNome: "", colaboradorCpf: "", cargo: "", tipoExame: "", observacoes: "" });
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [socCode, setSocCode] = useState("");
  const [buscandoEmp, setBuscandoEmp] = useState(false);
  const [func, setFunc] = useState<Func | null>(null);
  const [buscandoFunc, setBuscandoFunc] = useState(false);
  const [unidadeId, setUnidadeId] = useState("");
  const [porData, setPorData] = useState<Record<string, string[]>>({});
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [exames, setExames] = useState<string[]>([]);
  const [guia, setGuia] = useState<File | null>(null);

  useEffect(() => {
    document.title = "Agendamento de Exames | PreverMed";
    supabase.functions.invoke("soc-agenda-horarios", { body: { listarUnidades: true } })
      .then(({ data }) => setUnidades(data?.unidades ?? []));
  }, []);

  const cnpj = dig(f.empresaCnpj);
  useEffect(() => {
    setEmpresas(null); setSocCode(""); setFunc(null);
    if (cnpj.length !== 14) return;
    setBuscandoEmp(true);
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "empresa", cnpj } }).then(({ data }) => {
      const lista: Empresa[] = data?.empresas ?? [];
      setEmpresas(lista);
      if (lista.length === 1) setSoc(lista[0]);
      setBuscandoEmp(false);
    });
  }, [cnpj]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSoc = (e: Empresa) => { setSocCode(e.soc_code); setF((p) => ({ ...p, empresaNome: e.razao_social })); setFunc(null); };

  const cpf = dig(f.colaboradorCpf);
  const cpfValido = isValidCPF(cpf);
REPLACE_MID
    if (!cpfValido || !socCode) return;
    setBuscandoFunc(true);
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "funcionario", cnpj, socCode, cpf } }).then(({ data }) => {
      const r: Func = data?.encontrado !== undefined ? data : { encontrado: false, indisponivel: true };
      setFunc(r);
      if (r.encontrado) setF((p) => ({ ...p, colaboradorNome: r.funcionario.nome ?? "", cargo: r.funcionario.cargo ?? "" }));
      else setF((p) => ({ ...p, colaboradorNome: "", cargo: "" }));
      setBuscandoFunc(false);
    });
  }, [cpf, socCode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Exames do PCMSO do colaborador (SOC), filtrados pelo tipo de exame escolhido
  const [pcmso, setPcmso] = useState<{ nome: string; tipos: Record<string, boolean> }[] | null>(null);
  const [buscandoPcmso, setBuscandoPcmso] = useState(false);
  useEffect(() => {
    setPcmso(null);
    if (!func?.encontrado) return;
    setBuscandoPcmso(true);
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "exames", cnpj, socCode, cpf } }).then(({ data }) => {
      setPcmso(data?.indisponivel ? null : data?.exames ?? []);
      setBuscandoPcmso(false);
    });
  }, [func]); // eslint-disable-line react-hooks/exhaustive-deps
  const [novoSetor, setNovoSetor] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [conformePcmso, setConformePcmso] = useState(true);
  const mudanca = f.tipoExame === "Mudança de Risco";
  // Na Mudança de Risco os exames do cargo atual não valem: a grade é a da nova função
  const pcmsoTipo = useMemo(
    () => (pcmso && f.tipoExame && !mudanca ? pcmso.filter((e) => e.tipos[f.tipoExame]).map((e) => e.nome) : []),
    [pcmso, f.tipoExame, mudanca],
  );
  useEffect(() => {
    if (!f.tipoExame) return;
    setExames(pcmsoTipo);
  }, [pcmsoTipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const temPcmso = !!pcmso && pcmso.length > 0;
  const usaGradePcmso = mudanca && conformePcmso;
  const mostrarGrade = !usaGradePcmso;

  const [busca, setBusca] = useState("");
  const sugestoes = useMemo(() => {
    const q = semAcento(busca.trim());
    if (q.length < 2) return [];
    return EXAMES_SOC.filter((e) => e.nome !== CLINICO && !exames.includes(e.nome) && semAcento(e.nome).includes(q)).slice(0, 8);
  }, [busca, exames]);

  const dias = useMemo(() => Object.keys(porData).sort((a, b) => toIso(a).localeCompare(toIso(b))), [porData]);

  // Pré-cadastro de colaborador não localizado no SOC
  const [cadAberto, setCadAberto] = useState(false);
  const [hier, setHier] = useState<Hier | null>(null);
  const [cad, setCad] = useState({ nascimento: "", sexo: "", admissao: new Date().toISOString().slice(0, 10), unidade: "", setor: "", cargo: "" });
  const [cadastrando, setCadastrando] = useState(false);
  const [cadErro, setCadErro] = useState("");
  useEffect(() => { setCadAberto(false); setHier(null); setCadErro(""); }, [cpf, socCode]);
  const abrirCadastro = () => {
    setCadAberto(true);
    if (hier) return;
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "hierarquia", cnpj, socCode } })
      .then(({ data }) => setHier(data ?? { unidades: [], podeCriar: false, indisponivel: true }));
  };
  const livre = !!hier?.podeCriar;
  const uSel = hier?.unidades.find((u) => u.codigo === cad.unidade);
  const sSel = uSel?.setores.find((x) => x.codigo === cad.setor);
  // Livre: aceita nome digitado; se bater com um existente, envia o código
  const ref = (txt: string, lista: Item[] = []) => { const t = txt.trim().toUpperCase(); const m = lista.find((i) => i.nome.toUpperCase() === t || i.codigo === txt); return m ? { codigo: m.codigo } : { nome: t }; };
  const cadOk = f.colaboradorNome.trim().length >= 3 && !!cad.nascimento && !!cad.sexo && !!cad.admissao && !!cad.unidade.trim() && !!cad.setor.trim() && !!cad.cargo.trim();
  const cadastrar = async () => {
    setCadastrando(true); setCadErro("");
    const body = {
      acao: "cadastrar", cnpj, socCode, cpf, nome: f.colaboradorNome.trim(), dataNascimento: cad.nascimento, dataAdmissao: cad.admissao, sexo: cad.sexo,
      unidade: livre ? ref(cad.unidade, hier?.unidades) : { codigo: cad.unidade },
      setor: livre ? ref(cad.setor, hier?.setores) : { codigo: cad.setor },
      cargo: livre ? ref(cad.cargo, hier?.cargos) : { codigo: cad.cargo },
    };
    const { data, error } = await supabase.functions.invoke("soc-agenda-lookup", { body });
    setCadastrando(false);
    if (error || !data?.ok) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      return setCadErro(msg ?? "Não foi possível cadastrar agora. Tente novamente.");
    }
    const nomeDe = (v: string, l: Item[] = []) => l.find((i) => i.codigo === v)?.nome ?? v.toUpperCase();
    const cargoNome = livre ? cad.cargo.toUpperCase() : nomeDe(cad.cargo, sSel?.cargos);
    setFunc({ encontrado: true, recemCadastrado: true, funcionario: {
      nome: f.colaboradorNome.trim().toUpperCase(), cargo: cargoNome,
      setor: livre ? cad.setor.toUpperCase() : nomeDe(cad.setor, uSel?.setores),
      unidade: livre ? cad.unidade.toUpperCase() : nomeDe(cad.unidade, hier?.unidades), situacao: "PENDENTE" } });
    setF((p) => ({ ...p, cargo: cargoNome, tipoExame: "Admissional" }));
    setCadAberto(false);
  };

  const valido = [
    !!socCode && cnpj.length === 14,
    !!func && (func.encontrado || func.indisponivel) && cpf.length === 11 && f.colaboradorNome.trim().length >= 3,
    !!f.tipoExame && (!mudanca || (novoSetor.trim().length >= 2 && novoCargo.trim().length >= 2)),
    !!unidadeId && !!dia && !!hora,
  ];

  const enviar = async () => {
    setCarregando(true); setErro("");
    const fu = func?.funcionario;
    const extra = [
      mudanca
        ? `MUDANÇA DE RISCO — ATUALIZAR LOTAÇÃO NO SOC ANTES DO ATENDIMENTO — novo setor: ${novoSetor.trim().toUpperCase()}; novo cargo: ${novoCargo.trim().toUpperCase()}${usaGradePcmso ? " — EXAMES CONFORME PCMSO" : ""}` : "",
      fu ? `Cadastro SOC: ${[fu.matricula && `matrícula ${fu.matricula}`, fu.cargo && `cargo ${fu.cargo}`, fu.setor && `setor ${fu.setor}`, fu.unidade && `unidade ${fu.unidade}`].filter(Boolean).join(", ")}` : `Não cadastrado no SOC${f.cargo ? ` — cargo pretendido: ${f.cargo}` : ""}`,
      f.observacoes,
    ].filter(Boolean).join("\n");
    let guiaPayload: { nome: string; tipo: string; base64: string } | undefined;
    if (guia) {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(guia); });
      guiaPayload = { nome: guia.name.slice(0, 120), tipo: guia.type, base64: b64 };
    }
    const { data, error } = await supabase.functions.invoke("soc-agenda-solicitar", {
      body: {
        unidadeId, empresaNome: f.empresaNome, empresaCnpj: cnpj, codigoEmpresaSoc: socCode,
        colaboradorNome: f.colaboradorNome, colaboradorCpf: cpf,
        tipoExame: f.tipoExame, data: toIso(dia), hora, observacoes: extra.slice(0, 1000) || undefined,
        exames: [...(temPcmso ? [] : [CLINICO]), ...(usaGradePcmso ? ["CONFORME PCMSO"] : exames)], guia: guiaPayload,
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
                <div><Label>CPF do colaborador</Label><Input inputMode="numeric" maxLength={14} value={maskCPF(f.colaboradorCpf)} onChange={(e) => setF((p) => ({ ...p, colaboradorCpf: dig(e.target.value).slice(0, 11) }))} placeholder="000.000.000-00" />
                  {cpf.length === 11 && !cpfValido && <p className="mt-1 text-xs text-destructive">CPF inválido. Confira os números digitados.</p>}</div>
                {buscandoFunc && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                {func?.encontrado && (
                  <div className="space-y-1 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                    <p className="font-semibold">{func.funcionario.nome}</p>
                    {func.funcionario.cargo && <p>Cargo: {func.funcionario.cargo}</p>}
                    {func.funcionario.setor && <p>Setor: {func.funcionario.setor}</p>}
                    {func.funcionario.unidade && <p>Unidade: {func.funcionario.unidade}</p>}
                    {func.recemCadastrado && <p className="text-xs text-primary">Cadastrado agora no SOC (situação Pendente).</p>}
                  </div>
                )}
                {func?.indisponivel && !func.encontrado && (<>
                  <p className="text-sm text-muted-foreground">Não foi possível consultar o cadastro agora. Preencha os dados abaixo.</p>
                  <div><Label>Nome completo</Label><Input value={f.colaboradorNome} onChange={set("colaboradorNome")} /></div>
                  <div><Label>Cargo pretendido</Label><Input value={f.cargo} onChange={set("cargo")} /></div>
                </>)}
                {func && !func.encontrado && !func.indisponivel && !cadAberto && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <p>Colaborador não localizado no cadastro desta empresa (ativo, pendente, afastado ou férias).</p>
                    <p className="font-medium">Deseja cadastrá-lo para seguir com o agendamento?</p>
                    <Button type="button" size="sm" onClick={abrirCadastro}>Sim, cadastrar colaborador</Button>
                  </div>
                )}
                {func && !func.encontrado && !func.indisponivel && cadAberto && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Cadastro do colaborador</p>
                    <div><Label>Nome completo *</Label><Input value={f.colaboradorNome} onChange={set("colaboradorNome")} maxLength={120} /></div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div><Label>Nascimento *</Label><Input type="date" value={cad.nascimento} onChange={(e) => setCad({ ...cad, nascimento: e.target.value })} /></div>
                      <div><Label>Sexo *</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cad.sexo} onChange={(e) => setCad({ ...cad, sexo: e.target.value })}>
                          <option value="">Selecione</option><option value="MASCULINO">Masculino</option><option value="FEMININO">Feminino</option>
                        </select></div>
                      <div><Label>Admissão *</Label><Input type="date" value={cad.admissao} onChange={(e) => setCad({ ...cad, admissao: e.target.value })} /></div>
                    </div>
                    {!hier && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando unidades, setores e cargos…</p>}
                    {hier?.indisponivel && <p className="text-xs text-destructive">Não foi possível carregar a hierarquia da empresa agora.</p>}
                    {hier && !hier.indisponivel && !livre && (<>
                      <p className="text-xs text-muted-foreground">Selecione a unidade, o setor e o cargo já existentes da empresa (conforme os laudos).</p>
                      {[
                        { k: "unidade", label: "Unidade *", lista: hier.unidades, reset: { setor: "", cargo: "" } },
                        { k: "setor", label: "Setor *", lista: uSel?.setores ?? [], reset: { cargo: "" } },
                        { k: "cargo", label: "Cargo *", lista: sSel?.cargos ?? [], reset: {} },
                      ].map(({ k, label, lista, reset }) => (
                        <div key={k}><Label>{label}</Label>
                          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" disabled={lista.length === 0}
                            value={cad[k as "unidade"]} onChange={(e) => setCad({ ...cad, ...reset, [k]: e.target.value })}>
                            <option value="">{lista.length ? "Selecione" : "—"}</option>
                            {lista.map((i) => <option key={i.codigo} value={i.codigo}>{i.nome}</option>)}
                          </select></div>
                      ))}
                    </>)}
                    {hier && !hier.indisponivel && livre && (<>
                      <p className="text-xs text-muted-foreground">Escolha uma opção existente ou digite uma nova.</p>
                      {[
                        { k: "unidade", label: "Unidade *", lista: hier.unidades },
                        { k: "setor", label: "Setor *", lista: hier.setores ?? [] },
                        { k: "cargo", label: "Cargo *", lista: hier.cargos ?? [] },
                      ].map(({ k, label, lista }) => (
                        <div key={k}><Label>{label}</Label>
                          <Input list={`lista-${k}`} value={cad[k as "unidade"]} maxLength={120} onChange={(e) => setCad({ ...cad, [k]: e.target.value })} />
                          <datalist id={`lista-${k}`}>{lista.map((i) => <option key={i.codigo} value={i.nome} />)}</datalist></div>
                      ))}
                    </>)}
                    {cadErro && <p className="text-sm text-destructive">{cadErro}</p>}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCadAberto(false)}>Cancelar</Button>
                      <Button type="button" size="sm" disabled={!cadOk || cadastrando} onClick={cadastrar}>
                        {cadastrando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Cadastrar no SOC
                      </Button>
                    </div>
                  </div>
                )}
              </>)}
              {passo === 2 && (<>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map((t) => (
                    <Button key={t} type="button" variant={f.tipoExame === t ? "default" : "outline"} onClick={() => setF({ ...f, tipoExame: t })}>{t}</Button>
                  ))}
                </div>
                {f.tipoExame === "Admissional" && func?.encontrado && !func.recemCadastrado && (
                  <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p><strong>Atenção:</strong> colaborador já possui cadastro ativo nesta empresa
                      {func.funcionario?.cargo && <> como <strong>{func.funcionario.cargo}</strong></>}
                      {func.funcionario?.matricula && <> (Matrícula: {func.funcionario.matricula})</>}.
                      {" "}Verifique se o <strong>tipo de exame</strong> está correto antes de prosseguir.</p>
                  </div>
                )}
                {mudanca && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                    <p className="text-sm font-medium">Informe a nova função pretendida.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><Label>Novo setor *</Label><Input value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)} maxLength={80} /></div>
                      <div><Label>Novo cargo *</Label><Input value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)} maxLength={80} /></div>
                    </div>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox checked={conformePcmso} onCheckedChange={(v) => setConformePcmso(v === true)} className="mt-0.5" />
                      <span>Realizar exames conforme grade do PCMSO da nova função</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      A lotação do colaborador será atualizada no SOC considerando o novo setor e/ou cargo antes do atendimento, para aplicar os riscos e exames corretos.
                      {conformePcmso && " Nossa equipe aplicará os exames previstos no PCMSO conforme a mudança de risco ocupacional."}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Exames</Label>
                    {mostrarGrade && pcmsoTipo.length > 0 && pcmsoTipo.some((e) => !exames.includes(e)) && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs whitespace-nowrap"
                        onClick={() => setExames((p) => [...new Set([...p, ...pcmsoTipo])])}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restaurar PCMSO
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!temPcmso && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary bg-primary px-2.5 py-1 text-xs text-primary-foreground">
                        <Check className="h-3 w-3" />{CLINICO}
                      </span>
                    )}
                    {usaGradePcmso && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary bg-primary px-2.5 py-1 text-xs text-primary-foreground">
                        <Check className="h-3 w-3" />CONFORME PCMSO
                      </span>
                    )}
                    {mostrarGrade && [...pcmsoTipo, ...(pcmsoTipo.length > 0 ? [] : EXAMES.filter((e) => !pcmsoTipo.includes(e))), ...exames.filter((e) => !EXAMES.includes(e) && !pcmsoTipo.includes(e))]
                      .filter((e, i, a) => a.indexOf(e) === i)
                      .map((e) => {
                      const on = exames.includes(e); const doPcmso = pcmsoTipo.includes(e);
                      return (
                        <button key={e} type="button"
                          onClick={() => setExames((p) => p.includes(e) ? p.filter((x) => x !== e) : [...p, e])}
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : doPcmso ? "border-dashed border-primary/60 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                          {on && <Check className="h-3 w-3" />}
                          {e}
                          {doPcmso && <span className={`rounded px-1 text-[9px] font-semibold whitespace-nowrap ${on ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>PCMSO</span>}
                        </button>
                      );
                    })}
                  </div>
                  {mostrarGrade && pcmsoTipo.some((e) => !exames.includes(e)) && (
                    <p className="text-xs text-destructive">Há exame previsto no PCMSO desmarcado (borda tracejada).</p>
                  )}
                  {mostrarGrade && (
                    <div className="relative">
                      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Adicionar exame (digite para buscar)" className="h-8" />
                      {sugestoes.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                          {sugestoes.map((s) => (
                            <button key={s.codigo + s.nome} type="button" className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                              onClick={() => { setExames((p) => [...p, s.nome]); setBusca(""); }}>
                              {s.nome}
                            </button>
                          ))}
                        </div>
                      )}
                      {busca.trim().length >= 2 && sugestoes.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">Nenhum exame encontrado no catálogo.</p>
                      )}
                    </div>
                  )}
                  {buscandoPcmso && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando exames do PCMSO…</p>}
                  {mostrarGrade && !mudanca && (
                    <p className="text-xs text-muted-foreground">
                      {temPcmso
                        ? "Todos os exames sugeridos (PCMSO) para o tipo de exame selecionado."
                        : "Selecione os exames ou busque no catálogo."}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Guia de encaminhamento (opcional — PDF ou imagem, até 5 MB)</Label>
                  <Input type="file" accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => { const file = e.target.files?.[0] ?? null; if (file && file.size > 5 * 1024 * 1024) { setErro("Arquivo maior que 5 MB."); e.target.value = ""; return setGuia(null); } setErro(""); setGuia(file); }} />
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
