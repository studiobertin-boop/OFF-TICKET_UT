/**
 * Script di importazione catalogo apparecchiature da Excel
 *
 * Legge il file "Lista Modelli.xlsx" e popola la tabella equipment_catalog
 * con tutte le associazioni TIPO → MARCA → MODELLO
 *
 * Usage: npx tsx scripts/import-equipment-catalog.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

// Supabase config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Errore: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere definiti')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Mappatura tipologie Excel → Form DM329
const TIPO_MAPPING: Record<string, string> = {
  'Serbatoio aria verticale': 'Serbatoi',
  'Serbatoio aria orizzontale': 'Serbatoi',
  'Serbatoio disoleatore': 'Disoleatori',
  'Compressore': 'Compressori',
  'Compressore con essiccatore integrato': 'Compressori',
  'Compressore alta pressione - Booster': 'Compressori',
  'Essiccatore frigorifero': 'Essiccatori',
  'Scambiatore di calore': 'Scambiatori',
  'Filtro': 'Filtri',
  'Separatore di condense': 'Separatori',
  'Valvola di sicurezza': 'Valvole di sicurezza'
}

interface EquipmentRow {
  tipo_excel: string
  tipo_apparecchiatura: string
  marca: string
  modello: string
  specs?: {
    volume?: string
    pressione?: string
    temperatura?: string
    categoria_ped?: string
  }
}

async function main() {
  console.log('🚀 Avvio importazione catalogo apparecchiature...\n')

  // 1. Leggi file Excel
  const excelPath = path.join(process.cwd(), 'DOCUMENTAZIONE', 'Lista Modelli.xlsx')

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ File non trovato: ${excelPath}`)
    process.exit(1)
  }

  console.log(`📂 Lettura file: ${excelPath}`)
  const workbook = XLSX.readFile(excelPath)

  // 2. Leggi scheda "Modelli"
  const modelliSheet = workbook.Sheets['Modelli']
  if (!modelliSheet) {
    console.error('❌ Scheda "Modelli" non trovata nel file Excel')
    process.exit(1)
  }

  const data = XLSX.utils.sheet_to_json(modelliSheet, { defval: '' })
  console.log(`✅ Lette ${data.length} righe dalla scheda "Modelli"\n`)

  // 3. Parsing e validazione dati
  const equipmentRows: EquipmentRow[] = []
  const skippedRows: string[] = []

  for (const row of data) {
    const tipoExcel = (row as any)['TIPO']?.toString().trim()
    const marca = (row as any)['MARCA']?.toString().trim()
    const modello = (row as any)['MODELLO']?.toString().trim()

    // Skip righe invalide
    if (!tipoExcel || !marca || !modello) {
      skippedRows.push(`Riga saltata: TIPO="${tipoExcel}", MARCA="${marca}", MODELLO="${modello}"`)
      continue
    }

    // Mappa tipo
    const tipoApparecchiatura = TIPO_MAPPING[tipoExcel]
    if (!tipoApparecchiatura) {
      skippedRows.push(`Tipo sconosciuto: "${tipoExcel}" (MARCA: ${marca}, MODELLO: ${modello})`)
      continue
    }

    // Estrai specs opzionali
    const specs: any = {}
    if ((row as any)['V(l)/FAD(l/min)']) {
      specs.volume = (row as any)['V(l)/FAD(l/min)'].toString()
    }
    if ((row as any)['PS/Ptar(bar)']) {
      specs.pressione = (row as any)['PS/Ptar(bar)'].toString()
    }
    if ((row as any)['TS(°C)']) {
      specs.temperatura = (row as any)['TS(°C)'].toString()
    }
    if ((row as any)['CAT_PED']) {
      specs.categoria_ped = (row as any)['CAT_PED'].toString()
    }

    equipmentRows.push({
      tipo_excel: tipoExcel,
      tipo_apparecchiatura: tipoApparecchiatura,
      marca,
      modello,
      specs: Object.keys(specs).length > 0 ? specs : undefined
    })
  }

  console.log(`✅ Parsed ${equipmentRows.length} righe valide`)
  if (skippedRows.length > 0) {
    console.log(`⚠️  Saltate ${skippedRows.length} righe:\n`)
    skippedRows.slice(0, 10).forEach(msg => console.log(`   ${msg}`))
    if (skippedRows.length > 10) {
      console.log(`   ... e altre ${skippedRows.length - 10} righe`)
    }
    console.log()
  }

  // 4. Statistiche per tipo
  const statsByTipo: Record<string, number> = {}
  equipmentRows.forEach(row => {
    statsByTipo[row.tipo_apparecchiatura] = (statsByTipo[row.tipo_apparecchiatura] || 0) + 1
  })

  console.log('📊 Statistiche per tipologia:')
  Object.entries(statsByTipo)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tipo, count]) => {
      console.log(`   ${tipo.padEnd(25)} : ${count} modelli`)
    })
  console.log()

  // 5. Conferma prima di procedere
  console.log(`⚠️  Stai per importare ${equipmentRows.length} apparecchiature nel database.`)
  console.log('   Questo sovrascriverà eventuali dati esistenti con stesso TIPO-MARCA-MODELLO.')
  console.log()

  // In ambiente production, chiedi conferma
  // Per ora procediamo direttamente

  // 6. Import nel database
  console.log('💾 Importazione in corso...\n')

  let inserted = 0
  let updated = 0
  let errors = 0

  // Batch import (100 alla volta per performance)
  const BATCH_SIZE = 100
  for (let i = 0; i < equipmentRows.length; i += BATCH_SIZE) {
    const batch = equipmentRows.slice(i, i + BATCH_SIZE)

    const records = batch.map(row => ({
      tipo: row.tipo_excel, // Legacy field
      tipo_apparecchiatura: row.tipo_apparecchiatura,
      marca: row.marca,
      modello: row.modello,
      specs: row.specs,
      is_active: true,
      is_user_defined: false, // Dati da import iniziale
      usage_count: 0
    }))

    const { data, error } = await supabase
      .from('equipment_catalog')
      .upsert(records, {
        onConflict: 'tipo_apparecchiatura,marca,modello',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`❌ Errore batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`   Processate: ${Math.min(i + BATCH_SIZE, equipmentRows.length)}/${equipmentRows.length}\r`)
    }
  }

  console.log('\n')

  // 7. Riepilogo finale
  console.log('✅ Importazione completata!\n')
  console.log('📈 Riepilogo:')
  console.log(`   ✅ Importate con successo: ${inserted}`)
  console.log(`   ❌ Errori: ${errors}`)
  console.log()

  // 8. Verifica database
  const { count, error: countError } = await supabase
    .from('equipment_catalog')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (!countError && count !== null) {
    console.log(`🗄️  Totale apparecchiature nel catalogo: ${count}`)
  }

  console.log('\n🎉 Import completato!')
}

// Esegui
main().catch(error => {
  console.error('❌ Errore fatale:', error)
  process.exit(1)
})
