import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CalendarCheck, Check, CheckCircle2, Info, Loader2, RotateCcw } from "lucide-react";
import logo from "@/assets/logo-prevermed.png";
import { Checkbox } from "@/components/ui/checkbox";
import { EXAMES_SOC } from "@/data/examesSoc";
import { isValidCPF, maskCPF } from "@/lib/contractual/cpf";
import { preparosDosExames } from "../../supabase/functions/_shared/preparosExames";

type Unidade = { id: string; nome: string; codigo_agenda: string };
type Empresa = { soc_code: string; razao_social: string; cidade: string | null; estado: string | null; podeCriar?: boolean };
type Item = { codigo: string; nome: string };
type Hier = { unidades: (Item & { setores: (Item & { cargos: Item[] })[] })[]; setores?: Item[]; cargos?: Item[]; podeCriar: boolean; indisponivel?: boolean };
type Func = { encontrado: boolean; inativo?: boolean; indisponivel?: boolean; funcionario?: any; recemCadastrado?: boolean };
const TIPOS = ["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Risco", "Monitoração Pontual", "Consulta"] as const;
const dig = (v: string) => v.replace(/\D/g, "");
// Endereço exibido no comprovante, por código da agenda SOC
const ENDERECOS: Record<string, string> = {
  "820293": "Rua Avelino Lopes, 248 - Centro - Osasco - SP",
  "830071": "Rua Afonso Sardinha, 155 - Lapa - São Paulo - SP",
};
const br = (d: Date) => d.toLocaleDateString("pt-BR");
const toIso = (b: string) => b.split("/").reverse().join("-");
const PASSOS = ["Empresa", "Colaborador", "Exame", "Data e hora"];
// Mais utilizados (nomes oficiais do catálogo SOC) — exibidos só quando não há PCMSO
const EXAMES = ["AUDIOMETRIA", "ACUIDADE VISUAL", "ELETROCARDIOGRAMA-ECG", "ELETROENCEFALOGRAMA-EEG", "ESPIROMETRIA", "GLICEMIA DE JEJUM (GLICOSE)", "HEMOGRAMA COMPLETO", "EXAME TOXICOLÓGICO (QUERATINA)"];
const CLINICO = "EXAME CLÍNICO";
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

export default function AgendamentoPublico() {
  const [passo, setPasso] = useState(() => (new URLSearchParams(window.location.search).get("cnpj")?.length === 14 ? 1 : 0));
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [f, setF] = useState({ empresaNome: "", empresaCnpj: new URLSearchParams(window.location.search).get("cnpj") ?? "", colaboradorNome: "", colaboradorCpf: "", cargo: "", tipoExame: "", observacoes: "" });
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [socCode, setSocCode] = useState("");
  const [buscandoEmp, setBuscandoEmp] = useState(false);
  const [func, setFunc] = useState<Func | null>(null);
  const [buscandoFunc, setBuscandoFunc] = useState(false);
  const [lotConfirmada, setLotConfirmada] = useState(false);
  const [alterandoLot, setAlterandoLot] = useState(false);
  const [unidadeId, setUnidadeId] = useState("");
  const [porData, setPorData] = useState<Record<string, { hora: string; vagas: number }[]>>({});
  const [indisp, setIndisp] = useState<{ data: string; motivo: string }[]>([]);
  const [regrasEx, setRegrasEx] = useState<{ exame: string; texto: string }[]>([]);
  const [docsExig, setDocsExig] = useState<{ tipo_exame: string; nome: string; obrigatorio: boolean }[]>([]);
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [motivoRetorno, setMotivoRetorno] = useState("");
  const [aguardandoAprov, setAguardandoAprov] = useState(false);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [exames, setExames] = useState<string[]>([]);
  const [guias, setGuias] = useState<File[]>([]);
  const qs = new URLSearchParams(window.location.search);
  const socInicial = qs.get("soc") ?? "";
  // Fora da carteira PreverMed (ex.: cliente de assessoria parceira) e pedido SOCNET localizado pelo CPF
  const [externa, setExterna] = useState<{ razao_social: string } | null>(null);
  type Pedido = { sequencialFicha: string; tipoExame: string | null; empresa: { codigo: string; nome: string }; assessoria: { codigo: string; nome: string }; funcionario: { nome: string }; exames: string[] };
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [semPedido, setSemPedido] = useState(false);
  const [pendenteEquipe, setPendenteEquipe] = useState(false);
  const [guiaSocnet, setGuiaSocnet] = useState<{ numero: string; exames: string[] } | null>(null);

  useEffect(() => {
    document.title = "Agendamento de Exames | PreverMed";
    supabase.functions.invoke("soc-agenda-horarios", { body: { listarUnidades: true } })
      .then(({ data }) => setUnidades(data?.unidades ?? []));
    supabase.functions.invoke("soc-agenda-horarios", { body: { documentosExigidos: true } })
      .then(({ data }) => setDocsExig(data?.documentos ?? []));
  }, []);

  const cnpj = dig(f.empresaCnpj);
  useEffect(() => {
    setEmpresas(null); setSocCode(""); setFunc(null); setExterna(null);
    if (cnpj.length !== 14) return;
    setBuscandoEmp(true);
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "empresa", cnpj } }).then(({ data }) => {
      const lista: Empresa[] = data?.empresas ?? [];
      setEmpresas(lista);
      const pre = socInicial ? lista.find((e) => e.soc_code === socInicial) : undefined;
      if (pre) setSoc(pre); else if (lista.length === 1) setSoc(lista[0]);
      else if (lista.length > 1) setPasso(0);
      if (!lista.length && data?.externa) { setExterna(data.externa); setF((p) => ({ ...p, empresaNome: data.externa.razao_social })); }
      setBuscandoEmp(false);
    });
  }, [cnpj]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSoc = (e: Empresa) => { setSocCode(e.soc_code); setF((p) => ({ ...p, empresaNome: e.razao_social })); setFunc(null); };

  const cpf = dig(f.colaboradorCpf);
  const cpfValido = isValidCPF(cpf);
  const buscarPedido = async () => {
    const { data } = await supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "socnet", cpf } });
    const p: Pedido | undefined = data?.pedidos?.[0];
    if (!p) {
      const guia = data?.guias?.[0];
      if (guia) setGuiaSocnet(guia);
      return false;
    }
    setPedido(p);
    setF((x) => ({ ...x, colaboradorNome: p.funcionario?.nome ?? "", empresaNome: p.empresa?.nome || x.empresaNome, tipoExame: p.tipoExame ?? "Periódico" }));
    setExames(p.exames);
    return true;
  };
  useEffect(() => {
    setFunc(null); setPedido(null); setSemPedido(false); setLotConfirmada(false); setAlterandoLot(false); setGuiaSocnet(null);
    if (!cpfValido || (!socCode && !externa)) return;
    setBuscandoFunc(true);
    if (!socCode) {
      buscarPedido().then((ok) => { if (!ok) { setSemPedido(true); setF((p) => ({ ...p, colaboradorNome: "", tipoExame: "" })); } setBuscandoFunc(false); });
      return;
    }
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "funcionario", cnpj, socCode, cpf } }).then(async ({ data }) => {
      const r: Func = data?.encontrado !== undefined ? data : { encontrado: false, indisponivel: true };
      // Blindagem: empresa da carteira nunca consulta pedidos SOCNET de outras empresas pelo CPF
      setFunc(r);
      if (r.encontrado) setF((p) => ({ ...p, colaboradorNome: r.funcionario.nome ?? "", cargo: r.funcionario.cargo ?? "" }));
      else setF((p) => ({ ...p, colaboradorNome: "", cargo: "" }));
      setBuscandoFunc(false);
    });
  }, [cpf, socCode, externa]); // eslint-disable-line react-hooks/exhaustive-deps

  const unidade = unidades.find((u) => u.id === unidadeId);
  useEffect(() => {
    if (!unidade) return;
    setCarregando(true); setPorData({}); setDia(""); setHora(""); setErro("");
    const ini = new Date(); ini.setDate(ini.getDate() + 1);
    const fim = new Date(); fim.setDate(fim.getDate() + 14);
    supabase.functions.invoke("soc-agenda-horarios", {
      body: { unidadeId: unidade.id, dataInicio: br(ini), dataFim: br(fim), tipoExame: f.tipoExame || undefined, exames: usaGradePcmso ? pcmsoTipo : exames },
    }).then(({ data, error }) => {
      if (error || data?.error) setErro("Não foi possível consultar os horários agora. Tente novamente.");
      else { setPorData(data.porData ?? {}); setIndisp(data.indisponiveis ?? []); setRegrasEx(data.regrasExames ?? []); }
      setCarregando(false);
    });
  }, [unidadeId, passo === 3]); // eslint-disable-line react-hooks/exhaustive-deps

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
    () => (pcmso && f.tipoExame ? pcmso.filter((e) => e.tipos[f.tipoExame]).map((e) => e.nome) : []),
    [pcmso, f.tipoExame, mudanca],
  );
  useEffect(() => {
    if (!f.tipoExame || pedido) return;
    setExames(pcmsoTipo);
  }, [pcmsoTipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const temPcmso = !!pcmso && pcmso.length > 0;
  const usaGradePcmso = false;
  const mostrarGrade = !usaGradePcmso;

  const [busca, setBusca] = useState("");
  const [foraAgenda, setForaAgenda] = useState<string[]>([]);
  useEffect(() => {
    supabase.functions.invoke("soc-agenda-horarios", { body: { naoAgendaveis: true } }).then(({ data }) => setForaAgenda((data?.exames ?? []).map((n: string) => semAcento(n))));
  }, []);
  const sugestoes = useMemo(() => {
    const q = semAcento(busca.trim());
    if (q.length < 2) return [];
    return EXAMES_SOC.filter((e) => e.nome !== CLINICO && !exames.includes(e.nome) && !foraAgenda.includes(semAcento(e.nome)) && semAcento(e.nome).includes(q)).slice(0, 8);
  }, [busca, exames, foraAgenda]);

  const dias = useMemo(() => Object.keys(porData).sort((a, b) => toIso(a).localeCompare(toIso(b))), [porData]);

  // Pré-cadastro de colaborador não localizado no SOC
  const [cadAberto, setCadAberto] = useState(false);
  const [hier, setHier] = useState<Hier | null>(null);
  const [cad, setCad] = useState({ nascimento: "", sexo: "", admissao: new Date().toISOString().slice(0, 10), unidade: "", setor: "", cargo: "" });
  const [cadastrando, setCadastrando] = useState(false);
  const [cadErro, setCadErro] = useState("");
  // Unidade/setor/cargo inexistente no SOC: segue como pré-agendamento travado para a Engenharia
  const [engAberto, setEngAberto] = useState(false);
  const [eng, setEng] = useState({ unidade: "", setor: "", cargo: "", atividades: "" });
  const [pedidoEng, setPedidoEng] = useState<typeof eng | null>(null);
  useEffect(() => { setCadAberto(false); setHier(null); setCadErro(""); setEngAberto(false); setPedidoEng(null); }, [cpf, socCode]);
  const abrirCadastro = () => {
    setAlterandoLot(false); setCadAberto(true);
    if (hier) return;
    supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "hierarquia", cnpj, socCode } })
      .then(({ data }) => setHier(data ?? { unidades: [], podeCriar: false, indisponivel: true }));
  };
  const abrirLotacao = () => {
    setAlterandoLot(true); setCadAberto(true); setCadErro(""); setLotConfirmada(false);
    setCad((p) => ({ ...p, unidade: "", setor: "", cargo: "" }));
    if (!hier) supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "hierarquia", cnpj, socCode } }).then(({ data }) => setHier(data ?? { unidades: [], podeCriar: false, indisponivel: true }));
  };
  const livre = !!hier?.podeCriar;
  const empSel = empresas?.find((e) => e.soc_code === socCode);
  const inativo = !!func?.encontrado && !!func.inativo;
  // Pontuais/parceiros: histórico inativo vai direto para o novo cadastro
  const inativoLivre = inativo && !!empSel?.podeCriar;
  // Parceiras/Pontual: o cadastro inativo é reativado (volta como Pendente) em vez de criar outro
  const [reativ, setReativ] = useState(false);
  const [reativando, setReativando] = useState(false);
  useEffect(() => { setReativ(false); }, [cpf, socCode]);
  const reativarDireto = async () => {
    setReativando(true); setCadErro("");
    const { data, error } = await supabase.functions.invoke("soc-agenda-lookup", { body: { acao: "reativar", cnpj, socCode, cpf } });
    setReativando(false);
    if (error || !data?.ok) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      return setCadErro(msg ?? "Não foi possível reativar o cadastro agora. Tente novamente.");
    }
    setFunc({ encontrado: true, funcionario: data.funcionario });
    setF((p) => ({ ...p, cargo: data.funcionario.cargo ?? "", tipoExame: "" }));
    setLotConfirmada(true); setExames([]);
  };
  const precisaCadastro = !!func && ((!func.encontrado && !func.indisponivel) || inativo);
  const tipoPermitidoInativo = f.tipoExame === "Demissional";
  const uSel = hier?.unidades.find((u) => u.codigo === cad.unidade);
  const sSel = uSel?.setores.find((x) => x.codigo === cad.setor);
  // Livre: aceita nome digitado; se bater com um existente, envia o código
  const ref = (txt: string, lista: Item[] = []) => { const t = txt.trim().toUpperCase(); const m = lista.find((i) => i.nome.toUpperCase() === t || i.codigo === txt); return m ? { codigo: m.codigo } : { nome: t }; };
  const cadOk = !hier?.indisponivel && !!hier && (alterandoLot || (f.colaboradorNome.trim().length >= 3 && !!cad.nascimento && !!cad.sexo && !!cad.admissao)) && !!cad.unidade.trim() && !!cad.setor.trim() && !!cad.cargo.trim();
  const cadastrar = async () => {
    setCadastrando(true); setCadErro("");
    const body = {
      acao: reativ ? "reativar" : alterandoLot ? "alterarLotacao" : "cadastrar", cnpj, socCode, cpf, nome: f.colaboradorNome.trim(), dataNascimento: cad.nascimento, dataAdmissao: cad.admissao, sexo: cad.sexo,
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
    if (alterandoLot || reativ) {
      setReativ(false);
      if (!data.funcionario) return setCadErro("Não foi possível conferir a lotação no SOC. Tente consultar novamente.");
      setFunc({ encontrado: true, funcionario: data.funcionario });
      setF((p) => ({ ...p, cargo: data.funcionario.cargo ?? "", tipoExame: "" }));
      setCadAberto(false); setAlterandoLot(false); setLotConfirmada(true); setExames([]);
      return;
    }
    setLotConfirmada(true);
    const nomeDe = (v: string, l: Item[] = []) => l.find((i) => i.codigo === v)?.nome ?? v.toUpperCase();
    const cargoNome = livre ? cad.cargo.toUpperCase() : nomeDe(cad.cargo, sSel?.cargos);
    setFunc({ encontrado: true, recemCadastrado: true, funcionario: {
      nome: f.colaboradorNome.trim().toUpperCase(), cargo: cargoNome,
      setor: livre ? cad.setor.toUpperCase() : nomeDe(cad.setor, uSel?.setores),
      unidade: livre ? cad.unidade.toUpperCase() : nomeDe(cad.unidade, hier?.unidades), situacao: "PENDENTE" } });
    setF((p) => ({ ...p, cargo: cargoNome, tipoExame: "Admissional" }));
    setCadAberto(false);
  };

  const retorno = f.tipoExame === "Retorno ao Trabalho";
  const docsRetorno = docsExig.filter((d) => d.tipo_exame === f.tipoExame);
  const valido = [
    (!!socCode || !!externa) && cnpj.length === 14,
    cpfValido && f.colaboradorNome.trim().length >= 3 && (!!pedido || semPedido || (!!func && !func.encontrado && !!func.indisponivel && !!f.cargo.trim()) || (!!func && func.encontrado && !inativoLivre && (inativo || lotConfirmada) && !cadAberto) || (!!pedidoEng && !cadAberto)),
    pedido ? true : semPedido ? !!f.tipoExame && guias.length > 0 : !!f.tipoExame && (!inativo || tipoPermitidoInativo) && (!retorno || (motivoRetorno.trim().length >= 10 && docsRetorno.length > 0 && docsRetorno.filter((d) => d.obrigatorio).every((d) => docs[d.nome]) && docsRetorno.some((d) => docs[d.nome]))) && !buscandoPcmso,
    !!unidadeId && !!dia && !!hora,
  ];

  const enviar = async () => {
    setCarregando(true); setErro("");
    const fu = func?.funcionario;
    void fu;
    const mudancaRisco = mudanca ? `MUDANÇA DE RISCO — LOTAÇÃO CONFERIDA NO SOC: ${func?.funcionario?.unidade ?? ""}; ${func?.funcionario?.setor ?? ""}; ${func?.funcionario?.cargo ?? ""}` : undefined;
    const toB64 = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
    const [primeira, ...demais] = guias;
    const guiaPayload = primeira ? { nome: primeira.name.slice(0, 120), tipo: primeira.type, base64: await toB64(primeira) } : undefined;
    const extras = await Promise.all(demais.map(async (g) => ({ tipoDocumento: "Guia/Kit", nome: g.name.slice(0, 120), tipo: g.type, base64: await toB64(g) })));
    const docsRet = retorno ? await Promise.all(Object.entries(docs).filter(([, v]) => v).map(async ([k, v]) => ({ tipoDocumento: k, nome: v?.name.slice(0, 120), tipo: v?.type, base64: v ? await toB64(v) : "" }))) : [];
    const documentos = [...docsRet, ...extras].slice(0, 10);
    const { data, error } = await supabase.functions.invoke("soc-agenda-solicitar", {
      body: {
        unidadeId, empresaNome: f.empresaNome, empresaCnpj: cnpj, codigoEmpresaSoc: pedido || semPedido ? undefined : socCode,
        origem: pedido ? "socnet" : semPedido ? "externo" : "cliente", sequencialFicha: pedido?.sequencialFicha,
        colaboradorNome: f.colaboradorNome, colaboradorCpf: cpf,
        tipoExame: f.tipoExame, data: toIso(dia), hora, observacoes: f.observacoes.trim().slice(0, 1000) || undefined, mudancaRisco: mudancaRisco?.slice(0, 400),
        exames: pedido ? pedido.exames : [...(temPcmso ? [] : [CLINICO]), ...(usaGradePcmso ? ["CONFORME PCMSO"] : exames)], guia: guiaPayload,
        documentos, motivoRetorno: retorno ? motivoRetorno.trim() : undefined,
        estruturaNova: pedidoEng ? {
          unidade: pedidoEng.unidade.trim(), setor: pedidoEng.setor.trim(), cargo: pedidoEng.cargo.trim(), atividades: pedidoEng.atividades.trim() || undefined,
          ...(alterandoLot ? {} : { nascimento: cad.nascimento || undefined, sexo: cad.sexo || undefined, admissao: cad.admissao || undefined }),
        } : undefined,
      },
    });
    setCarregando(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      return setErro(msg ?? "Não foi possível concluir. Tente novamente.");
    }
    if (data?.aguardandoAprovacao) { setAguardandoAprov(true); return setProtocolo(data.protocolo); }
    if (data?.pendenteEquipe) { setPendenteEquipe(true); return setProtocolo(data.protocolo); }
    if (!data?.agendadoSoc) {
      return setErro(`Não conseguimos reservar este horário na agenda (protocolo ${data?.protocolo ?? "-"}). Escolha outro horário ou fale com a PreverMed antes de comparecer.`);
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
            <CardContent className="space-y-5 py-8">
              <div className="space-y-2 text-center">
                <CalendarCheck className="mx-auto h-12 w-12 text-primary" />
                <p className="text-lg font-semibold">{aguardandoAprov ? "Solicitação recebida — aguardando aprovação" : pendenteEquipe ? "Solicitação recebida!" : "Pré-agendamento realizado!"}</p>
                {pendenteEquipe && <p className="text-sm text-muted-foreground">Nossa equipe vai conferir {pedido ? "o pedido" : "a guia enviada"} e confirmar a reserva na agenda. Se houver pendência, entraremos em contato.</p>}
                <p className="font-mono text-2xl">{protocolo}</p>
                <p className="text-xs text-muted-foreground">Guarde este número de protocolo.</p>
              </div>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 rounded-md border p-4 text-sm">
                <dt className="text-muted-foreground">Empresa</dt><dd className="font-medium">{empresas?.find((e) => e.soc_code === socCode)?.razao_social ?? f.empresaNome}</dd>
                <dt className="text-muted-foreground">Colaborador</dt><dd className="font-medium">{f.colaboradorNome}</dd>
                {func?.funcionario?.unidade && (<><dt className="text-muted-foreground">Unidade do colaborador</dt><dd className="font-medium">{func.funcionario.unidade}</dd></>)}
                <dt className="text-muted-foreground">Tipo de exame</dt><dd className="font-medium">{f.tipoExame}</dd>
                <dt className="text-muted-foreground">Exames</dt><dd className="font-medium">{pedido ? pedido.exames.join(", ") : usaGradePcmso ? "CONFORME PCMSO" : [...(temPcmso ? [] : [CLINICO]), ...exames].join(", ") || "-"}</dd>
                <dt className="text-muted-foreground">Local de atendimento</dt>
                <dd><span className="font-medium">{unidade?.nome}</span>
                  {ENDERECOS[unidade?.codigo_agenda.replace(/^0+/, "") ?? ""] && <span className="block text-xs text-muted-foreground">{ENDERECOS[unidade?.codigo_agenda.replace(/^0+/, "") ?? ""]}</span>}
                </dd>
                <dt className="text-muted-foreground">Data</dt><dd className="font-medium">{dia}</dd>
                <dt className="text-muted-foreground">Horário</dt><dd className="font-medium">{hora}h</dd>
              </dl>
              {aguardandoAprov && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-sm">
                  Nossa equipe de saúde vai conferir a documentação do retorno ao trabalho. O horário só fica confirmado após a aprovação.
                  Acompanhe ou envie documentos pelo link abaixo, com o protocolo e o CPF.
                </div>
              )}
              <div className="space-y-2 rounded-md bg-muted/60 p-4 text-sm">
                <p className="font-medium">Leve um documento oficial de identificação com foto.</p>
                <p className="text-muted-foreground">Este é um pré-agendamento, feito para agilizar a abertura da ficha na recepção. O horário é uma previsão de chegada e não garante atendimento exatamente no horário marcado.</p>
              </div>
              {preparosDosExames(pedido ? pedido.exames : exames).length > 0 && (
                <section className="space-y-2 border-t pt-4 text-sm">
                  <h2 className="font-semibold">Preparos dos exames</h2>
                  <p className="text-xs text-muted-foreground">Clique no exame para ver o preparo.</p>
                  {preparosDosExames(pedido ? pedido.exames : exames).map((p) => (
                    <details key={p.codigo} className="rounded-md border px-3 py-2 print:break-inside-avoid">
                      <summary className="cursor-pointer font-medium">{p.nome}</summary>
                      <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{p.texto.replace(/\s*\n(?![*•\-A-ZÀ-Ú])\s*/g, " ")}</p>
                    </details>
                  ))}
                </section>
              )}
              <div className="flex flex-wrap justify-center gap-2 print:hidden">
                <Button variant="outline" onClick={() => window.print()}>Imprimir comprovante</Button>
                <Button onClick={() => window.location.assign(`${window.location.pathname}?cnpj=${cnpj}${socCode ? `&soc=${socCode}` : ""}`)}>Outro colaborador desta empresa</Button>
                <Button variant="outline" onClick={() => window.location.assign(window.location.pathname)}>Nova empresa</Button>
              </div>
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
                {empresas && empresas.length === 0 && externa && (
                  <div className="flex gap-2 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <p>Empresa identificada: <strong>{externa.razao_social}</strong>. Continue para informar o CPF do colaborador.</p>
                  </div>
                )}
                {empresas && empresas.length === 0 && !externa && (
                  <p className="text-sm text-destructive">Não conseguimos identificar este CNPJ. Confira os números ou fale com a PreverMed.</p>
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
                {buscandoFunc && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Consultando…</p>}
                {pedido && (
                  <div className="space-y-1 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-primary"><CheckCircle2 className="h-4 w-4" /> Localizamos a autorização de exames!</p>
                    <p className="font-semibold">{pedido.funcionario?.nome}</p>
                    <p>Tipo de exame: {pedido.tipoExame ?? "Periódico"}</p>
                    <p>Empresa: {pedido.empresa?.nome}</p>
                    <p>Exames autorizados: {pedido.exames.join(", ")}</p>
                  </div>
                )}
                {semPedido && (<>
                  {guiaSocnet && <p className="rounded-md border border-primary p-3 text-sm">Localizamos a guia SOCNET {guiaSocnet.numero}: {guiaSocnet.exames.join(", ")}. Anexe o kit para conferência da equipe antes da confirmação do atendimento.</p>}
                  <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <p>Não localizamos pedido de exames nem guia de encaminhamento para este CPF no SOC. Solicite à empresa/assessoria a abertura do pedido de exames no SOC direcionado à PreverMed, ou informe o nome do colaborador e, na próxima etapa, envie a guia de encaminhamento / kit de atendimento para a equipe lançar o atendimento.</p>
                  </div>
                  <div><Label>Nome completo</Label><Input value={f.colaboradorNome} onChange={set("colaboradorNome")} maxLength={120} /></div>
                </>)}
                {func?.encontrado && (
                  <div className="space-y-1 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                    <p className="font-semibold">{func.funcionario.nome}</p>
                    {func.funcionario.cargo && <p>Cargo: {func.funcionario.cargo}</p>}
                    {func.funcionario.setor && <p>Setor: {func.funcionario.setor}</p>}
                    {func.funcionario.unidade && <p>Unidade: {func.funcionario.unidade}</p>}
                    {inativo && !inativoLivre && <p className="text-xs font-semibold text-destructive whitespace-nowrap">Cadastro INATIVO nesta empresa</p>}
                    {func.recemCadastrado && <p className="text-xs text-primary">Pré-cadastrado agora no SOC (situação Pendente).</p>}
                    {inativoLivre && !cadAberto && (
                      <div className="space-y-1 pt-2">
                        <p className="text-xs text-muted-foreground">Encontramos o cadastro deste colaborador. O cargo, o setor e a unidade acima continuam os mesmos?</p>
                        {reativando
                          ? <p className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><Loader2 className="h-3 w-3 animate-spin" />Atualizando cadastro…</p>
                          : <div className="flex items-center gap-3 text-xs">
                              <button type="button" className="font-medium text-primary hover:underline whitespace-nowrap" onClick={reativarDireto}>Sim, estão corretos</button>
                              <button type="button" className="text-muted-foreground hover:underline whitespace-nowrap" onClick={() => { abrirLotacao(); setReativ(true); }}>Não, corrigir</button>
                            </div>}
                        {cadErro && !cadAberto && <p className="text-xs text-destructive">{cadErro}</p>}
                      </div>
                    )}
                    {!inativo && !cadAberto && (
                      <div className="space-y-1 pt-2">
                        <p className="text-xs text-muted-foreground">O cargo, o setor e a unidade acima estão corretos? Eles definem os exames do atendimento.</p>
                        {lotConfirmada
                          ? <p className="flex items-center gap-1 text-xs font-medium text-primary whitespace-nowrap"><Check className="h-3.5 w-3.5" />Dados confirmados</p>
                          : <div className="flex items-center gap-3 text-xs">
                              <button type="button" className="font-medium text-primary hover:underline whitespace-nowrap" onClick={() => setLotConfirmada(true)}>Sim, estão corretos</button>
                              <button type="button" className="text-muted-foreground hover:underline whitespace-nowrap" onClick={abrirLotacao}>Não, corrigir</button>
                            </div>}
                      </div>
                    )}
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
                {(precisaCadastro || alterandoLot) && cadAberto && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">{alterandoLot ? "Corrigir cargo, setor e unidade" : "Pré-cadastro do colaborador"}</p>
                    {!alterandoLot && <><div><Label>Nome completo *</Label><Input value={f.colaboradorNome} onChange={set("colaboradorNome")} maxLength={120} /></div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div><Label>Nascimento *</Label><Input type="date" value={cad.nascimento} onChange={(e) => setCad({ ...cad, nascimento: e.target.value })} /></div>
                      <div><Label>Sexo *</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cad.sexo} onChange={(e) => setCad({ ...cad, sexo: e.target.value })}>
                          <option value="">Selecione</option><option value="MASCULINO">Masculino</option><option value="FEMININO">Feminino</option>
                        </select></div>
                      <div><Label>Admissão *</Label><Input type="date" value={cad.admissao} onChange={(e) => setCad({ ...cad, admissao: e.target.value })} /></div>
                    </div>
                    </>}
                    {reativ && <div className="sm:w-1/3"><Label>Admissão</Label><Input type="date" value={cad.admissao} onChange={(e) => setCad({ ...cad, admissao: e.target.value })} /></div>}
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
                      {!engAberto ? (
                        <button type="button" className="text-xs text-primary underline" onClick={() => setEngAberto(true)}>Não encontrei a unidade, o setor ou o cargo</button>
                      ) : (
                        <div className="space-y-2 rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Informe como é na empresa. O horário fica reservado e nossa equipe técnica confere antes de confirmar.</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {(["unidade", "setor", "cargo"] as const).map((k) => (
                              <div key={k}><Label className="capitalize">{k} *</Label><Input value={eng[k]} maxLength={120} onChange={(e) => setEng({ ...eng, [k]: e.target.value })} /></div>
                            ))}
                          </div>
                          <div><Label>Atividades do cargo</Label><Textarea rows={2} maxLength={800} value={eng.atividades} onChange={(e) => setEng({ ...eng, atividades: e.target.value })} /></div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEngAberto(false)}>Voltar</Button>
                            <Button type="button" size="sm"
                              disabled={eng.unidade.trim().length < 2 || eng.setor.trim().length < 2 || eng.cargo.trim().length < 2 || (!alterandoLot && (f.colaboradorNome.trim().length < 3 || !cad.nascimento || !cad.sexo || !cad.admissao))}
                              onClick={() => { setPedidoEng({ ...eng }); setF((p) => ({ ...p, cargo: eng.cargo.trim().toUpperCase(), tipoExame: alterandoLot ? "Mudança de Risco" : "Admissional" })); setCadAberto(false); setEngAberto(false); }}>
                              Continuar
                            </Button>
                          </div>
                        </div>
                      )}
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
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setCadAberto(false); setAlterandoLot(false); setReativ(false); }}>Cancelar</Button>
                      <Button type="button" size="sm" disabled={!cadOk || cadastrando} onClick={cadastrar}>
                        {cadastrando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{alterandoLot ? "Confirmar e atualizar no SOC" : "Pré-cadastrar no SOC"}
                      </Button>
                    </div>
                  </div>
                )}
              </>)}
              {passo === 1 && pedidoEng && !cadAberto && (
                <div className="rounded-md border p-3 text-sm">
                  <p><strong>{toTitle(pedidoEng.cargo)}</strong> · {toTitle(pedidoEng.setor)} · {toTitle(pedidoEng.unidade)}</p>
                  <p className="text-xs text-muted-foreground">Nossa equipe técnica vai conferir antes de confirmar o horário.</p>
                  <button type="button" className="text-xs text-primary underline" onClick={() => setPedidoEng(null)}>Corrigir</button>
                </div>
              )}
              {passo === 2 && pedido && (
                <div className="space-y-2 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                  <p>Tipo de exame: <strong>{f.tipoExame}</strong></p>
                  <p className="font-medium">Exames autorizados no pedido:</p>
                  <div className="flex flex-wrap gap-1.5">{pedido.exames.map((e) => <span key={e} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary bg-primary px-2.5 py-1 text-xs text-primary-foreground"><Check className="h-3 w-3" />{e}</span>)}</div>
                  <div><Label>Observações (opcional)</Label><Textarea value={f.observacoes} onChange={set("observacoes")} maxLength={1000} /></div>
                </div>
              )}
              {passo === 2 && !pedido && (<>
                {inativo && (
                  <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p><strong>Atenção:</strong> este colaborador consta como INATIVO nesta empresa no sistema.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.filter((t) => !semPedido || t !== "Retorno ao Trabalho").map((t) => (
                    <Button key={t} type="button" variant={f.tipoExame === t ? "default" : "outline"} onClick={() => setF({ ...f, tipoExame: t })}>{t}</Button>
                  ))}
                </div>
                {inativo && f.tipoExame === "Admissional" && (
                  <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <p>Colaborador inativo identificado. Ao prosseguir com Admissional, você preencherá a nova data de admissão e a lotação para registrar o novo vínculo.</p>
                    <Button type="button" size="sm" onClick={() => { setPasso(1); abrirCadastro(); }}>Avançar para dados de admissão</Button>
                  </div>
                )}
                {inativo && f.tipoExame === "Demissional" && (
                  <div className="flex gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <p>Agendamento de Demissional autorizado no vínculo existente para conclusão do desligamento.</p>
                  </div>
                )}
                {inativo && f.tipoExame && f.tipoExame !== "Admissional" && f.tipoExame !== "Demissional" && (
                  <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p>Não é possível agendar este tipo de exame para um colaborador inativo. Para realizar este atendimento, o cadastro precisa estar ativo no SOC, ou selecione Admissional/Demissional.</p>
                  </div>
                )}
                {f.tipoExame === "Admissional" && func?.encontrado && !func.recemCadastrado && !inativo && (
                  <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p><strong>Atenção:</strong> colaborador já possui cadastro ativo nesta empresa
                      {func.funcionario?.cargo && <> como <strong>{func.funcionario.cargo}</strong></>}
                      {func.funcionario?.matricula && <> (Matrícula: {func.funcionario.matricula})</>}.
                      {" "}Verifique se o <strong>tipo de exame</strong> está correto antes de prosseguir.</p>
                  </div>
                )}
                {mudanca && (
                  <div className="space-y-1 rounded-md border p-3 text-sm">
                    {func?.funcionario?.cargo && <p>Cargo: {func.funcionario.cargo}</p>}
                    {func?.funcionario?.setor && <p>Setor: {func.funcionario.setor}</p>}
                    {func?.funcionario?.unidade && <p>Unidade: {func.funcionario.unidade}</p>}
                    <p className="pt-1 text-xs text-muted-foreground">Estes são o cargo, o setor e a unidade para onde o colaborador vai? Eles definem os exames do atendimento.</p>
                    <button type="button" className="text-xs font-medium text-primary hover:underline whitespace-nowrap" onClick={() => { setPasso(1); abrirLotacao(); }}>Não, corrigir</button>
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
                    {mostrarGrade && [...pcmsoTipo, ...(pcmsoTipo.length > 0 ? [] : EXAMES.filter((e) => !pcmsoTipo.includes(e))), ...exames.filter((e) => !pcmsoTipo.includes(e))]
                      .filter((e, i, a) => a.indexOf(e) === i)
                      .map((e) => {
                      const on = exames.includes(e); const doPcmso = temPcmso && pcmsoTipo.includes(e);
                      return (
                        <button key={e} type="button"
                          onClick={() => setExames((p) => p.includes(e) ? p.filter((x) => x !== e) : [...p, e])}
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : doPcmso ? "border-dashed border-primary/60 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                          {on && <Check className="h-3 w-3" />}
                          {e}
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
                {(semPedido || !!pedido || !!empSel?.podeCriar) && (
                <div className="space-y-2">
                  <Label>Kit de atendimento / Guia ({semPedido ? "obrigatório" : "opcional"} — PDF ou imagem, até 5 MB cada, máx. 8 arquivos)</Label>
                  <Input type="file" multiple accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => {
                      const novos = Array.from(e.target.files ?? []); e.target.value = "";
                      if (novos.some((x) => x.size > 5 * 1024 * 1024)) return setErro("Há arquivo maior que 5 MB.");
                      setErro(""); setGuias((p) => [...p, ...novos].slice(0, 8));
                    }} />
                  {guias.length === 0 && !semPedido && (
                    <p className="text-xs text-destructive">Atenção: O atendimento no balcão depende da apresentação do kit (guia, ficha clínica e ASO) para realização do atendimento.</p>
                  )}
                  {guias.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {guias.map((g, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                          <span className="truncate">{g.name}</span>
                          <button type="button" className="text-destructive" onClick={() => setGuias((p) => p.filter((_, j) => j !== i))}>remover</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                )}
                {retorno && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium">Documentação do retorno ao trabalho</p>
                    <p className="text-xs text-muted-foreground">O agendamento só é confirmado após a nossa equipe de saúde conferir os documentos (completos e legíveis), para o colaborador não perder tempo na clínica.</p>
                    <div><Label>Motivo do retorno *</Label>
                      <Textarea value={motivoRetorno} onChange={(e) => setMotivoRetorno(e.target.value)} maxLength={1000} placeholder="Ex.: afastamento por cirurgia no joelho de 01/08 a 30/09, alta do INSS em 01/10." />
                      {motivoRetorno.trim().length > 0 && motivoRetorno.trim().length < 10 && <p className="mt-1 text-xs text-destructive">Descreva um pouco mais (mínimo 10 caracteres).</p>}</div>
                    {docsRetorno.map((d) => (
                      <div key={d.nome}><Label>{d.nome}{d.obrigatorio ? " *" : " (se houver)"}</Label>
                        <Input type="file" accept="application/pdf,image/png,image/jpeg"
                          onChange={(e) => { const file = e.target.files?.[0] ?? null; if (file && file.size > 5 * 1024 * 1024) { setErro("Arquivo maior que 5 MB."); e.target.value = ""; return; } setErro(""); setDocs((p) => ({ ...p, [d.nome]: file })); }} /></div>
                    ))}
                  </div>
                )}
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
                  <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Sem horários disponíveis nos próximos 14 dias nesta unidade.</p>
                    {indisp.slice(0, 4).map((i) => <p key={i.data} className="text-muted-foreground">{i.data.slice(0, 5)}: {i.motivo}</p>)}
                    <p className="text-muted-foreground">O que fazer: tente a outra unidade{regrasEx.length ? ", volte e agende os exames especiais em separado" : ""} ou fale com a PreverMed.</p>
                  </div>
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
                    {porData[dia].map(({ hora: h }) => (
                      <Button key={h} size="sm" variant={hora === h ? "default" : "outline"} onClick={() => setHora(h)}>
                        {h}
                      </Button>
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
