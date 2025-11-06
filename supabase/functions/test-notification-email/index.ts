import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get user details from the database
    const { data: userData, error: userDataError } = await supabaseClient
      .from('users')
      .select('email, full_name, role')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData) {
      throw new Error('User not found in database')
    }

    // Only admins can send test emails
    if (userData.role !== 'admin') {
      throw new Error('Only administrators can send test emails')
    }

    console.log('Sending test email to:', userData.email)

    // Call the send-notification-email function
    const { data: emailResponse, error: emailError } = await supabaseClient.functions.invoke(
      'send-notification-email',
      {
        body: {
          to: userData.email,
          user_name: userData.full_name || 'Utente',
          event_type: 'status_change',
          message: 'Questa è una email di test del sistema di notifiche',
          request_id: '00000000-0000-0000-0000-000000000000',
          metadata: {
            request_title: 'Email di Test - Sistema Notifiche',
            customer_name: 'Cliente Test S.r.l.',
            request_type_name: 'Richiesta Tecnica Standard',
            current_status: 'IN_LAVORAZIONE',
            assigned_to_name: 'Mario Rossi',
            is_dm329: false,
          },
        },
      }
    )

    if (emailError) {
      console.error('Error calling send-notification-email:', emailError)
      throw emailError
    }

    console.log('Test email sent successfully:', emailResponse)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email di test inviata con successo a ${userData.email}`,
        response: emailResponse,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in test-notification-email:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
