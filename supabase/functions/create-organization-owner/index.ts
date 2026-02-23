import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Payload = {
  organizationDetails: {
    id: string
    name: string
    email?: string
    phone?: string
    address?: string
  }
  userDetails: {
    firstName: string
    lastName: string
    email: string
    password: string
  }
  isPurchase?: boolean
  provisioningSecret: string
}

const PURPLE_THEME = {
  id: 'purple',
  name: 'Royal Purple',
  description: 'Elegant purple theme',
  light: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    card: 'oklch(1 0 0)',
    cardForeground: 'oklch(0.145 0 0)',
    popover: 'oklch(1 0 0)',
    popoverForeground: 'oklch(0.145 0 0)',
    primaryForeground: 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0 0)',
    secondaryForeground: 'oklch(0.205 0 0)',
    muted: 'oklch(0.97 0 0)',
    mutedForeground: 'oklch(0.556 0 0)',
    accentForeground: 'oklch(0.205 0 0)',
    destructive: 'oklch(0.577 0.245 27.325)',
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',
    chart1: 'oklch(0.488 0.243 264.376)',
    chart2: 'oklch(0.627 0.265 264.376)',
    chart3: 'oklch(0.646 0.222 41.116)',
    chart4: 'oklch(0.828 0.189 84.429)',
    chart5: 'oklch(0.769 0.188 70.08)',
    sidebar: 'oklch(0.985 0 0)',
    sidebarForeground: 'oklch(0.145 0 0)',
    sidebarPrimary: 'oklch(0.488 0.243 264.376)',
    sidebarPrimaryForeground: 'oklch(0.985 0 0)',
    sidebarAccent: 'oklch(0.627 0.265 264.376)',
    sidebarAccentForeground: 'oklch(0.205 0 0)',
    sidebarBorder: 'oklch(0.922 0 0)',
    sidebarRing: 'oklch(0.708 0 0)',
    primary: 'oklch(0.488 0.243 264.376)',
    accent: 'oklch(0.627 0.265 264.376)',
  },
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    card: 'oklch(0.205 0 0)',
    cardForeground: 'oklch(0.985 0 0)',
    popover: 'oklch(0.205 0 0)',
    popoverForeground: 'oklch(0.985 0 0)',
    primaryForeground: 'oklch(0.205 0 0)',
    secondary: 'oklch(0.269 0 0)',
    secondaryForeground: 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    mutedForeground: 'oklch(0.708 0 0)',
    accentForeground: 'oklch(0.985 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',
    chart1: 'oklch(0.818 0.188 264.376)',
    chart2: 'oklch(0.869 0.165 264.376)',
    chart3: 'oklch(0.769 0.188 70.08)',
    chart4: 'oklch(0.627 0.265 303.9)',
    chart5: 'oklch(0.645 0.246 16.439)',
    sidebar: 'oklch(0.205 0 0)',
    sidebarForeground: 'oklch(0.985 0 0)',
    sidebarPrimary: 'oklch(0.818 0.188 264.376)',
    sidebarPrimaryForeground: 'oklch(0.985 0 0)',
    sidebarAccent: 'oklch(0.869 0.165 264.376)',
    sidebarAccentForeground: 'oklch(0.985 0 0)',
    sidebarBorder: 'oklch(1 0 0 / 10%)',
    sidebarRing: 'oklch(0.556 0 0)',
    primary: 'oklch(0.818 0.188 264.376)',
    accent: 'oklch(0.869 0.165 264.376)',
  },
  fonts: {
    sans: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
    serif: 'Georgia, serif',
    mono: 'Menlo, Monaco, Consolas, monospace',
  },
  shadows: {
    xs2: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    xs: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    sm: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    default: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    md: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    lg: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    xl: '0 35px 60px -12px rgb(0 0 0 / 0.3)',
    xl2: '0 50px 100px -20px rgb(0 0 0 / 0.25)',
  },
  config: {
    radius: '0.625rem',
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const provisioningSecretEnv = Deno.env.get('PROVISIONING_SECRET')
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!provisioningSecretEnv) {
      return new Response(JSON.stringify({ error: 'Provisioning secret missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const payload: Payload = await req.json()
    const { organizationDetails, userDetails, provisioningSecret, isPurchase } = payload

    if (!organizationDetails?.id || !organizationDetails?.name) {
      return new Response(JSON.stringify({ error: 'Missing organization details' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!userDetails?.email || !userDetails?.password || !userDetails?.firstName || !userDetails?.lastName) {
      return new Response(JSON.stringify({ error: 'Missing user details' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (provisioningSecret !== provisioningSecretEnv) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id, has_purchased')
      .eq('id', organizationDetails.id)
      .maybeSingle()

    // Handle existing organization logic
    if (existingOrg) {
      if (isPurchase) {
        // If it's a purchase request and org exists:
        // 1. If already purchased, do nothing (idempotent)
        // 2. If not purchased (trial), upgrade to purchased and remove trial

        if (existingOrg.has_purchased) {
          // Already purchased, nothing to do
          return new Response(JSON.stringify({ success: true, message: 'Organization already purchased' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Update to purchased status
        const { error: updateError } = await supabaseAdmin
          .from('organizations')
          .update({ has_purchased: true, trial_end_date: null })
          .eq('id', existingOrg.id)

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: true, message: 'Organization upgraded to purchased status' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } else {
        // If it's a trial request and org exists:
        // Return error or success (idempotent) - User says "nothing happens" implies we shouldn't error but maybe just return success? 
        // "If the organization has already requested trial and is trying to request again. nothing happens."
        // "If organization has purchased and is trying to request a trial. nothing happens."
        return new Response(JSON.stringify({ success: true, message: 'Organization already exists' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // New Organization Logic
    const orgInsert = {
      id: organizationDetails.id,
      name: organizationDetails.name,
      email: organizationDetails.email || null,
      phone: organizationDetails.phone || null,
      address: organizationDetails.address || null,
      brand_colors: PURPLE_THEME,
      theme_name: 'purple',
      is_active: true,
      has_purchased: !!isPurchase,
      // If purchased, trial_end_date is null. If trial, it defaults to 30 days via database default or trigger.
      // The database trigger `handle_org_trial_logic` handles trial_end_date logic:
      // - If has_purchased = true, sets trial_end_date = NULL
      // - If has_purchased = false AND trial_end_date IS NULL, sets trial_end_date = now() + 30 days
      // So we just need to set has_purchased.
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert(orgInsert)
      .select()
      .single()

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = (existingUsers?.users || []).find((u: any) => u.email?.toLowerCase() === userDetails.email.toLowerCase())

    let userId: string
    let isNewUser = false

    if (existing) {
      userId = existing.id
    } else {
      const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({ email: userDetails.email, password: userDetails.password, email_confirm: true })
      if (createUserError || !created?.user?.id) {
        return new Response(JSON.stringify({ error: createUserError?.message || 'Failed to create auth user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      userId = created.user.id
      isNewUser = true
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, email: userDetails.email, first_name: userDetails.firstName, last_name: userDetails.lastName, phone: null }, { onConflict: 'id' })

    if (profileError) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: authUsersError } = await supabaseAdmin
      .from('auth_users')
      .upsert({ id: userId, email: userDetails.email, is_first_login: true, password_updated: false }, { onConflict: 'id' })

    if (authUsersError) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: authUsersError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({ name: 'Main Branch', location: organizationDetails.address || organizationDetails.name, description: 'Default main branch', organization_id: org.id, contact: organizationDetails.phone || organizationDetails.email || null })
      .select()
      .single()

    if (branchError) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('auth_users').delete().eq('id', userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: branchError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: userOrgError } = await supabaseAdmin
      .from('user_organizations')
      .upsert({ user_id: userId, organization_id: org.id, role: 'owner', is_active: true }, { onConflict: 'user_id,organization_id' })

    if (userOrgError) {
      if (isNewUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('branches').delete().eq('id', branch.id)
      await supabaseAdmin.from('auth_users').delete().eq('id', userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.from('organizations').delete().eq('id', org.id)
      return new Response(JSON.stringify({ error: userOrgError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ success: true, organization_id: org.id, owner_user_id: userId, branch_id: branch.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})