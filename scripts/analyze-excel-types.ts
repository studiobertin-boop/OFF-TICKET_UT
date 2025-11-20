#!/usr/bin/env tsx

import XLSX from 'xlsx'
import * as path from 'path'

const EXCEL_FILE_PATH = path.join(process.cwd(), 'DOCUMENTAZIONE', 'ClientiDaMAGO.xlsx')

const workbook = XLSX.readFile(EXCEL_FILE_PATH)
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: null })

console.log(`\n📊 Analisi ${jsonData.length} righe Excel\n`)

// Conta tipi
const types = new Map<string, number>()
for (const row of jsonData) {
  const type = row.CustSuppType || 'VUOTO'
  types.set(type, (types.get(type) || 0) + 1)
}

console.log('Valori CustSuppType trovati:')
for (const [type, count] of Array.from(types.entries()).sort((a, b) => b[1] - a[1])) {
  const percent = ((count / jsonData.length) * 100).toFixed(1)
  console.log(`  ${type}: ${count} (${percent}%)`)
}

// Mostra esempi per ogni tipo
console.log('\n📋 Esempi per tipo:\n')
for (const type of types.keys()) {
  const example = jsonData.find(r => (r.CustSuppType || 'VUOTO') === type)
  console.log(`${type}:`)
  console.log(`  CustSupp: ${example.CustSupp}`)
  console.log(`  CompanyName: ${example.CompanyName}`)
  console.log()
}
