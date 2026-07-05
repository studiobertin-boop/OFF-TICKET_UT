// scripts/export-retro-codici-dm329.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import XLSX from 'xlsx'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { proposeAssignments, FetchedPractice, ProposedAssignment } from './lib/retroPracticeCode'

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

const OUT_PATH = resolve(__dirname, '../DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx')
const EXCLUDED_STATUSES = ['7-CHIUSA', 'ARCHIVIATA NON FINITA']

async function main() {
  console.log('📋 Carico le pratiche DM329 attive codificabili...')
  const { data, error } = await supabase
    .from('requests')
    .select(`
      id, title, status, created_at, customer_id, custom_fields,
      request_type:request_types!inner(name),
      customer:customers(ragione_sociale, identificativo)
    `)
    .in('request_type.name', ['DM329', 'DM329-Integrazioni'])
    .not('customer_id', 'is', null)
    .not('status', 'in', `(${EXCLUDED_STATUSES.map(s => `"${s}"`).join(',')})`)
    .order('customer_id', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) { console.error('❌ Errore query:', error); process.exit(1) }

  const fetched: FetchedPractice[] = (data || [])
    .filter((r: any) => r.customer?.identificativo)
    .map((r: any) => ({
      request_id: r.id,
      request_type: r.request_type.name,
      customer_id: r.customer_id,
      codice_cliente: r.customer.identificativo,
      cliente: r.customer.ragione_sociale || '',
      title: r.title || '',
      indirizzo:
        r.custom_fields?.indirizzo_impianto ||
        r.custom_fields?.indirizzo_immobile ||
        '',
      status: r.status,
      created_at: r.created_at,
    }))

  console.log(`✓ ${fetched.length} pratiche codificabili`)

  const proposals: ProposedAssignment[] = proposeAssignments(fetched)

  const sheetRows = proposals
    .sort((a, b) =>
      a.cliente.localeCompare(b.cliente) ||
      a.prop_sala_lettera.localeCompare(b.prop_sala_lettera) ||
      a.prop_progressivo - b.prop_progressivo
    )
    .map(p => ({
      request_id: p.request_id,
      tipo: p.request_type,
      cliente: p.cliente,
      codice_cliente: p.codice_cliente,
      titolo: p.title,
      indirizzo: p.indirizzo,
      created_at: p.created_at,
      stato: p.status,
      sala_lettera: p.prop_sala_lettera,
      denominazione_sala: p.prop_denominazione_sala,
      progressivo: p.prop_progressivo,
      anno: p.prop_anno,
      pratica_padre: p.pratica_padre,
      note_override: p.note_override,
    }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(sheetRows)
  XLSX.utils.book_append_sheet(wb, ws, 'Pratiche')
  XLSX.writeFile(wb, OUT_PATH)

  console.log(`✅ Scritto ${sheetRows.length} righe in ${OUT_PATH}`)
}

main().catch(err => { console.error('❌ Errore fatale:', err); process.exit(1) })
