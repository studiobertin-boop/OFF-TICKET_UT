#!/usr/bin/env tsx

/**
 * Script di Importazione Dati Clienti da Excel
 *
 * Funzionalità:
 * - Legge file Excel con dati completi clienti
 * - Match clienti esistenti per DENOMINAZIONE (fuzzy matching con similarity)
 * - UPDATE solo campi NULL/mancanti (non sovrascrive dati esistenti)
 * - Opzionale: creazione nuovi clienti per righe senza match (--create-new)
 * - Dry-run mode per preview modifiche
 * - Report dettagliato: matched, updated, created, skipped, errors
 *
 * Utilizzo:
 *   npm run import-customers                   # Esegue importazione (solo update)
 *   npm run import-customers:dry-run           # Preview senza modifiche
 *   npm run import-customers:create            # Update + creazione nuovi clienti
 *   npm run import-customers:create:dry-run    # Preview con creazione
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'
import { config } from 'dotenv'

// Load environment variables
config({ path: path.join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variabili ambiente non configurate')
  console.error('Assicurati che .env.local contenga:')
  console.error('  - VITE_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const EXCEL_FILE_PATH = path.join(process.cwd(), 'DOCUMENTAZIONE', 'DatiClienti.xlsx')
const isDryRun = process.argv.includes('--dry-run')
const createNew = process.argv.includes('--create-new') // Flag per creare nuovi clienti

interface ExcelRow {
  IDENTIFICATIVO?: string
  'DENOMINAZIONE DITTA'?: string
  INDIRIZZO?: string
  'NUMERO CIVICO'?: string
  CAP?: string
  COMUNE?: string
  PROVINCIA?: string
  TELEFONO?: string
  'DESCRIZIONE ATTIVITA'?: string
  PEC?: string
}

interface Customer {
  id: string
  ragione_sociale: string
  identificativo?: string | null
  via?: string | null
  numero_civico?: string | null
  cap?: string | null
  comune?: string | null
  provincia?: string | null
  telefono?: string | null
  pec?: string | null
  descrizione_attivita?: string | null
}

interface ImportStats {
  totalRows: number
  matched: number
  updated: number
  created: number
  skipped: number
  skippedNoMatch: number
  skippedAlreadyComplete: number
  skippedMissingData: number
  errors: number
}

const stats: ImportStats = {
  totalRows: 0,
  matched: 0,
  updated: 0,
  created: 0,
  skipped: 0,
  skippedNoMatch: 0,
  skippedAlreadyComplete: 0,
  skippedMissingData: 0,
  errors: 0,
}

/**
 * Fuzzy matching con similarity usando funzione database
 */
async function findMatchingCustomer(ragioneSociale: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .rpc('find_duplicate_customers', {
      customer_name: ragioneSociale,
      threshold: 0.7, // 70% similarity
    })

  if (error) {
    console.error('Error in fuzzy matching:', error)
    return null
  }

  if (data && data.length > 0) {
    // Return best match (highest similarity)
    return data[0] as Customer
  }

  return null
}

/**
 * Converte un valore Excel (numerico "90" o legacy "CLI-0090") nel codice cliente
 * canonico: sole cifre, senza over-padding, minimo 3 cifre (es. "090", "521", "1000").
 * Restituisce '' se non contiene cifre valide.
 */
function toNumericCode(raw: string): string {
  const digits = raw.trim().replace(/^CLI-/i, '').replace(/\D/g, '').replace(/^0+/, '')
  return digits ? digits.padStart(3, '0') : ''
}

/**
 * Determina quali campi aggiornare (solo NULL/vuoti)
 */
function getFieldsToUpdate(customer: Customer, excelRow: ExcelRow): Partial<Customer> {
  const updates: Partial<Customer> = {}

  // Helper per verificare se campo è vuoto
  const isEmpty = (value: any) => !value || (typeof value === 'string' && value.trim() === '')

  // Identificativo - codice cliente numerico canonico (zero-pad min 3 cifre)
  if (isEmpty(customer.identificativo) && excelRow.IDENTIFICATIVO) {
    const code = toNumericCode(String(excelRow.IDENTIFICATIVO))
    if (code) {
      updates.identificativo = code
    }
    // Altrimenti ignora (formato non valido)
  }

  // Telefono
  if (isEmpty(customer.telefono) && excelRow.TELEFONO) {
    updates.telefono = excelRow.TELEFONO.trim()
  }

  // PEC
  if (isEmpty(customer.pec) && excelRow.PEC) {
    updates.pec = excelRow.PEC.toLowerCase().trim()
  }

  // Descrizione Attività
  if (isEmpty(customer.descrizione_attivita) && excelRow['DESCRIZIONE ATTIVITA']) {
    updates.descrizione_attivita = excelRow['DESCRIZIONE ATTIVITA'].trim()
  }

  // Via
  if (isEmpty(customer.via) && excelRow.INDIRIZZO) {
    updates.via = excelRow.INDIRIZZO.trim()
  }

  // Numero Civico
  if (isEmpty(customer.numero_civico) && excelRow['NUMERO CIVICO']) {
    updates.numero_civico = String(excelRow['NUMERO CIVICO']).trim()
  }

  // CAP
  if (isEmpty(customer.cap) && excelRow.CAP) {
    updates.cap = String(excelRow.CAP).trim().padStart(5, '0') // Ensure 5 digits
  }

  // Comune
  if (isEmpty(customer.comune) && excelRow.COMUNE) {
    updates.comune = excelRow.COMUNE.trim()
  }

  // Provincia
  if (isEmpty(customer.provincia) && excelRow.PROVINCIA) {
    updates.provincia = excelRow.PROVINCIA.toUpperCase().trim()
  }

  return updates
}

/**
 * Crea un nuovo cliente da riga Excel
 */
function createCustomerFromExcel(excelRow: ExcelRow): Omit<Customer, 'id'> | null {
  const denominazione = excelRow['DENOMINAZIONE DITTA']?.trim()

  // Validazione campi obbligatori
  if (!denominazione) {
    return null
  }

  // Prepara identificativo (codice cliente numerico canonico)
  const identificativo: string | null = excelRow.IDENTIFICATIVO
    ? toNumericCode(String(excelRow.IDENTIFICATIVO)) || null
    : null

  return {
    ragione_sociale: denominazione,
    identificativo,
    via: excelRow.INDIRIZZO?.trim() || null,
    numero_civico: excelRow['NUMERO CIVICO'] ? String(excelRow['NUMERO CIVICO']).trim() : null,
    cap: excelRow.CAP ? String(excelRow.CAP).trim().padStart(5, '0') : null,
    comune: excelRow.COMUNE?.trim() || null,
    provincia: excelRow.PROVINCIA?.toUpperCase().trim() || null,
    telefono: excelRow.TELEFONO?.trim() || null,
    pec: excelRow.PEC?.toLowerCase().trim() || null,
    descrizione_attivita: excelRow['DESCRIZIONE ATTIVITA']?.trim() || null,
  }
}

/**
 * Processo principale
 */
async function importCustomerData() {
  console.log('\n🚀 Avvio Importazione Dati Clienti\n')
  console.log(`📁 File: ${EXCEL_FILE_PATH}`)
  console.log(`🔍 Modalità: ${isDryRun ? 'DRY-RUN (anteprima)' : 'ESECUZIONE REALE'}`)
  console.log(`🆕 Crea nuovi: ${createNew ? 'SÌ' : 'NO (solo update)'}\n`)

  // Verifica esistenza file
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    console.error(`❌ File non trovato: ${EXCEL_FILE_PATH}`)
    console.error('\nCrea il file Excel nella cartella DOCUMENTAZIONE con le seguenti colonne:')
    console.error('IDENTIFICATIVO | DENOMINAZIONE DITTA | INDIRIZZO | NUMERO CIVICO | CAP | COMUNE | PROVINCIA | TELEFONO | DESCRIZIONE ATTIVITA | PEC')
    process.exit(1)
  }

  // Leggi Excel
  console.log('📖 Lettura file Excel...')
  const workbook = XLSX.readFile(EXCEL_FILE_PATH)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

  stats.totalRows = data.length
  console.log(`📊 Totale righe Excel: ${stats.totalRows}\n`)

  if (stats.totalRows === 0) {
    console.error('❌ Il file Excel è vuoto')
    process.exit(1)
  }

  // Processa ogni riga
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const denominazione = row['DENOMINAZIONE DITTA']

    if (!denominazione || denominazione.trim() === '') {
      console.log(`⏭️  Riga ${i + 1}: Saltata (denominazione vuota)`)
      stats.skipped++
      continue
    }

    console.log(`\n📋 Riga ${i + 1}/${stats.totalRows}: ${denominazione}`)

    try {
      // 1. Trova cliente corrispondente
      const matchedCustomer = await findMatchingCustomer(denominazione)

      if (!matchedCustomer) {
        console.log(`   ⚠️  Nessun match trovato - cliente non esiste nel DB`)

        // Se flag --create-new è attivo, crea nuovo cliente
        if (createNew) {
          console.log(`   🆕 Tentativo creazione nuovo cliente...`)

          const newCustomer = createCustomerFromExcel(row)

          if (!newCustomer) {
            console.log(`   ❌ Impossibile creare cliente - dati mancanti`)
            stats.skipped++
            stats.skippedMissingData++
            continue
          }

          // Esegui INSERT (se non dry-run)
          if (!isDryRun) {
            const { error } = await supabase
              .from('customers')
              .insert(newCustomer)

            if (error) {
              console.error(`   ❌ Errore creazione:`, error.message)
              stats.errors++
              continue
            }

            console.log(`   ✅ Nuovo cliente creato con successo`)
            stats.created++
          } else {
            console.log(`   📋 [DRY-RUN] Preview creazione nuovo cliente:`)
            Object.entries(newCustomer).forEach(([key, value]) => {
              if (value !== null) {
                console.log(`      - ${key}: "${value}"`)
              }
            })
            stats.created++
          }
        } else {
          stats.skipped++
          stats.skippedNoMatch++
        }

        continue
      }

      stats.matched++
      console.log(`   ✅ Match trovato: ${matchedCustomer.ragione_sociale} (ID: ${matchedCustomer.id})`)

      // 2. Determina campi da aggiornare
      const updates = getFieldsToUpdate(matchedCustomer, row)

      if (Object.keys(updates).length === 0) {
        console.log(`   ℹ️  Nessun campo da aggiornare (tutti già popolati)`)
        stats.skipped++
        stats.skippedAlreadyComplete++
        continue
      }

      console.log(`   🔄 Campi da aggiornare: ${Object.keys(updates).join(', ')}`)

      // 3. Esegui UPDATE (se non dry-run)
      if (!isDryRun) {
        const { error } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', matchedCustomer.id)

        if (error) {
          console.error(`   ❌ Errore update:`, error.message)
          stats.errors++
          continue
        }

        console.log(`   ✅ Cliente aggiornato con successo`)
        stats.updated++
      } else {
        console.log(`   📋 [DRY-RUN] Preview update:`)
        Object.entries(updates).forEach(([key, value]) => {
          console.log(`      - ${key}: "${value}"`)
        })
        stats.updated++
      }

    } catch (error: any) {
      console.error(`   ❌ Errore:`, error.message)
      stats.errors++
    }
  }

  // Report finale
  console.log('\n' + '='.repeat(60))
  console.log('📊 REPORT FINALE')
  console.log('='.repeat(60))
  console.log(`Totale righe processate: ${stats.totalRows}`)
  console.log(`✅ Match trovati:         ${stats.matched}`)
  console.log(`🔄 Clienti aggiornati:    ${stats.updated}`)
  console.log(`🆕 Clienti creati:        ${stats.created}`)
  console.log(`⏭️  Righe saltate:         ${stats.skipped}`)
  console.log(`   - Nessun match:        ${stats.skippedNoMatch}`)
  console.log(`   - Già completi:        ${stats.skippedAlreadyComplete}`)
  console.log(`   - Dati mancanti:       ${stats.skippedMissingData}`)
  console.log(`❌ Errori:                ${stats.errors}`)
  console.log('='.repeat(60) + '\n')

  if (isDryRun) {
    console.log('💡 Questo era un DRY-RUN. Per eseguire realmente, usa: npm run import-customers\n')
  } else {
    console.log('✅ Importazione completata!\n')
  }
}

// Esegui
importCustomerData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error)
    process.exit(1)
  })
