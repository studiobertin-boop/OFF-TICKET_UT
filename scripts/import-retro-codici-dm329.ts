// scripts/import-retro-codici-dm329.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import XLSX from 'xlsx'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validateAssignments, ReviewedAssignment } from './lib/retroPracticeCode'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Mancano VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const IN_PATH = resolve(__dirname, '../DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx')
const isApply = process.argv.includes('--apply')

function toNumber(v: any): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').trim(), 10)
  return Number.isNaN(n) ? -1 : n
}

async function main() {
  console.log(`📋 Leggo ${IN_PATH} (${isApply ? 'APPLY' : 'DRY-RUN'})`)
  const wb = XLSX.readFile(IN_PATH)
  const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Pratiche'], { defval: '' })

  const rows: ReviewedAssignment[] = raw.map(r => ({
    request_id: String(r.request_id).trim(),
    request_type: String(r.tipo).trim(),
    customer_id: String(r.customer_id ?? '').trim() || '', // may be blank in sheet
    sala_lettera: String(r.sala_lettera ?? '').trim(),
    denominazione_sala: String(r.denominazione_sala ?? '').trim(),
    progressivo: toNumber(r.progressivo),
    anno: toNumber(r.anno),
    indirizzo_impianto: String(r.indirizzo ?? '').trim(),
    pratica_padre: String(r.pratica_padre ?? '').trim(),
  }))

  // customer_id non è nel foglio (solo cliente/codice): ricavalo dal DB per la validazione unicità.
  const ids = rows.map(r => r.request_id)
  const { data: dbRows, error: dbErr } = await supabase
    .from('requests').select('id, customer_id').in('id', ids)
  if (dbErr) { console.error('❌ Errore lettura customer_id:', dbErr); process.exit(1) }
  const custById = new Map((dbRows || []).map((d: any) => [d.id, d.customer_id]))
  for (const r of rows) r.customer_id = custById.get(r.request_id) || ''

  const report = validateAssignments(rows)

  console.log(`\n📊 Validazione: ${report.valid.length} valide, ${report.errors.length} errori`)
  for (const e of report.errors) console.log(`  ❌ ${e.request_id}: ${e.message}`)

  if (report.errors.length > 0) {
    console.log('\n⚠️  Correggi gli errori nell\'Excel prima di applicare. Nessuna scrittura.')
    process.exit(1)
  }
  if (!isApply) {
    console.log('\n✅ Dry-run OK. Rilancia con --apply per scrivere.')
    return
  }

  // Applica: prima le primarie (per poter ereditare nelle integrazioni), poi le integrazioni.
  const parentById = new Map(report.valid.filter(r => !r.pratica_padre).map(p => [p.request_id, p]))
  let ok = 0, ko = 0

  for (const r of report.valid.filter(r => !r.pratica_padre)) {
    const { error } = await supabase.from('requests').update({
      sala_lettera: r.sala_lettera,
      denominazione_sala: r.denominazione_sala || null,
      progressivo: r.progressivo,
      anno: r.anno,
      indirizzo_impianto: r.indirizzo_impianto || null,
    }).eq('id', r.request_id)
    if (error) { console.log(`  ❌ ${r.request_id}: ${error.message}`); ko++ } else ok++
  }

  for (const r of report.valid.filter(r => r.pratica_padre)) {
    const parent = parentById.get(r.pratica_padre)!
    const { error } = await supabase.from('requests').update({
      pratica_padre_id: r.pratica_padre,
      sala_lettera: parent.sala_lettera,
      progressivo: parent.progressivo,
      anno: parent.anno,
    }).eq('id', r.request_id)
    if (error) { console.log(`  ❌ ${r.request_id}: ${error.message}`); ko++ } else ok++
  }

  console.log(`\n✅ Applicati ${ok} aggiornamenti, ${ko} errori.`)
  if (ko > 0) process.exit(1)
}

main().catch(err => { console.error('❌ Errore fatale:', err); process.exit(1) })
