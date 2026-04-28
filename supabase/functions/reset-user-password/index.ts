import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify they are ADM Master
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify JWT and get claims
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      console.error('Claims error:', claimsError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.claims.sub

    // Check if the requesting user is ADM Master
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleError || roleData?.role !== 'adm_master') {
      console.error('Role check failed:', roleError, roleData)
      try {
        await userClient.rpc('log_unauthorized_access', {
          _resource: 'edge_function:reset-user-password',
          _source: 'edge_function',
          _method: req.method,
          _details: { attempted_role: roleData?.role ?? null },
        })
      } catch (logErr) {
        console.error('Failed to log unauthorized attempt:', logErr)
      }
      return new Response(
        JSON.stringify({ error: 'Apenas ADM Master pode resetar senhas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { targetUserId } = await req.json()

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'targetUserId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to update user password
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Reset password to default
    const defaultPassword = 'prevermed'
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: defaultPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao resetar senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set must_change_password flag
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('user_id', targetUserId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      // Don't fail the request, password was already reset
    }

    console.log(`Password reset successful for user ${targetUserId} by ADM Master ${userId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Senha resetada com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in reset-user-password:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
