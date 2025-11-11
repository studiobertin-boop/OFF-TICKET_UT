/**
 * Script di importazione CSV DM329 → Supabase
 *
 * Importa le richieste DM329 dal file CSV Excel fornito:
 * - Trasforma i dati dal formato CSV al formato database
 * - Crea i record delle richieste
 * - Genera lo storico delle transizioni di stato
 *
 * Usage: npx tsx scripts/import-dm329-csv.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ========================================
// CONFIGURATION
// ========================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tgvznzpgbkjqmwfflqtr.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const CSV_FILE_PATH = path.join(__dirname, '..', 'DOCUMENTAZIONE', 'DASHBOARD_10-11-25.csv')
const DRY_RUN = process.argv.includes('--dry-run')
const ADMIN_USER_EMAIL = 'admin@studiobertin.it' // Email dell'utente admin per created_by

// ========================================
// TYPES
// ========================================

interface CSVRow {
  CLIENTE: string
  STATO: string
  '1 - INCARICO RICEVUTO': string
  '2- SCHEDA DATI PRONTA': string
  '3 - MAIL CLIENTE INVIATA': string
  '4 - DOCUMENTI PRONTI': string
  '5 - ATTESA FIRMA': string
  '6 -  PRONTA PER CIVA': string
  '7 - CHIUSA': string
  NOTE: string
  'OFF / CAC': string
}

interface WorkflowDates {
  '1-INCARICO_RICEVUTO': string | null
  '2-SCHEDA_DATI_PRONTA': string | null
  '3-MAIL_CLIENTE_INVIATA': string | null
  '4-DOCUMENTI_PRONTI': string | null
  '5-ATTESA_FIRMA': string | null
  '6-PRONTA_PER_CIVA': string | null
  '7-CHIUSA': string | null
}

interface TransformedRequest {
  request_type_id: string
  title: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  custom_fields: {
    cliente: string
    indirizzo_immobile: string
    tipologia_intervento: string
    superficie: string
    note: string
    off_cac: string
    workflow_dates: WorkflowDates
    assignment_category: string
    original_csv_row: number
  }
}

interface HistoryRecord {
  request_id: string
  status_from: string | null
  status_to: string
  changed_by: string
  created_at: string
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Parse CSV date (DD/MM/YYYY) to ISO 8601 timestamp
 */
function parseCSVDate(csvDate: string): string | null {
  if (!csvDate || csvDate.trim() === '') return null

  try {
    const [day, month, year] = csvDate.trim().split('/')
    if (!day || !month || !year) return null

    // Create ISO 8601 timestamp (midnight UTC)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`
  } catch (error) {
    console.warn(`⚠️  Invalid date format: "${csvDate}"`)
    return null
  }
}

/**
 * Map CSV status to database enum value
 */
function mapCSVStatusToDBStatus(csvStatus: string): string {
  const statusMap: Record<string, string> = {
    '1 - INCARICO RICEVUTO': '1-INCARICO_RICEVUTO',
    '2- SCHEDA DATI PRONTA': '2-SCHEDA_DATI_PRONTA',
    '2 - SCHEDA DATI PRONTA': '2-SCHEDA_DATI_PRONTA',
    '3 - MAIL CLIENTE INVIATA': '3-MAIL_CLIENTE_INVIATA',
    '4 - DOCUMENTI PRONTI': '4-DOCUMENTI_PRONTI',
    '5 - ATTESA FIRMA': '5-ATTESA_FIRMA',
    '6 - PRONTA PER CIVA': '6-PRONTA_PER_CIVA',
    '6 -  PRONTA PER CIVA': '6-PRONTA_PER_CIVA',
    '7 - CHIUSA': '7-CHIUSA',
    'SOSPESA': 'ARCHIVIATA NON FINITA'
  }

  const normalized = csvStatus.trim()
  return statusMap[normalized] || '1-INCARICO_RICEVUTO'
}

/**
 * Clean client name: remove (x2), (x3), etc.
 */
function cleanClienteName(cliente: string): string {
  return cliente
    .replace(/\s*\(x\d+\)\s*/gi, '') // Remove (x2), (x3), etc.
    .replace(/\s*\*+\s*/g, ' ')      // Remove asterisks
    .replace(/\s*\/\/\s*/g, ' ')     // Remove double slashes
    .trim()
}

/**
 * Generate title from client name
 */
function generateTitle(cliente: string): string {
  const cleanName = cleanClienteName(cliente)
  return `DM329 - ${cleanName}`
}

/**
 * Map OFF/CAC to database value
 */
function mapOffCac(offCac: string): string {
  const normalized = offCac.trim().toUpperCase()
  if (normalized === 'OFFICOMP') return 'off'
  if (normalized === 'CAC') return 'cac'
  return ''
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse header
  const header = lines[0].split(';').map(h => h.trim())

  // Parse rows
  const rows: CSVRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';')

    // Skip empty rows
    if (values.length < header.length || !values[0].trim()) continue

    const row: any = {}
    header.forEach((key, index) => {
      row[key] = values[index]?.trim() || ''
    })

    rows.push(row as CSVRow)
  }

  return rows
}

/**
 * Transform CSV row to database request object
 */
function transformCSVRowToDBRow(
  row: CSVRow,
  rowIndex: number,
  dm329TypeId: string,
  adminUserId: string
): TransformedRequest {
  // Parse all workflow dates
  const workflowDates: WorkflowDates = {
    '1-INCARICO_RICEVUTO': parseCSVDate(row['1 - INCARICO RICEVUTO']),
    '2-SCHEDA_DATI_PRONTA': parseCSVDate(row['2- SCHEDA DATI PRONTA']),
    '3-MAIL_CLIENTE_INVIATA': parseCSVDate(row['3 - MAIL CLIENTE INVIATA']),
    '4-DOCUMENTI_PRONTI': parseCSVDate(row['4 - DOCUMENTI PRONTI']),
    '5-ATTESA_FIRMA': parseCSVDate(row['5 - ATTESA FIRMA']),
    '6-PRONTA_PER_CIVA': parseCSVDate(row['6 -  PRONTA PER CIVA']),
    '7-CHIUSA': parseCSVDate(row['7 - CHIUSA'])
  }

  // Get earliest and latest dates for created_at/updated_at
  const dates = Object.values(workflowDates)
    .filter((d): d is string => d !== null)
    .sort()

  const created_at = dates.length > 0 ? dates[0] : new Date().toISOString()
  const updated_at = dates.length > 0 ? dates[dates.length - 1] : created_at

  return {
    request_type_id: dm329TypeId,
    title: generateTitle(row.CLIENTE),
    status: mapCSVStatusToDBStatus(row.STATO),
    created_by: adminUserId,
    created_at,
    updated_at,
    custom_fields: {
      cliente: cleanClienteName(row.CLIENTE),
      indirizzo_immobile: '',
      tipologia_intervento: 'Nuova Costruzione',
      superficie: '',
      note: row.NOTE?.trim() || '',
      off_cac: mapOffCac(row['OFF / CAC']),
      workflow_dates: workflowDates,
      assignment_category: row['OFF / CAC']?.trim() || '',
      original_csv_row: rowIndex + 2 // +2 because of header and 0-index
    }
  }
}

/**
 * Generate history records for a request based on workflow dates
 */
function generateHistoryRecords(
  requestId: string,
  workflowDates: WorkflowDates,
  adminUserId: string
): HistoryRecord[] {
  const history: HistoryRecord[] = []

  // Order of workflow states
  const stateOrder: (keyof WorkflowDates)[] = [
    '1-INCARICO_RICEVUTO',
    '2-SCHEDA_DATI_PRONTA',
    '3-MAIL_CLIENTE_INVIATA',
    '4-DOCUMENTI_PRONTI',
    '5-ATTESA_FIRMA',
    '6-PRONTA_PER_CIVA',
    '7-CHIUSA'
  ]

  let previousStatus: string | null = null

  for (const status of stateOrder) {
    const date = workflowDates[status]

    if (date) {
      history.push({
        request_id: requestId,
        status_from: previousStatus,
        status_to: status,
        changed_by: adminUserId,
        created_at: date
      })
      previousStatus = status
    }
  }

  return history
}

// ========================================
// MAIN IMPORT FUNCTION
// ========================================

async function importDM329CSV() {
  console.log('🚀 DM329 CSV Import Script')
  console.log('=' .repeat(60))
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✅ LIVE IMPORT'}`)
  console.log(`CSV File: ${CSV_FILE_PATH}`)
  console.log('=' .repeat(60))
  console.log()

  // Check if CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found: ${CSV_FILE_PATH}`)
  }

  // Initialize Supabase client
  if (!DRY_RUN && !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for live import')
  }

  // Use dummy key for dry run
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY || 'dummy-key-for-dry-run'
  )

  // Step 1: Schema ready (off_cac is in custom_fields JSONB)
  console.log('📋 Step 1: Schema ready...')
  console.log('✅ off_cac will be saved in custom_fields JSONB')

  // Step 2: Get DM329 request type ID
  console.log('\n📋 Step 2: Getting DM329 request type...')

  let dm329TypeId: string
  let adminUserId: string

  if (DRY_RUN) {
    // Use dummy IDs for dry run
    dm329TypeId = '00000000-0000-0000-0000-000000000001'
    adminUserId = '00000000-0000-0000-0000-000000000002'
    console.log(`🔍 Dry run: Using dummy DM329 type ID: ${dm329TypeId}`)
    console.log(`🔍 Dry run: Using dummy admin user ID: ${adminUserId}`)
  } else {
    const { data: dm329Type, error: typeError } = await supabase
      .from('request_types')
      .select('id')
      .eq('name', 'DM329')
      .single()

    if (typeError || !dm329Type) {
      throw new Error('DM329 request type not found in database')
    }

    dm329TypeId = dm329Type.id
    console.log(`✅ DM329 type ID: ${dm329TypeId}`)

    // Get admin user ID
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', ADMIN_USER_EMAIL)
      .single()

    if (userError || !adminUser) {
      throw new Error(`Admin user not found: ${ADMIN_USER_EMAIL}`)
    }

    adminUserId = adminUser.id
    console.log(`✅ Admin user ID: ${adminUserId}`)
  }

  // Step 3: Admin user ready
  console.log('\n📋 Step 3: Admin user ready...')

  // Step 4: Parse CSV file
  console.log('\n📋 Step 4: Parsing CSV file...')

  const csvRows = parseCSV(CSV_FILE_PATH)
  console.log(`✅ Parsed ${csvRows.length} rows from CSV`)

  // Step 5: Transform data
  console.log('\n📋 Step 5: Transforming data...')

  const transformedRequests = csvRows.map((row, index) =>
    transformCSVRowToDBRow(row, index, dm329TypeId, adminUserId)
  )

  console.log(`✅ Transformed ${transformedRequests.length} requests`)

  // Step 6: Display sample data
  console.log('\n📋 Sample transformed request:')
  console.log(JSON.stringify(transformedRequests[0], null, 2))

  // Step 7: Import requests
  console.log(`\n📋 Step 7: ${DRY_RUN ? 'Simulating' : 'Importing'} requests...`)

  let successCount = 0
  let errorCount = 0
  const allHistory: HistoryRecord[] = []

  if (DRY_RUN) {
    console.log(`🔍 Dry run: Would import ${transformedRequests.length} requests`)

    // Count potential history records
    for (const request of transformedRequests) {
      const historyRecords = generateHistoryRecords(
        'dummy-id',
        request.custom_fields.workflow_dates,
        adminUserId
      )
      allHistory.push(...historyRecords)
    }

    successCount = transformedRequests.length
  } else {
    // Insert requests in batches
    const BATCH_SIZE = 50

    for (let i = 0; i < transformedRequests.length; i += BATCH_SIZE) {
      const batch = transformedRequests.slice(i, i + BATCH_SIZE)

      const { data: insertedRequests, error: insertError } = await supabase
        .from('requests')
        .insert(batch)
        .select('id, custom_fields')

      if (insertError) {
        console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError)
        errorCount += batch.length
        continue
      }

      successCount += batch.length
      console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} requests)`)

      // Generate history records for inserted requests
      if (insertedRequests) {
        for (const request of insertedRequests) {
          const workflowDates = request.custom_fields.workflow_dates as WorkflowDates
          const historyRecords = generateHistoryRecords(
            request.id,
            workflowDates,
            adminUserId
          )
          allHistory.push(...historyRecords)
        }
      }
    }
  }

  console.log(`\n✅ Requests import complete: ${successCount} success, ${errorCount} errors`)

  // Step 8: Import history records
  console.log(`\n📋 Step 8: ${DRY_RUN ? 'Simulating' : 'Importing'} history records...`)
  console.log(`Total history records to import: ${allHistory.length}`)

  if (DRY_RUN) {
    console.log(`🔍 Dry run: Would import ${allHistory.length} history records`)
  } else {
    // Insert history records in batches
    const HISTORY_BATCH_SIZE = 100
    let historySuccessCount = 0
    let historyErrorCount = 0

    for (let i = 0; i < allHistory.length; i += HISTORY_BATCH_SIZE) {
      const batch = allHistory.slice(i, i + HISTORY_BATCH_SIZE)

      const { error: historyError } = await supabase
        .from('request_history')
        .insert(batch)

      if (historyError) {
        console.error(`❌ Error inserting history batch ${i / HISTORY_BATCH_SIZE + 1}:`, historyError)
        historyErrorCount += batch.length
        continue
      }

      historySuccessCount += batch.length
      console.log(`✅ Inserted history batch ${i / HISTORY_BATCH_SIZE + 1} (${batch.length} records)`)
    }

    console.log(`\n✅ History import complete: ${historySuccessCount} success, ${historyErrorCount} errors`)
  }

  // Step 9: Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 IMPORT SUMMARY')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✅ LIVE IMPORT'}`)
  console.log(`CSV Rows Parsed: ${csvRows.length}`)
  console.log(`Requests Imported: ${successCount}`)
  console.log(`History Records Imported: ${allHistory.length}`)
  console.log(`Errors: ${errorCount}`)
  console.log('='.repeat(60))
  console.log()

  if (DRY_RUN) {
    console.log('💡 Run without --dry-run flag to perform actual import')
  } else {
    console.log('✅ Import complete!')
  }
}

// ========================================
// EXECUTE
// ========================================

importDM329CSV()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
