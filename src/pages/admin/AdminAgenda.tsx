import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RegrasExames } from "@/components/agenda/RegrasExames";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPOS = ["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Risco", "Monitoração Pontual", "Consulta", "Consulta Assistencial"];
const fmtData = (d: string) => d.split("-").reverse().join("/");
const sel = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const TIPO_WHATS: Record<string, string> = { agendamento: "Agendamento", analise_pcmso: "Análise PCMSO", atendimento_humano: "Atendente humano" };
const db = supabase as any;

function useTabela<T = any>(tabela: string, order = "created_at") {
  return useQuery<T[]>({
    queryKey: ["agenda-admin", tabela],
    queryFn: async () => {
      const { data, error } = await db.from(tabela).select("*").order(order);
      if (error) throw error;
      return data;
    },
  });
}

export default function AdminAgenda() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const aba = sp.get("tab") ?? "calendario";
  const { data: unidades = [] } = useTabela<any>("soc_agenda_unidades", "nome");
  const { data: calendario = [] } = useTabela<any>("agenda_calendario", "dia_semana");
  const { data: bloqueios = [] } = useTabela<any>("agenda_bloqueios", "data");
  const { data: regras = [] } = useTabela<any>("agenda_exames_regras");
  const { data: limites = [] } = useTabela<any>("agenda_limites");
  const { data: docs = [] } = useTabela<any>("agenda_documentos_exigidos", "ordem");
  const { data: whats = [] } = useQuery<any[]>({
    queryKey: ["agenda-admin", "whatsapp_registros"],
    enabled: aba === "whatsapp",
    queryFn: async () => {
      const { data, error } = await db.from("whatsapp_registros").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  const nomeUn = (id: string | null) => (id ? unidades.find((u: any) => u.id === id)?.nome?.replace("PreverMed - ", "") : "Todas") ?? "-";

  const run = async (p: PromiseLike<{ error: unknown }>, tabela: string, ok = "Salvo") => {
    const { error } = await p;
    if (error) return toast.error("Não foi possível salvar"), false;
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["agenda-admin", tabela] });
    return true;
  };
  const remover = (tabela: string, id: string) => run(db.from(tabela).delete().eq("id", id), tabela, "Removido");

  // Formulários de inclusão
  const [bl, setBl] = useState({ unidade_id: "", data: "", hora_fim_antecipada: "", motivo: "" });
  const [rg, setRg] = useState({ exame_nome: "", unidade_id: "", dias_semana: [1, 2, 3, 4, 5] as number[], hora_inicio: "07:00", hora_fim: "16:00", antecedencia_dias: "0", parceiro: false, observacao: "" });
  const [lm, setLm] = useState({ unidade_id: "", tipo_exame: "Retorno ao Trabalho", dia_semana: "", maximo: "" });
  const [dc, setDc] = useState({ tipo_exame: "Retorno ao Trabalho", nome: "", obrigatorio: true });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Agenda</h1>
      </div>
      <Tabs value={aba} onValueChange={(v) => setSp({ tab: v }, { replace: true })}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="calendario">Calendário das unidades</TabsTrigger>
          <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
          <TabsTrigger value="exames">Regras de exames</TabsTrigger>
          <TabsTrigger value="limites">Limites diários</TabsTrigger>
          <TabsTrigger value="documentos">Documentos exigidos</TabsTrigger>
          <TabsTrigger value="soc">Integração SOC</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="grid gap-3 md:grid-cols-2">
          {unidades.map((u: any) => (
            <Card key={u.id}>
              <CardHeader className="py-2"><CardTitle className="text-sm">{u.nome}</CardTitle></CardHeader>
              <CardContent className="pb-2">
                <Table className="text-xs">
                  <TableHeader><TableRow><TableHead className="h-7">Dia</TableHead><TableHead className="h-7">Atende</TableHead><TableHead className="h-7">Início</TableHead><TableHead className="h-7">Fim</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {DIAS.map((nome, d) => {
                      const c = calendario.find((x: any) => x.unidade_id === u.id && x.dia_semana === d);
                      const salvar = (patch: Record<string, unknown>) => run(db.from("agenda_calendario").upsert({ unidade_id: u.id, dia_semana: d, hora_inicio: c?.hora_inicio ?? "07:00", hora_fim: c?.hora_fim ?? "16:00", ativo: c?.ativo ?? false, ...patch }, { onConflict: "unidade_id,dia_semana" }), "agenda_calendario");
                      return (
                        <TableRow key={d}>
                          <TableCell className="py-1 font-medium">{nome}</TableCell>
                          <TableCell className="py-1"><Switch className="scale-75" checked={!!c?.ativo} onCheckedChange={(v) => salvar({ ativo: v })} /></TableCell>
                          <TableCell className="py-1"><Input type="time" className="h-7 w-24 text-xs" disabled={!c?.ativo} defaultValue={c?.hora_inicio?.slice(0, 5) ?? "07:00"} key={`i${c?.hora_inicio}`} onBlur={(e) => c && e.target.value !== c.hora_inicio.slice(0, 5) && salvar({ hora_inicio: e.target.value })} /></TableCell>
                          <TableCell className="py-1"><Input type="time" className="h-7 w-24 text-xs" disabled={!c?.ativo} defaultValue={c?.hora_fim?.slice(0, 5) ?? "16:00"} key={`f${c?.hora_fim}`} onBlur={(e) => c && e.target.value !== c.hora_fim.slice(0, 5) && salvar({ hora_fim: e.target.value })} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bloqueios">
          <Card>
            <CardHeader><CardTitle className="text-base">Datas bloqueadas e encerramento antecipado</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Os feriados cadastrados no portal já são bloqueados automaticamente. Deixe "Encerra às" vazio para bloquear o dia inteiro.</p>
              <div className="grid gap-2 md:grid-cols-5 items-end">
                <div><Label>Unidade</Label><select className={sel} value={bl.unidade_id} onChange={(e) => setBl({ ...bl, unidade_id: e.target.value })}><option value="">Todas</option>{unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
                <div><Label>Data *</Label><Input type="date" value={bl.data} onChange={(e) => setBl({ ...bl, data: e.target.value })} /></div>
                <div><Label>Encerra às</Label><Input type="time" value={bl.hora_fim_antecipada} onChange={(e) => setBl({ ...bl, hora_fim_antecipada: e.target.value })} /></div>
                <div><Label>Motivo *</Label><Input value={bl.motivo} maxLength={120} onChange={(e) => setBl({ ...bl, motivo: e.target.value })} /></div>
                <Button disabled={!bl.data || bl.motivo.trim().length < 3} onClick={async () => { if (await run(db.from("agenda_bloqueios").insert({ unidade_id: bl.unidade_id || null, data: bl.data, hora_fim_antecipada: bl.hora_fim_antecipada || null, motivo: bl.motivo.trim() }), "agenda_bloqueios")) setBl({ unidade_id: "", data: "", hora_fim_antecipada: "", motivo: "" }); }}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Unidade</TableHead><TableHead>Bloqueio</TableHead><TableHead>Motivo</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {bloqueios.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{fmtData(b.data)}</TableCell><TableCell>{nomeUn(b.unidade_id)}</TableCell>
                      <TableCell><Badge variant="secondary" className="whitespace-nowrap">{b.hora_fim_antecipada ? `Encerra às ${b.hora_fim_antecipada.slice(0, 5)}` : "Dia inteiro"}</Badge></TableCell>
                      <TableCell>{b.motivo}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remover("agenda_bloqueios", b.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exames">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Exames com dias, horários ou antecedência próprios</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Marque vários exames (ou um grupo) e aplique o mesmo horário a todos. Exames sem regra seguem o horário da unidade.</p>
              <RegrasExames
                regras={regras} unidades={unidades} nomeUn={nomeUn}
                salvar={(linhas, editId) => editId
                  ? run(db.from("agenda_exames_regras").update(linhas[0]).eq("id", editId), "agenda_exames_regras", "Regra atualizada")
                  : run(db.from("agenda_exames_regras").insert(linhas), "agenda_exames_regras", `${linhas.length} regra(s) criada(s)`)}
                ativar={(id, v) => run(db.from("agenda_exames_regras").update({ ativo: v }).eq("id", id), "agenda_exames_regras")}
                remover={(id) => remover("agenda_exames_regras", id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limites">
          <Card>
            <CardHeader><CardTitle className="text-base">Quantidade máxima de agendamentos por dia</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-5 items-end">
                <div><Label>Unidade</Label><select className={sel} value={lm.unidade_id} onChange={(e) => setLm({ ...lm, unidade_id: e.target.value })}><option value="">Todas</option>{unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
                <div><Label>Tipo de exame</Label><select className={sel} value={lm.tipo_exame} onChange={(e) => setLm({ ...lm, tipo_exame: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><Label>Dia da semana</Label><select className={sel} value={lm.dia_semana} onChange={(e) => setLm({ ...lm, dia_semana: e.target.value })}><option value="">Todos</option>{DIAS.map((n, d) => <option key={d} value={d}>{n}</option>)}</select></div>
                <div><Label>Máximo por dia *</Label><Input type="number" min={0} value={lm.maximo} onChange={(e) => setLm({ ...lm, maximo: e.target.value })} /></div>
                <Button disabled={lm.maximo === ""} onClick={async () => { if (await run(db.from("agenda_limites").insert({ unidade_id: lm.unidade_id || null, tipo_exame: lm.tipo_exame, dia_semana: lm.dia_semana === "" ? null : Number(lm.dia_semana), maximo: Number(lm.maximo) }), "agenda_limites")) setLm({ ...lm, maximo: "" }); }}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Unidade</TableHead><TableHead>Dia</TableHead><TableHead>Máximo</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {limites.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.tipo_exame}</TableCell><TableCell>{nomeUn(l.unidade_id)}</TableCell>
                      <TableCell>{l.dia_semana === null ? "Todos" : DIAS[l.dia_semana]}</TableCell><TableCell>{l.maximo}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remover("agenda_limites", l.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Documentos exigidos por tipo de exame</CardTitle>
              <p className="text-xs text-muted-foreground">Cada documento marcado como obrigatório vira um anexo que o cliente precisa enviar para concluir o agendamento daquele tipo. Ex.: 3 obrigatórios no Retorno = 3 anexos exigidos. Os não obrigatórios aparecem como opcionais.</p></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">No Retorno ao Trabalho é exigido pelo menos um documento, além dos marcados como obrigatórios, e o agendamento aguarda aprovação da equipe de saúde.</p>
              <div className="grid gap-2 md:grid-cols-4 items-end">
                <div><Label>Tipo de exame</Label><select className={sel} value={dc.tipo_exame} onChange={(e) => setDc({ ...dc, tipo_exame: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><Label>Documento *</Label><Input value={dc.nome} maxLength={80} onChange={(e) => setDc({ ...dc, nome: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={dc.obrigatorio} onCheckedChange={(v) => setDc({ ...dc, obrigatorio: v })} />Obrigatório</label>
                <Button disabled={dc.nome.trim().length < 3} onClick={async () => { if (await run(db.from("agenda_documentos_exigidos").insert({ ...dc, nome: dc.nome.trim(), ordem: docs.length + 1 }), "agenda_documentos_exigidos")) setDc({ ...dc, nome: "" }); }}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo de exame</TableHead><TableHead>Documento</TableHead><TableHead>Obrigatório</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {docs.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.tipo_exame}</TableCell><TableCell className="font-medium">{d.nome}</TableCell>
                      <TableCell><Switch checked={d.obrigatorio} onCheckedChange={(v) => run(db.from("agenda_documentos_exigidos").update({ obrigatorio: v }).eq("id", d.id), "agenda_documentos_exigidos")} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remover("agenda_documentos_exigidos", d.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="soc">
          <Card>
            <CardHeader><CardTitle className="text-base">Unidades e agendas do SOC</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead>Código da agenda</TableHead><TableHead>Ativa</TableHead></TableRow></TableHeader>
                <TableBody>
                  {unidades.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="font-mono">{u.codigo_agenda}</TableCell>
                      <TableCell><Switch checked={u.ativo} onCheckedChange={(v) => run(db.from("soc_agenda_unidades").update({ ativo: v }).eq("id", u.id), "soc_agenda_unidades")} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-sm text-muted-foreground">Horários de atendimento ficam em "Calendário das unidades". As credenciais do Web Service ficam protegidas no servidor.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader><CardTitle className="text-base">Solicitações recebidas pelo WhatsApp</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data/hora</TableHead><TableHead>Tipo</TableHead><TableHead>Protocolo</TableHead><TableHead>Número solicitante</TableHead><TableHead>Nome no WhatsApp</TableHead><TableHead>Empresa</TableHead><TableHead>Colaborador</TableHead><TableHead>Cargo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {whats.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="whitespace-nowrap">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant={w.tipo === "agendamento" ? "secondary" : "destructive"} className="whitespace-nowrap">{TIPO_WHATS[w.tipo] ?? w.tipo}</Badge></TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{w.protocolo}</TableCell>
                      <TableCell className="whitespace-nowrap">{w.telefone}</TableCell>
                      <TableCell>{w.nome_whatsapp ?? "-"}</TableCell>
                      <TableCell>{w.empresa_nome ?? "-"}{w.empresa_cnpj ? <div className="text-xs text-muted-foreground">{w.empresa_cnpj}</div> : null}</TableCell>
                      <TableCell>{w.colaborador_nome ?? "-"}</TableCell>
                      <TableCell>{w.cargo ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {!whats.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma solicitação pelo WhatsApp ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
