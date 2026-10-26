import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// gpt-6-luna: OpenAI's low-cost model with no announced shutdown. It is a
// reasoning model; effort "none" keeps a short answer fast and cheap.
const MODEL = 'gpt-6-luna'

// A summary is reused for the same user, period and branches until it is this old.
const CACHE_HOURS = 6

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

interface Body {
  organizationId: string
  branchIds?: string[] | null
  start?: string | null
  end?: string | null
  prevStart?: string | null
  prevEnd?: string | null
  bucket?: 'hour' | 'day' | 'month'
  timeZone?: string
  periodLabel: string
  previousLabel?: string | null
  branchLabel?: string
  currency?: string
  refresh?: boolean
}

const SYSTEM_PROMPT = `You summarise a shop's dashboard for its owner or manager.
Write 3 or 4 short sentences, each a separate line, in plain everyday English.
Use only the figures given; never invent numbers, causes or advice.
Lead with how sales did against the previous period when one is given (say the percentage change).
Then mention what stands out: a busy or quiet stretch, the top product, a branch that led or made no sales, how customers paid.
End with what needs attention now (stock out or low by branch, money owed and by whom, pending orders, discounts ending), only if there is any.
Write amounts with the currency code and thousands separators, no decimals unless needed, e.g. GHS 35,530.
Return JSON: {"lines": ["...", "..."]}.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    // Reads the dashboard as the signed-in user, so their access rules apply.
    const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid user token')

    const body = (await req.json()) as Body
    if (!body.organizationId || !body.periodLabel) throw new Error('Missing organizationId or periodLabel')

    const branchIds = body.branchIds && body.branchIds.length > 0 ? [...body.branchIds].sort() : null
    const cacheKey = JSON.stringify([body.start ?? null, body.end ?? null, body.prevStart ?? null, body.prevEnd ?? null, branchIds])

    // 1. A recent summary for the same view is reused (no AI call, no quota).
    if (!body.refresh) {
      const { data: cached } = await admin
        .from('dashboard_ai_summaries')
        .select('lines, created_at')
        .eq('organization_id', body.organizationId)
        .eq('user_id', user.id)
        .eq('cache_key', cacheKey)
        .maybeSingle()
      if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_HOURS * 3600 * 1000) {
        return json({ lines: cached.lines, createdAt: cached.created_at, cached: true })
      }
    }

    // 2. The dashboard's figures, as this user sees them (also checks membership).
    const { data: dash, error: dashError } = await asUser.rpc('get_dashboard_summary', {
      p_organization_id: body.organizationId,
      p_branch_ids: branchIds,
      p_start: body.start ?? null,
      p_end: body.end ?? null,
      p_prev_start: body.prevStart ?? null,
      p_prev_end: body.prevEnd ?? null,
      p_bucket: body.bucket ?? 'day',
      p_tz: body.timeZone ?? 'UTC',
    })
    if (dashError) throw new Error(dashError.message)

    // 3. Shared daily AI limit of the organization.
    const today = new Date().toISOString().split('T')[0]
    const { data: org } = await admin.from('organizations').select('ai_daily_limit').eq('id', body.organizationId).single()
    const dailyLimit = org?.ai_daily_limit ?? 20
    const { data: usage } = await admin
      .from('organization_ai_usage')
      .select('request_count')
      .eq('organization_id', body.organizationId)
      .eq('usage_date', today)
      .maybeSingle()
    const currentCount = usage?.request_count || 0
    if (currentCount >= dailyLimit) {
      return json({ error: `Daily AI limit (${dailyLimit}) reached for this organization.` }, 429)
    }

    // 4. Ask the model.
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) throw new Error('AI is not configured (OPENAI_API_KEY is missing).')

    const facts = {
      period: body.periodLabel,
      previousPeriod: body.previousLabel ?? null,
      branches: body.branchLabel ?? 'All branches',
      currency: body.currency ?? 'GHS',
      chartBucket: body.bucket ?? 'day',
      ...dash,
      recent: undefined,
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: 'none',
        max_completion_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      }),
    })
    if (!response.ok) {
      console.error('OpenAI error:', response.status, await response.text())
      throw new Error('Could not write a summary right now. Please try again.')
    }
    const data = await response.json()
    let lines: string[] = []
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
      lines = Array.isArray(parsed.lines) ? parsed.lines.filter((l: unknown) => typeof l === 'string' && l.trim()).slice(0, 5) : []
    } catch {
      lines = []
    }
    if (lines.length === 0) throw new Error('Could not write a summary right now. Please try again.')

    // 5. Keep it, count it, log it.
    const createdAt = new Date().toISOString()
    await admin.from('dashboard_ai_summaries').upsert(
      { organization_id: body.organizationId, user_id: user.id, cache_key: cacheKey, lines, model: MODEL, created_at: createdAt },
      { onConflict: 'organization_id,user_id,cache_key' }
    )
    await admin.from('organization_ai_usage').upsert(
      { organization_id: body.organizationId, usage_date: today, request_count: currentCount + 1 },
      { onConflict: 'organization_id, usage_date' }
    )
    const { error: logError } = await admin.from('ai_request_logs').insert({
      organization_id: body.organizationId,
      user_id: user.id,
      request_type: 'dashboard_summary',
      input_context: { period: body.periodLabel, start: body.start, end: body.end, branchIds },
      generated_content: lines.join('\n'),
      model_used: MODEL,
      provider: 'OpenAI',
      tokens_used: data.usage?.total_tokens ?? 0,
    })
    if (logError) console.error('Error logging request:', logError)

    return json({ lines, createdAt, cached: false, remaining: dailyLimit - (currentCount + 1) })
  } catch (error) {
    return json({ error: (error as Error).message }, 400)
  }
})
