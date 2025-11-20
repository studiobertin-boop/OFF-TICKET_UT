#!/usr/bin/env tsx

/**
 * Script di Sincronizzazione Clienti da Excel MAGO
 *
 * Questo script legge il file ClientiDaMAGO.xlsx e sincronizza i dati con la tabella customers di Supabase.
 *
 * Funzionalità:
 * - Legge il file Excel dalla directory DOCUMENTAZIONE
 * - Mappa le colonne Excel ai campi del database
 * - Inserisce nuovi clienti con external_id da MAGO
 * - Aggiorna clienti esistenti SOLO se i campi sono vuoti (merge intelligente)
 * - Gestisce duplicati per nome identico al 100%
 * - Mostra warning per clienti con nome simile senza external_id
 *
 * Utilizzo:
 *   npm run sync-customers
 *
 * Opzioni:
 *   --dry-run    Esegue senza modificare il database (solo report)
 *   --verbose    Mostra più dettagli durante l'esecuzione
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { config } from 'dotenv'

// Carica variabili d'ambiente da .env.local
config({ path: path.join(process.cwd(), '.env.local') })

// Configurazione Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Errore: Variabili ambiente VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono richieste')
  console.error('Assicurati di avere un file .env.local con queste variabili configurate')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Percorso file Excel
const EXCEL_FILE_PATH = path.join(process.cwd(), 'DOCUMENTAZIONE', 'ClientiDaMAGO.xlsx')

// Opzioni da linea di comando
const isDryRun = process.argv.includes('--dry-run')
const isVerbose = process.argv.includes('--verbose')

// Interfacce TypeScript
interface ExcelRow {
  CustSupp?: string
  ragione_sociale?: string
  Address?: string
  Zip?: string
  City?: string
  Country?: string // Contiene il codice provincia
}

interface Customer {
  id?: string
  ragione_sociale: string
  external_id?: string | null
  via?: string | null
  cap?: string | null
  citta?: string | null
  provincia?: string | null
  is_active: boolean
}

interface SyncStats {
  totalRows: number
  skippedEmpty: number
  inserted: number
  updated: number
  merged: number
  warnings: number
  errors: number
}

interface Warning {
  type: 'similar_name' | 'duplicate_external_id' | 'missing_data'
  message: string
  excelRow?: ExcelRow
  dbCustomer?: Customer
}

// Statistiche e warning
const stats: SyncStats = {
  totalRows: 0,
  skippedEmpty: 0,
  inserted: 0,
  updated: 0,
  merged: 0,
  warnings: 0,
  errors: 0,
}

const warnings: Warning[] = []

/**
 * Normalizza una stringa: trim, lowercase, rimuove spazi multipli
 */
function normalizeString(str: string | undefined | null): string {
  if (!str) return ''
  return str.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Normalizza codice provincia: uppercase, max 2 caratteri
 */
function normalizeProvincia(provincia: string | undefined | null): string | null {
  if (!provincia) return null
  const normalized = provincia.trim().toUpperCase().substring(0, 2)
  return normalized.length === 2 ? normalized : null
}

/**
 * Calcola la similarità tra due stringhe (0-1)
 * Usa algoritmo semplice basato su Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1)
  const s2 = normalizeString(str2)

  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length
  const maxLen = Math.max(len1, len2)

  if (maxLen === 0) return 1.0

  // Levenshtein distance
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  return 1 - distance / maxLen
}

/**
 * Legge il file Excel e restituisce le righe come array di oggetti
 */
function readExcelFile(): ExcelRow[] {
  console.log('📖 Lettura file Excel...')

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ File non trovato: ${EXCEL_FILE_PATH}`)
    process.exit(1)
  }

  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Converti il foglio in JSON
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null })

  console.log(`✅ File letto con successo: ${jsonData.length} righe trovate`)

  if (jsonData.length > 0) {
    const columns = Object.keys(jsonData[0])
    console.log('\n📋 Colonne rilevate nel file Excel:')
    console.log(columns.join(', '))

    if (isVerbose) {
      console.log('\n📄 Esempio prima riga:')
      console.log(JSON.stringify(jsonData[0], null, 2))
    }
  }

  return jsonData
}

/**
 * Mappa una riga Excel a un oggetto Customer
 */
function mapExcelRowToCustomer(row: any): Customer | null {
  // IMPORTANTE: Filtra solo i CLIENTI (non fornitori o altri)
  // La colonna CustSuppType indica il tipo di record
  // 3211264 = codice MAGO per CLIENTI
  const recordType = String(row.CustSuppType || '')

  // Skippa se non è un cliente
  if (recordType !== '3211264') {
    return null
  }

  // Mappa i nomi delle colonne reali del file Excel MAGO
  const ragioneSociale = (row.CompanyName || '').trim()
  const externalId = row.CustSupp
  const via = row.Address
  const cap = row.ZIPCode
  const citta = row.City
  const provincia = row.County // County contiene il codice provincia

  // Skip righe vuote o invalid
  if (!externalId || externalId === '%' || !ragioneSociale) {
    return null
  }

  const customer: Customer = {
    ragione_sociale: String(ragioneSociale).trim(),
    external_id: externalId ? String(externalId).trim() : null,
    via: via ? String(via).trim() : null,
    cap: cap ? String(cap).trim() : null,
    citta: citta ? String(citta).trim() : null,
    provincia: normalizeProvincia(provincia),
    is_active: true,
  }

  // Valida che almeno ragione_sociale sia presente
  if (!customer.ragione_sociale || customer.ragione_sociale.length === 0) {
    return null
  }

  return customer
}

/**
 * Trova un cliente nel database per external_id
 */
async function findCustomerByExternalId(externalId: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('external_id', externalId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error(`⚠️ Errore ricerca cliente per external_id ${externalId}:`, error.message)
    return null
  }

  return data
}

/**
 * Trova clienti nel database con nome simile (senza external_id)
 */
async function findSimilarCustomersWithoutExternalId(ragioneSociale: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .is('external_id', null)

  if (error) {
    console.error('⚠️ Errore ricerca clienti senza external_id:', error.message)
    return []
  }

  if (!data) return []

  // Filtra per similarità >= 80%
  const similar = data.filter(customer => {
    const similarity = calculateSimilarity(customer.ragione_sociale, ragioneSociale)
    return similarity >= 0.8
  })

  return similar
}

/**
 * Inserisce un nuovo cliente nel database
 */
async function insertCustomer(customer: Customer): Promise<boolean> {
  if (isDryRun) {
    console.log(`  [DRY-RUN] Inserirei nuovo cliente: ${customer.ragione_sociale} (${customer.external_id})`)
    return true
  }

  const { error } = await supabase
    .from('customers')
    .insert([customer])

  if (error) {
    console.error(`  ❌ Errore inserimento cliente ${customer.ragione_sociale}:`, error.message)
    stats.errors++
    return false
  }

  if (isVerbose) {
    console.log(`  ✅ Inserito: ${customer.ragione_sociale}`)
  }

  stats.inserted++
  return true
}

/**
 * Aggiorna un cliente esistente (merge intelligente: aggiorna solo campi vuoti)
 */
async function updateCustomer(existingCustomer: Customer, newData: Customer): Promise<boolean> {
  const updates: Partial<Customer> = {}

  // Merge intelligente: aggiorna solo se il campo esistente è null/undefined/empty
  if (newData.via && !existingCustomer.via) {
    updates.via = newData.via
  }

  if (newData.cap && !existingCustomer.cap) {
    updates.cap = newData.cap
  }

  if (newData.citta && !existingCustomer.citta) {
    updates.citta = newData.citta
  }

  if (newData.provincia && !existingCustomer.provincia) {
    updates.provincia = newData.provincia
  }

  // Se non c'è niente da aggiornare, skippa
  if (Object.keys(updates).length === 0) {
    if (isVerbose) {
      console.log(`  ⏭️ Nessun aggiornamento necessario per: ${existingCustomer.ragione_sociale}`)
    }
    return true
  }

  if (isDryRun) {
    console.log(`  [DRY-RUN] Aggiornerei cliente ${existingCustomer.ragione_sociale} con:`, updates)
    return true
  }

  const { error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', existingCustomer.id!)

  if (error) {
    console.error(`  ❌ Errore aggiornamento cliente ${existingCustomer.ragione_sociale}:`, error.message)
    stats.errors++
    return false
  }

  if (isVerbose) {
    console.log(`  ✅ Aggiornato: ${existingCustomer.ragione_sociale}`)
  }

  stats.updated++
  return true
}

/**
 * Merge automatico: assegna external_id a cliente senza external_id con nome identico 100%
 */
async function mergeCustomerWithExactMatch(existingCustomer: Customer, externalId: string, addressData: Partial<Customer>): Promise<boolean> {
  const updates: Partial<Customer> = {
    external_id: externalId,
    ...addressData,
  }

  if (isDryRun) {
    console.log(`  [DRY-RUN] Mergierei cliente ${existingCustomer.ragione_sociale} assegnando external_id ${externalId}`)
    return true
  }

  const { error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', existingCustomer.id!)

  if (error) {
    console.error(`  ❌ Errore merge cliente ${existingCustomer.ragione_sociale}:`, error.message)
    stats.errors++
    return false
  }

  console.log(`  🔗 Mergato: ${existingCustomer.ragione_sociale} → external_id: ${externalId}`)
  stats.merged++
  return true
}

/**
 * Processa una singola riga Excel
 */
async function processRow(row: any, index: number): Promise<void> {
  const customer = mapExcelRowToCustomer(row)

  if (!customer) {
    stats.skippedEmpty++
    return
  }

  // Caso 1: Cliente con external_id
  if (customer.external_id) {
    const existing = await findCustomerByExternalId(customer.external_id)

    if (existing) {
      // Cliente esiste → aggiorna solo campi vuoti
      await updateCustomer(existing, customer)
    } else {
      // Cliente nuovo → inserisci
      await insertCustomer(customer)
    }
    return
  }

  // Caso 2: Cliente SENZA external_id (solo da ragione_sociale)
  // Cerchiamo match esatti (100%) per merge automatico
  const similarCustomers = await findSimilarCustomersWithoutExternalId(customer.ragione_sociale)

  if (similarCustomers.length === 0) {
    // Nessun match simile → inserisci nuovo cliente (senza external_id)
    await insertCustomer(customer)
    return
  }

  // Cerca match esatto al 100%
  const exactMatch = similarCustomers.find(c =>
    normalizeString(c.ragione_sociale) === normalizeString(customer.ragione_sociale)
  )

  if (exactMatch) {
    // Match esatto al 100% → merge automatico
    console.log(`  🔍 Match esatto trovato per: ${customer.ragione_sociale}`)

    // Non abbiamo external_id da assegnare, facciamo solo merge indirizzi
    const addressData = {
      via: customer.via,
      cap: customer.cap,
      citta: customer.citta,
      provincia: customer.provincia,
    }

    await updateCustomer(exactMatch, { ...customer, id: exactMatch.id })
    return
  }

  // Match simile ma non esatto → warning
  warnings.push({
    type: 'similar_name',
    message: `Cliente simile trovato senza external_id: "${customer.ragione_sociale}" vs "${similarCustomers[0].ragione_sociale}"`,
    excelRow: row,
    dbCustomer: similarCustomers[0],
  })

  stats.warnings++

  // Inserisci comunque come nuovo cliente
  await insertCustomer(customer)
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Avvio sincronizzazione clienti da Excel MAGO\n')

  if (isDryRun) {
    console.log('⚠️ MODALITÀ DRY-RUN: nessuna modifica verrà salvata nel database\n')
  }

  // Leggi file Excel
  const rows = readExcelFile()

  // In dry-run, limita a 100 righe per test veloce
  const rowsToProcess = isDryRun ? rows.slice(0, 100) : rows
  stats.totalRows = rowsToProcess.length

  if (isDryRun && rows.length > 100) {
    console.log(`\n⚡ Modalità test veloce: elaboro solo le prime 100 righe su ${rows.length} totali\n`)
  }

  console.log('\n⚙️ Elaborazione righe...\n')

  // Processa ogni riga
  for (let i = 0; i < rowsToProcess.length; i++) {
    if (isVerbose || i % 50 === 0 || i === rowsToProcess.length - 1) {
      console.log(`📊 Progresso: ${i + 1}/${rowsToProcess.length}`)
    }

    await processRow(rowsToProcess[i], i)
  }

  // Stampa riepilogo
  console.log('\n' + '='.repeat(60))
  console.log('📈 RIEPILOGO SINCRONIZZAZIONE')
  console.log('='.repeat(60))
  console.log(`Righe totali:           ${stats.totalRows}`)
  console.log(`Righe vuote (skippate): ${stats.skippedEmpty}`)
  console.log(`Clienti inseriti:       ${stats.inserted}`)
  console.log(`Clienti aggiornati:     ${stats.updated}`)
  console.log(`Clienti mergati:        ${stats.merged}`)
  console.log(`Warning:                ${stats.warnings}`)
  console.log(`Errori:                 ${stats.errors}`)
  console.log('='.repeat(60))

  // Stampa warning
  if (warnings.length > 0) {
    console.log('\n⚠️ WARNING RILEVATI:')
    console.log('='.repeat(60))
    warnings.forEach((w, i) => {
      console.log(`\n${i + 1}. ${w.type.toUpperCase()}`)
      console.log(`   ${w.message}`)
      if (w.excelRow && isVerbose) {
        console.log(`   Excel: ${JSON.stringify(w.excelRow, null, 2)}`)
      }
    })
    console.log('\n' + '='.repeat(60))
  }

  if (isDryRun) {
    console.log('\n✅ DRY-RUN completato. Esegui senza --dry-run per applicare le modifiche.')
  } else {
    console.log('\n✅ Sincronizzazione completata!')
  }
}

// Esegui
main().catch(error => {
  console.error('\n❌ Errore fatale:', error)
  process.exit(1)
})
