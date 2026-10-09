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
import { EXAMES_SOC } from "@/data/examesSoc";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIPOS = ["Admissional", "Periódico", "Demissional", "Retorno ao Trabalho", "Mudança de Risco", "Monitoração Pontual", "Consulta", "Consulta Assistencial"];
const fmtData = (d: string) => d.split("-").reverse().join("/");
const sel = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
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
        </TabsList>

        <TabsContent value="calendario" className="space-y-4">
          {unidades.map((u: any) => (
            <Card key={u.id}>
              <CardHeader><CardTitle className="text-base">{u.nome}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead>Atende</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {DIAS.map((nome, d) => {
                      const c = calendario.find((x: any) => x.unidade_id === u.id && x.dia_semana === d);
                      const salvar = (patch: Record<string, unknown>) => run(db.from("agenda_calendario").upsert({ unidade_id: u.id, dia_semana: d, hora_inicio: c?.hora_inicio ?? "07:00", hora_fim: c?.hora_fim ?? "16:00", ativo: c?.ativo ?? false, ...patch }, { onConflict: "unidade_id,dia_semana" }), "agenda_calendario");
                      return (
                        <TableRow key={d}>
                          <TableCell className="font-medium">{nome}</TableCell>
                          <TableCell><Switch checked={!!c?.ativo} onCheckedChange={(v) => salvar({ ativo: v })} /></TableCell>
                          <TableCell><Input type="time" className="w-28" disabled={!c?.ativo} defaultValue={c?.hora_inicio?.slice(0, 5) ?? "07:00"} key={`i${c?.hora_inicio}`} onBlur={(e) => c && e.target.value !== c.hora_inicio.slice(0, 5) && salvar({ hora_inicio: e.target.value })} /></TableCell>
                          <TableCell><Input type="time" className="w-28" disabled={!c?.ativo} defaultValue={c?.hora_fim?.slice(0, 5) ?? "16:00"} key={`f${c?.hora_fim}`} onBlur={(e) => c && e.target.value !== c.hora_fim.slice(0, 5) && salvar({ hora_fim: e.target.value })} /></TableCell>
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
            <CardHeader><CardTitle className="text-base">Exames com dias, horários ou antecedência próprios</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Ex.: Audiometria, Avaliação Psicológica, Psicossocial, Teste Oftalmológico, Ergométrico (parceiro). Ao agendar, só aparecem horários em que todos os exames escolhidos podem ser feitos, com a explicação para o cliente.</p>
              <div className="grid gap-2 md:grid-cols-4 items-end">
                <div className="md:col-span-2"><Label>Exame (catálogo SOC) *</Label>
                  <Input list="catalogo-exames" value={rg.exame_nome} onChange={(e) => setRg({ ...rg, exame_nome: e.target.value.toUpperCase() })} placeholder="Digite para buscar ou cadastre um novo nome" />
                  <datalist id="catalogo-exames">{EXAMES_SOC.map((e) => <option key={e.nome} value={e.nome} />)}</datalist></div>
                <div><Label>Unidade</Label><select className={sel} value={rg.unidade_id} onChange={(e) => setRg({ ...rg, unidade_id: e.target.value })}><option value="">Todas</option>{unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
                <div><Label>Antecedência (dias)</Label><Input type="number" min={0} value={rg.antecedencia_dias} onChange={(e) => setRg({ ...rg, antecedencia_dias: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-1">{DIAS.map((n, d) => (
                    <Button key={d} type="button" size="sm" variant={rg.dias_semana.includes(d) ? "default" : "outline"} onClick={() => setRg({ ...rg, dias_semana: rg.dias_semana.includes(d) ? rg.dias_semana.filter((x) => x !== d) : [...rg.dias_semana, d].sort() })}>{n}</Button>
                  ))}</div></div>
                <div><Label>Das</Label><Input type="time" value={rg.hora_inicio} onChange={(e) => setRg({ ...rg, hora_inicio: e.target.value })} /></div>
                <div><Label>Até</Label><Input type="time" value={rg.hora_fim} onChange={(e) => setRg({ ...rg, hora_fim: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={rg.parceiro} onCheckedChange={(v) => setRg({ ...rg, parceiro: v })} />Realizado em parceiro</label>
                <div className="md:col-span-2"><Label>Orientação ao cliente</Label><Input value={rg.observacao} maxLength={200} onChange={(e) => setRg({ ...rg, observacao: e.target.value })} /></div>
                <Button disabled={rg.exame_nome.trim().length < 3 || !rg.dias_semana.length || rg.hora_fim <= rg.hora_inicio} onClick={async () => {
                  if (await run(db.from("agenda_exames_regras").insert({ ...rg, exame_nome: rg.exame_nome.trim(), unidade_id: rg.unidade_id || null, antecedencia_dias: Number(rg.antecedencia_dias) || 0, observacao: rg.observacao.trim() || null }), "agenda_exames_regras"))
                    setRg({ ...rg, exame_nome: "", observacao: "" });
                }}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Exame</TableHead><TableHead>Unidade</TableHead><TableHead>Dias</TableHead><TableHead>Horário</TableHead><TableHead>Antecedência</TableHead><TableHead>Ativa</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {regras.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.exame_nome}{r.parceiro && <Badge variant="outline" className="ml-2 whitespace-nowrap">Parceiro</Badge>}</TableCell>
                      <TableCell>{nomeUn(r.unidade_id)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.dias_semana.map((d: number) => DIAS[d]).join(", ")}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)}</TableCell>
                      <TableCell>{r.antecedencia_dias} dia(s)</TableCell>
                      <TableCell><Switch checked={r.ativo} onCheckedChange={(v) => run(db.from("agenda_exames_regras").update({ ativo: v }).eq("id", r.id), "agenda_exames_regras")} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => remover("agenda_exames_regras", r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <CardHeader><CardTitle className="text-base">Documentos exigidos por tipo de exame</CardTitle></CardHeader>
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
      </Tabs>
    </div>
  );
}
