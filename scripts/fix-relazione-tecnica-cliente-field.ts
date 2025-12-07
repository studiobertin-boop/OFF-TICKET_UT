/**
 * Script per uniformare il nome del campo cliente in RELAZIONE TECNICA
 * da "nome_cliente" a "cliente" per coerenza con gli altri tipi di richiesta
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

async function fixRelazioneTecnicaClienteField() {
  console.log('🔧 Fixing RELAZIONE TECNICA cliente field name...\n')

  // Step 1: Update the schema
  console.log('📋 Step 1: Updating request type schema...')

  const { data: requestType, error: fetchError } = await supabase
    .from('request_types')
    .select('id, name, fields_schema')
    .eq('name', 'RELAZIONE TECNICA')
    .single()

  if (fetchError || !requestType) {
    console.error('❌ Error fetching RELAZIONE TECNICA:', fetchError)
    process.exit(1)
  }

  // Update the field name in schema
  const updatedSchema = requestType.fields_schema.map((field: any) => {
    if (field.name === 'nome_cliente') {
      return { ...field, name: 'cliente' }
    }
    return field
  })

  const { error: updateSchemaError } = await supabase
    .from('request_types')
    .update({ fields_schema: updatedSchema })
    .eq('id', requestType.id)

  if (updateSchemaError) {
    console.error('❌ Error updating schema:', updateSchemaError)
    process.exit(1)
  }

  console.log('✅ Schema updated: nome_cliente → cliente\n')

  // Step 2: Update existing requests
  console.log('📝 Step 2: Updating existing requests...')

  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('id, custom_fields')
    .eq('request_type_id', requestType.id)

  if (requestsError) {
    console.error('❌ Error fetching requests:', requestsError)
    process.exit(1)
  }

  if (!requests || requests.length === 0) {
    console.log('ℹ️  No requests found for RELAZIONE TECNICA')
    console.log('\n✨ Done!')
    return
  }

  console.log(`Found ${requests.length} request(s) to update`)

  let updatedCount = 0
  for (const request of requests) {
    const customFields = request.custom_fields as any

    // Check if it has nome_cliente field
    if (customFields && customFields.nome_cliente) {
      // Rename the field
      const updatedFields = { ...customFields }
      updatedFields.cliente = updatedFields.nome_cliente
      delete updatedFields.nome_cliente

      const { error: updateError } = await supabase
        .from('requests')
        .update({ custom_fields: updatedFields })
        .eq('id', request.id)

      if (updateError) {
        console.error(`❌ Error updating request ${request.id}:`, updateError)
      } else {
        console.log(`✅ Updated request ${request.id}`)
        updatedCount++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total requests: ${requests.length}`)
  console.log(`   Updated: ${updatedCount}`)
  console.log('\n✨ Done!')
}

fixRelazioneTecnicaClienteField().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
