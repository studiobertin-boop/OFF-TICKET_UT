#!/usr/bin/env tsx

/**
 * Script per eliminare TUTTI i clienti dal database
 * ATTENZIONE: Questo script è DISTRUTTIVO!
 *
 * Utilizzo:
 *   npm run delete-all-customers           # Dry-run
 *   npm run delete-all-customers -- --confirm  # Esecuzione reale
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const isConfirmed = process.argv.includes('--confirm')

async function main() {
  console.log('🗑️  ELIMINAZIONE COMPLETA CLIENTI\n')

  if (!isConfirmed) {
    console.log('⚠️  MODALITÀ DRY-RUN\n')
    console.log('Questo script eliminerà TUTTI i clienti dal database.')
    console.log('Per procedere, esegui: npm run delete-all-customers -- --confirm\n')
  } else {
    console.log('🚨 ATTENZIONE: Stai per eliminare TUTTI i clienti!\n')
  }

  // Conta clienti attuali
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })

  console.log(`📊 Clienti totali nel database: ${totalCustomers}\n`)

  // Conta richieste collegate
  const { count: linkedRequests } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .not('customer_id', 'is', null)

  console.log(`📝 Richieste con cliente collegato: ${linkedRequests}\n`)

  if (!isConfirmed) {
    console.log('ℹ️  Nessuna operazione eseguita (dry-run)\n')
    return
  }

  // Step 1: Rimuovi il collegamento dalle richieste
  console.log('1️⃣  Rimozione collegamento customer_id dalle richieste...')
  const { error: updateError } = await supabase
    .from('requests')
    .update({ customer_id: null })
    .not('customer_id', 'is', null)

  if (updateError) {
    console.error('❌ Errore:', updateError)
    return
  }
  console.log('✅ Richieste aggiornate\n')

  // Step 2: Elimina tutti i clienti
  console.log('2️⃣  Eliminazione di tutti i clienti...')
  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Match tutti

  if (deleteError) {
    console.error('❌ Errore:', deleteError)
    return
  }

  console.log('✅ Tutti i clienti eliminati\n')

  // Verifica
  const { count: remainingCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })

  console.log(`📊 Clienti rimanenti: ${remainingCustomers}`)
  console.log('\n✅ Operazione completata!')
  console.log('\n💡 Ora puoi eseguire nuovamente: npm run sync-customers\n')
}

main().catch(console.error)
