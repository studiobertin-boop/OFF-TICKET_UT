// Supabase Edge Function: Sync customers from external Supabase project
// Invoke via: POST https://<project-ref>.supabase.co/functions/v1/sync-customers
// Headers: Authorization: Bearer <anon-key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Customer {
  ragione_sociale: string
  external_id: string
}

interface SyncResult {
  success: boolean
  inserted: number
  updated: number
  errors: number
  message?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables for external Supabase project
    const EXTERNAL_SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL')
    const EXTERNAL_SUPABASE_KEY = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')
    const EXTERNAL_TABLE_NAME = Deno.env.get('EXTERNAL_TABLE_NAME') || 'clienti'

    if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_KEY) {
      throw new Error('External Supabase credentials not configured. Set EXTERNAL_SUPABASE_URL and EXTERNAL_SUPABASE_ANON_KEY in Edge Function secrets.')
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const localSupabase = createClient(supabaseUrl, supabaseServiceKey)
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_KEY)

    // Verify user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await localSupabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: userData, error: userError } = await localSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can sync customers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting customer sync from external project...')

    // Fetch all customers from external Supabase project
    // Using pagination to handle 10k+ records
    let allExternalCustomers: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: externalCustomers, error: fetchError } = await externalSupabase
        .from(EXTERNAL_TABLE_NAME)
        .select('id, ragione_sociale')
        .not('ragione_sociale', 'is', null)
        .order('id')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (fetchError) {
        throw new Error(`Failed to fetch customers from external project: ${fetchError.message}`)
      }

      if (!externalCustomers || externalCustomers.length === 0) {
        hasMore = false
      } else {
        allExternalCustomers = [...allExternalCustomers, ...externalCustomers]
        page++

        // If we got less than pageSize, we've reached the end
        if (externalCustomers.length < pageSize) {
          hasMore = false
        }
      }
    }

    console.log(`Fetched ${allExternalCustomers.length} customers from external project`)

    // Transform data for local database
    const customersToSync: Customer[] = allExternalCustomers
      .filter(c => c.ragione_sociale && c.ragione_sociale.trim().length > 0)
      .map(c => ({
        ragione_sociale: c.ragione_sociale.trim(),
        external_id: String(c.id), // Store original ID as string
      }))

    // Upsert customers to local database in batches
    const batchSize = 500
    let inserted = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < customersToSync.length; i += batchSize) {
      const batch = customersToSync.slice(i, i + batchSize)

      const { data, error: upsertError } = await localSupabase
        .from('customers')
        .upsert(
          batch.map(c => ({
            ...c,
            is_active: true,
          })),
          {
            onConflict: 'external_id',
            ignoreDuplicates: false, // Update existing records
          }
        )
        .select('id')

      if (upsertError) {
        console.error(`Batch ${i / batchSize + 1} error:`, upsertError)
        errors += batch.length
      } else {
        // Note: Supabase doesn't return info about inserted vs updated in upsert
        // We count all successful operations
        inserted += data?.length || 0
      }
    }

    const result: SyncResult = {
      success: true,
      inserted: inserted,
      updated: 0, // Cannot distinguish in Supabase upsert
      errors: errors,
      message: `Successfully synced ${customersToSync.length} customers from external project`,
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        inserted: 0,
        updated: 0,
        errors: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
