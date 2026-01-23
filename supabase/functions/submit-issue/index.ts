import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface IssueSubmission {
  issueType: 'bug_report' | 'feedback' | 'suggestion'
  description: string
  email: string
  screenshotUrl?: string
  userAgent?: string
  appVersion?: string
  platform?: string
}

// Helper function to generate Cloudinary signature
async function generateCloudinarySignature(params: Record<string, string>, apiSecret: string): Promise<string> {
  // Sort parameters alphabetically and create query string format
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')

  // Cloudinary signature format: sorted_params + api_secret (no separator)
  const stringToSign = sortedParams + apiSecret
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)

  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper function to upload image to Cloudinary
async function uploadToCloudinary(imageFile: File): Promise<string> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  if (!cloudName) {
    throw new Error('Cloudinary cloud name not configured. Please contact support.')
  }
  if (!apiKey) {
    throw new Error('Cloudinary API key not configured. Please contact support.')
  }
  if (!apiSecret) {
    throw new Error('Cloudinary API secret not configured. Please contact support.')
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (imageFile.size > maxSize) {
    throw new Error('Image file is too large. Please use an image smaller than 5MB.')
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(imageFile.type)) {
    throw new Error('Invalid file type. Please use JPEG, PNG, GIF, or WebP images.')
  }

  const timestamp = Math.round(Date.now() / 1000).toString()
  const folder = 'issues/screenshots'
  const publicId = `issue_${timestamp}_${Math.random().toString(36).substring(2, 15)}`

  // Parameters for signature generation (exclude: file, cloud_name, resource_type, api_key per Cloudinary docs)
  const params = {
    folder,
    public_id: publicId,
    timestamp
  }

  // Generate signature
  const signature = await generateCloudinarySignature(params, apiSecret)

  // Create form data for Cloudinary upload
  const formData = new FormData()
  formData.append('file', imageFile)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp)
  formData.append('folder', folder)
  formData.append('public_id', publicId)
  formData.append('resource_type', 'image')
  formData.append('signature', signature)

  // Upload to Cloudinary
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = 'Image upload failed'
    try {
      const errorData = await response.json()
      if (errorData.error && errorData.error.message) {
        errorMessage = `Image upload failed: ${errorData.error.message}`
      } else if (response.status === 401) {
        errorMessage = 'Image upload failed: Invalid Cloudinary credentials'
      } else if (response.status === 413) {
        errorMessage = 'Image file is too large'
      } else {
        errorMessage = `Image upload failed (${response.status})`
      }
    } catch {
      // If we can't parse the error response, use a generic message
      errorMessage = `Image upload failed (${response.status})`
    }
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!result.secure_url) {
    throw new Error('Image upload completed but no URL was returned')
  }

  return result.secure_url
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Require authentication for issue submission
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in to submit an issue.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user session using the anon key client for proper token validation
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!anonKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

    if (authError || !user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is active and not banned
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: 'Please verify your email address before submitting issues.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle both JSON and FormData requests
    let issueType: string
    let description: string
    let email: string
    let screenshotUrl: string | null = null
    let userAgent: string | undefined
    let appVersion: string | undefined
    let platform: string | undefined

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (with potential file upload)
      try {
        const formData = await req.formData()

        issueType = formData.get('issueType') as string
        description = formData.get('description') as string
        email = formData.get('email') as string
        userAgent = formData.get('userAgent') as string || undefined
        appVersion = formData.get('appVersion') as string || undefined
        platform = formData.get('platform') as string || undefined

        // Handle screenshot upload if present
        const screenshotFile = formData.get('screenshot') as File
        if (screenshotFile && screenshotFile.size > 0) {
          try {
            screenshotUrl = await uploadToCloudinary(screenshotFile)
          } catch (uploadError) {
            console.error('Screenshot upload error:', uploadError)
            const errorMessage = uploadError instanceof Error ? uploadError.message : 'Failed to upload screenshot'
            return new Response(
              JSON.stringify({ error: errorMessage }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid form data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Handle JSON requests (backward compatibility)
      try {
        const requestBody: IssueSubmission = await req.json()
        issueType = requestBody.issueType
        description = requestBody.description
        email = requestBody.email
        screenshotUrl = requestBody.screenshotUrl || null
        userAgent = requestBody.userAgent
        appVersion = requestBody.appVersion
        platform = requestBody.platform
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (!issueType || !description || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: issueType, description, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate issue type
    const validIssueTypes = ['bug_report', 'feedback', 'suggestion']
    if (!validIssueTypes.includes(issueType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid issue type. Must be one of: bug_report, feedback, suggestion' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use the authenticated user's ID (we already verified the user above)
    const userId = user.id

    // Insert issue into database
    const { data: issue, error: insertError } = await supabase
      .from('issues')
      .insert({
        issue_type: issueType,
        description: description.trim(),
        email: email.toLowerCase().trim(),
        screenshot_url: screenshotUrl || null,
        user_id: userId,
        user_agent: userAgent || null,
        app_version: appVersion || null,
        platform: platform || null,
        status: 'open',
        priority: 'medium'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)

      let errorMessage = 'Failed to submit issue. Please try again.'

      // Provide more specific error messages based on the error type
      if (insertError.code === '23505') {
        errorMessage = 'A duplicate issue was detected. Please check if you have already submitted this issue.'
      } else if (insertError.code === '23514') {
        errorMessage = 'Invalid data provided. Please check your input and try again.'
      } else if (insertError.code === 'PGRST116') {
        errorMessage = 'Database connection error. Please try again in a moment.'
      } else if (insertError.message?.includes('permission')) {
        errorMessage = 'Permission denied. Please contact support if this issue persists.'
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Issue submitted successfully',
        issueId: issue.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    // Log detailed error for debugging
    console.error('Error in submit-issue function:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    })

    // Return user-friendly error message
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        // Include error details in development/debugging
        ...(Deno.env.get('ENVIRONMENT') === 'development' && {
          debug: {
            message: error.message,
            timestamp: new Date().toISOString()
          }
        })
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})