/**
 * Script per aggiornare il campo customer_id nelle richieste
 * estraendo l'ID dal campo cliente nei custom_fields
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

async function updateCustomerIds() {
  console.log('🔧 Updating customer_id from custom_fields...\n')

  // Get all requests with cliente field but no customer_id
  const { data: requests, error } = await supabase
    .from('requests')
    .select('id, custom_fields, customer_id')
    .is('customer_id', null)

  if (error) {
    console.error('❌ Error fetching requests:', error)
    process.exit(1)
  }

  if (!requests || requests.length === 0) {
    console.log('ℹ️  No requests found without customer_id')
    console.log('✨ Done!')
    return
  }

  console.log(`Found ${requests.length} request(s) to check\n`)

  let updatedCount = 0

  for (const request of requests) {
    const customFields = request.custom_fields as any

    // Check if it has a cliente field with an id
    if (customFields?.cliente && typeof customFields.cliente === 'object' && customFields.cliente.id) {
      const customerId = customFields.cliente.id

      const { error: updateError } = await supabase
        .from('requests')
        .update({ customer_id: customerId })
        .eq('id', request.id)

      if (updateError) {
        console.error(`❌ Error updating request ${request.id}:`, updateError)
      } else {
        const clientName = customFields.cliente.ragione_sociale || 'Unknown'
        console.log(`✅ Updated request ${request.id} - Customer: ${clientName}`)
        updatedCount++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total requests checked: ${requests.length}`)
  console.log(`   Updated with customer_id: ${updatedCount}`)
  console.log('\n✨ Done!')
}

updateCustomerIds().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
