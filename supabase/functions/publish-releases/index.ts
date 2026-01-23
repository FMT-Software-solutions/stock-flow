import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for the app_versions table
type Platform = 'win32' | 'darwin' | 'linux';
type AppVersionStatus = 'draft' | 'published' | 'archived';
type Architecture = 'x64' | 'arm64' | 'ia32';

interface PlatformData {
  platform: Platform;
  architecture?: Architecture;
  download_url: string;
  file_size: number;
  status?: AppVersionStatus;
  is_critical?: boolean;
  minimum_version?: string;
}

interface ReleaseData {
  version: string;
  release_notes: string;
  platforms: PlatformData[];
}
Deno.serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }
  try {
    // Verify request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Get request body
    const releaseData: ReleaseData = await req.json();
    
    // Validate required fields
    if (!releaseData.version || !releaseData.release_notes || !releaseData.platforms || releaseData.platforms.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: version, release_notes, and platforms array'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Validate each platform data
    for (const platform of releaseData.platforms) {
      if (!platform.platform || !platform.download_url || !platform.file_size) {
        return new Response(JSON.stringify({
          error: 'Each platform must have platform, download_url, and file_size'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check if version already exists
    const { data: existingVersion, error: checkError } = await supabase.from('app_versions').select('version').eq('version', releaseData.version).single();
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing version:', checkError);
      return new Response(JSON.stringify({
        error: 'Database error while checking version'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    if (existingVersion) {
      return new Response(JSON.stringify({
        error: `Version ${releaseData.version} already exists`
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    // Prepare platform data for insertion
    const platformsToInsert = releaseData.platforms.map((platform) => {
      const status = platform.status || 'published';
      return {
        version: releaseData.version,
        release_notes: releaseData.release_notes,
        download_url: platform.download_url,
        platform: platform.platform,
        architecture: platform.architecture || null,
        file_size: platform.file_size,
        status: status,
        is_critical: platform.is_critical || false,
        minimum_version: platform.minimum_version || null,
        is_latest: status === 'published',
        published_at: status === 'published' ? new Date().toISOString() : null
      };
    });
    // Mark all previous versions as not latest for each platform
    for (const platformData of platformsToInsert){
      const { error: updateError } = await supabase.from('app_versions').update({
        is_latest: false
      }).eq('platform', platformData.platform).neq('version', releaseData.version);
      if (updateError) {
        console.error(`Error updating previous versions for platform ${platformData.platform}:`, updateError);
        return new Response(JSON.stringify({
          error: `Failed to update previous versions for platform ${platformData.platform}`
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    // Insert new version records for all platforms
    const { data, error } = await supabase.from('app_versions').insert(platformsToInsert).select();
    if (error) {
      console.error('Error inserting version:', error);
      return new Response(JSON.stringify({
        error: 'Failed to publish release'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: `Release ${releaseData.version} published successfully`,
      data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
