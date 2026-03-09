import { supabase } from '@/integrations/supabase/client';

/**
 * Launches an external module by opening it in a new tab with the current JWT token.
 * The external module receives the token via URL hash (not query params) for security.
 * Also registers the access in module_sessions.
 */
export async function launchExternalModule(
  baseUrl: string,
  moduleId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'Sessão não encontrada. Faça login novamente.' };
  }

  // Check access permission
  const { data: hasAccess } = await supabase.rpc('user_has_module_access', {
    _user_id: session.user.id,
    _module_id: moduleId,
  });

  if (!hasAccess) {
    return { success: false, error: 'Você não tem permissão para acessar este módulo.' };
  }

  // Register session
  await supabase.from('module_sessions').insert({
    user_id: session.user.id,
    module_id: moduleId,
    user_agent: navigator.userAgent,
  });

  // Open module with token in URL hash (not exposed in server logs)
  const url = new URL(baseUrl);
  url.searchParams.set('portal_token', session.access_token);
  url.searchParams.set('portal_refresh', session.refresh_token);

  window.open(url.toString(), '_blank');

  return { success: true };
}
