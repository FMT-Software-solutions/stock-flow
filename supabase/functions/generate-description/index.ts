import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MODEL = 'gpt-6-luna'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get User and Org Context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        throw new Error('Missing Authorization header')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
        throw new Error('Invalid user token')
    }

    const { organizationId, productName, categoryName, additionalContext } = await req.json()

    if (!organizationId) {
        throw new Error('Missing organizationId')
    }

    const { data: membership } = await supabaseClient
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!membership) {
        throw new Error('Not a member of this organization')
    }

    // 2. Check Usage Limit
    const today = new Date().toISOString().split('T')[0]

    // Fetch organization limit
    const { data: orgData, error: orgError } = await supabaseClient
      .from('organizations')
      .select('ai_daily_limit')
      .eq('id', organizationId)
      .single()

    const dailyLimit = orgData?.ai_daily_limit ?? 20 // Default to 20 if not found
    
    const { data: usage, error: usageError } = await supabaseClient
      .from('organization_ai_usage')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('usage_date', today)
      .single()

    const currentCount = usage?.request_count || 0
    if (currentCount >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: `Daily AI generation limit (${dailyLimit}) reached for this organization.` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Generate with OpenAI.
    // gpt-6-luna: OpenAI's low-cost model with no announced shutdown
    // (gpt-3.5-turbo, used before, was shut down on 2026-10-23). It is a
    // reasoning model; effort "none" keeps a short text answer fast and cheap.
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
        throw new Error('AI is not configured (OPENAI_API_KEY is missing).')
    }

    const prompt = `Generate a professional and concise product description for a product named "${productName}"${categoryName ? ` in the category "${categoryName}"` : ''}. ${additionalContext ? `Additional details: ${additionalContext}` : ''}. Keep it under 100 words.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            reasoning_effort: 'none',
            max_completion_tokens: 300
        })
    })
    if (!response.ok) {
        console.error('OpenAI error:', response.status, await response.text())
        throw new Error('Could not generate a description right now. Please try again.')
    }
    const data = await response.json()
    const generatedText: string = data.choices?.[0]?.message?.content?.trim() ?? ''
    const tokensUsed: number = data.usage?.total_tokens ?? 0

    if (!generatedText) {
        throw new Error('Could not generate a description right now. Please try again.')
    }

    // 4. Update Usage and Log
    // Upsert usage
    const { error: upsertError } = await supabaseClient.from('organization_ai_usage').upsert({
        organization_id: organizationId,
        usage_date: today,
        request_count: currentCount + 1
    }, { onConflict: 'organization_id, usage_date' })
    
    if (upsertError) {
        console.error('Error updating usage:', upsertError)
    }

    // Insert Log
    const { error: logError } = await supabaseClient.from('ai_request_logs').insert({
        organization_id: organizationId,
        user_id: user.id,
        request_type: 'product_description',
        input_context: { productName, categoryName, additionalContext },
        generated_content: generatedText,
        model_used: MODEL,
        provider: 'OpenAI',
        tokens_used: tokensUsed
    })

    if (logError) {
        console.error('Error logging request:', logError)
    }

    return new Response(
      JSON.stringify({ description: generatedText, remaining: dailyLimit - (currentCount + 1) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
