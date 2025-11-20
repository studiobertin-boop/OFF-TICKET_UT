#!/usr/bin/env tsx

/**
 * Script per trovare e analizzare i clienti duplicati nel database
 *
 * Utilizzo:
 *   npm run find-duplicates
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

interface DuplicateGroup {
  ragione_sociale: string
  count: number
  customers: Customer[]
}

/**
 * Normalizza una stringa per il confronto
 */
function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Trova tutti i duplicati nel database
 */
async function findDuplicates(): Promise<DuplicateGroup[]> {
  console.log('🔍 Ricerca duplicati nel database...\n')

  // Carica tutti i clienti
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Errore caricamento clienti:', error)
    process.exit(1)
  }

  console.log(`📊 Clienti totali: ${customers.length}`)
  console.log(`📊 Clienti attivi: ${customers.filter(c => c.is_active).length}\n`)

  // Raggruppa per ragione sociale normalizzata
  const groups = new Map<string, Customer[]>()

  for (const customer of customers) {
    // Normalizza: trim, lowercase, rimuovi spazi multipli
    const normalized = normalizeString(customer.ragione_sociale)

    if (!normalized) continue // Skip se vuoto

    if (!groups.has(normalized)) {
      groups.set(normalized, [])
    }
    groups.get(normalized)!.push(customer)
  }

  console.log(`📊 Nomi univoci (normalizzati): ${groups.size}\n`)

  // Trova solo i gruppi con duplicati
  const duplicates: DuplicateGroup[] = []

  for (const [normalizedName, customerList] of groups.entries()) {
    if (customerList.length > 1) {
      duplicates.push({
        ragione_sociale: customerList[0].ragione_sociale,
        count: customerList.length,
        customers: customerList,
      })
    }
  }

  // Ordina per numero di duplicati (decrescente)
  duplicates.sort((a, b) => b.count - a.count)

  return duplicates
}

/**
 * Mostra statistiche sui duplicati
 */
function printStatistics(duplicates: DuplicateGroup[]) {
  console.log('=' .repeat(70))
  console.log('📈 STATISTICHE DUPLICATI')
  console.log('='.repeat(70))

  const totalDuplicateGroups = duplicates.length
  const totalDuplicateRecords = duplicates.reduce((sum, group) => sum + (group.count - 1), 0)

  console.log(`Gruppi di duplicati:        ${totalDuplicateGroups}`)
  console.log(`Record duplicati totali:    ${totalDuplicateRecords}`)
  console.log(`Max duplicati per cliente:  ${duplicates[0]?.count || 0}`)
  console.log('='.repeat(70))
}

/**
 * Mostra dettagli duplicati
 */
function printDuplicateDetails(duplicates: DuplicateGroup[], limit: number = 20) {
  console.log(`\n📋 TOP ${limit} GRUPPI DI DUPLICATI:\n`)

  for (let i = 0; i < Math.min(limit, duplicates.length); i++) {
    const group = duplicates[i]
    console.log(`${i + 1}. "${group.ragione_sociale}" - ${group.count} duplicati`)

    for (const customer of group.customers) {
      const hasExternalId = customer.external_id ? `✅ ${customer.external_id}` : '❌ NO ID'
      const hasAddress = customer.via ? `📍 ${customer.citta || 'N/A'}` : '📍 Nessun indirizzo'
      const date = new Date(customer.created_at).toLocaleString('it-IT')

      console.log(`   - ID: ${customer.id.substring(0, 8)}... | ${hasExternalId} | ${hasAddress} | ${date}`)
    }
    console.log()
  }
}

/**
 * Genera suggerimenti per la pulizia
 */
function generateCleanupSuggestions(duplicates: DuplicateGroup[]) {
  console.log('\n💡 SUGGERIMENTI PER LA PULIZIA:\n')

  let withExternalIdConflicts = 0
  let canAutoMerge = 0
  let needsManualReview = 0

  for (const group of duplicates) {
    const withExternalId = group.customers.filter(c => c.external_id !== null)
    const withoutExternalId = group.customers.filter(c => c.external_id === null)

    if (withExternalId.length > 1) {
      // Più record con external_id diversi - problema serio
      withExternalIdConflicts++
    } else if (withExternalId.length === 1) {
      // Un record con external_id, gli altri senza - merge automatico possibile
      canAutoMerge++
    } else {
      // Tutti senza external_id - revisione manuale necessaria
      needsManualReview++
    }
  }

  console.log(`✅ Merge automatico possibile:     ${canAutoMerge} gruppi`)
  console.log(`⚠️  Revisione manuale necessaria:   ${needsManualReview} gruppi`)
  console.log(`❌ Conflitti external_id multipli: ${withExternalIdConflicts} gruppi`)

  console.log('\n📝 PROSSIMI PASSI:\n')
  console.log('1. Esegui lo script di cleanup automatico per i merge sicuri')
  console.log('2. Usa l\'interfaccia admin per gestire i duplicati con revisione manuale')
  console.log('3. Contatta il supporto per i conflitti di external_id\n')
}

/**
 * Esporta lista duplicati in CSV
 */
async function exportToCSV(duplicates: DuplicateGroup[]) {
  const fs = await import('fs')
  const csvLines: string[] = []

  // Header
  csvLines.push('Ragione Sociale,Num Duplicati,ID 1,External ID 1,Indirizzo 1,ID 2,External ID 2,Indirizzo 2')

  for (const group of duplicates.slice(0, 100)) { // Prime 100 per non esagerare
    const c1 = group.customers[0]
    const c2 = group.customers[1] || {}

    csvLines.push([
      `"${group.ragione_sociale}"`,
      group.count,
      c1.id,
      c1.external_id || '',
      c1.citta || '',
      (c2 as any).id || '',
      (c2 as any).external_id || '',
      (c2 as any).citta || '',
    ].join(','))
  }

  const csvPath = path.join(process.cwd(), 'DOCUMENTAZIONE', 'duplicati_clienti.csv')
  fs.writeFileSync(csvPath, csvLines.join('\n'))

  console.log(`\n💾 Esportato CSV: ${csvPath}\n`)
}

/**
 * Main
 */
async function main() {
  console.log('🔧 Analisi Duplicati Clienti\n')

  const duplicates = await findDuplicates()

  if (duplicates.length === 0) {
    console.log('✅ Nessun duplicato trovato!\n')
    return
  }

  printStatistics(duplicates)
  printDuplicateDetails(duplicates, 20)
  generateCleanupSuggestions(duplicates)
  await exportToCSV(duplicates)

  console.log('✅ Analisi completata!\n')
}

main().catch(error => {
  console.error('\n❌ Errore:', error)
  process.exit(1)
})
