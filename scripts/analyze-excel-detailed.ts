#!/usr/bin/env tsx

import XLSX from 'xlsx'
import * as path from 'path'

const EXCEL_FILE_PATH = path.join(process.cwd(), 'DOCUMENTAZIONE', 'ClientiDaMAGO.xlsx')

const workbook = XLSX.readFile(EXCEL_FILE_PATH)
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null })

console.log(`\n📊 Analisi dettagliata file Excel (${jsonData.length} righe)\n`)

// Analizza CustSuppType
const types = new Map<string, number>()
for (const row of jsonData) {
  const type = String(row.CustSuppType || 'VUOTO')
  types.set(type, (types.get(type) || 0) + 1)
}

console.log('1️⃣ CUSTSUPPTYPE (codice tipo record):')
for (const [type, count] of Array.from(types.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${type}: ${count} record`)
}

// Analizza prime 20 righe
console.log('\n2️⃣ PRIME 20 RIGHE:\n')
for (let i = 0; i < Math.min(20, jsonData.length); i++) {
  const row = jsonData[i]
  console.log(`Riga ${i + 1}:`)
  console.log(`  CustSuppType: ${row.CustSuppType}`)
  console.log(`  CustSupp: ${row.CustSupp}`)
  console.log(`  CompanyName: ${row.CompanyName || '(VUOTO)'}`)
  console.log(`  Address: ${row.Address || '(vuoto)'}`)
  console.log()
}

// Conta righe valide
let valid = 0
let empty = 0
let noExternalId = 0

for (const row of jsonData) {
  if (!row.CustSupp || row.CustSupp === '%') {
    noExternalId++
    continue
  }

  if (!row.CompanyName || row.CompanyName.trim() === '') {
    empty++
    continue
  }

  valid++
}

console.log('\n3️⃣ STATISTICHE:')
console.log(`   Righe totali: ${jsonData.length}`)
console.log(`   Righe valide (con CustSupp E CompanyName): ${valid}`)
console.log(`   Righe senza CompanyName: ${empty}`)
console.log(`   Righe senza CustSupp valido: ${noExternalId}`)
console.log()
