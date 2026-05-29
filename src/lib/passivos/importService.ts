import { supabase } from '@/integrations/supabase/client';
import type { ParsedPassivo } from './importParser';
import type { PassivoStatus } from './utils';

export interface ImportSummary {
  total: number;
  criados: number;
  atualizados: number;
  historicoCriado: number;
  erros: Array<{ cnpj: string; numero_acordo: string; error: string }>;
}

function deriveStatus(p: ParsedPassivo): PassivoStatus {
  if (p.parcelas_pagas >= p.parcelas_totais && p.parcelas_totais > 0) return 'encerrado';
  if (p.parcelas_em_atraso > 0) return 'atrasado';
  return 'em_dia';
}

export async function importPassivos(items: ParsedPassivo[]): Promise<ImportSummary> {
  const summary: ImportSummary = { total: items.length, criados: 0, atualizados: 0, historicoCriado: 0, erros: [] };

  for (const it of items) {
    try {
      const status = deriveStatus(it);
      const payload = {
        cnpj: it.cnpj,
        empresa_nome: it.empresa_nome,
        numero_acordo: it.numero_acordo,
        tipo_parcelamento: it.tipo_parcelamento,
        parcelas_pagas: it.parcelas_pagas,
        parcelas_totais: it.parcelas_totais,
        valor_mensal: it.valor_mensal,
        dia_vencimento: it.dia_vencimento,
        parcelas_em_atraso: it.parcelas_em_atraso,
        observacoes: it.observacoes,
        link_acesso: it.link_acesso,
        status,
      };

      // verificar existência por (cnpj + numero_acordo)
      const { data: existing, error: selErr } = await supabase
        .from('passivos_parcelamentos')
        .select('id')
        .eq('cnpj', it.cnpj)
        .eq('numero_acordo', it.numero_acordo)
        .maybeSingle();
      if (selErr) throw selErr;

      let passivoId: string;
      if (existing?.id) {
        const { error } = await supabase
          .from('passivos_parcelamentos')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
        passivoId = existing.id;
        summary.atualizados++;
      } else {
        const { data, error } = await supabase
          .from('passivos_parcelamentos')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        passivoId = data.id;
        summary.criados++;
      }

      // histórico mensal — upsert por (passivo_id, ano, mes)
      if (it.historico.length > 0) {
        const rows = it.historico.map(h => ({
          passivo_id: passivoId,
          ano: h.ano,
          mes: h.mes,
          valor: h.valor,
          status: 'pendente' as const,
        }));
        const { error: hErr } = await supabase
          .from('passivos_historico_mensal')
          .upsert(rows, { onConflict: 'passivo_id,ano,mes' });
        if (hErr) throw hErr;
        summary.historicoCriado += rows.length;
      }
    } catch (e: any) {
      summary.erros.push({
        cnpj: it.cnpj,
        numero_acordo: it.numero_acordo,
        error: e?.message || String(e),
      });
    }
  }

  return summary;
}
