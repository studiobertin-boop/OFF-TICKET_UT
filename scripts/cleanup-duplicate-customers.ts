#!/usr/bin/env tsx

/**
 * Script per pulire i clienti duplicati dal database
 *
 * Strategia:
 * 1. Duplicati con 1 external_id e N senza → Merge automatico (tiene quello con external_id)
 * 2. Duplicati tutti senza external_id → Merge automatico (tiene il più vecchio)
 * 3. Duplicati con external_id multipli → SKIP (gestione manuale richiesta)
 *
 * Utilizzo:
 *   npm run cleanup-duplicates           # Dry-run (solo report)
 *   npm run cleanup-duplicates -- --apply # Applica le modifiche
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'

// Carica variabili d'ambiente
config({ path: path.join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Errore: Variabili ambiente mancanti')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const isApplyMode = process.argv.includes('--apply')

interface Customer {
  id: string
  ragione_sociale: string
  external_id: string | null
  via: string | null
  cap: string | null
  citta: string | null
  provincia: string | null
  is_active: boolean
  created_at: string
}

interface MergeAction {
  keepId: string
  deleteIds: string[]
  reason: string
  customer: Customer
}

const stats = {
  totalGroups: 0,
  autoMerged: 0,
  skippedConflicts: 0,
  requestsUpdated: 0,
  customersDeleted: 0,
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Decide quale cliente tenere e quali eliminare
 */
function decideMergeStrategy(customers: Customer[]): MergeAction | null {
  const withExternalId = customers.filter(c => c.external_id !== null)
  const withoutExternalId = customers.filter(c => c.external_id === null)

  // Caso 1: Multipli external_id → SKIP (conflitto)
  if (withExternalId.length > 1) {
    return null // Gestione manuale richiesta
  }

  // Caso 2: Un solo external_id → Tieni quello
  if (withExternalId.length === 1) {
    const keep = withExternalId[0]
    const deleteList = withoutExternalId.map(c => c.id)

    return {
      keepId: keep.id,
      deleteIds: deleteList,
      reason: 'Cliente con external_id ha priorità',
      customer: keep,
    }
  }

  // Caso 3: Tutti senza external_id → Tieni il più vecchio
  const sorted = [...customers].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const keep = sorted[0]
  const deleteList = sorted.slice(1).map(c => c.id)

  return {
    keepId: keep.id,
    deleteIds: deleteList,
    reason: 'Cliente più vecchio mantenuto',
    customer: keep,
  }
}

/**
 * Aggiorna le richieste che puntano ai clienti da eliminare
 */
async function updateRequestsReferences(deleteIds: string[], keepId: string): Promise<number> {
  if (isApplyMode) {
    const { data, error } = await supabase
      .from('requests')
      .update({ customer_id: keepId })
      .in('customer_id', deleteIds)
      .select('id')

    if (error) {
      console.error('  ❌ Errore aggiornamento richieste:', error.message)
      return 0
    }

    return data?.length || 0
  }

  // In dry-run, conta solo quante richieste sarebbero aggiornate
  const { count, error } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .in('customer_id', deleteIds)

  if (error) {
    console.error('  ❌ Errore conteggio richieste:', error.message)
    return 0
  }

  return count || 0
}

/**
 * Elimina i clienti duplicati (soft delete)
 */
async function deleteCustomers(ids: string[]): Promise<number> {
  if (!isApplyMode) {
    return ids.length // Dry-run
  }

  const { error } = await supabase
    .from('customers')
    .update({ is_active: false })
    .in('id', ids)

  if (error) {
    console.error('  ❌ Errore eliminazione clienti:', error.message)
    return 0
  }

  return ids.length
}

/**
 * Processa un gruppo di duplicati
 */
async function processDuplicateGroup(customers: Customer[]) {
  stats.totalGroups++

  const action = decideMergeStrategy(customers)

  if (!action) {
    console.log(`\n⚠️  SKIP: "${customers[0].ragione_sociale}" - ${customers.length} duplicati`)
    console.log('   Motivo: Multipli external_id (gestione manuale richiesta)')

    for (const c of customers) {
      console.log(`   - ID: ${c.id.substring(0, 8)}... | External ID: ${c.external_id}`)
    }

    stats.skippedConflicts++
    return
  }

  console.log(`\n${isApplyMode ? '✅' : '🔍'} "${action.customer.ragione_sociale}" - ${customers.length} duplicati`)
  console.log(`   Strategia: ${action.reason}`)
  console.log(`   Mantieni: ${action.keepId.substring(0, 8)}... (External ID: ${action.customer.external_id || 'N/A'})`)
  console.log(`   Elimina: ${action.deleteIds.length} record`)

  // Aggiorna richieste
  const requestsUpdated = await updateRequestsReferences(action.deleteIds, action.keepId)
  if (requestsUpdated > 0) {
    console.log(`   📝 Richieste ${isApplyMode ? 'aggiornate' : 'da aggiornare'}: ${requestsUpdated}`)
    stats.requestsUpdated += requestsUpdated
  }

  // Elimina duplicati
  const deleted = await deleteCustomers(action.deleteIds)
  stats.customersDeleted += deleted
  stats.autoMerged++

  if (isApplyMode) {
    console.log(`   ✅ Merge completato`)
  } else {
    console.log(`   [DRY-RUN] Operazione simulata`)
  }
}

/**
 * Main
 */
async function main() {
  console.log('🧹 Pulizia Duplicati Clienti\n')

  if (!isApplyMode) {
    console.log('⚠️  MODALITÀ DRY-RUN: nessuna modifica verrà applicata')
    console.log('   Usa --apply per applicare le modifiche\n')
  } else {
    console.log('🚀 MODALITÀ APPLICAZIONE: le modifiche verranno salvate\n')
  }

  // Carica tutti i clienti
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Errore caricamento clienti:', error)
    process.exit(1)
  }

  console.log(`📊 Clienti attivi: ${customers.length}\n`)

  // Raggruppa per ragione sociale
  const groups = new Map<string, Customer[]>()

  for (const customer of customers) {
    const normalized = normalizeString(customer.ragione_sociale)
    if (!groups.has(normalized)) {
      groups.set(normalized, [])
    }
    groups.get(normalized)!.push(customer)
  }

  // Trova duplicati
  const duplicates: Customer[][] = []
  for (const [, customerList] of groups.entries()) {
    if (customerList.length > 1) {
      duplicates.push(customerList)
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ Nessun duplicato trovato!\n')
    return
  }

  console.log(`🔍 Trovati ${duplicates.length} gruppi di duplicati\n`)
  console.log('='.repeat(70))

  // Processa ogni gruppo
  for (const group of duplicates) {
    await processDuplicateGroup(group)
  }

  // Stampa riepilogo
  console.log('\n' + '='.repeat(70))
  console.log('📈 RIEPILOGO OPERAZIONI')
  console.log('='.repeat(70))
  console.log(`Gruppi processati:          ${stats.totalGroups}`)
  console.log(`Merge ${isApplyMode ? 'completati' : 'possibili'}:          ${stats.autoMerged}`)
  console.log(`Conflitti skippati:         ${stats.skippedConflicts}`)
  console.log(`Richieste ${isApplyMode ? 'aggiornate' : 'da aggiornare'}:      ${stats.requestsUpdated}`)
  console.log(`Clienti ${isApplyMode ? 'eliminati' : 'da eliminare'}:         ${stats.customersDeleted}`)
  console.log('='.repeat(70))

  if (!isApplyMode && stats.autoMerged > 0) {
    console.log('\n💡 Per applicare le modifiche, esegui:')
    console.log('   npm run cleanup-duplicates -- --apply\n')
  } else if (isApplyMode) {
    console.log('\n✅ Pulizia completata!\n')
  }

  if (stats.skippedConflicts > 0) {
    console.log('\n⚠️  ATTENZIONE: Alcuni duplicati richiedono gestione manuale')
    console.log('   Usa l\'interfaccia admin per risolverli\n')
  }
}

main().catch(error => {
  console.error('\n❌ Errore:', error)
  process.exit(1)
})
