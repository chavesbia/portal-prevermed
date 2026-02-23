import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserToCreate {
  full_name: string
  login: string
  position?: string
  unit?: 'lapa' | 'osasco'
  hierarchy_position?: 'director' | 'manager' | 'coordinator' | 'leader' | 'team_member'
  internal_handle?: string
  role?: 'adm_master' | 'adm_user' | 'tech_user'
  departments?: string[] // department names
  primary_department?: string // department name
  birth_date?: string
  start_date?: string
  phone_extension?: string
  contact_email?: string
}

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify caller is ADM Master
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerId = claimsData.claims.sub

    const { data: roleData } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle()

    if (roleData?.role !== 'adm_master') {
      return new Response(
        JSON.stringify({ error: 'Apenas ADM Master pode importar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { users } = await req.json() as { users: UserToCreate[] }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Lista de usuários vazia' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (users.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Máximo de 50 usuários por importação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch departments for name-to-id mapping
    const { data: allDepts } = await adminClient
      .from('departments')
      .select('id, name')

    const deptMap = new Map<string, string>()
    allDepts?.forEach(d => {
      deptMap.set(d.name.toLowerCase().trim(), d.id)
    })

    // Check existing logins
    const logins = users.map(u => u.login.trim().toLowerCase().replace(/\s+/g, '.'))
    const { data: existingProfiles } = await adminClient
      .from('profiles')
      .select('login')
      .in('login', logins)

    const existingLogins = new Set(existingProfiles?.map(p => p.login) || [])

    const results: { login: string; success: boolean; error?: string; user_id?: string }[] = []
    const defaultPassword = 'prevermed'

    for (const user of users) {
      const login = user.login.trim().toLowerCase().replace(/\s+/g, '.')

      if (!user.full_name || !login) {
        results.push({ login: login || '?', success: false, error: 'Nome e login obrigatórios' })
        continue
      }

      if (existingLogins.has(login)) {
        results.push({ login, success: false, error: 'Login já existe' })
        continue
      }

      try {
        const fakeEmail = `${login}@prevermed.internal`

        // Create auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email: fakeEmail,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: { full_name: user.full_name },
        })

        if (authError || !authData.user) {
          results.push({ login, success: false, error: authError?.message || 'Erro ao criar auth' })
          continue
        }

        const userId = authData.user.id

        // Update profile (trigger creates it)
        // Small delay for trigger
        await new Promise(r => setTimeout(r, 300))

        await adminClient
          .from('profiles')
          .update({
            login,
            position: user.position || null,
            unit: user.unit || 'lapa',
            hierarchy_position: user.hierarchy_position || 'team_member',
            internal_handle: user.internal_handle || login,
            birth_date: user.birth_date || null,
            start_date: user.start_date || null,
            phone_extension: user.phone_extension || null,
            contact_email: user.contact_email || null,
            must_change_password: true,
          })
          .eq('user_id', userId)

        // Add role
        if (user.role) {
          await adminClient
            .from('user_roles')
            .insert({ user_id: userId, role: user.role })
        }

        // Add departments
        if (user.departments && user.departments.length > 0) {
          const deptInserts = user.departments
            .map(name => {
              const deptId = deptMap.get(name.toLowerCase().trim())
              if (!deptId) return null
              return {
                user_id: userId,
                department_id: deptId,
                is_primary: user.primary_department?.toLowerCase().trim() === name.toLowerCase().trim(),
              }
            })
            .filter(Boolean)

          if (deptInserts.length > 0) {
            await adminClient.from('user_departments').insert(deptInserts)
          }
        }

        existingLogins.add(login)
        results.push({ login, success: true, user_id: userId })
      } catch (err: any) {
        results.push({ login, success: false, error: err.message || 'Erro desconhecido' })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${successCount} criado(s), ${failCount} erro(s)`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in bulk-create-users:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
