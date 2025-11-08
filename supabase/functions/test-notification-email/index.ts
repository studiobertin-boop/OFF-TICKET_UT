import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== FUNCTION INVOKED ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request, returning CORS headers')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Starting test-notification-email ===')

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    console.log('Auth header value:', authHeader?.substring(0, 20) + '...')

    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Check env variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    console.log('SUPABASE_URL:', supabaseUrl ? 'present' : 'MISSING')
    console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'present' : 'MISSING')

    // Create Supabase client
    const supabaseClient = createClient(
      supabaseUrl ?? '',
      supabaseAnonKey ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )
    console.log('Supabase client created')

    // Get the current user - use getUser(jwt) to decode token directly
    console.log('Getting user from auth...')

    // Extract JWT from Bearer token
    const jwt = authHeader.replace('Bearer ', '')
    console.log('JWT extracted, length:', jwt.length)

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(jwt)

    if (userError) {
      console.error('User error:', userError)
      throw new Error(`Auth error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('No user found in session')
    }

    console.log('User ID:', user.id)
    console.log('User email from auth:', user.email)

    // Get user details from the database (email is in auth.users, not in public.users)
    console.log('Fetching user from database...')
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (userDataError) {
      console.error('User data error:', userDataError)
      throw new Error(`Database error: ${userDataError.message}`)
    }

    if (!userData) {
      throw new Error(`User not found in database with ID: ${user.id}`)
    }

    console.log('User data:', { email: user.email, role: userData.role })

    // Only admins can send test emails
    if (userData.role !== 'admin') {
      throw new Error('Only administrators can send test emails')
    }

    const userEmail = user.email
    if (!userEmail) {
      throw new Error('User email not found in auth')
    }

    console.log('=== Preparing to send email ===')
    console.log('Target email:', userEmail)

    // Call Resend API directly for testing
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'onboarding@resend.dev'

    console.log('RESEND_API_KEY present:', !!RESEND_API_KEY)
    console.log('RESEND_API_KEY first 10 chars:', RESEND_API_KEY?.substring(0, 10))
    console.log('EMAIL_FROM:', EMAIL_FROM)

    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY not configured!')
      throw new Error('RESEND_API_KEY not configured')
    }

    const emailPayload = {
      from: `Officomp Ticketing <${EMAIL_FROM}>`,
      to: [userEmail],
      subject: 'Test Email - Sistema Ticketing Officomp',
      html: `
        <h1>Email di Test</h1>
        <p>Ciao ${userData.full_name || 'Utente'},</p>
        <p>Questa è una email di test del sistema di notifiche.</p>
        <p><strong>Se ricevi questa email, il sistema funziona correttamente!</strong></p>
      `,
    }

    console.log('=== Calling Resend API ===')
    console.log('URL: https://api.resend.com/emails')
    console.log('Payload:', JSON.stringify(emailPayload))

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    })

    console.log('=== Resend API Response ===')
    console.log('Status:', resendResponse.status)
    console.log('Status Text:', resendResponse.statusText)
    console.log('Headers:', Object.fromEntries(resendResponse.headers.entries()))

    const resendData = await resendResponse.json()
    console.log('Response data:', JSON.stringify(resendData, null, 2))

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`)
    }

    console.log('=== SUCCESS ===')
    console.log('Email sent successfully via Resend:', resendData)

    const successResponse = {
      success: true,
      message: `Email di test inviata con successo a ${userEmail}`,
      response: resendData,
    }
    console.log('Returning success response:', successResponse)

    return new Response(
      JSON.stringify(successResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('=== ERROR CAUGHT ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)

    // Return detailed error for debugging
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 to see error details in frontend
      }
    )
  }
})
