import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Create Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get request body
    const { platform, currentVersion } = await req.json()

    console.log('Received platform:', platform, 'currentVersion:', currentVersion)

    if (!platform) {
      return new Response(
        JSON.stringify({ success: false, error: 'Platform is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // First try to get the version marked as latest
    console.log('Querying for platform:', platform)
    let { data: latestVersionData, error } = await supabaseClient
      .from('app_versions')
      .select('id, version, download_url, release_notes, platform, file_size, created_at, updated_at, published_at, status')
      .eq('platform', platform)
      .eq('status', 'published')
      .eq('is_latest', true)
      .single()
    
    console.log('Query result - data:', latestVersionData, 'error:', error)

    // If no version is marked as latest, fall back to most recent published version
    if (error && error.code === 'PGRST116') {
      console.log('Falling back to created_at ordering')
      const { data: versions, error: fallbackError } = await supabaseClient
        .from('app_versions')
        .select('id, version, download_url, release_notes, platform, file_size, created_at, updated_at, published_at, status')
        .eq('platform', platform)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1)
      
      console.log('Fallback query result - data:', versions, 'error:', fallbackError)
      
      if (fallbackError) {
        console.error('Fallback database error:', fallbackError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch versions' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      latestVersionData = versions && versions.length > 0 ? versions[0] : null
      error = null
    }

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch versions' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Helper function to compare semantic versions
    function compareVersions(a: string, b: string): number {
      const parseVersion = (version: string) => {
        return version.replace(/^v/, '').split('.').map(num => parseInt(num, 10))
      }
      
      const versionA = parseVersion(a)
      const versionB = parseVersion(b)
      
      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0
        const numB = versionB[i] || 0
        
        if (numA > numB) return 1
        if (numA < numB) return -1
      }
      
      return 0
    }

    if (latestVersionData) {
      const isNewer = currentVersion ? compareVersions(latestVersionData.version, currentVersion) > 0 : true
      
      return new Response(
        JSON.stringify({
          success: true,
          hasUpdate: isNewer,
          currentVersion: currentVersion || 'unknown',
          latestVersion: isNewer ? latestVersionData : null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion || 'unknown',
        latestVersion: null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})