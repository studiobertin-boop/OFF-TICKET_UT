// Edge Function DEBUG VERSION - per capire dove fallisce
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== REQUEST START ===')
    console.log('Method:', req.method)
    console.log('URL:', req.url)

    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    console.log('Auth header value:', authHeader?.substring(0, 50) + '...')

    if (!authHeader) {
      console.log('ERROR: Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    console.log('Supabase URL:', supabaseUrl)
    console.log('Supabase Anon Key present:', !!supabaseAnonKey)

    const supabaseClient = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    })

    console.log('Getting user...')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    console.log('User error:', userError)
    console.log('User data:', user ? { id: user.id, email: user.email } : null)

    if (userError || !user) {
      console.log('ERROR: User not authenticated')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - user not found', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Getting user profile...')
    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('role, is_suspended')
      .eq('id', user.id)
      .single()

    console.log('Profile error:', profileError)
    console.log('Profile data:', profile)

    if (profileError) {
      console.log('ERROR: Failed to fetch user profile')
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile', details: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile) {
      console.log('ERROR: Profile not found')
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.role !== 'admin') {
      console.log('ERROR: User is not admin, role:', profile.role)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required', userRole: profile.role }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User is admin! Processing request...')

    const requestData = await req.json()
    console.log('Request action:', requestData.action)

    // Per ora ritorniamo solo un messaggio di successo per il debug
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auth successful!',
        user: { id: user.id, email: user.email },
        profile: profile
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('UNEXPECTED ERROR:', error)
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
