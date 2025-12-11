/**
 * Script per importare dati costruttori da ListaCostruttori.xlsx
 *
 * Funzionalità:
 * - Legge Excel con dati costruttori
 * - Normalizza dati (P.IVA, CAP, provincia, telefono)
 * - Fa UPDATE sui costruttori esistenti nel DB (match per nome)
 * - Crea nuovi costruttori se non esistono
 * - Gestisce costruttori italiani ed esteri
 *
 * Uso: npx tsx scripts/import-manufacturers-data.ts [--dry-run]
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Carica variabili d'ambiente da .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Configurazione Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Errore: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere definiti in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Modalità dry-run (non salva nel DB)
const isDryRun = process.argv.includes('--dry-run')

interface ExcelRow {
  MARCA: string
  'Nazionalità': string
  'P.IVA': string | number
  'C.F.': string | number
  Indirizzo: string
  civico: string | number
  CAP: string | number
  Comune: string
  Provincia: string
  Telefono: string | number
}

interface ManufacturerData {
  nome: string
  is_estero: boolean
  // Italian fields
  partita_iva?: string
  telefono?: string
  via?: string
  numero_civico?: string
  cap?: string
  comune?: string
  provincia?: string
  // Foreign field
  paese?: string
}

/**
 * Normalizza Partita IVA: rimuove spazi, lascia solo cifre
 */
function normalizePartitaIva(piva: string | number | undefined): string | undefined {
  if (!piva) return undefined
  const cleaned = String(piva).replace(/\s/g, '').replace(/\D/g, '')
  return cleaned.length === 11 ? cleaned : undefined
}

/**
 * Normalizza CAP: assicura 5 cifre con padding
 */
function normalizeCap(cap: string | number | undefined): string | undefined {
  if (!cap) return undefined
  const cleaned = String(cap).replace(/\D/g, '')
  return cleaned.padStart(5, '0')
}

/**
 * Normalizza provincia: uppercase, 2 caratteri
 */
function normalizeProvincia(prov: string | undefined): string | undefined {
  if (!prov) return undefined
  return String(prov).toUpperCase().trim().substring(0, 2)
}

/**
 * Normalizza telefono: rimuove spazi, assicura prefisso +39
 */
function normalizeTelefono(tel: string | number | undefined): string | undefined {
  if (!tel) return undefined
  let cleaned = String(tel).replace(/[\s\-\(\)]/g, '')

  if (cleaned.startsWith('+39')) return cleaned
  if (cleaned.startsWith('0039')) return '+39' + cleaned.slice(4)
  return '+39' + cleaned
}

/**
 * Normalizza numero civico
 */
function normalizeNumeroCivico(civico: string | number | undefined): string | undefined {
  if (!civico) return undefined
  return String(civico).trim()
}

/**
 * Normalizza nome marca: trim e uppercase prima lettera di ogni parola
 */
function normalizeMarca(marca: string): string {
  return marca.trim()
}

/**
 * Determina se il costruttore è estero dalla nazionalità
 */
function isEstero(nazionalita: string | undefined): boolean {
  if (!nazionalita) return false
  const naz = nazionalita.toUpperCase().trim()
  return naz !== 'ITALIANA' && naz !== 'ITALIA'
}

/**
 * Estrae paese dalla nazionalità
 */
function getPaese(nazionalita: string | undefined): string | undefined {
  if (!nazionalita) return undefined
  const naz = nazionalita.trim()
  if (naz.toUpperCase() === 'ITALIANA' || naz.toUpperCase() === 'ITALIA') {
    return undefined
  }
  return naz
}

/**
 * Converte riga Excel in ManufacturerData
 */
function excelRowToManufacturerData(row: ExcelRow): ManufacturerData {
  const estero = isEstero(row['Nazionalità'])

  const data: ManufacturerData = {
    nome: normalizeMarca(row.MARCA),
    is_estero: estero,
  }

  if (estero) {
    // Costruttore estero: solo paese
    data.paese = getPaese(row['Nazionalità']) || 'Non specificato'
  } else {
    // Costruttore italiano: tutti i campi
    data.partita_iva = normalizePartitaIva(row['P.IVA'])
    data.telefono = normalizeTelefono(row.Telefono)
    data.via = row.Indirizzo?.trim()
    data.numero_civico = normalizeNumeroCivico(row.civico)
    data.cap = normalizeCap(row.CAP)
    data.comune = row.Comune?.trim()
    data.provincia = normalizeProvincia(row.Provincia)
  }

  return data
}

/**
 * Verifica se i dati sono completi
 */
function isDataComplete(data: ManufacturerData): boolean {
  if (data.is_estero) {
    return !!data.paese
  } else {
    return !!(
      data.partita_iva &&
      data.telefono &&
      data.via &&
      data.numero_civico &&
      data.cap &&
      data.comune &&
      data.provincia
    )
  }
}

/**
 * Main
 */
async function main() {
  console.log('📊 Import Dati Costruttori da Excel\n')
  console.log(`Modalità: ${isDryRun ? '🔍 DRY RUN (nessuna modifica al DB)' : '💾 SCRITTURA REALE'}\n`)

  // Leggi Excel
  const filePath = path.join(__dirname, '..', 'DOCUMENTAZIONE', 'ListaCostruttori.xlsx')
  console.log(`📁 Lettura file: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

  console.log(`✅ ${rows.length} costruttori trovati nel file Excel\n`)

  // Recupera tutti i costruttori esistenti dal DB
  console.log('🔍 Recupero costruttori esistenti dal database...')
  const { data: existingManufacturers, error: fetchError } = await supabase
    .from('manufacturers')
    .select('id, nome, is_estero')

  if (fetchError) {
    console.error('❌ Errore recupero costruttori:', fetchError)
    process.exit(1)
  }

  console.log(`✅ ${existingManufacturers?.length || 0} costruttori già presenti nel DB\n`)

  // Crea mappa nome -> id per match veloce
  const existingMap = new Map(
    existingManufacturers?.map(m => [m.nome.toLowerCase().trim(), m]) || []
  )

  // Statistiche
  let updated = 0
  let created = 0
  let skipped = 0
  let errors = 0

  console.log('🚀 Inizio elaborazione...\n')

  for (const row of rows) {
    try {
      const data = excelRowToManufacturerData(row)
      const existing = existingMap.get(data.nome.toLowerCase().trim())

      // Verifica completezza
      const complete = isDataComplete(data)

      if (existing) {
        // UPDATE costruttore esistente
        console.log(`🔄 UPDATE: ${data.nome}`)
        console.log(`   Tipo: ${data.is_estero ? 'Estero' : 'Italiano'}`)
        console.log(`   Completo: ${complete ? '✅' : '⚠️'}`)

        if (!isDryRun) {
          const { error: updateError } = await supabase
            .from('manufacturers')
            .update(data)
            .eq('id', existing.id)

          if (updateError) {
            console.error(`   ❌ Errore: ${updateError.message}`)
            errors++
          } else {
            console.log(`   ✅ Aggiornato con successo`)
            updated++
          }
        } else {
          console.log(`   🔍 Sarebbe stato aggiornato`)
          updated++
        }
      } else {
        // CREATE nuovo costruttore
        console.log(`➕ CREATE: ${data.nome}`)
        console.log(`   Tipo: ${data.is_estero ? 'Estero' : 'Italiano'}`)
        console.log(`   Completo: ${complete ? '✅' : '⚠️'}`)

        if (!isDryRun) {
          const { error: insertError } = await supabase
            .from('manufacturers')
            .insert({
              ...data,
              is_active: true,
              usage_count: 0,
            })

          if (insertError) {
            // Probabilmente già esiste con nome simile
            console.error(`   ❌ Errore: ${insertError.message}`)
            errors++
          } else {
            console.log(`   ✅ Creato con successo`)
            created++
          }
        } else {
          console.log(`   🔍 Sarebbe stato creato`)
          created++
        }
      }
    } catch (error) {
      console.error(`❌ Errore elaborazione riga "${row.MARCA}":`, error)
      errors++
    }

    console.log('') // Riga vuota tra costruttori
  }

  // Riepilogo finale
  console.log('\n' + '='.repeat(60))
  console.log('📊 RIEPILOGO IMPORT')
  console.log('='.repeat(60))
  console.log(`✅ Aggiornati: ${updated}`)
  console.log(`➕ Creati: ${created}`)
  console.log(`⏭️  Saltati: ${skipped}`)
  console.log(`❌ Errori: ${errors}`)
  console.log(`📦 Totale elaborati: ${rows.length}`)
  console.log('='.repeat(60))

  if (isDryRun) {
    console.log('\n🔍 DRY RUN completato - nessuna modifica effettuata al database')
    console.log('💡 Esegui senza --dry-run per applicare le modifiche')
  } else {
    console.log('\n✅ Import completato!')
  }
}

main().catch(console.error)
