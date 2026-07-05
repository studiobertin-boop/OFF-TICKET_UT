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

  // Rileva collisioni con codici già presenti in DB (pratiche già codificate dal flusso in-app).
  const batchPrimaryCustomerIds = [...new Set(
    report.valid.filter(r => !r.pratica_padre).map(r => r.customer_id)
  )]
  let collisionCount = 0
  if (batchPrimaryCustomerIds.length > 0) {
    const { data: codedRows, error: codedErr } = await supabase
      .from('requests')
      .select('id, customer_id, sala_lettera, progressivo')
      .in('customer_id', batchPrimaryCustomerIds)
      .not('sala_lettera', 'is', null)
      .is('pratica_padre_id', null)
    if (codedErr) { console.error('❌ Errore lettura codici già in DB:', codedErr); process.exit(1) }

    const batchRequestIds = new Set(rows.map(r => r.request_id))
    const codedKeys = new Set(
      (codedRows || [])
        .filter((d: any) => !batchRequestIds.has(d.id))
        .map((d: any) => `${d.customer_id}|${d.sala_lettera}|${d.progressivo}`)
    )

    const collidingIds = new Set<string>()
    for (const r of report.valid.filter(r => !r.pratica_padre)) {
      const key = `${r.customer_id}|${r.sala_lettera}|${r.progressivo}`
      if (codedKeys.has(key)) {
        report.errors.push({ request_id: r.request_id, message: 'codice già presente in DB per questo cliente+sala+progressivo' })
        collidingIds.add(r.request_id)
        collisionCount++
      }
    }
    if (collidingIds.size > 0) {
      report.valid = report.valid.filter(r => !collidingIds.has(r.request_id))
    }
  }
  console.log(`🔎 Collisioni con codici già in DB: ${collisionCount}`)

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
    const parent = parentById.get(r.pratica_padre)
    if (!parent) { console.log(`  ❌ ${r.request_id}: padre ${r.pratica_padre} non tra le primarie valide`); ko++; continue }
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
