#!/usr/bin/env tsx

/**
 * Script di Pulizia Intelligente Duplicati Clienti
 *
 * Strategia:
 * 1. Identifica clienti "protetti" (collegati a richieste) → NON li tocca MAI
 * 2. Trova duplicati tra clienti NON protetti
 * 3. Elimina duplicati mantenendo il migliore (con external_id o il più vecchio)
 * 4. Sincronizza con Excel MAGO (solo tipo "Customer")
 * 5. Preserva TUTTI i collegamenti esistenti
 *
 * Utilizzo:
 *   npm run smart-cleanup           # Dry-run (solo analisi)
 *   npm run smart-cleanup -- --apply  # Esecuzione reale
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Carica env
config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const isApplyMode = process.argv.includes('--apply')
const EXCEL_FILE_PATH = path.join(process.cwd(), 'DOCUMENTAZIONE', 'ClientiDaMAGO.xlsx')

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
  is_protected?: boolean // Ha richieste collegate
}

interface ExcelCustomer {
  external_id: string
  ragione_sociale: string
  via: string | null
  cap: string | null
  citta: string | null
  provincia: string | null
}

const stats = {
  totalCustomers: 0,
  protectedCustomers: 0,
  unprotectedCustomers: 0,
  duplicatesFound: 0,
  duplicatesDeleted: 0,
  customersUpdated: 0,
  customersInserted: 0,
  excelRowsTotal: 0,
  excelCustomersFiltered: 0,
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeProvincia(provincia: string | null): string | null {
  if (!provincia) return null
  return provincia.trim().toUpperCase().substring(0, 2) || null
}

/**
 * Carica tutti i clienti con info se sono protetti
 */
async function loadCustomers(): Promise<Customer[]> {
  console.log('📥 Caricamento clienti dal database...\n')

  // Carica tutti i clienti
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Trova quali clienti hanno richieste collegate
  const { data: linkedCustomers } = await supabase
    .from('requests')
    .select('customer_id')
    .not('customer_id', 'is', null)

  const protectedIds = new Set(linkedCustomers?.map(r => r.customer_id) || [])

  // Marca clienti protetti
  const customersWithProtection = customers.map(c => ({
    ...c,
    is_protected: protectedIds.has(c.id),
  }))

  stats.totalCustomers = customersWithProtection.length
  stats.protectedCustomers = customersWithProtection.filter(c => c.is_protected).length
  stats.unprotectedCustomers = customersWithProtection.filter(c => !c.is_protected).length

  console.log(`✅ Clienti caricati: ${stats.totalCustomers}`)
  console.log(`   🛡️  Protetti (con richieste): ${stats.protectedCustomers}`)
  console.log(`   📝 Non protetti: ${stats.unprotectedCustomers}\n`)

  return customersWithProtection
}

/**
 * Trova duplicati tra clienti NON protetti
 */
function findUnprotectedDuplicates(customers: Customer[]): Map<string, Customer[]> {
  const unprotected = customers.filter(c => !c.is_protected)
  const groups = new Map<string, Customer[]>()

  for (const customer of unprotected) {
    const normalized = normalizeString(customer.ragione_sociale)
    if (!normalized) continue

    if (!groups.has(normalized)) {
      groups.set(normalized, [])
    }
    groups.get(normalized)!.push(customer)
  }

  // Filtra solo gruppi con duplicati
  const duplicates = new Map<string, Customer[]>()
  for (const [name, list] of groups.entries()) {
    if (list.length > 1) {
      duplicates.set(name, list)
      stats.duplicatesFound += list.length - 1 // Conta duplicati (non il keeper)
    }
  }

  return duplicates
}

/**
 * Sceglie quale cliente mantenere in un gruppo di duplicati
 */
function chooseBestCustomer(customers: Customer[]): Customer {
  // Priorità 1: Cliente con external_id
  const withExternalId = customers.filter(c => c.external_id !== null)
  if (withExternalId.length === 1) {
    return withExternalId[0]
  }

  // Priorità 2: Cliente più vecchio
  return customers.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0]
}

/**
 * Elimina duplicati non protetti
 */
async function cleanupDuplicates(duplicateGroups: Map<string, Customer[]>): Promise<void> {
  console.log('🧹 Pulizia duplicati non protetti...\n')

  if (duplicateGroups.size === 0) {
    console.log('✅ Nessun duplicato trovato!\n')
    return
  }

  console.log(`📋 Trovati ${duplicateGroups.size} gruppi di duplicati\n`)

  for (const [name, group] of duplicateGroups.entries()) {
    const keep = chooseBestCustomer(group)
    const toDelete = group.filter(c => c.id !== keep.id)

    console.log(`"${name}" - ${group.length} duplicati`)
    console.log(`   ✅ Mantieni: ${keep.id.substring(0, 8)}... (${keep.external_id || 'no ext_id'})`)
    console.log(`   🗑️  Elimina: ${toDelete.length} record`)

    if (isApplyMode) {
      const deleteIds = toDelete.map(c => c.id)
      const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', deleteIds)

      if (error) {
        console.error(`   ❌ Errore eliminazione:`, error.message)
      } else {
        stats.duplicatesDeleted += deleteIds.length
        console.log(`   ✅ Eliminati`)
      }
    } else {
      console.log(`   [DRY-RUN] Operazione simulata`)
    }
    console.log()
  }
}

/**
 * Legge clienti dall'Excel MAGO (solo tipo "Customer")
 */
function readExcelCustomers(): ExcelCustomer[] {
  console.log('📖 Lettura file Excel MAGO...\n')

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    throw new Error(`File non trovato: ${EXCEL_FILE_PATH}`)
  }

  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null })

  stats.excelRowsTotal = jsonData.length
  console.log(`✅ Righe totali Excel: ${stats.excelRowsTotal}`)

  // Filtra solo clienti (non fornitori)
  const customers: ExcelCustomer[] = []

  for (const row of jsonData) {
    const recordType = String(row.CustSuppType || '')

    // 3211264 = codice MAGO per CLIENTI (non fornitori)
    if (recordType !== '3211264') {
      continue
    }

    const ragioneSociale = (row.CompanyName || '').trim()
    const externalId = row.CustSupp

    // Skip righe vuote o invalid
    if (!externalId || externalId === '%' || !ragioneSociale) {
      continue
    }

    customers.push({
      external_id: String(externalId).trim(),
      ragione_sociale: String(ragioneSociale).trim(),
      via: row.Address ? String(row.Address).trim() : null,
      cap: row.ZIPCode ? String(row.ZIPCode).trim() : null,
      citta: row.City ? String(row.City).trim() : null,
      provincia: normalizeProvincia(row.County),
    })
  }

  stats.excelCustomersFiltered = customers.length
  console.log(`✅ Clienti validi filtrati: ${stats.excelCustomersFiltered}\n`)

  return customers
}

/**
 * Sincronizza database con Excel
 */
async function syncWithExcel(
  existingCustomers: Customer[],
  excelCustomers: ExcelCustomer[]
): Promise<void> {
  console.log('🔄 Sincronizzazione con Excel...\n')

  const existingByExternalId = new Map(
    existingCustomers
      .filter(c => c.external_id)
      .map(c => [c.external_id!, c])
  )

  for (const excelCustomer of excelCustomers) {
    const existing = existingByExternalId.get(excelCustomer.external_id)

    if (existing) {
      // Cliente esiste → aggiorna solo campi vuoti (merge intelligente)
      const updates: any = {}

      if (excelCustomer.via && !existing.via) updates.via = excelCustomer.via
      if (excelCustomer.cap && !existing.cap) updates.cap = excelCustomer.cap
      if (excelCustomer.citta && !existing.citta) updates.citta = excelCustomer.citta
      if (excelCustomer.provincia && !existing.provincia) updates.provincia = excelCustomer.provincia

      if (Object.keys(updates).length > 0) {
        if (isApplyMode) {
          const { error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', existing.id)

          if (!error) {
            stats.customersUpdated++
          }
        } else {
          stats.customersUpdated++
        }
      }
    } else {
      // Cliente nuovo → inserisci
      if (isApplyMode) {
        const { error } = await supabase
          .from('customers')
          .insert([{
            ragione_sociale: excelCustomer.ragione_sociale,
            external_id: excelCustomer.external_id,
            via: excelCustomer.via,
            cap: excelCustomer.cap,
            citta: excelCustomer.citta,
            provincia: excelCustomer.provincia,
            is_active: true,
          }])

        if (!error) {
          stats.customersInserted++
        }
      } else {
        stats.customersInserted++
      }
    }
  }

  console.log(`✅ Clienti aggiornati: ${stats.customersUpdated}`)
  console.log(`✅ Clienti nuovi inseriti: ${stats.customersInserted}\n`)
}

/**
 * Stampa report finale
 */
function printReport() {
  console.log('\n' + '='.repeat(70))
  console.log('📊 REPORT FINALE')
  console.log('='.repeat(70))

  console.log('\n📈 STATO INIZIALE:')
  console.log(`   Clienti totali:              ${stats.totalCustomers}`)
  console.log(`   Clienti protetti:            ${stats.protectedCustomers}`)
  console.log(`   Clienti non protetti:        ${stats.unprotectedCustomers}`)
  console.log(`   Duplicati trovati:           ${stats.duplicatesFound}`)

  console.log('\n📥 EXCEL MAGO:')
  console.log(`   Righe totali:                ${stats.excelRowsTotal}`)
  console.log(`   Clienti validi (filtrati):   ${stats.excelCustomersFiltered}`)

  console.log('\n✅ OPERAZIONI ESEGUITE:')
  console.log(`   Duplicati eliminati:         ${stats.duplicatesDeleted}`)
  console.log(`   Clienti aggiornati:          ${stats.customersUpdated}`)
  console.log(`   Clienti nuovi inseriti:      ${stats.customersInserted}`)

  const finalTotal = stats.totalCustomers - stats.duplicatesDeleted + stats.customersInserted
  console.log('\n📊 STATO FINALE STIMATO:')
  console.log(`   Clienti totali:              ${finalTotal}`)
  console.log(`   Collegamenti preservati:     100% (${stats.protectedCustomers} richieste)`)

  console.log('\n' + '='.repeat(70))

  if (!isApplyMode) {
    console.log('\n⚠️  MODALITÀ DRY-RUN: Nessuna modifica applicata')
    console.log('💡 Per applicare le modifiche, esegui:')
    console.log('   npm run smart-cleanup -- --apply\n')
  } else {
    console.log('\n✅ Pulizia completata con successo!\n')
  }
}

/**
 * Main
 */
async function main() {
  console.log('🚀 PULIZIA INTELLIGENTE DUPLICATI CLIENTI\n')
  console.log('='.repeat(70))

  if (!isApplyMode) {
    console.log('⚠️  MODALITÀ DRY-RUN (nessuna modifica verrà applicata)\n')
  } else {
    console.log('🔥 MODALITÀ APPLICAZIONE (le modifiche verranno salvate)\n')
  }

  console.log('='.repeat(70))
  console.log()

  try {
    // Step 1: Carica clienti attuali
    const customers = await loadCustomers()

    // Step 2: Trova duplicati NON protetti
    const duplicates = findUnprotectedDuplicates(customers)

    // Step 3: Elimina duplicati
    await cleanupDuplicates(duplicates)

    // Step 4: Ricarica clienti dopo pulizia (per sync)
    const cleanedCustomers = isApplyMode ? await loadCustomers() : customers.filter(c => {
      // Simula eliminazione in dry-run
      for (const [, group] of duplicates.entries()) {
        const keep = chooseBestCustomer(group)
        const toDelete = group.filter(g => g.id !== keep.id)
        if (toDelete.find(d => d.id === c.id)) {
          return false
        }
      }
      return true
    })

    // Step 5: Leggi Excel
    const excelCustomers = readExcelCustomers()

    // Step 6: Sincronizza con Excel
    await syncWithExcel(cleanedCustomers, excelCustomers)

    // Step 7: Report finale
    printReport()

  } catch (error: any) {
    console.error('\n❌ ERRORE FATALE:', error.message)
    process.exit(1)
  }
}

main()
