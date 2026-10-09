import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import logo from "@/assets/logo-prevermed.png";

const dig = (v: string) => v.replace(/\D/g, "");
const maskCPF = (v: string) => dig(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const KIT = ["Guia", "Ficha Clínica", "ASO", "Comunicado do INSS", "Alta Médica", "Laudo do Especialista", "Outros"];
const toB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });

export default function AgendamentoCompletar() {
  const [sp] = useSearchParams();
  const [protocolo, setProtocolo] = useState(sp.get("protocolo") ?? "");
  const [cpf, setCpf] = useState("");
  const [info, setInfo] = useState<any | null>(null);
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => { document.title = "Completar pré-agendamento | PreverMed"; }, []);

  const chamar = async (body: Record<string, unknown>) => {
    setCarregando(true); setErro("");
    const { data, error } = await supabase.functions.invoke("soc-agenda-kit", { body: { protocolo: protocolo.trim().toUpperCase(), cpf: dig(cpf), ...body } });
    setCarregando(false);
    let msg = data?.error;
    if (error && !msg) { try { msg = (await (error as any).context?.json())?.error; } catch { /* */ } }
    if (error || msg) { setErro(msg ?? "Não foi possível concluir."); return null; }
    return data;
  };
  const consultar = async () => { const d = await chamar({ acao: "consultar" }); if (d) setInfo(d); };
  const enviar = async () => {
    const lista = await Promise.all(Object.entries(arquivos).filter(([, f]) => f).map(async ([k, f]) => ({ tipoDocumento: k, nome: f!.name.slice(0, 120), tipo: f!.type, base64: await toB64(f!) })));
    const d = await chamar({ acao: "enviar", arquivos: lista });
    if (d) { setOk(`${d.enviados} arquivo(s) enviado(s). A recepção já pode visualizar.`); setArquivos({}); consultar(); }
  };
  const ag = info?.agendamento;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="PreverMed" className="h-12" />
          <h1 className="text-2xl font-semibold">Completar pré-agendamento</h1>
          <p className="text-sm text-muted-foreground">Envie o kit de atendimento (guia, ficha clínica, ASO) ou documentos pendentes.</p>
        </div>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div><Label>Protocolo</Label><Input value={protocolo} onChange={(e) => setProtocolo(e.target.value.toUpperCase())} placeholder="AG-20261009-ABC123" /></div>
            <div><Label>CPF do colaborador</Label><Input inputMode="numeric" value={maskCPF(cpf)} onChange={(e) => setCpf(dig(e.target.value).slice(0, 11))} placeholder="000.000.000-00" /></div>
            <Button className="w-full" disabled={carregando || protocolo.length < 10 || dig(cpf).length !== 11} onClick={consultar}>
              {carregando && !ag && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Buscar pré-agendamento
            </Button>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </CardContent>
        </Card>
        {ag && (
          <Card>
            <CardHeader><CardTitle className="text-base">{ag.colaborador_nome}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{ag.empresa_nome} — {ag.tipo_exame} em {ag.data_agendada.split("-").reverse().join("/")} às {ag.hora_agendada.slice(0, 5)}</p>
              {ag.aprovacao_status === "pendente" && <p className="rounded-md bg-muted p-3">Documentação em análise pela equipe de saúde. O horário será confirmado após a aprovação.</p>}
              {ag.aprovacao_status === "devolvido" && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3"><strong>Documentação devolvida:</strong> {ag.devolucao_motivo}. Envie os documentos corrigidos abaixo para nova análise.</p>}
              {ag.aprovacao_status === "aprovado" && <p className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-4 w-4" />Documentação aprovada.</p>}
              <div className="space-y-1">
                <p className="font-medium">Arquivos já enviados</p>
                {info.anexos.length ? info.anexos.map((a: any, i: number) => <p key={i} className="flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4" />{a.tipo_documento} — {new Date(a.enviado_em).toLocaleDateString("pt-BR")}</p>) : <p className="text-muted-foreground">Nenhum.</p>}
              </div>
              <div className="space-y-2">
                <p className="font-medium">Enviar arquivos (PDF ou imagem, até 5 MB cada)</p>
                {KIT.map((k) => (
                  <div key={k}><Label>{k}</Label>
                    <Input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f && f.size > 5 * 1024 * 1024) { setErro("Arquivo maior que 5 MB."); e.target.value = ""; return; } setErro(""); setArquivos((p) => ({ ...p, [k]: f })); }} /></div>
                ))}
              </div>
              {ok && <p className="text-primary">{ok}</p>}
              <Button className="w-full" disabled={carregando || !Object.values(arquivos).some(Boolean)} onClick={enviar}>
                {carregando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Enviar arquivos
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
