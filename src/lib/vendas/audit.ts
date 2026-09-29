import { supabase } from '@/integrations/supabase/client';

export async function auditVendas(userId: string | null | undefined, action: string, objectId: string | null, details: Record<string, unknown>) {
  if (!userId) return;
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action_type: action,
      object_type: 'gestao_vendas',
      object_id: objectId,
      details: details as any,
    } as any);
  } catch (e) {
    console.error('audit vendas', e);
  }
}

export const titleCase = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/(^|\s|\/|-|\()([a-zà-ú])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(Ltda|Me|Epp|Eireli|S\/A|Sa)\b/g, m => m.toUpperCase());
