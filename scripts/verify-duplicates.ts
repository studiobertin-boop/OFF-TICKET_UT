#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Query SQL per trovare duplicati esatti
  const { data, error } = await supabase.rpc('find_exact_duplicates', {})
    .catch(async () => {
      // Se la funzione non esiste, usiamo una query diretta
      const result = await supabase
        .from('customers')
        .select('ragione_sociale')
        .eq('is_active', true)

      const names = result.data?.map(c => c.ragione_sociale) || []
      const counts = new Map<string, number>()

      for (const name of names) {
        counts.set(name, (counts.get(name) || 0) + 1)
      }

      const duplicates: any[] = []
      for (const [name, count] of counts.entries()) {
        if (count > 1) {
          duplicates.push({ ragione_sociale: name, count })
        }
      }

      return { data: duplicates, error: null }
    })

  if (error) {
    console.error('Errore:', error)
    return
  }

  console.log('\n🔍 DUPLICATI ESATTI (confronto case-sensitive):\n')
  console.log(`Trovati ${data?.length || 0} gruppi di duplicati\n`)

  if (data && data.length > 0) {
    for (const dup of data.slice(0, 50)) {
      console.log(`"${dup.ragione_sociale}" → ${dup.count} volte`)
    }
  }

  // Ora cerca per caratteri invisibili / spazi strani
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, ragione_sociale')
    .eq('is_active', true)
    .order('ragione_sociale')

  console.log('\n📊 Primi 50 clienti (ordinati):\n')
  if (allCustomers) {
    for (let i = 0; i < Math.min(50, allCustomers.length); i++) {
      const c = allCustomers[i]
      const bytes = Buffer.from(c.ragione_sociale).toString('hex')
      console.log(`${i + 1}. "${c.ragione_sociale}" [${c.ragione_sociale.length} chars] (${bytes.substring(0, 40)}...)`)
    }
  }
}

main()
