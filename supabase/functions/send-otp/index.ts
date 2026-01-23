import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OtpRequest {
  email: string
}

// We'll use Supabase's built-in OTP generation instead of our custom function

function getEmailTemplate(otp: string, userName: string) {
  const colors = {
    primary: '#4F46E5',
    primaryLight: '#8B5CF6',
    background: '#FFFFFF',
    foreground: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    textPrimary: '#FFFFFF',
    warning: '#F59E0B'
  };

  const organizationName = 'FMT Software';

  return {
    subject: 'Your verification code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code - ${organizationName}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="padding: 32px 24px 24px; border-bottom: 1px solid #f0f0f0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <h1 style="margin: 0; font-size: 24px; color: ${colors.foreground};">${organizationName}</h1>
      </div>
      <h2 style="margin: 16px 0 0 0; font-size: 20px; color: ${colors.foreground};">Verification Code</h2>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">Hi ${userName},</p>
      
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        You requested a verification code. Use the code below to complete the process:
      </p>
      
      <div style="background-color: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.muted};">Your verification code:</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 0.1em; color: ${colors.primary}; font-family: monospace;">
          ${otp}
        </p>
      </div>
      
      <p style="margin: 0 0 16px 0; font-size: 14px; color: ${colors.muted};">
        This code will expire in 1 hour.
      </p>
      
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        If you didn't request this code, please ignore this email or contact support if you have concerns.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
      
      <p style="margin: 0; font-size: 14px; color: ${colors.muted};">
        For security reasons, never share this code with anyone.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #f0f0f0; background-color: #f8fafc; text-align: center;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.muted};">
        This email was sent from ${organizationName}. If you have any questions, please contact your administrator.
      </p>
      <div style="height: 1px; background-color: #e2e8f0; margin: 16px 0;"></div>
      <p style="margin: 0; font-size: 12px; color: ${colors.muted};">© ${new Date().getFullYear()} ${organizationName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
      Verification Code
      
      Hi ${userName},
      
      You requested a verification code. Use this code to proceed:
      
      Verification Code: ${otp}
      
      Security Notice:
      - This code expires in 1 hour
      - Never share this code with anyone
      - If you didn't request this, please ignore this email
    `
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if this is an authenticated request or anon key request
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const isAnonRequest = authHeader === `Bearer ${anonKey}`


    if (!isAnonRequest) {
      // For authenticated requests, verify the user's session
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        anonKey,
        {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        }
      )

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      authenticatedUser = user
    }
    // For anon requests, we allow the request to proceed without user verification

    const { email }: OtpRequest = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: authUser } = await supabaseAdmin
      .from('auth_users')
      .select('id, email, is_active, otp_requests_count, last_otp_request')
      .eq('email', email)
      .single();

    if (!authUser) {
      return {
        success: false,
        message: 'No active user with this email address found in our system',
      };
    }

    if (authUser && authUser.is_active === false) {
      return {
        success: false,
        message: 'User account is not active. Contact your administrator',
      };
    }

    // Check if user has exceeded request limit
    if (authUser.otp_requests_count >= 4) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Maximum OTP requests exceeded. Please contact your administrator for assistance.'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request count
    const requestCount = authUser.otp_requests_count || 0

    // Progressive cooldown based on request count
    const getCooldownMinutes = (count: number) => {
      if (count === 0) return 0; // No wait for first request
      if (count === 1) return 1; // 1 minute for second request
      if (count === 2) return 3; // 3 minutes for third request
      return 5; // 5 minutes for fourth and subsequent requests
    };

    // Check time-based restriction with progressive cooldown
    if (authUser.last_otp_request && requestCount > 0) {
      const lastRequest = new Date(authUser.last_otp_request)
      const now = new Date()
      const timeDiff = now.getTime() - lastRequest.getTime()
      const minutesDiff = timeDiff / (1000 * 60)
      const requiredCooldown = getCooldownMinutes(requestCount)

      if (minutesDiff < requiredCooldown) {
        const cooldownMinutes = Math.ceil(requiredCooldown - minutesDiff)
        const remainingRequests = 4 - requestCount
        return new Response(
          JSON.stringify({
            success: false,
            message: `Please wait ${cooldownMinutes} minute${cooldownMinutes > 1 ? 's' : ''} before requesting another code. You have ${remainingRequests} request${remainingRequests !== 1 ? 's' : ''} remaining.`,
            cooldownMinutes,
            remainingRequests
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get user profile for email template
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', authUser.id)
      .single();

    // Prepare user name for email
    const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || email : email;

    // Generate OTP using Supabase auth admin
    const { data, error: updateAuthError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (!data?.properties?.email_otp) {
      throw new Error('Failed to generate OTP');
    }

    const otp = data.properties.email_otp;

    if (updateAuthError) {
      console.error('Error updating user metadata:', updateAuthError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update auth_users table with request tracking
    const now = new Date()
    const { error: updateError } = await supabaseAdmin
      .from('auth_users')
      .update({
        otp_requests_count: requestCount + 1,
        last_otp_request: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', authUser.id)

    if (updateError) {
      console.error('Error updating auth_users:', updateError)
    }

    // Send email using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailTemplate = getEmailTemplate(otp, userName)

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from: 'FMT Software <auth@fmtsoftware.com>',
      to: [email],
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });

    if (emailError) {
      console.error('Resend API error:', emailError)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const remainingRequests = 4 - (requestCount + 1)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'OTP sent successfully',
        remainingRequests
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-otp function:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})