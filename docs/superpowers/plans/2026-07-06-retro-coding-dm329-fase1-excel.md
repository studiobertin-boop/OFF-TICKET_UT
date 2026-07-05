# Retro-coding codici pratica DM329 — Fase 1 (Excel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assegnare i campi del codice pratica (`sala_lettera`, `progressivo`, `anno`, `denominazione_sala`, `indirizzo_impianto`, `pratica_padre_id`) alle ~122 pratiche DM329 attive esistenti, via uno script di proposta → revisione manuale Excel → import validato.

**Architecture:** Logica pura e testabile (raggruppamento sala/progressivo + validazione vincoli) isolata in `scripts/lib/retroPracticeCode.ts`. Due script sottili la usano: `export-retro-codici-dm329.ts` (legge dal DB, scrive l'Excel di proposta) e `import-retro-codici-dm329.ts` (rilegge l'Excel corretto, valida, applica in dry-run/`--apply`). La revisione (Fase C) è manuale sull'Excel.

**Tech Stack:** TypeScript + `tsx`, `@supabase/supabase-js` (service role, bypassa RLS), `xlsx`, Vitest.

## Global Constraints

- Formato codice: `CODICECLIENTE[LETTERASALA]_PROGRESSIVO-ANNO`; lettera scritta sempre in DB, omessa solo a video se il cliente ha 1 sala.
- `sala_lettera`: `char(1)`, regex `^[A-Z]$`.
- `progressivo`: intero 0–99; `00` = pratica iniziale, `01+` = aggiornamenti della stessa sala.
- `anno`: intero 2000–2100.
- Unicità DB: indice parziale `ux_requests_codice_pratica (customer_id, sala_lettera, progressivo) WHERE pratica_padre_id IS NULL AND sala_lettera IS NOT NULL`.
- Integrazioni: `pratica_padre_id` → primaria dello **stesso** `customer_id`; ereditano sala/progressivo/anno del padre; escluse dall'unicità.
- Scope: solo pratiche DM329/DM329-Integrazioni **NON** in stato `7-CHIUSA` o `ARCHIVIATA NON FINITA`, con `customer_id` valorizzato e cliente con `identificativo` non vuoto.
- Env: `.env.local` con `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Project ref `uphftgpwisdiubuhohnc`.
- Ogni scrittura in produzione avviene solo con flag esplicito `--apply`; senza flag lo script è dry-run.

## File Structure

- Create: `scripts/lib/retroPracticeCode.ts` — tipi + `proposeAssignments()` + `validateAssignments()` (logica pura).
- Create: `scripts/lib/retroPracticeCode.test.ts` — unit test Vitest.
- Create: `scripts/export-retro-codici-dm329.ts` — Fase B: fetch DB → Excel di proposta.
- Create: `scripts/import-retro-codici-dm329.ts` — Fase D: Excel → validazione → dry-run/apply.
- Create: `DOCUMENTAZIONE/RETRO_CODICI_PRATICA_README.md` — istruzioni Fase C (revisione manuale).
- Modify: `package.json` — npm scripts per export/import.

---

### Task 1: Logica di proposta (raggruppamento sala/progressivo/anno)

**Files:**
- Create: `scripts/lib/retroPracticeCode.ts`
- Test: `scripts/lib/retroPracticeCode.test.ts`

**Interfaces:**
- Produces:
  - `interface FetchedPractice { request_id: string; request_type: 'DM329' | 'DM329-Integrazioni'; customer_id: string; codice_cliente: string; cliente: string; title: string; indirizzo: string; status: string; created_at: string }`
  - `interface ProposedAssignment { request_id: string; request_type: string; customer_id: string; codice_cliente: string; cliente: string; title: string; indirizzo: string; status: string; created_at: string; prop_sala_lettera: string; prop_denominazione_sala: string; prop_progressivo: number; prop_anno: number; pratica_padre: string; note_override: string }`
  - `function proposeAssignments(practices: FetchedPractice[]): ProposedAssignment[]`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/retroPracticeCode.test.ts
import { describe, it, expect } from 'vitest'
import { proposeAssignments, FetchedPractice } from './retroPracticeCode'

const base = {
  request_type: 'DM329' as const,
  customer_id: 'c1',
  codice_cliente: '527',
  cliente: 'ACME',
  title: 't',
  status: '3-MAIL_CLIENTE_INVIATA',
}

describe('proposeAssignments', () => {
  it('assegna lettere diverse a indirizzi diversi dello stesso cliente, in ordine di data', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'r2', indirizzo: 'Via Roma 1', created_at: '2024-05-01T00:00:00Z' },
      { ...base, request_id: 'r1', indirizzo: 'Via Milano 2', created_at: '2024-01-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input)
    const byId = Object.fromEntries(out.map(o => [o.request_id, o]))
    expect(byId['r1'].prop_sala_lettera).toBe('A') // indirizzo più vecchio
    expect(byId['r2'].prop_sala_lettera).toBe('B')
    expect(byId['r1'].prop_progressivo).toBe(0)
    expect(byId['r2'].prop_progressivo).toBe(0)
  })

  it('stesso indirizzo => stessa lettera, progressivo incrementale per data', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'r1', indirizzo: 'Via Roma 1', created_at: '2023-01-01T00:00:00Z' },
      { ...base, request_id: 'r2', indirizzo: 'via  roma 1', created_at: '2024-01-01T00:00:00Z' },
      { ...base, request_id: 'r3', indirizzo: 'VIA ROMA 1', created_at: '2025-01-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input).sort((a, b) => a.prop_progressivo - b.prop_progressivo)
    expect(out.map(o => [o.request_id, o.prop_sala_lettera, o.prop_progressivo])).toEqual([
      ['r1', 'A', 0],
      ['r2', 'A', 1],
      ['r3', 'A', 2],
    ])
    expect(out[2].prop_anno).toBe(2025)
  })

  it('le integrazioni non ricevono lettera e propongono la primaria più recente dello stesso cliente come padre', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'p1', indirizzo: 'Via Roma 1', created_at: '2024-01-01T00:00:00Z' },
      { ...base, request_type: 'DM329-Integrazioni', request_id: 'i1', indirizzo: '', created_at: '2024-06-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input)
    const integr = out.find(o => o.request_id === 'i1')!
    expect(integr.prop_sala_lettera).toBe('')
    expect(integr.pratica_padre).toBe('p1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/retroPracticeCode.test.ts`
Expected: FAIL — "Cannot find module './retroPracticeCode'" / export non definito.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/retroPracticeCode.ts

export interface FetchedPractice {
  request_id: string
  request_type: 'DM329' | 'DM329-Integrazioni'
  customer_id: string
  codice_cliente: string
  cliente: string
  title: string
  indirizzo: string
  status: string
  created_at: string
}

export interface ProposedAssignment {
  request_id: string
  request_type: string
  customer_id: string
  codice_cliente: string
  cliente: string
  title: string
  indirizzo: string
  status: string
  created_at: string
  prop_sala_lettera: string
  prop_denominazione_sala: string
  prop_progressivo: number
  prop_anno: number
  pratica_padre: string
  note_override: string
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const normAddr = (s: string) =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

const yearOf = (iso: string) => new Date(iso).getUTCFullYear()

export function proposeAssignments(practices: FetchedPractice[]): ProposedAssignment[] {
  const primaries = practices.filter(p => p.request_type === 'DM329')
  const integrazioni = practices.filter(p => p.request_type === 'DM329-Integrazioni')
  const out: ProposedAssignment[] = []

  // Raggruppa le primarie per cliente
  const byCustomer = new Map<string, FetchedPractice[]>()
  for (const p of primaries) {
    if (!byCustomer.has(p.customer_id)) byCustomer.set(p.customer_id, [])
    byCustomer.get(p.customer_id)!.push(p)
  }

  for (const [, rows] of byCustomer) {
    // Ordina per data crescente
    const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
    // Assegna una lettera per indirizzo distinto (ordine di prima comparsa)
    const letterOf = new Map<string, string>()
    const progOf = new Map<string, number>()
    let nextLetterIdx = 0
    for (const p of sorted) {
      const key = normAddr(p.indirizzo)
      if (!letterOf.has(key)) {
        letterOf.set(key, LETTERS[nextLetterIdx] || 'Z')
        nextLetterIdx++
        progOf.set(key, 0)
      }
      const lettera = letterOf.get(key)!
      const progressivo = progOf.get(key)!
      progOf.set(key, progressivo + 1)
      out.push({
        request_id: p.request_id,
        request_type: p.request_type,
        customer_id: p.customer_id,
        codice_cliente: p.codice_cliente,
        cliente: p.cliente,
        title: p.title,
        indirizzo: p.indirizzo,
        status: p.status,
        created_at: p.created_at,
        prop_sala_lettera: lettera,
        prop_denominazione_sala: '',
        prop_progressivo: progressivo,
        prop_anno: yearOf(p.created_at),
        pratica_padre: '',
        note_override: '',
      })
    }
  }

  // Integrazioni: proponi come padre la primaria più recente dello stesso cliente
  for (const i of integrazioni) {
    const candidates = primaries
      .filter(p => p.customer_id === i.customer_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    out.push({
      request_id: i.request_id,
      request_type: i.request_type,
      customer_id: i.customer_id,
      codice_cliente: i.codice_cliente,
      cliente: i.cliente,
      title: i.title,
      indirizzo: i.indirizzo,
      status: i.status,
      created_at: i.created_at,
      prop_sala_lettera: '',
      prop_denominazione_sala: '',
      prop_progressivo: 0,
      prop_anno: yearOf(i.created_at),
      pratica_padre: candidates[0]?.request_id ?? '',
      note_override: '',
    })
  }

  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/retroPracticeCode.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/retroPracticeCode.ts scripts/lib/retroPracticeCode.test.ts
git commit -m "feat(dm329): logica proposta retro-coding (raggruppamento sala/progressivo)"
```

---

### Task 2: Validazione dei vincoli

**Files:**
- Modify: `scripts/lib/retroPracticeCode.ts` (append)
- Test: `scripts/lib/retroPracticeCode.test.ts` (append)

**Interfaces:**
- Consumes: nulla dai task precedenti (funzione indipendente nello stesso file).
- Produces:
  - `interface ReviewedAssignment { request_id: string; request_type: string; customer_id: string; sala_lettera: string; denominazione_sala: string; progressivo: number; anno: number; indirizzo_impianto: string; pratica_padre: string }`
  - `interface ValidationError { request_id: string; message: string }`
  - `interface ValidationReport { valid: ReviewedAssignment[]; errors: ValidationError[] }`
  - `function validateAssignments(rows: ReviewedAssignment[]): ValidationReport`

- [ ] **Step 1: Write the failing test**

```ts
// append to scripts/lib/retroPracticeCode.test.ts
import { validateAssignments, ReviewedAssignment } from './retroPracticeCode'

const prim = (over: Partial<ReviewedAssignment>): ReviewedAssignment => ({
  request_id: 'r', request_type: 'DM329', customer_id: 'c1',
  sala_lettera: 'A', denominazione_sala: 'Sala', progressivo: 0, anno: 2025,
  indirizzo_impianto: 'Via Roma 1', pratica_padre: '', ...over,
})

describe('validateAssignments', () => {
  it('accetta una primaria valida', () => {
    const rep = validateAssignments([prim({ request_id: 'r1' })])
    expect(rep.errors).toEqual([])
    expect(rep.valid).toHaveLength(1)
  })

  it('rifiuta lettera non valida, progressivo/anno fuori range', () => {
    const rep = validateAssignments([
      prim({ request_id: 'r1', sala_lettera: 'a' }),
      prim({ request_id: 'r2', progressivo: 100 }),
      prim({ request_id: 'r3', anno: 1999 }),
    ])
    expect(rep.errors.map(e => e.request_id).sort()).toEqual(['r1', 'r2', 'r3'])
    expect(rep.valid).toHaveLength(0)
  })

  it('rifiuta due primarie con stesso (cliente, sala, progressivo)', () => {
    const rep = validateAssignments([
      prim({ request_id: 'r1', sala_lettera: 'A', progressivo: 0 }),
      prim({ request_id: 'r2', sala_lettera: 'A', progressivo: 0 }),
    ])
    expect(rep.errors.some(e => /duplicat/i.test(e.message))).toBe(true)
  })

  it('rifiuta integrazione il cui padre non è una primaria dello stesso cliente', () => {
    const rep = validateAssignments([
      prim({ request_id: 'p1', customer_id: 'c1' }),
      { request_id: 'i1', request_type: 'DM329-Integrazioni', customer_id: 'c2',
        sala_lettera: '', denominazione_sala: '', progressivo: 0, anno: 2025,
        indirizzo_impianto: '', pratica_padre: 'p1' },
    ])
    expect(rep.errors.some(e => e.request_id === 'i1')).toBe(true)
  })

  it('accetta integrazione con padre corretto', () => {
    const rep = validateAssignments([
      prim({ request_id: 'p1', customer_id: 'c1' }),
      { request_id: 'i1', request_type: 'DM329-Integrazioni', customer_id: 'c1',
        sala_lettera: '', denominazione_sala: '', progressivo: 0, anno: 2025,
        indirizzo_impianto: '', pratica_padre: 'p1' },
    ])
    expect(rep.errors).toEqual([])
    expect(rep.valid).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/retroPracticeCode.test.ts`
Expected: FAIL — `validateAssignments` non esportata.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to scripts/lib/retroPracticeCode.ts

export interface ReviewedAssignment {
  request_id: string
  request_type: string
  customer_id: string
  sala_lettera: string
  denominazione_sala: string
  progressivo: number
  anno: number
  indirizzo_impianto: string
  pratica_padre: string
}

export interface ValidationError {
  request_id: string
  message: string
}

export interface ValidationReport {
  valid: ReviewedAssignment[]
  errors: ValidationError[]
}

export function validateAssignments(rows: ReviewedAssignment[]): ValidationReport {
  const errors: ValidationError[] = []
  const invalidIds = new Set<string>()
  const fail = (id: string, message: string) => {
    errors.push({ request_id: id, message })
    invalidIds.add(id)
  }

  const primaries = rows.filter(r => !r.pratica_padre)
  const integrazioni = rows.filter(r => r.pratica_padre)

  // Vincoli di formato/range sulle primarie
  const seen = new Map<string, string>() // "cust|sala|prog" -> request_id
  for (const r of primaries) {
    if (!/^[A-Z]$/.test(r.sala_lettera)) fail(r.request_id, `sala_lettera non valida: "${r.sala_lettera}"`)
    if (!Number.isInteger(r.progressivo) || r.progressivo < 0 || r.progressivo > 99)
      fail(r.request_id, `progressivo fuori range: ${r.progressivo}`)
    if (!Number.isInteger(r.anno) || r.anno < 2000 || r.anno > 2100)
      fail(r.request_id, `anno fuori range: ${r.anno}`)
    const key = `${r.customer_id}|${r.sala_lettera}|${r.progressivo}`
    if (seen.has(key)) fail(r.request_id, `codice duplicato con ${seen.get(key)} (cliente+sala+progressivo)`)
    else seen.set(key, r.request_id)
  }

  // Integrazioni: il padre deve essere una primaria dello stesso cliente (in questo batch)
  const primaryById = new Map(primaries.map(p => [p.request_id, p]))
  for (const i of integrazioni) {
    const parent = primaryById.get(i.pratica_padre)
    if (!parent) fail(i.request_id, `pratica_padre inesistente o non primaria: "${i.pratica_padre}"`)
    else if (parent.customer_id !== i.customer_id)
      fail(i.request_id, `pratica_padre di un altro cliente`)
  }

  const valid = rows.filter(r => !invalidIds.has(r.request_id))
  return { valid, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/retroPracticeCode.test.ts`
Expected: PASS (8 test totali nel file).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/retroPracticeCode.ts scripts/lib/retroPracticeCode.test.ts
git commit -m "feat(dm329): validazione vincoli retro-coding codici pratica"
```

---

### Task 3: Script di export (Fase B) — genera l'Excel di proposta

**Files:**
- Create: `scripts/export-retro-codici-dm329.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `FetchedPractice`, `ProposedAssignment`, `proposeAssignments` da `scripts/lib/retroPracticeCode.ts`.
- Produces: file `DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx`.

- [ ] **Step 1: Scrivere lo script**

```ts
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
```

- [ ] **Step 2: Aggiungere gli npm script**

In `package.json`, dentro `"scripts"`, aggiungere dopo `"smart-cleanup"`:

```json
    "smart-cleanup": "tsx scripts/smart-cleanup-customers.ts",
    "retro-codici:export": "tsx scripts/export-retro-codici-dm329.ts",
    "retro-codici:import": "tsx scripts/import-retro-codici-dm329.ts",
    "retro-codici:import:apply": "tsx scripts/import-retro-codici-dm329.ts --apply"
```

(La riga `smart-cleanup` esiste già: aggiungere solo le tre nuove sotto, mantenendo la virgola.)

- [ ] **Step 3: Eseguire l'export (verifica reale)**

Run: `npm run retro-codici:export`
Expected: stampa `✓ N pratiche codificabili` (N ≈ 122) e `✅ Scritto N righe in …RETRO_CODICI_PRATICA_DM329.xlsx`; il file esiste.

- [ ] **Step 4: Verificare il contenuto dell'Excel**

Run: `tsx -e "import X from 'xlsx'; const wb=X.readFile('DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx'); const r=X.utils.sheet_to_json(wb.Sheets['Pratiche']); console.log('righe',r.length); console.log(r[0])"`
Expected: `righe` ≈ 122; la prima riga ha le colonne `request_id, tipo, cliente, codice_cliente, …, sala_lettera, progressivo, anno, pratica_padre, note_override`.

- [ ] **Step 5: Commit**

```bash
git add scripts/export-retro-codici-dm329.ts package.json
git commit -m "feat(dm329): script export proposta codici pratica (Fase B)"
```

---

### Task 4: Script di import (Fase D) — valida e applica

**Files:**
- Create: `scripts/import-retro-codici-dm329.ts`

**Interfaces:**
- Consumes: `validateAssignments`, `ReviewedAssignment`, `ValidationReport` da `scripts/lib/retroPracticeCode.ts`.
- Produces: aggiornamenti su `requests` (solo con `--apply`).

- [ ] **Step 1: Scrivere lo script**

```ts
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
```

- [ ] **Step 2: Eseguire il dry-run sull'Excel di proposta non modificato (verifica)**

Run: `npm run retro-codici:import`
Expected: stampa `📊 Validazione: N valide, 0 errori` e `✅ Dry-run OK. Rilancia con --apply per scrivere.` (nessuna scrittura). Se emergono errori (es. integrazioni senza padre valido), sono elencati per `request_id`.

- [ ] **Step 3: Commit**

```bash
git add scripts/import-retro-codici-dm329.ts
git commit -m "feat(dm329): script import/validazione codici pratica con dry-run (Fase D)"
```

---

### Task 5: Documentazione revisione manuale (Fase C)

**Files:**
- Create: `DOCUMENTAZIONE/RETRO_CODICI_PRATICA_README.md`

**Interfaces:** nessuna (documento).

- [ ] **Step 1: Scrivere il README**

````markdown
# Retro-coding codici pratica DM329 — Istruzioni

Assegnazione dei codici pratica alle pratiche DM329 create prima della funzione codice pratica.

## Flusso

1. **Genera la proposta**
   `npm run retro-codici:export`
   Crea `DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx` con una proposta automatica
   (una lettera per indirizzo distinto del cliente, progressivo per data, anno da data).

2. **Rivedi a mano l'Excel** (foglio `Pratiche`). Correggi queste colonne:
   - `sala_lettera`: una lettera **A–Z** per ogni sala fisica distinta del cliente.
   - `denominazione_sala`: nome descrittivo della sala (facoltativo ma consigliato).
   - `progressivo`: **00** = pratica iniziale, **01/02…** = aggiornamenti della stessa sala.
   - `anno`: 2000–2100.
   - `pratica_padre` (solo righe `tipo = DM329-Integrazioni`): il `request_id` della
     pratica **primaria** dello stesso cliente a cui agganciare l'integrazione.
   Non modificare `request_id`, `tipo`, `customer_id` (se presente).

   **Regole da rispettare** (altrimenti l'import segnala errore):
   - Per lo stesso cliente, la coppia (sala_lettera, progressivo) deve essere unica.
   - Un'integrazione deve puntare a una primaria **dello stesso cliente**.

3. **Verifica senza scrivere (dry-run)**
   `npm run retro-codici:import`
   Elenca righe valide ed eventuali errori. Correggi l'Excel finché "0 errori".

4. **Applica in produzione**
   `npm run retro-codici:import:apply`
   Scrive i codici su `requests`.

## Fuori scope (non presenti nell'Excel)
- Pratiche in stato `7-CHIUSA` o `ARCHIVIATA NON FINITA`.
- Pratiche senza cliente o con cliente privo di codice cliente.
Questi casi si gestiranno più avanti dal pannello in-app (Fase 2).
````

- [ ] **Step 2: Commit**

```bash
git add DOCUMENTAZIONE/RETRO_CODICI_PRATICA_README.md
git commit -m "docs(dm329): istruzioni revisione manuale codici pratica (Fase C)"
```

---

## Note di esecuzione

- I task 1–2 sono TDD puro (Vitest). I task 3–4 sono script che toccano il DB: la verifica è il **dry-run reale** con l'output atteso indicato; nessuna scrittura avviene senza `--apply`.
- Prima del primo `--apply`, fare un backup mirato delle colonne codice pratica di `requests` (via Management API), come da spec ("Sicurezza dei dati").
- Il **caso aperto integrazioni** (padre solo tra le chiuse) emerge come errore nel dry-run del Task 4: si decide allora se codificare in eccezione la primaria-padre o rinviare la singola integrazione.
- La **Fase E (pannello in-app)** ha un piano separato, da scrivere dopo aver chiuso questa Fase 1.

## Self-Review

- **Copertura spec:** Fase B → Task 3; Fase C → Task 5; Fase D → Task 4; logica raggruppamento → Task 1; validazione vincoli → Task 2; sicurezza dati (dry-run/backup) → note + Task 4; caso aperto integrazioni → note + validazione Task 2/4. Fase E esplicitamente rimandata a piano separato.
- **Placeholder:** nessuno; ogni step ha codice/comando completo.
- **Coerenza tipi:** `FetchedPractice`/`ProposedAssignment`/`proposeAssignments` (Task 1) usati in Task 3; `ReviewedAssignment`/`validateAssignments`/`ValidationReport` (Task 2) usati in Task 4. Nomi colonne Excel scritti in Task 3 (`sala_lettera`, `progressivo`, `anno`, `pratica_padre`, `indirizzo`, `tipo`, `request_id`) riletti in Task 4 con gli stessi nomi.
