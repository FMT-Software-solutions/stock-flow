import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // 3. Call AI Provider (Randomized Selection)
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const groqKey = Deno.env.get('GROQ_API_KEY')
    
    const prompt = `Generate a professional and concise product description for a product named "${productName}"${categoryName ? ` in the category "${categoryName}"` : ''}. ${additionalContext ? `Additional details: ${additionalContext}` : ''}. Keep it under 100 words.`

    // Define providers
    const providers = [
        {
            name: 'Google',
            model: 'gemini-1.5-flash',
            key: geminiKey,
            generate: async (key: string) => {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                })
                if (!response.ok) throw new Error(await response.text())
                const data = await response.json()
                return data.candidates?.[0]?.content?.parts?.[0]?.text
            }
        },
        {
            name: 'OpenAI',
            model: 'gpt-3.5-turbo',
            key: openaiKey,
            generate: async (key: string) => {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 150
                    })
                })
                if (!response.ok) throw new Error(await response.text())
                const data = await response.json()
                return data.choices?.[0]?.message?.content
            }
        },
        {
            name: 'Groq',
            model: 'llama3-8b-8192',
            key: groqKey,
            generate: async (key: string) => {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'llama3-8b-8192',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 150
                    })
                })
                if (!response.ok) throw new Error(await response.text())
                const data = await response.json()
                return data.choices?.[0]?.message?.content
            }
        }
    ]

    // Filter available providers
    const availableProviders = providers.filter(p => !!p.key)

    if (availableProviders.length === 0) {
        throw new Error('No AI provider API keys configured (GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY).')
    }

    // Shuffle providers to randomize usage (Fisher-Yates shuffle)
    for (let i = availableProviders.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableProviders[i], availableProviders[j]] = [availableProviders[j], availableProviders[i]];
    }

    let generatedText = ''
    let modelUsed = ''
    let providerName = ''

    // Try each provider until one succeeds
    for (const provider of availableProviders) {
        try {
            console.log(`Trying provider: ${provider.name}`)
            const result = await provider.generate(provider.key!)
            if (result) {
                generatedText = result
                modelUsed = provider.model
                providerName = provider.name
                break // Success!
            }
        } catch (error) {
            console.error(`${provider.name} Generation Error:`, error)
            // Continue to next provider
        }
    }

    if (!generatedText) {
        throw new Error('Failed to generate content from all available providers.')
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
        model_used: modelUsed,
        provider: providerName,
        tokens_used: 0 
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
