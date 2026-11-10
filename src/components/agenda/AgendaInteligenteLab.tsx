import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

const ROT: Record<string, string> = {
  cnpj: "CNPJ", razao_social: "Razão social", cpf: "CPF", nome: "Colaborador", data_nascimento: "Nascimento", sexo: "Sexo",
  tipo_exame: "Tipo de exame", unidade_empresa: "Unidade (empresa)", setor: "Setor", cargo: "Cargo",
  unidade_atendimento: "Unidade de atendimento", data_preferida: "Dia preferido", periodo_preferido: "Período",
};
const fmt = (k: string, v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v);

const toB64 = (f: File) => new Promise<string>((ok, err) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1]);
  r.onerror = err; r.readAsDataURL(f);
});

export function AgendaInteligenteLab() {
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<any>(null);

  const ler = async () => {
    if (!texto.trim() && !arquivo) return toast.error("Cole um texto ou anexe uma guia.");
    if (arquivo && arquivo.size > 5 * 1024 * 1024) return toast.error("Arquivo acima de 5MB.");
    setCarregando(true); setRes(null);
    try {
      const body: any = { texto };
      if (arquivo) body.arquivo = { nome: arquivo.name, mime: arquivo.type || "application/pdf", base64: await toB64(arquivo) };
      const { data, error } = await supabase.functions.invoke("agenda-inteligente-lab", { body });
      if (error) {
        const msg = await (error as any).context?.json?.().then((j: any) => j.error).catch(() => null);
        throw new Error(msg ?? error.message);
      }
      setRes(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha na leitura"); }
    finally { setCarregando(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-5 w-5 text-primary" />Agenda Inteligente, laboratório de testes</CardTitle>
          <p className="text-xs text-muted-foreground">Simulação: nada é gravado, nenhum horário é reservado e nada vai ao SOC. Cada leitura consome créditos de IA.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui a mensagem do cliente, como ela chegou no WhatsApp (opcional se anexar a guia)" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
              <Paperclip className="h-4 w-4" />Anexar guia (PDF ou foto)
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            {arquivo && <Badge variant="secondary" className="gap-1 whitespace-nowrap">{arquivo.name}<X className="h-3 w-3 cursor-pointer" onClick={() => setArquivo(null)} /></Badge>}
            <Button onClick={ler} disabled={carregando} className="ml-auto">
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}Ler e simular
            </Button>
          </div>
        </CardContent>
      </Card>

      {res && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">O que foi identificado</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {Object.keys(ROT).map((k) => (
                <div key={k} className="flex justify-between gap-3 border-b py-1">
                  <span className="text-muted-foreground">{ROT[k]}</span>
                  {res.dados[k] ? <span className="text-right font-medium">{fmt(k, res.dados[k])}</span> : <Badge variant="outline" className="whitespace-nowrap">Faltando</Badge>}
                </div>
              ))}
              <div className="pt-2"><span className="text-muted-foreground">Exames:</span> {res.dados.exames?.length ? res.dados.exames.join(", ") : "nenhum informado"}</div>
              {res.dados.observacoes && <p className="pt-1 text-xs text-muted-foreground">Obs.: {res.dados.observacoes}</p>}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Confronto com a carteira e regras</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {res.empresa ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{res.empresa.razao_social}</span>
                    <Badge variant="secondary" className="whitespace-nowrap">{res.empresa.subgrupo_codigo ?? "sem subgrupo"} {res.empresa.subgrupo ?? ""}</Badge>
                    <Badge variant={res.empresa.livre ? "default" : "destructive"} className="whitespace-nowrap">{res.empresa.livre ? "Hierarquia livre" : "Restrita (laudos)"}</Badge>
                  </div>
                ) : <p className="text-muted-foreground">Empresa não localizada na carteira.</p>}
                {res.alertas.map((a: string, i: number) => <p key={i} className="rounded-md bg-muted p-2 text-xs">{a}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Resposta simulada do robô</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">{res.resposta}</p></CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
