import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type FbClassificacao = "insuficiente" | "fraco" | "razoavel" | "bom" | "excelente";
export type FbRisco = "baixo" | "medio" | "alto";
export type FbAcaoStatus = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado";
export type FbColabStatus = "ativo" | "inativo" | "ferias" | "afastado";

export interface FbSetor { id: string; nome: string; ativo: boolean }
export interface FbCompetencia { id: string; ordem: number; nome: string; ativo: boolean }
export interface FbNivel { id: string; competencia_id: string; nota: number; descricao_oficial: string }
export interface FbColaborador {
  id: string; user_id: string | null; nome: string | null; matricula: string | null; cpf: string | null;
  cargo: string | null; setor_id: string | null; gestor_id: string | null;
  data_admissao: string | null; status: FbColabStatus; periodicidade_dias: number;
  incluido_no_ciclo: boolean;
}
export interface FbStatusColab {
  colaborador_id: string;
  fb_colaborador_id: string | null;
  user_id: string | null;
  nome: string; matricula: string | null; cpf: string | null; cargo: string | null;
  setor_id: string | null; setor_nome: string | null;
  lider_id: string | null; lider_nome: string | null;
  gestor_id: string | null; gestor_nome: string | null;
  unit: string | null; data_admissao: string | null;
  status: FbColabStatus; periodicidade_dias: number; incluido_no_ciclo: boolean;
  ultima_avaliacao_id: string | null; ultimo_feedback: string | null; proximo_feedback: string | null;
  pontuacao_total: number | null; classificacao: FbClassificacao | null;
  status_feedback: "em_dia" | "proximo" | "atrasado" | "sem_feedback"; risco: FbRisco;
}
export interface FbAvaliacao {
  id: string; colaborador_id: string; gestor_id: string | null;
  data_avaliacao: string; data_proximo_feedback: string | null;
  atividades: string | null; pontos_positivos: string | null; pontos_melhora: string | null;
  acoes_melhoria: string | null; observacoes: string | null;
  pontuacao_total: number | null; classificacao: FbClassificacao | null; concluida: boolean;
  created_at: string;
}
export interface FbNota { id: string; avaliacao_id: string; competencia_id: string; nota: number; comentario: string | null }
export interface FbAcao { id: string; avaliacao_id: string; competencia_id?: string | null; acao: string; responsavel: string | null; prazo: string | null; status: FbAcaoStatus; evidencia?: string | null }

export const CLASS_LABELS: Record<FbClassificacao, string> = {
  insuficiente: "Insuficiente", fraco: "Fraco", razoavel: "Razoável", bom: "Bom", excelente: "Excelente",
};
export const CLASS_COLORS: Record<FbClassificacao, string> = {
  insuficiente: "hsl(0 84% 50%)", fraco: "hsl(25 95% 53%)", razoavel: "hsl(48 96% 53%)",
  bom: "hsl(217 91% 55%)", excelente: "hsl(142 76% 40%)",
};
export const RISCO_LABELS: Record<FbRisco, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto" };

export function classificar(total: number): FbClassificacao | null {
  if (total < 10) return null;
  if (total <= 18) return "insuficiente";
  if (total <= 23) return "fraco";
  if (total <= 28) return "razoavel";
  if (total <= 34) return "bom";
  return "excelente";
}

// ============= Queries =============
export function useSetores() {
  return useQuery({
    queryKey: ["fb_setores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fb_setores").select("*").order("nome");
      if (error) throw error;
      return data as FbSetor[];
    },
  });
}

export function useCompetencias() {
  return useQuery({
    queryKey: ["fb_competencias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fb_competencias").select("*").order("ordem");
      if (error) throw error;
      return data as FbCompetencia[];
    },
  });
}

export function useNiveis() {
  return useQuery({
    queryKey: ["fb_niveis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fb_competencia_niveis").select("*");
      if (error) throw error;
      return data as FbNivel[];
    },
  });
}

export function useColaboradores() {
  return useQuery({
    queryKey: ["fb_colaboradores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fb_colaboradores").select("*").order("nome");
      if (error) throw error;
      return data as FbColaborador[];
    },
  });
}

export function useStatusColaboradores() {
  return useQuery({
    queryKey: ["fb_status_colab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fb_v_status_colaborador").select("*").order("nome");
      if (error) throw error;
      return data as FbStatusColab[];
    },
  });
}

export function useAvaliacoesDoColaborador(colaboradorId: string | null) {
  return useQuery({
    queryKey: ["fb_avaliacoes", colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fb_avaliacoes").select("*")
        .eq("colaborador_id", colaboradorId!)
        .order("data_avaliacao", { ascending: false });
      if (error) throw error;
      return data as FbAvaliacao[];
    },
  });
}

export function useAvaliacaoDetalhe(avaliacaoId: string | null) {
  return useQuery({
    queryKey: ["fb_avaliacao_detalhe", avaliacaoId],
    enabled: !!avaliacaoId,
    queryFn: async () => {
      const [aval, notas, ff, pdi] = await Promise.all([
        supabase.from("fb_avaliacoes").select("*").eq("id", avaliacaoId!).maybeSingle(),
        supabase.from("fb_avaliacao_notas").select("*").eq("avaliacao_id", avaliacaoId!),
        supabase.from("fb_feedforward").select("*").eq("avaliacao_id", avaliacaoId!),
        supabase.from("fb_pdi").select("*").eq("avaliacao_id", avaliacaoId!),
      ]);
      if (aval.error) throw aval.error;
      return {
        avaliacao: aval.data as FbAvaliacao,
        notas: (notas.data ?? []) as FbNota[],
        feedforward: (ff.data ?? []) as FbAcao[],
        pdi: (pdi.data ?? []) as FbAcao[],
      };
    },
  });
}

// ============= Mutations =============
export function useUpsertColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FbColaborador> & { nome: string }) => {
      const { id, ...rest } = input as any;
      if (id) {
        const { error } = await supabase.from("fb_colaboradores").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fb_colaboradores").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fb_colaboradores"] });
      qc.invalidateQueries({ queryKey: ["fb_status_colab"] });
      toast({ title: "Colaborador salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });
}

/** Upsert por user_id — vincula um usuário do portal ao ciclo de feedback.
 *  Usa optimistic update no cache de `fb_status_colab` para manter o toggle
 *  consistente mesmo com cliques rápidos / latência. Em caso de erro
 *  (ex: violação de unique), restaura o estado anterior. */
export function useUpsertColaboradorByUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string } & Partial<FbColaborador>) => {
      if (!input.user_id) throw new Error("Usuário inválido.");
      const { error } = await supabase
        .from("fb_colaboradores")
        .upsert(input as any, { onConflict: "user_id" });
      if (error) {
        if (error.code === "23505") {
          throw new Error("Este colaborador já está cadastrado no ciclo de feedback.");
        }
        throw error;
      }
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["fb_status_colab"] });
      const prev = qc.getQueryData<FbStatusColab[]>(["fb_status_colab"]);
      if (prev) {
        qc.setQueryData<FbStatusColab[]>(["fb_status_colab"], prev.map((r) =>
          r.user_id === input.user_id
            ? {
                ...r,
                incluido_no_ciclo: input.incluido_no_ciclo ?? r.incluido_no_ciclo,
                matricula: input.matricula !== undefined ? input.matricula ?? null : r.matricula,
                cpf: input.cpf !== undefined ? input.cpf ?? null : r.cpf,
                setor_id: input.setor_id !== undefined ? input.setor_id ?? null : r.setor_id,
                periodicidade_dias: input.periodicidade_dias ?? r.periodicidade_dias,
              }
            : r,
        ));
      }
      return { prev };
    },
    onError: (e: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["fb_status_colab"], ctx.prev);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["fb_colaboradores"] });
      qc.invalidateQueries({ queryKey: ["fb_status_colab"] });
    },
  });
}



export function useUpsertSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; nome: string; ativo?: boolean }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase.from("fb_setores").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fb_setores").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fb_setores"] }),
  });
}

export function useUpdateNivelDescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, descricao_oficial }: { id: string; descricao_oficial: string }) => {
      const { error } = await supabase.from("fb_competencia_niveis").update({ descricao_oficial }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fb_niveis"] });
      toast({ title: "Descrição atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export interface SaveAvaliacaoInput {
  id?: string;
  colaborador_id: string;
  gestor_id?: string | null;
  data_avaliacao: string;
  data_proximo_feedback?: string | null;
  atividades?: string | null;
  pontos_positivos?: string | null;
  pontos_melhora?: string | null;
  acoes_melhoria?: string | null;
  observacoes?: string | null;
  concluida?: boolean;
  notas: { competencia_id: string; nota: number; comentario?: string | null }[];
  feedforward?: { acao: string; responsavel?: string | null; prazo?: string | null; status?: FbAcaoStatus }[];
  pdi?: { competencia_id?: string | null; acao: string; responsavel?: string | null; prazo?: string | null; evidencia?: string | null; status?: FbAcaoStatus }[];
}

export function useSaveAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAvaliacaoInput & { silent?: boolean }) => {
      const { notas, feedforward, pdi, id, silent, ...header } = input;
      let avalId = id;
      if (avalId) {
        const { error } = await supabase.from("fb_avaliacoes").update(header).eq("id", avalId);
        if (error) throw error;
      } else {
        const user = (await supabase.auth.getUser()).data.user;
        const { data, error } = await supabase.from("fb_avaliacoes")
          .insert({ ...header, created_by: user?.id, gestor_id: header.gestor_id ?? user?.id })
          .select("id").single();
        if (error) throw error;
        avalId = data.id;
      }

      await supabase.from("fb_avaliacao_notas").delete().eq("avaliacao_id", avalId!);
      if (notas.length) {
        const { error: en } = await supabase.from("fb_avaliacao_notas")
          .insert(notas.map(n => ({ ...n, avaliacao_id: avalId! })));
        if (en) throw en;
      }

      await supabase.from("fb_feedforward").delete().eq("avaliacao_id", avalId!);
      if (feedforward?.length) {
        const { error: ef } = await supabase.from("fb_feedforward")
          .insert(feedforward.map(f => ({ ...f, avaliacao_id: avalId! })));
        if (ef) throw ef;
      }

      await supabase.from("fb_pdi").delete().eq("avaliacao_id", avalId!);
      if (pdi?.length) {
        const { error: ep } = await supabase.from("fb_pdi")
          .insert(pdi.map(p => ({ ...p, avaliacao_id: avalId! })));
        if (ep) throw ep;
      }
      return { id: avalId!, silent: !!silent };
    },
    onSuccess: (result) => {
      if (result.silent) return;
      qc.invalidateQueries({ queryKey: ["fb_avaliacoes"] });
      qc.invalidateQueries({ queryKey: ["fb_status_colab"] });
      qc.invalidateQueries({ queryKey: ["fb_avaliacao_detalhe"] });
      toast({ title: "Avaliação salva" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar avaliação", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateAcaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ table, id, status }: { table: "fb_feedforward" | "fb_pdi"; id: string; status: FbAcaoStatus }) => {
      const { error } = await supabase.from(table).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fb_avaliacao_detalhe"] });
      qc.invalidateQueries({ queryKey: ["fb_planos_consolidados"] });
    },
  });
}

export function usePlanosConsolidados() {
  return useQuery({
    queryKey: ["fb_planos_consolidados"],
    queryFn: async () => {
      const [ff, pdi, statusRows] = await Promise.all([
        supabase.from("fb_feedforward").select("*, fb_avaliacoes!inner(colaborador_id)"),
        supabase.from("fb_pdi").select("*, fb_avaliacoes!inner(colaborador_id), fb_competencias(nome)"),
        supabase.from("fb_v_status_colaborador").select("colaborador_id, nome, setor_nome"),
      ]);
      const nameMap = new Map<string, { nome: string; setor: string | null }>();
      (statusRows.data ?? []).forEach((r: any) =>
        nameMap.set(r.colaborador_id, { nome: r.nome, setor: r.setor_nome }),
      );
      const enrich = (rows: any[]) =>
        rows.map((r) => {
          const info = nameMap.get(r.fb_avaliacoes?.colaborador_id);
          return { ...r, colaborador_nome: info?.nome ?? "—", setor_nome: info?.setor ?? "—" };
        });
      return {
        feedforward: enrich(ff.data ?? []),
        pdi: enrich(pdi.data ?? []),
      };
    },
  });
}

/** Reabre uma avaliação concluída (apenas ADM Master / RH). */
export function useReabrirAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (avaliacaoId: string) => {
      const { error } = await supabase
        .from("fb_avaliacoes")
        .update({ concluida: false })
        .eq("id", avaliacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fb_avaliacoes"] });
      qc.invalidateQueries({ queryKey: ["fb_avaliacao_detalhe"] });
      qc.invalidateQueries({ queryKey: ["fb_status_colab"] });
      toast({ title: "Avaliação reaberta para edição" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}
