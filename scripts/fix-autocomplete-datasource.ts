/**
 * Script per aggiungere dataSource: 'customers' ai campi autocomplete
 * che non ce l'hanno ancora definito
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

interface FieldSchema {
  name: string
  type: string
  label: string
  required?: boolean
  hidden?: boolean
  dataSource?: string
  [key: string]: any
}

interface RequestType {
  id: string
  name: string
  fields_schema: FieldSchema[]
}

async function fixAutocompleteDataSource() {
  console.log('🔍 Searching for request types with autocomplete fields...\n')

  // Fetch all request types
  const { data: requestTypes, error } = await supabase
    .from('request_types')
    .select('id, name, fields_schema')
    .order('name')

  if (error) {
    console.error('❌ Error fetching request types:', error)
    process.exit(1)
  }

  if (!requestTypes || requestTypes.length === 0) {
    console.log('ℹ️  No request types found')
    return
  }

  let fixedCount = 0
  let totalAutocompleteFields = 0

  for (const requestType of requestTypes as RequestType[]) {
    let hasChanges = false
    const updatedFieldsSchema = requestType.fields_schema.map((field) => {
      if (field.type === 'autocomplete') {
        totalAutocompleteFields++

        // Se non ha dataSource, aggiungilo
        if (!field.dataSource) {
          console.log(`📝 Fixing field "${field.label}" in "${requestType.name}"`)
          hasChanges = true
          return {
            ...field,
            dataSource: 'customers',
          }
        } else {
          console.log(`✅ Field "${field.label}" in "${requestType.name}" already has dataSource: ${field.dataSource}`)
        }
      }
      return field
    })

    if (hasChanges) {
      // Update the request type
      const { error: updateError } = await supabase
        .from('request_types')
        .update({ fields_schema: updatedFieldsSchema })
        .eq('id', requestType.id)

      if (updateError) {
        console.error(`❌ Error updating ${requestType.name}:`, updateError)
      } else {
        console.log(`✅ Updated ${requestType.name}\n`)
        fixedCount++
      }
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Total request types: ${requestTypes.length}`)
  console.log(`   Total autocomplete fields: ${totalAutocompleteFields}`)
  console.log(`   Fixed request types: ${fixedCount}`)

  if (fixedCount === 0) {
    console.log('\n✨ All autocomplete fields already have dataSource configured!')
  } else {
    console.log('\n✨ Fix completed successfully!')
  }
}

// Run the script
fixAutocompleteDataSource()
  .catch((error) => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
