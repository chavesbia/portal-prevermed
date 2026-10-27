import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hospital, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

type Prestador = {
  codigo: string; nome: string; cidade: string | null; uf: string | null; telefone: string | null; celular: string | null;
  email: string | null; tipo_atendimento: string | null; socnet: boolean; ativo: boolean; unidade_responsavel: string | null;
  sincronizado_em: string;
};
const UNIDADES: Record<string, string> = { lapa: "Unidade Lapa", osasco: "Unidade Osasco" };
const sel = "h-8 rounded-md border border-input bg-background px-2 text-xs";
const titulo = (t: string | null) => (t ?? "").toLowerCase().replace(/(^|\s|\()\S/g, (c) => c.toUpperCase());
const db = supabase as any;

async function carregar(): Promise<Prestador[]> {
  const out: Prestador[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("soc_prestadores")
      .select("codigo,nome,cidade,uf,telefone,celular,email,tipo_atendimento,socnet,ativo,unidade_responsavel,sincronizado_em")
      .order("nome").range(de, de + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export default function AdminPrestadores() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const busca = sp.get("q") ?? "";
  const filtro = sp.get("f") ?? "todos";
  const situacao = sp.get("s") ?? "ativos";
  const [sincronizando, setSincronizando] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["soc-prestadores"], queryFn: carregar });

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return data.filter((p) =>
      (situacao === "todos" || (situacao === "ativos" ? p.ativo : !p.ativo)) &&
      (filtro === "todos" || (filtro === "externo" ? !p.unidade_responsavel : p.unidade_responsavel === filtro)) &&
      (!q || p.nome.includes(q) || p.codigo.includes(q) || (p.cidade ?? "").includes(q)));
  }, [data, busca, filtro, situacao]);

  const contagem = useMemo(() => ({
    lapa: data.filter((p) => p.unidade_responsavel === "lapa").length,
    osasco: data.filter((p) => p.unidade_responsavel === "osasco").length,
  }), [data]);

  const classificar = async (p: Prestador, unidade: string) => {
    const valor = unidade || null;
    const { error } = await db.from("soc_prestadores")
      .update({ unidade_responsavel: valor, classificado_por: user?.id, classificado_em: new Date().toISOString() })
      .eq("codigo", p.codigo);
    if (error) return toast.error("Não foi possível salvar a classificação.");
    await supabase.from("audit_log").insert({
      user_id: user?.id, action_type: "prestador_classificado", object_type: "soc_prestadores", object_id: null,
      details: { codigo: p.codigo, nome: p.nome, de: p.unidade_responsavel, para: valor },
    } as any);
    qc.setQueryData<Prestador[]>(["soc-prestadores"], (old) => old?.map((x) => x.codigo === p.codigo ? { ...x, unidade_responsavel: valor } : x));
    toast.success(valor ? `${titulo(p.nome)} vinculado à ${UNIDADES[valor]}` : `${titulo(p.nome)} marcado como rede externa`);
  };

  const sincronizar = async () => {
    setSincronizando(true);
    const { data: r, error } = await supabase.functions.invoke("soc-prestadores-sync", { body: {} });
    setSincronizando(false);
    if (error || r?.error) return toast.error(r?.error ?? "SOC indisponível no momento. Tente novamente.");
    toast.success(`${r.prestadores} prestadores atualizados do SOC`);
    qc.invalidateQueries({ queryKey: ["soc-prestadores"] });
  };

  const ultima = data[0]?.sincronizado_em ? new Date(data.reduce((m, p) => p.sincronizado_em > m ? p.sincronizado_em : m, data[0].sincronizado_em)) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Hospital className="h-6 w-6 text-primary" /> Prestadores</h1>
          <p className="text-sm text-muted-foreground">
            Lista oficial da Tela 245 do SOC, atualizada todo dia. Vincule à Lapa ou Osasco os prestadores que atendem nas nossas unidades — os demais ficam como rede externa.
          </p>
        </div>
        <div className="text-right">
          <Button size="sm" variant="outline" onClick={sincronizar} disabled={sincronizando}>
            <RefreshCw className={`h-4 w-4 mr-1 ${sincronizando ? "animate-spin" : ""}`} /> Buscar no SOC agora
          </Button>
          {ultima && <p className="text-xs text-muted-foreground mt-1">Última atualização: {ultima.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Unidade Lapa", contagem.lapa], ["Unidade Osasco", contagem.osasco], ["Total no SOC", data.length]].map(([l, n]) => (
          <Card key={l as string}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold">{n}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base mr-auto">{lista.length} prestadores</CardTitle>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2 text-muted-foreground" />
              <Input className="h-8 pl-7 w-64 text-xs" placeholder="Nome, código ou cidade" value={busca} onChange={(e) => setParam("q", e.target.value)} />
            </div>
            <select className={sel} value={filtro} onChange={(e) => setParam("f", e.target.value === "todos" ? "" : e.target.value)}>
              <option value="todos">Todas as vinculações</option>
              <option value="lapa">Unidade Lapa</option>
              <option value="osasco">Unidade Osasco</option>
              <option value="externo">Rede externa (sem vínculo)</option>
            </select>
            <select className={sel} value={situacao} onChange={(e) => setParam("s", e.target.value === "ativos" ? "" : e.target.value)}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-330px)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  {["Código", "Prestador", "Cidade/UF", "Contato", "Atendimento", "Unidade responsável"].map((h, i) => (
                    <th key={h} className={`bg-muted border-b border-border px-3 py-2 font-medium whitespace-nowrap ${i < 2 ? "sticky z-20" : ""} ${i === 0 ? "left-0" : i === 1 ? "left-[72px]" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && !data.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum prestador ainda. Clique em "Buscar no SOC agora".</td></tr>}
                {lista.map((p) => (
                  <tr key={p.codigo} className="hover:bg-muted/40">
                    <td className="sticky left-0 bg-background px-3 py-2 font-mono text-xs w-[72px]">{p.codigo}</td>
                    <td className="sticky left-[72px] bg-background px-3 py-2">
                      <div className="font-medium">{titulo(p.nome)}</div>
                      <div className="flex gap-1 mt-0.5">
                        {p.socnet && <Badge variant="secondary" className="whitespace-nowrap text-[10px]">SOCNET</Badge>}
                        {!p.ativo && <Badge variant="outline" className="whitespace-nowrap text-[10px]">Inativo</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{titulo(p.cidade)}{p.uf ? `/${p.uf}` : ""}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="whitespace-nowrap">{[p.telefone, p.celular].filter(Boolean).join(" · ") || "—"}</div>
                      {p.email && <div className="text-muted-foreground">{p.email}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{p.tipo_atendimento ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select className={sel} value={p.unidade_responsavel ?? ""} onChange={(e) => classificar(p, e.target.value)}>
                        <option value="">Rede externa</option>
                        <option value="lapa">Unidade Lapa</option>
                        <option value="osasco">Unidade Osasco</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
