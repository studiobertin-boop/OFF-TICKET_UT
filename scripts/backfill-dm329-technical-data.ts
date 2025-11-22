/**
 * Backfill Script: Create missing dm329_technical_data records
 *
 * Purpose: Create technical data sheets for all DM329 requests that were created
 * before the automatic trigger was implemented (before 2025-11-12).
 *
 * This script:
 * 1. Finds all DM329 requests without a corresponding technical data record
 * 2. Creates a dm329_technical_data record for each one
 * 3. Copies the indirizzo_impianto from custom_fields if available
 * 4. Logs all operations for audit purposes
 *
 * Usage:
 *   npm install tsx (if not already installed)
 *   tsx scripts/backfill-dm329-technical-data.ts
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - Service role key needed to bypass RLS policies
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables')
  console.error('   Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface DM329Request {
  id: string
  created_by: string
  custom_fields: {
    indirizzo_impianto?: string
    [key: string]: any
  }
}

async function backfillTechnicalData() {
  console.log('🚀 Starting backfill process for DM329 technical data...\n')

  try {
    // Step 1: Get the DM329 request_type_id
    console.log('📋 Step 1: Finding DM329 request type...')
    const { data: requestType, error: typeError } = await supabase
      .from('request_types')
      .select('id, name')
      .eq('name', 'DM329')
      .single()

    if (typeError || !requestType) {
      console.error('❌ Error: Could not find DM329 request type')
      console.error(typeError)
      process.exit(1)
    }

    console.log(`✓ Found DM329 request type: ${requestType.id}\n`)

    // Step 2: Get all DM329 requests without technical data
    console.log('📋 Step 2: Finding DM329 requests without technical data...')

    // First, get all request IDs that already have technical data
    const { data: existingTechData, error: existingError } = await supabase
      .from('dm329_technical_data')
      .select('request_id')

    if (existingError) {
      console.error('❌ Error fetching existing technical data:', existingError)
      process.exit(1)
    }

    const existingRequestIds = new Set(existingTechData?.map((td) => td.request_id) || [])
    console.log(`✓ Found ${existingRequestIds.size} requests that already have technical data`)

    // Now get all DM329 requests
    const { data: allRequests, error: requestsError } = await supabase
      .from('requests')
      .select('id, created_by, custom_fields')
      .eq('request_type_id', requestType.id)

    if (requestsError) {
      console.error('❌ Error fetching requests:', requestsError)
      process.exit(1)
    }

    // Filter out requests that already have technical data
    const requestsWithoutTechData = (allRequests || []).filter(
      (req) => !existingRequestIds.has(req.id)
    ) as DM329Request[]

    console.log(`✓ Found ${allRequests?.length || 0} total DM329 requests`)
    console.log(`✓ Found ${requestsWithoutTechData.length} requests WITHOUT technical data\n`)

    if (requestsWithoutTechData.length === 0) {
      console.log('✅ Nothing to do - all DM329 requests already have technical data!')
      return
    }

    // Step 3: Create technical data for each request
    console.log('📋 Step 3: Creating technical data records...\n')

    let successCount = 0
    let errorCount = 0

    for (const request of requestsWithoutTechData) {
      try {
        const indirizzoImpianto = request.custom_fields?.indirizzo_impianto

        console.log(`  Processing request ${request.id}...`)
        if (indirizzoImpianto) {
          console.log(`    └─ Address: ${indirizzoImpianto}`)
        }

        const { error: insertError } = await supabase
          .from('dm329_technical_data')
          .insert({
            request_id: request.id,
            created_by: request.created_by,
            indirizzo_impianto: indirizzoImpianto || null,
            equipment_data: {},
            is_completed: false,
            ocr_processing_status: 'pending',
          })

        if (insertError) {
          console.error(`  ❌ Error creating technical data for ${request.id}:`, insertError.message)
          errorCount++
        } else {
          console.log(`  ✓ Created technical data for ${request.id}`)
          successCount++
        }
      } catch (err) {
        console.error(`  ❌ Unexpected error for ${request.id}:`, err)
        errorCount++
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 BACKFILL SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total DM329 requests:              ${allRequests?.length || 0}`)
    console.log(`Already had technical data:        ${existingRequestIds.size}`)
    console.log(`Needed backfill:                   ${requestsWithoutTechData.length}`)
    console.log(`Successfully created:              ${successCount}`)
    console.log(`Errors:                            ${errorCount}`)
    console.log('='.repeat(60))

    if (errorCount > 0) {
      console.log('\n⚠️  Some records failed to create. Please review errors above.')
      process.exit(1)
    } else {
      console.log('\n✅ Backfill completed successfully!')
    }
  } catch (err) {
    console.error('\n❌ Fatal error during backfill:', err)
    process.exit(1)
  }
}

// Run the backfill
backfillTechnicalData()
  .then(() => {
    console.log('\n👋 Backfill script finished')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ Unhandled error:', err)
    process.exit(1)
  })
