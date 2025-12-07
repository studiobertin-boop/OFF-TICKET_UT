import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkRelazioneTecnica() {
  // Get schema
  const { data: schema } = await supabase
    .from('request_types')
    .select('name, fields_schema')
    .eq('name', 'RELAZIONE TECNICA')
    .single()

  console.log('📋 Schema RELAZIONE TECNICA:')
  console.log(JSON.stringify(schema, null, 2))

  // Get the request type id first
  const { data: typeData } = await supabase
    .from('request_types')
    .select('id')
    .eq('name', 'RELAZIONE TECNICA')
    .single()

  if (!typeData) {
    console.log('❌ Could not find request type')
    return
  }

  // Get requests
  const { data: requests } = await supabase
    .from('requests')
    .select('id, title, custom_fields, customer_id')
    .eq('request_type_id', typeData.id)
    .limit(5)

  console.log('\n📝 Richieste RELAZIONE TECNICA:')
  requests?.forEach((req: any) => {
    console.log(`\nID: ${req.id}`)
    console.log(`Title: ${req.title}`)
    console.log(`Customer ID: ${req.customer_id}`)
    console.log(`Custom fields:`, JSON.stringify(req.custom_fields, null, 2))
  })
}

checkRelazioneTecnica()
