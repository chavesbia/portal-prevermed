import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

const SLA_LABEL: Record<string, string> = {
  EM_DIA: "Em Dia",
  ATENCAO: "Em Atenção",
  ATRASADO: "Atrasado",
  SEM_SLA: "Sem SLA",
};
const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  INICIADA: "Iniciada",
  EM_ANDAMENTO: "Em Andamento",
  FINALIZADA: "Finalizada",
};
const COMP_LABEL: Record<string, string> = {
  COMPARECEU: "Compareceu",
  NAO_COMPARECEU: "Não Compareceu",
  NAO_INFORMADO: "Não Informado",
};
const SIM_NAO_LABEL: Record<string, string> = {
  SIM: "Sim",
  NAO: "Não",
  PARCIAL: "Parcial",
  NAO_INFORMADO: "Não Informado",
};
const ASO_AGUARD_LABEL: Record<string, string> = {
  NAO_INFORMADO: "—",
  CONTATO_REALIZADO: "Contato realizado",
  RECEBIDO: "Recebido",
  NAO_RECEBIDO: "Não recebido",
};

function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  if (isNaN(d.getTime())) return s ?? "";
  return format(d, "dd/MM/yyyy");
}

async function fetchAllGuias(filters: any): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  // safety cap
  while (page < 500) {
    const { data, error } = await supabase.rpc("listar_guias" as any, {
      _filters: filters,
      _sort_field: "data_guia",
      _sort_dir: "desc",
      _page: page,
      _page_size: PAGE_SIZE,
    });
    if (error) throw error;
    const payload = (data ?? { rows: [], total: 0 }) as { rows: any[]; total: number };
    all.push(...(payload.rows ?? []));
    if (!payload.rows || payload.rows.length < PAGE_SIZE) break;
    if (all.length >= (payload.total ?? all.length)) break;
    page++;
  }
  return all;
}

export async function exportGuiasCompleto(opts?: {
  filters?: any;
  periodoIni?: string; // yyyy-MM-dd (for dashboard aggregate)
  periodoFim?: string;
}) {
  const filters = opts?.filters ?? {};
  const rows = await fetchAllGuias(filters);

  // dashboard aggregate — use provided range, or derive from rows
  let ini = opts?.periodoIni;
  let fim = opts?.periodoFim;
  if (!ini || !fim) {
    const datas = rows.map((r) => r.data_guia).filter(Boolean).sort();
    if (datas.length) {
      ini = ini ?? datas[0];
      fim = fim ?? datas[datas.length - 1];
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      ini = ini ?? today;
      fim = fim ?? today;
    }
  }

  const { data: agg } = await supabase.rpc("dashboard_guias_agregado", {
    _periodo_ini: ini!,
    _periodo_fim: fim!,
  });
  const dash: any = agg ?? {};

  const wb = XLSX.utils.book_new();

  // Sheet 1: Guias (linha a linha, com toda gestão operacional)
  const guiasRows = rows.map((g: any) => ({
    "Data Guia": fmtDate(g.data_guia),
    "Código": g.guia_codigo ?? "",
    "Empresa": g.empresa_nome ?? "",
    "Prestador": g.prestador_nome ?? "",
    "Status Prestador": g.status_prestador ?? "",
    "Funcionário": g.funcionario_nome ?? "",
    "CPF": g.funcionario_cpf ?? "",
    "Tipo Exame": g.tipo_exame ?? "",
    "Atendido": g.atendido_texto ?? "",
    "Data Agendamento": fmtDate(g.data_agendamento),
    "Hora Agendamento": g.hora_agendamento ?? "",
    "Situação": g.situacao ?? "",
    "Solicitante": g.solicitante_nome ?? "",
    "Unidade": g.unidade_nome ?? "",
    "Origem": g.origem ?? "",
    "SLA": SLA_LABEL[g.sla] ?? g.sla ?? "",
    "SLA Final": g.sla_final ?? "",
    "Status Guia": STATUS_LABEL[g.status_guia] ?? g.status_guia ?? "",
    "Compareceu": COMP_LABEL[g.compareceu] ?? g.compareceu ?? "",
    "Atendimento Lançado": SIM_NAO_LABEL[g.atendimento_lancado] ?? g.atendimento_lancado ?? "",
    "ASO Anexado": SIM_NAO_LABEL[g.aso_anexado] ?? g.aso_anexado ?? "",
    "Aguardando ASO": ASO_AGUARD_LABEL[g.aguardando_aso] ?? g.aguardando_aso ?? "",
  }));
  const wsGuias = XLSX.utils.json_to_sheet(guiasRows);
  XLSX.utils.book_append_sheet(wb, wsGuias, "Guias");

  // Sheet 2: Resumo / Totais
  const t = dash.totais ?? {};
  const variacao = dash.variacao ?? {};
  const resumo: Array<[string, any]> = [
    ["Período (início)", fmtDate(ini)],
    ["Período (fim)", fmtDate(fim)],
    ["", ""],
    ["Total de guias", t.total ?? 0],
    ["Últimas (último dia útil)", t.ultimas ?? 0],
    ["Sem prestador", t.sem_prestador ?? 0],
    ["Compareceram", t.compareceram ?? 0],
    ["", ""],
    ["SLA — Em Dia", t.em_dia ?? 0],
    ["SLA — Em Atenção", t.em_atencao ?? 0],
    ["SLA — Atrasadas", t.atrasadas ?? 0],
    ["", ""],
    ["Status — Pendentes", t.pendentes ?? 0],
    ["Status — Iniciadas", t.iniciadas ?? 0],
    ["Status — Em Andamento", t.em_andamento ?? 0],
    ["Status — Finalizadas", t.finalizadas ?? 0],
    ["Status — Finalizadas c/ Atraso", t.finalizadas_com_atraso ?? 0],
    ["", ""],
    ["Origem — Cliente", t.origem_cliente ?? 0],
    ["Origem — PreverMed", t.origem_prevermed ?? 0],
    ["", ""],
    ["Variação — Total (atual)", variacao.total?.atual ?? 0],
    ["Variação — Total (anterior)", variacao.total?.anterior ?? 0],
    ["Variação — Total (Δ%)", variacao.total?.pct ?? ""],
    ["Variação — Atrasadas (atual)", variacao.atrasadas?.atual ?? 0],
    ["Variação — Atrasadas (anterior)", variacao.atrasadas?.anterior ?? 0],
    ["Variação — Atrasadas (Δ%)", variacao.atrasadas?.pct ?? ""],
    ["Variação — Finalizadas (atual)", variacao.finalizadas?.atual ?? 0],
    ["Variação — Finalizadas (anterior)", variacao.finalizadas?.anterior ?? 0],
    ["Variação — Finalizadas (Δ%)", variacao.finalizadas?.pct ?? ""],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet([["Métrica", "Valor"], ...resumo]);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Sheet 3: Volume diário
  const daily = (dash.daily ?? []).map((d: any) => ({
    Data: fmtDate(d.date),
    Guias: d.count,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daily), "Volume Diário");

  // Sheet 4: SLA Mensal
  const slaMes = (dash.sla_mensal ?? []).map((m: any) => ({
    Mês: m.mes_label,
    "Em Dia": m.em_dia,
    "Em Atenção": m.atencao,
    Atrasado: m.atrasado,
    Total: m.total,
    "% Atraso": m.total > 0 ? Number(((m.atrasado / m.total) * 100).toFixed(1)) : 0,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slaMes), "SLA Mensal");

  // Sheet 5: Empresas
  const empresas = (dash.empresas ?? []).map((e: any) => ({ Empresa: e.name, Guias: e.count }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empresas), "Empresas");

  // Sheet 6: Prestadores com atrasos
  const prest = (dash.prestador_atrasos ?? []).map((p: any) => ({ Prestador: p.name, Atrasos: p.count }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prest), "Prestadores Atrasos");

  // Sheet 7: Exames
  const exames = (dash.exames ?? []).map((e: any) => ({ Exame: e.name, Total: e.count }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exames), "Exames");

  // Sheet 8: Comparativo mensal por Empresa
  const cEmp = dash.comparativo_empresa ?? {};
  const cEmpMeses: any[] = cEmp.meses ?? [];
  const cEmpSeries: any[] = cEmp.series ?? [];
  if (cEmpMeses.length && cEmpSeries.length) {
    const rowsEmp = cEmpMeses.map((m: any) => {
      const row: any = { Mês: m.mes_label };
      cEmpSeries.forEach((s: any) => {
        const p = s.pontos?.find((pp: any) => pp.mes === m.mes);
        row[s.name] = p?.count ?? 0;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsEmp), "Comp. Empresas");
  }

  // Sheet 9: Comparativo mensal por Prestador
  const cPre = dash.comparativo_prestador ?? {};
  const cPreMeses: any[] = cPre.meses ?? [];
  const cPreSeries: any[] = cPre.series ?? [];
  if (cPreMeses.length && cPreSeries.length) {
    const rowsPre = cPreMeses.map((m: any) => {
      const row: any = { Mês: m.mes_label };
      cPreSeries.forEach((s: any) => {
        const p = s.pontos?.find((pp: any) => pp.mes === m.mes);
        row[s.name] = p?.count ?? 0;
      });
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsPre), "Comp. Prestadores");
  }

  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  XLSX.writeFile(wb, `gestao-guias-${stamp}.xlsx`);

  return { totalGuias: rows.length };
}
