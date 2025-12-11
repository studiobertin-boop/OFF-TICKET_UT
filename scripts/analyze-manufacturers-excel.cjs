/**
 * Script per analizzare ListaCostruttori.xlsx
 * Mostra la struttura del file Excel per capire i dati disponibili
 */

const XLSX = require('xlsx')
const path = require('path')

const filePath = path.join(__dirname, '..', 'DOCUMENTAZIONE', 'ListaCostruttori.xlsx')

console.log('📊 Analisi ListaCostruttori.xlsx\n')

try {
  // Leggi il file Excel
  const workbook = XLSX.readFile(filePath)

  // Mostra i nomi dei fogli
  console.log('📋 Fogli presenti:')
  workbook.SheetNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`)
  })
  console.log()

  // Analizza il primo foglio
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]

  // Converti in JSON per vedere i dati
  const data = XLSX.utils.sheet_to_json(worksheet)

  console.log(`📄 Foglio: "${firstSheetName}"`)
  console.log(`📊 Numero righe: ${data.length}`)
  console.log()

  if (data.length > 0) {
    console.log('📋 Colonne disponibili:')
    const columns = Object.keys(data[0])
    columns.forEach((col, i) => {
      console.log(`  ${i + 1}. ${col}`)
    })
    console.log()

    console.log('🔍 Prime 5 righe di esempio:')
    console.log(JSON.stringify(data.slice(0, 5), null, 2))
    console.log()

    console.log('📊 Statistiche:')
    console.log(`  Totale costruttori: ${data.length}`)

    // Analizza la presenza di dati per colonna
    console.log('\n📈 Completezza dati per colonna:')
    columns.forEach(col => {
      const nonEmpty = data.filter(row => row[col] && String(row[col]).trim() !== '').length
      const percentage = ((nonEmpty / data.length) * 100).toFixed(1)
      console.log(`  ${col}: ${nonEmpty}/${data.length} (${percentage}%)`)
    })
  } else {
    console.log('⚠️  Nessun dato trovato nel foglio')
  }

} catch (error) {
  console.error('❌ Errore durante la lettura del file:', error.message)
  process.exit(1)
}
