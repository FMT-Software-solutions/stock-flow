import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email template for new users with temporal password
function getNewUserInvitationTemplate(userName: string, email: string, organizationName: string, temporaryPassword: string, brandColors: any) {
  const colors = {
    primary: brandColors?.light?.primary || '#4F46E5',
    secondary: brandColors?.light?.secondary || '#64748B',
    accent: brandColors?.light?.accent || '#06b6d4',
    background: '#FFFFFF',
    foreground: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0'
  };
  
  return {
    subject: `User Account Details - ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Account -  ${organizationName}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="padding: 32px 24px 24px; border-bottom: 1px solid #f0f0f0;">
      <h2 style="margin: 16px 0 0 0; font-size: 20px; color: ${colors.foreground};">Your user account has been created for ${organizationName}</h2>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">Hi ${userName},</p>
      
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        Welcome to ${organizationName}! Your account has been created and you can now access our platform.
      </p>
      
      <div style="background-color: #f3f4f6; border: 2px solid ${colors.primary}; border-radius: 8px; padding: 24px; margin: 24px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: ${colors.foreground};">Your Login Details:</h3>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.muted};">Email: <strong>${email}</strong></p>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: ${colors.muted};">Temporary Password:</p>
        <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.1em; color: ${colors.primary}; font-family: monospace; background-color: white; padding: 12px; border-radius: 4px; text-align: center;">
          ${temporaryPassword}
        </p>
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>Important:</strong> Please change your password after your first login for security purposes.
        </p>
      </div>
      
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        If you have any questions or need assistance, please don't hesitate to contact your administrator.
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
      Welcome to ${organizationName}!
      
      Hi ${userName},
      
      Your account has been created and you can now access our platform.
      
      Login Details:
      Email: ${userName}
      Temporary Password: ${temporaryPassword}
      
      Important: Please change your password after your first login for security purposes.
      
      If you have any questions, please contact your administrator.
    `
  }
}

// Email template for existing users added to organization
function getExistingUserNotificationTemplate(userName: string, organizationName: string, brandColors: any) {
  const colors = {
    primary: brandColors?.light?.primary || '#4F46E5',
    secondary: brandColors?.light?.secondary || '#64748B',
    accent: brandColors?.light?.accent || '#06b6d4',
    background: '#FFFFFF',
    foreground: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0'
  };
  
  return {
    subject: `You've been added to ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Added to ${organizationName}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="padding: 32px 24px 24px; border-bottom: 1px solid #f0f0f0;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 48px; height: 48px; background-color: ${colors.primary}; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">${organizationName.charAt(0)}</div>
        <h1 style="margin: 0; font-size: 24px; color: ${colors.foreground};">${organizationName}</h1>
      </div>
      <h2 style="margin: 16px 0 0 0; font-size: 20px; color: ${colors.foreground};">Organization Access Granted</h2>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">Hi ${userName},</p>
      
      <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        Great news! You've been added to <strong>${organizationName}</strong> and now have access to their platform.
      </p>
      
      <div style="background-color: #f3f4f6; border: 2px solid ${colors.primary}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 16px; color: ${colors.foreground};">You can now log in with your existing credentials to access ${organizationName}.</p>
      </div>
      
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        Simply log in to your account and you'll see ${organizationName} in your organization list.
      </p>
      
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${colors.foreground};">
        If you have any questions or need assistance, please contact your administrator.
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
      Organization Access Granted
      
      Hi ${userName},
      
      You've been added to ${organizationName} and now have access to their platform.
      
      You can now log in with your existing credentials to access ${organizationName}.
      
      If you have any questions, please contact your administrator.
    `
  }
}

serve(async (req) => {
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

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Initialize Resend client
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user making the request
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized request. User not found.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body with error handling
    let requestBody
    try {
      requestBody = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, firstName, lastName, role, branchIds, organizationId } = requestBody
    
    console.log(`Creating user: ${email}, role: ${role}, organization: ${organizationId}, branches: ${branchIds?.join(', ') || 'none'}`)

    // Validate organizationId is provided
    if (!organizationId) {
      console.error('Missing required field: organizationId')
      return new Response(
        JSON.stringify({ error: 'Missing required field: organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user has required permissions in the SPECIFIC organization they're trying to create a user for
    const { data: userOrg, error: userOrgError } = await supabaseAdmin
      .from('user_organizations')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single()

    if (userOrgError || !userOrg || !['owner', 'admin', 'branch_admin'].includes(userOrg?.role)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized request. You do not have required permissions in this organization.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required fields
    if (!email || !firstName || !lastName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, firstName, lastName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate branchIds if provided (skip validation for admin and owner roles as they get all branches)
    if (branchIds && !['admin', 'owner'].includes(role) && (!Array.isArray(branchIds) || branchIds.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'branchIds must be a non-empty array if provided' }),
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

    // Validate role
    if (!['owner', 'admin', 'branch_admin', 'write', 'read'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be one of: owner, admin, branch_admin, write, read' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already exists in auth.users
    const { data: existingUsers, error: existingUserError } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(user => user.email === email)
    
    let userId: string
    let profileId: string
    let tempPassword: string | null = null
    let isNewUser = false

    if (existingUser) {
      // User already exists
      userId = existingUser.id
      
      // With unified IDs, the user ID is the same as the profile ID
      profileId = userId

      // Check if user is already part of this organization
      const { data: existingOrgMembership, error: orgCheckError } = await supabaseAdmin
        .from('user_organizations')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single()

      if (existingOrgMembership) {
        return new Response(
          JSON.stringify({ error: 'User is already a member of this organization' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // User doesn't exist, create new user
      isNewUser = true
      
      // Generate a temporary password (10 characters)
      tempPassword = Math.random().toString(36).slice(-10)

      // Create the user in Supabase Auth
      console.log(`Creating new auth user for: ${email}`)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: `${firstName} ${lastName}`,
          role: role,
          requires_password_reset: true
        }
      })

      if (createError) {
        console.error(`Failed to create auth user for ${email}:`, createError)
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log(`Successfully created auth user: ${newUser?.user?.id}`)

      if (!newUser?.user?.id) {
        return new Response(
          JSON.stringify({ error: 'Failed to create user: No user ID returned' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = newUser.user.id
    }

    // Only create profile and auth_users records for new users
    if (isNewUser) {
      // Create profile record with auth user ID as profile ID
      const { error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId, // Use auth user ID as profile ID
          email,
          first_name: firstName,
          last_name: lastName,
        })

      if (profileInsertError) {
        // If profile creation fails, delete the auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (deleteError) {
          console.error('Failed to cleanup auth user:', deleteError)
        }
        return new Response(
          JSON.stringify({ error: `Failed to create user profile: ${profileInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      profileId = userId // Profile ID is now the same as auth user ID

      // Create auth_users record with RLS bypass
      const { error: authUserInsertError } = await supabaseAdmin
        .from('auth_users')
        .insert({
          id: userId,
          email,
          is_active: true,
          is_first_login: true,
          password_updated: false,
        })

      if (authUserInsertError) {
        // If auth_users creation fails, delete the auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (deleteError) {
          console.error('Failed to cleanup auth user:', deleteError)
        }
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${authUserInsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Add user to organization with RLS bypass
    console.log(`Assigning user ${userId} to organization ${organizationId} with role ${role}`)
    const { error: orgError } = await supabaseAdmin
      .from('user_organizations')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role: role,
        is_active: true,
        created_by: user.id
      })

    if (orgError) {
      console.error(`Failed to assign user ${userId} to organization ${organizationId}:`, orgError)
      // If organization assignment fails, clean up only if it's a new user
      if (isNewUser) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (deleteError) {
          console.error('Failed to cleanup auth user:', deleteError)
        }
      }
      return new Response(
        JSON.stringify({ error: `Failed to assign user to organization: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Successfully assigned user ${userId} to organization ${organizationId}`)

    // If branchIds are provided and user is not admin/owner, add user to multiple branches
    // Admin and owner users get access to all branches automatically, so no specific branch assignment needed
    if (branchIds && branchIds.length > 0 && !['admin', 'owner'].includes(role)) {
      console.log(`Assigning user ${userId} to branches: ${branchIds.join(', ')}`)
      const branchInserts = branchIds.map(branchId => ({
        user_id: userId,
        branch_id: branchId,
        organization_id: organizationId,
        created_by: user.id
      }))

      const { error: branchError } = await supabaseAdmin
        .from('user_branches')
        .insert(branchInserts)

      if (branchError) {
        console.error(`Failed to assign user ${userId} to branches ${branchIds.join(', ')}:`, branchError)
        // If branch assignment fails, clean up and fail the entire operation
        if (isNewUser) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId)
            console.log(`Cleaned up auth user ${userId} due to branch assignment failure`)
          } catch (deleteError) {
            console.error('Failed to cleanup auth user:', deleteError)
          }
        }
        return new Response(
          JSON.stringify({ error: `Failed to assign user to branches: ${branchError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log(`Successfully assigned user ${userId} to branches: ${branchIds.join(', ')}`)
    } else if (['admin', 'owner'].includes(role)) {
      console.log(`User ${userId} has ${role} role - skipping branch assignment (gets access to all branches)`)
    }

    // Fetch organization details for email template
    const { data: organizationData, error: orgFetchError } = await supabaseAdmin
      .from('organizations')
      .select('name, brand_colors')
      .eq('id', organizationId)
      .single()

    if (orgFetchError) {
      console.error('Failed to fetch organization details:', orgFetchError)
    }

    // Send email notification
    if (organizationData && Deno.env.get('RESEND_API_KEY')) {
      try {
        let emailTemplate
        
        const fullName = `${firstName} ${lastName}`.trim();
        
        if (isNewUser && tempPassword) {
          // Send new user invitation with temporary password
          emailTemplate = getNewUserInvitationTemplate(
            fullName || email.split('@')[0],
            email,
            organizationData.name,
            tempPassword,
            organizationData.brand_colors
          )
        } else {
          // Send existing user notification
          emailTemplate = getExistingUserNotificationTemplate(
            fullName || email,
            organizationData.name,
            organizationData.brand_colors
          )
        }

        await resend.emails.send({
          from: 'noreply@fmtsoftware.com',
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text
        })

        console.log(`Email sent successfully to ${email}`)
      } catch (emailError) {
        console.error('Failed to send email:', emailError)
        // Don't fail the entire operation if email fails
      }
    }

    console.log(`Successfully created user ${userId} (${email}) with role ${role} in organization ${organizationId}${isNewUser ? ' - new user' : ' - existing user'}${tempPassword ? ` - temp password: ${tempPassword}` : ''}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          role,
          branchIds: branchIds || [],
          organizationId,
          isNewUser
        },
        temporaryPassword: tempPassword
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: `Internal server error: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})