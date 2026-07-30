# Codici apparecchiature DM329: identità stabile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il codice mostrato nella scheda dati DM329 è il codice memorizzato nel record, così la relazione tecnica stampa esattamente ciò che il tecnico vede a schermo.

**Architecture:** Il campo `codice` diventa l'identità dell'apparecchiatura: assegnato una volta, mostrato così com'è, mai riderivato dall'indice dell'array. Un nuovo modulo puro `src/utils/equipmentCodes.ts` diventa l'unico proprietario della logica dei codici (ordinamento, allocazione, normalizzazione, pulizia dei riferimenti); i quattro componenti che oggi producono o consumano codici lo usano al posto della propria aritmetica sugli indici.

**Tech Stack:** Vite + React 18 + TypeScript (`strict: false`) + Material UI 6 + React Hook Form + Vitest. Database Supabase (PostgreSQL, `equipment_data` e `additional_info` come colonne JSONB).

Spec di riferimento: `docs/superpowers/specs/2026-07-30-dm329-codici-apparecchiature-design.md`

## Global Constraints

- **Identità stabile.** Eliminando S2 da S1/S2/S3, l'ex S3 resta S3. Nessun codice viene mai rinumerato per effetto di un'eliminazione.
- **Nuovi codici sul buco più basso.** Con S1 e S3 presenti, la nuova apparecchiatura riceve S2. I codici restano sempre entro `1..max` di `EQUIPMENT_LIMITS`.
- **`EQUIPMENT_LIMITS` è la sola fonte di prefissi e massimi** (`src/types/technicalSheet.ts:265`, esportato da `@/types`). Nessun prefisso letterale sparso nei componenti.
- **`normalizeSchedaCodes` deve essere idempotente.** Gira a ogni caricamento di scheda: applicata due volte deve produrre lo stesso risultato e `changed: false` alla seconda.
- **Nessuna funzione di `equipmentCodes.ts` muta i propri argomenti.** Si ritornano nuovi oggetti.
- **Test solo sulla logica.** Da convenzioni di progetto (CLAUDE.md): Vitest per workflow logic, validations, calculations. Nessun test di interfaccia — i task sui componenti si verificano con typecheck, lint e passi manuali espliciti.
- **Test runner:** `npx vitest run <path>` (lo script `npm test` avvia vitest in watch mode e non termina).
- **Commit:** Conventional Commits, in italiano, come il resto del repository.

## File Structure

| File | Responsabilità |
|---|---|
| `src/utils/equipmentCodes.ts` *(nuovo)* | Unico proprietario della logica dei codici: parsing, ordinamento, allocazione, normalizzazione scheda, pulizia riferimenti. Puro, senza dipendenze da React. |
| `src/utils/__tests__/equipmentCodes.test.ts` *(nuovo)* | Test della logica sopra. |
| `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx` | Mostra il codice memorizzato, ordina le righe per codice, alloca i nuovi codici sul buco più basso, applica il limite `max`. |
| `src/pages/TechnicalDetails.tsx` | Normalizza i codici al caricamento della scheda e persiste se qualcosa è cambiato. |
| `src/components/technicalSheet/TechnicalSheetForm.tsx` | Il batch OCR assegna un codice a ogni record creato. |
| `src/components/relazione/RelazioneDataDialog.tsx` | Pulisce i riferimenti obsoleti all'apertura e al salvataggio, avvisando di cosa è stato rimosso. |
| `supabase/migrations/20260730000000_fix_dm329_missing_equipment_codes.sql` *(nuovo)* | Bonifica delle 2 schede con codici mai assegnati. |

**File deliberatamente non toccati:**

- `src/services/relazione/buildRelazioneModel.ts` e i moduli di `engine/`. Lo spec prevedeva un filtro difensivo, ma è già soddisfatto per costruzione: l'engine risolve sempre partendo dalle apparecchiature realmente presenti (`collegamenti[c.codice]` in `engine/valvole.ts:78`, `giriMap?.[c.codice]` in `engine/descrizioneGenerale.ts:17`, `spess.includes(d.codice)` in `engine/classificazione.ts:78`), quindi una voce obsoleta in `additional_info` non viene mai letta. Aggiungere un filtro sarebbe codice morto.
- `SerbatoiTable.tsx`, `CompressoriTable.tsx`, `EssiccatoriTable.tsx`, `FiltriTable.tsx`, `SeparatoriTable.tsx`, `SerbatoiSection.tsx`. Codice morto (il form monta `UnifiedEquipmentTable`; di `AllEquipmentSections` si importa solo `AltriApparecchiSection`). Decisione registrata nello spec; rimozione a task separato.
- Colonna `posizioni_compressori_spessimetrati`. Vuota in tutte le 354 righe, mai letta né scritta da `src`: colonna abbandonata, non riferimento attivo.

---

### Task 1: Parsing, ordinamento e allocazione dei codici

Le quattro funzioni di base, pure e senza dipendenze. Tutto il resto del piano si appoggia su queste.

**Files:**
- Create: `src/utils/equipmentCodes.ts`
- Test: `src/utils/__tests__/equipmentCodes.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `interface ParsedCode { prefix: string; num: number; sub?: number }`
  - `parseCode(code: unknown): ParsedCode | null`
  - `compareCodes(a: unknown, b: unknown): number`
  - `nextFreeCode(prefix: string, existing: unknown[], max: number): string | null`
  - `childCode(parentCode: string, sub?: number): string`

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/equipmentCodes.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { parseCode, compareCodes, nextFreeCode, childCode } from '@/utils/equipmentCodes'

describe('parseCode', () => {
  test('riconosce i codici principali', () => {
    expect(parseCode('S1')).toEqual({ prefix: 'S', num: 1 })
    expect(parseCode('SEP12')).toEqual({ prefix: 'SEP', num: 12 })
  })

  test('riconosce i codici dei figli', () => {
    expect(parseCode('C1.1')).toEqual({ prefix: 'C', num: 1, sub: 1 })
  })

  test('rifiuta i valori non validi', () => {
    expect(parseCode(null)).toBeNull()
    expect(parseCode(undefined)).toBeNull()
    expect(parseCode('')).toBeNull()
    expect(parseCode('undefined.1')).toBeNull()
    expect(parseCode('s1')).toBeNull()
    expect(parseCode('S')).toBeNull()
    expect(parseCode(3)).toBeNull()
  })
})

describe('compareCodes', () => {
  test('ordina numericamente, non alfabeticamente', () => {
    expect(['S10', 'S2', 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', 'S10'])
  })

  test('mette il figlio dopo il padre', () => {
    expect(['C1.1', 'C1'].sort(compareCodes)).toEqual(['C1', 'C1.1'])
  })

  test('raggruppa per prefisso', () => {
    expect(['S1', 'C1'].sort(compareCodes)).toEqual(['C1', 'S1'])
  })

  test('manda in fondo i codici non validi', () => {
    expect(['S2', null, 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', null])
  })
})

describe('nextFreeCode', () => {
  test('riempie il buco più basso', () => {
    expect(nextFreeCode('S', ['S1', 'S3'], 7)).toBe('S2')
  })

  test('parte da 1 su insieme vuoto', () => {
    expect(nextFreeCode('S', [], 7)).toBe('S1')
  })

  test('accoda quando non ci sono buchi', () => {
    expect(nextFreeCode('S', ['S1', 'S2'], 7)).toBe('S3')
  })

  test('ritorna null quando il tipo è saturo', () => {
    expect(nextFreeCode('SEP', ['SEP1', 'SEP2', 'SEP3'], 3)).toBeNull()
  })

  test('ignora i codici di altro prefisso', () => {
    expect(nextFreeCode('S', ['C1', 'C2'], 7)).toBe('S1')
  })

  test('ignora i codici dei figli: C1.1 non riserva il numero 1', () => {
    expect(nextFreeCode('C', ['C1.1'], 5)).toBe('C1')
  })

  test('tollera i valori non validi nella lista', () => {
    expect(nextFreeCode('S', [null, undefined, '', 'S1'], 7)).toBe('S2')
  })
})

describe('childCode', () => {
  test('deriva il codice del figlio dal padre', () => {
    expect(childCode('C3')).toBe('C3.1')
    expect(childCode('S1', 2)).toBe('S1.2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: FAIL — `Failed to resolve import "@/utils/equipmentCodes"`

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/equipmentCodes.ts`:

```ts
/**
 * Codici apparecchiature DM329.
 *
 * Il `codice` è l'identità dell'apparecchiatura: assegnato una volta, mostrato così com'è, mai
 * riderivato dall'indice dell'array. Eliminando S2 da S1/S2/S3 l'ex S3 resta S3; una nuova
 * apparecchiatura riceve il numero libero più basso (S2), così i codici restano sempre entro
 * 1..max di EQUIPMENT_LIMITS.
 */

export interface ParsedCode {
  prefix: string
  num: number
  /** Sotto-numero dei figli: `C1.1` → sub 1. Assente nei codici principali. */
  sub?: number
}

const CODE_RE = /^([A-Z]+)(\d+)(?:\.(\d+))?$/

/** Scompone un codice, o ritorna null se non è un codice valido. */
export function parseCode(code: unknown): ParsedCode | null {
  if (typeof code !== 'string') return null
  const m = CODE_RE.exec(code.trim())
  if (!m) return null
  const parsed: ParsedCode = { prefix: m[1], num: Number(m[2]) }
  if (m[3] !== undefined) parsed.sub = Number(m[3])
  return parsed
}

/**
 * Ordine naturale dei codici: S1 < S2 < S10, C1 < C1.1, prefissi raggruppati.
 * I codici non validi finiscono in fondo.
 */
export function compareCodes(a: unknown, b: unknown): number {
  const pa = parseCode(a)
  const pb = parseCode(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  if (pa.num !== pb.num) return pa.num - pb.num
  return (pa.sub ?? 0) - (pb.sub ?? 0)
}

/**
 * Numero libero più basso per il prefisso dato, entro 1..max.
 * I codici dei figli (`C1.1`) non riservano il numero del padre: un disoleatore orfano non
 * impedisce di creare il compressore C1.
 * Ritorna null se il tipo è saturo.
 */
export function nextFreeCode(prefix: string, existing: unknown[], max: number): string | null {
  const taken = new Set<number>()
  for (const code of existing) {
    const p = parseCode(code)
    if (p && p.prefix === prefix && p.sub === undefined) taken.add(p.num)
  }
  for (let n = 1; n <= max; n++) {
    if (!taken.has(n)) return `${prefix}${n}`
  }
  return null
}

/** Codice di un'apparecchiatura dipendente, derivato dal padre. */
export function childCode(parentCode: string, sub = 1): string {
  return `${parentCode}.${sub}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: PASS — 15 test

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentCodes.ts src/utils/__tests__/equipmentCodes.test.ts
git commit -m "feat(dm329): parsing, ordinamento e allocazione dei codici apparecchiatura"
```

---

### Task 2: Normalizzazione dei codici di una scheda

Assegna i codici mancanti, ripara i figli, risolve i duplicati. Serve sia per bonificare i dati esistenti al caricamento sia per completare i segnaposto lasciati dal batch OCR.

**Files:**
- Modify: `src/utils/equipmentCodes.ts` (aggiunge in coda)
- Test: `src/utils/__tests__/equipmentCodes.test.ts` (aggiunge in coda)

**Interfaces:**
- Consumes: `parseCode`, `nextFreeCode`, `childCode` da Task 1.
- Produces:
  - `collectCodes(scheda: any): Set<string>` — tutti i codici validi presenti negli 8 array della scheda.
  - `normalizeSchedaCodes<T extends Record<string, any>>(scheda: T): { scheda: T; changed: boolean }`

- [ ] **Step 1: Write the failing test**

Estendere l'import esistente in testa a `src/utils/__tests__/equipmentCodes.test.ts` (non aggiungere un secondo `import`: ESLint richiede gli import in cima al file):

```ts
import {
  parseCode, compareCodes, nextFreeCode, childCode, collectCodes, normalizeSchedaCodes,
} from '@/utils/equipmentCodes'
```

Poi aggiungere in coda al file:

```ts
describe('collectCodes', () => {
  test('raccoglie i codici validi di tutti gli array', () => {
    const codes = collectCodes({
      serbatoi: [{ codice: 'S1' }],
      compressori: [{ codice: 'C1' }],
      disoleatori: [{ codice: 'C1.1' }],
      filtri: [{ codice: null }],
    })
    expect(codes).toEqual(new Set(['S1', 'C1', 'C1.1']))
  })

  test('tollera scheda vuota o array assenti', () => {
    expect(collectCodes({})).toEqual(new Set())
    expect(collectCodes(null)).toEqual(new Set())
  })
})

describe('normalizeSchedaCodes', () => {
  test('assegna i codici mancanti in ordine di array', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ marca: 'a' }, { marca: 'b' }],
    })
    expect(changed).toBe(true)
    expect(scheda.compressori.map((c: any) => c.codice)).toEqual(['C1', 'C2'])
  })

  test('non rinumera: i buchi restano buchi', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1' }, { codice: 'S3' }],
    })
    expect(changed).toBe(false)
    expect(scheda.serbatoi.map((s: any) => s.codice)).toEqual(['S1', 'S3'])
  })

  test('assegna al record privo di codice il numero libero più basso', () => {
    const { scheda } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1' }, { codice: 'S3' }, {}],
    })
    expect(scheda.serbatoi.map((s: any) => s.codice)).toEqual(['S1', 'S3', 'S2'])
  })

  test('risolve i duplicati conservando il primo', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      serbatoi: [{ codice: 'S1', marca: 'primo' }, { codice: 'S1', marca: 'secondo' }],
    })
    expect(changed).toBe(true)
    expect(scheda.serbatoi[0]).toEqual({ codice: 'S1', marca: 'primo' })
    expect(scheda.serbatoi[1]).toEqual({ codice: 'S2', marca: 'secondo' })
  })

  test('riassegna i codici di prefisso sbagliato', () => {
    const { scheda } = normalizeSchedaCodes({ serbatoi: [{ codice: 'X9' }] })
    expect(scheda.serbatoi[0].codice).toBe('S1')
  })

  test('riassegna i codici fuori dal massimo del tipo', () => {
    const { scheda } = normalizeSchedaCodes({ separatori: [{ codice: 'SEP9' }] })
    expect(scheda.separatori[0].codice).toBe('SEP1')
  })

  test('lascia intatto il record quando il tipo è saturo', () => {
    const { scheda } = normalizeSchedaCodes({
      separatori: [{ codice: 'SEP1' }, { codice: 'SEP2' }, { codice: 'SEP3' }, { marca: 'quarto' }],
    })
    expect(scheda.separatori[3]).toEqual({ marca: 'quarto' })
  })

  test('deriva il codice del figlio dal riferimento al padre', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      compressori: [{ codice: 'C1' }, { codice: 'C2' }, { codice: 'C3' }],
      disoleatori: [{ codice: 'undefined.1', compressore_associato: 'C3' }],
    })
    expect(changed).toBe(true)
    expect(scheda.disoleatori[0].codice).toBe('C3.1')
  })

  test('lascia intatto il figlio senza riferimento valido', () => {
    const { scheda, changed } = normalizeSchedaCodes({
      disoleatori: [{ codice: 'undefined.1', compressore_associato: null }],
    })
    expect(changed).toBe(false)
    expect(scheda.disoleatori[0].codice).toBe('undefined.1')
  })

  test('deriva anche i codici di scambiatori e recipienti', () => {
    const { scheda } = normalizeSchedaCodes({
      scambiatori: [{ essiccatore_associato: 'E2' }],
      recipienti_filtro: [{ filtro_associato: 'F1' }],
    })
    expect(scheda.scambiatori[0].codice).toBe('E2.1')
    expect(scheda.recipienti_filtro[0].codice).toBe('F1.1')
  })

  test('è idempotente', () => {
    const first = normalizeSchedaCodes({
      compressori: [{ marca: 'a' }, { marca: 'b' }],
      disoleatori: [{ compressore_associato: 'C2' }],
    })
    const second = normalizeSchedaCodes(first.scheda)
    expect(second.changed).toBe(false)
    expect(second.scheda).toEqual(first.scheda)
  })

  test('non modifica la scheda in ingresso', () => {
    const input = { compressori: [{ marca: 'a' }] }
    normalizeSchedaCodes(input)
    expect(input.compressori[0]).toEqual({ marca: 'a' })
  })

  test('conserva i campi non gestiti', () => {
    const { scheda } = normalizeSchedaCodes({
      stato: 'bozza',
      dati_generali: { cliente: 'ACME' },
      serbatoi: [{ marca: 'a' }],
    })
    expect(scheda.stato).toBe('bozza')
    expect(scheda.dati_generali).toEqual({ cliente: 'ACME' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: FAIL — `collectCodes is not a function` / `normalizeSchedaCodes is not a function`

- [ ] **Step 3: Write minimal implementation**

In `src/utils/equipmentCodes.ts`, aggiungere l'import subito dopo il commento di testata e prima di `export interface ParsedCode` (ESLint richiede gli import in cima al file):

```ts
import { EQUIPMENT_LIMITS } from '@/types'
```

Poi aggiungere in coda al file:

```ts
/** Array principali della scheda: prefisso e massimo vengono da EQUIPMENT_LIMITS. */
const PARENT_ARRAYS = ['serbatoi', 'compressori', 'essiccatori', 'filtri', 'separatori'] as const

/** Array dipendenti: il codice si deriva dal padre tramite il campo di riferimento. */
const CHILD_ARRAYS = [
  { array: 'disoleatori', ref: 'compressore_associato' },
  { array: 'scambiatori', ref: 'essiccatore_associato' },
  { array: 'recipienti_filtro', ref: 'filtro_associato' },
] as const

/** Tutti i codici validi presenti nella scheda, per validare i riferimenti. */
export function collectCodes(scheda: any): Set<string> {
  const codes = new Set<string>()
  const names: string[] = [...PARENT_ARRAYS, ...CHILD_ARRAYS.map((c) => c.array)]
  for (const name of names) {
    const items = scheda?.[name]
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (parseCode(item?.codice)) codes.add(item.codice)
    }
  }
  return codes
}

/**
 * Completa i codici di una scheda senza rinumerare nulla di valido.
 *
 * Array principali: scorre nell'ordine in cui si trovano e assegna a ogni record privo di codice
 * valido — mancante, di prefisso sbagliato, fuori dal massimo del tipo, o duplicato di uno già
 * visto — il numero libero più basso.
 *
 * Array dipendenti: riallinea `codice` a `${riferimento}.1`. Il riferimento al padre deve avere il
 * prefisso e il numero entro i limiti specifici dell'array dipendente (es. disoleatori richiede
 * prefisso 'C' e num 1..5); se il riferimento non è valido il codice non è derivabile e il record
 * resta intatto. Anche quando il riferimento è valido, se il codice derivato è già occupato da un
 * altro figlio dello stesso padre, il record precedente conserva il codice e il nuovo resta intatto.
 *
 * Idempotente: applicata al proprio risultato ritorna `changed: false`.
 */
export function normalizeSchedaCodes<T extends Record<string, any>>(
  scheda: T
): { scheda: T; changed: boolean } {
  let changed = false
  const out: Record<string, any> = { ...(scheda ?? {}) }

  for (const name of PARENT_ARRAYS) {
    const items = scheda?.[name]
    if (!Array.isArray(items) || items.length === 0) continue

    const { prefix, max } = EQUIPMENT_LIMITS[name]
    const seen = new Set<number>()
    let touched = false

    // 1° passaggio: individua i codici da conservare.
    const keep = items.map((item: any) => {
      const p = parseCode(item?.codice)
      if (!p || p.prefix !== prefix || p.sub !== undefined || p.num < 1 || p.num > max) return false
      if (seen.has(p.num)) return false // duplicato: conserva il primo
      seen.add(p.num)
      return true
    })

    // 2° passaggio: assegna il numero libero più basso a chi ne è privo.
    const next = items.map((item: any, i: number) => {
      if (keep[i]) return item
      const taken = [...seen].map((n) => `${prefix}${n}`)
      const code = nextFreeCode(prefix, taken, max)
      if (!code) return item // tipo saturo: non c'è codice da assegnare
      seen.add(parseCode(code)!.num)
      touched = true
      return { ...item, codice: code }
    })

    if (touched) {
      out[name] = next
      changed = true
    }
  }

  for (const { array, ref } of CHILD_ARRAYS) {
    const items = scheda?.[array]
    if (!Array.isArray(items) || items.length === 0) continue

    const { prefix, max } = EQUIPMENT_LIMITS[array]
    /** Codice che il figlio dovrebbe avere, o null se il riferimento non è utilizzabile. */
    const expectedOf = (item: any): string | null => {
      const parent = parseCode(item?.[ref])
      if (!parent || parent.sub !== undefined) return null
      if (parent.prefix !== prefix || parent.num < 1 || parent.num > max) return null
      return childCode(item[ref])
    }
    const claimed = new Set<string>()
    // 1° passaggio: chi ha già il codice corretto lo mantiene e se lo riserva.
    items.forEach((item: any) => {
      const expected = expectedOf(item)
      if (expected && item?.codice === expected) claimed.add(expected)
    })
    // 2° passaggio: assegna a chi ne è privo, senza creare duplicati.
    let touched = false
    const next = items.map((item: any) => {
      const expected = expectedOf(item)
      if (!expected || item?.codice === expected) return item
      if (claimed.has(expected)) return item // il codice appartiene già a un altro figlio
      claimed.add(expected)
      touched = true
      return { ...item, codice: expected }
    })

    if (touched) {
      out[array] = next
      changed = true
    }
  }

  return { scheda: out as T, changed }
}
```

**Nota — deviazione approvata dopo la revisione.** Il passaggio sui figli sopra è più robusto di quanto il piano prevedesse in origine: valida prefisso e intervallo del riferimento contro l'entry `EQUIPMENT_LIMITS` dell'array dipendente, e usa due passaggi per non creare codici figli duplicati (chi ha già il codice corretto ha la precedenza sull'ordine di array). Senza la validazione un `compressore_associato: 'C99'` produceva `codice: 'C99.1'`, fuori da `1..max`, violando i vincoli globali; senza la deduplica due disoleatori sullo stesso padre ricevevano entrambi `C1.1`. Il round di fix ha aggiunto 5 test — riferimento di prefisso sbagliato, riferimento fuori dal massimo, due figli sullo stesso padre, precedenza di chi ha già il codice corretto, idempotenza con due figli sullo stesso padre — portando il totale a 35.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: PASS — 30 test (15 di Task 1 + 15 nuovi); 35 dopo il round di fix descritto sotto

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentCodes.ts src/utils/__tests__/equipmentCodes.test.ts
git commit -m "feat(dm329): normalizzazione idempotente dei codici di una scheda"
```

---

### Task 3: Pulizia dei riferimenti obsoleti in additional_info

`additional_info` contiene codici come chiavi e come valori. Questa funzione li confronta con i codici realmente presenti nella scheda e riporta cosa ha rimosso, così il dialog può dirlo all'utente.

**Files:**
- Modify: `src/utils/equipmentCodes.ts` (aggiunge in coda)
- Test: `src/utils/__tests__/equipmentCodes.test.ts` (aggiunge in coda)

**Interfaces:**
- Consumes: niente da Task 1/2 a runtime; usa i tipi `AdditionalInfo` e `TipoGiri` da `@/services/relazione/types`.
- Produces: `pruneAdditionalInfo(info: AdditionalInfo | undefined, codes: Set<string>): { info: AdditionalInfo; dropped: string[] }`

- [ ] **Step 1: Write the failing test**

Aggiungere `pruneAdditionalInfo` all'import esistente in testa a `src/utils/__tests__/equipmentCodes.test.ts`, poi aggiungere in coda al file:

```ts
describe('pruneAdditionalInfo', () => {
  const codes = new Set(['C1', 'S1', 'S2'])

  test('rimuove i giri di compressori inesistenti', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { compressoriGiri: { C1: 'fissi', C9: 'variabili' } },
      codes
    )
    expect(info.compressoriGiri).toEqual({ C1: 'fissi' })
    expect(dropped).toEqual(['giri C9'])
  })

  test('rimuove la chiave di collegamento di un compressore inesistente', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { collegamentiCompressoriSerbatoi: { C9: ['S1'] } },
      codes
    )
    expect(info.collegamentiCompressoriSerbatoi).toEqual({})
    expect(dropped).toEqual(['collegamenti C9'])
  })

  test('filtra i serbatoi inesistenti conservando la chiave', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { collegamentiCompressoriSerbatoi: { C1: ['S1', 'S7'] } },
      codes
    )
    expect(info.collegamentiCompressoriSerbatoi).toEqual({ C1: ['S1'] })
    expect(dropped).toEqual(['collegamento C1 → S7'])
  })

  test('filtra la spessimetrica', () => {
    const { info, dropped } = pruneAdditionalInfo({ spessimetrica: ['S1', 'S9'] }, codes)
    expect(info.spessimetrica).toEqual(['S1'])
    expect(dropped).toEqual(['spessimetrica S9'])
  })

  test('conserva i campi testuali', () => {
    const { info } = pruneAdditionalInfo(
      { descrizioneAttivita: 'officina', motivoRevisione: 'aggiunta serbatoio' },
      codes
    )
    expect(info.descrizioneAttivita).toBe('officina')
    expect(info.motivoRevisione).toBe('aggiunta serbatoio')
  })

  test('non segnala nulla quando tutto è valido', () => {
    const { dropped } = pruneAdditionalInfo(
      { compressoriGiri: { C1: 'fissi' }, collegamentiCompressoriSerbatoi: { C1: ['S1', 'S2'] } },
      codes
    )
    expect(dropped).toEqual([])
  })

  test('tollera additional_info assente', () => {
    const { info, dropped } = pruneAdditionalInfo(undefined, codes)
    expect(info).toEqual({
      compressoriGiri: {},
      spessimetrica: [],
      collegamentiCompressoriSerbatoi: {},
    })
    expect(dropped).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: FAIL — `pruneAdditionalInfo is not a function`

- [ ] **Step 3: Write minimal implementation**

In `src/utils/equipmentCodes.ts`, aggiungere l'import fra gli altri in cima al file:

```ts
import type { AdditionalInfo, TipoGiri } from '@/services/relazione/types'
```

Poi aggiungere in coda al file:

```ts
/**
 * Rimuove da `additional_info` i riferimenti a codici non più presenti nella scheda e riporta
 * cosa ha scartato, così il chiamante può dirlo all'utente.
 *
 * Attenzione al limite intrinseco del modello posizionale: se un codice liberato viene
 * riassegnato a una nuova apparecchiatura, un riferimento redatto per la precedente risulta
 * ancora valido e resta agganciato alla nuova. Qui non c'è l'informazione per distinguere i due
 * casi; la riconferma visiva nel dialog è la mitigazione.
 */
export function pruneAdditionalInfo(
  info: AdditionalInfo | undefined,
  codes: Set<string>
): { info: AdditionalInfo; dropped: string[] } {
  const src = info ?? {}
  const dropped: string[] = []

  const compressoriGiri: Record<string, TipoGiri> = {}
  for (const [code, giro] of Object.entries(src.compressoriGiri ?? {})) {
    if (codes.has(code)) compressoriGiri[code] = giro
    else dropped.push(`giri ${code}`)
  }

  const collegamentiCompressoriSerbatoi: Record<string, string[]> = {}
  for (const [code, serbatoi] of Object.entries(src.collegamentiCompressoriSerbatoi ?? {})) {
    if (!codes.has(code)) {
      dropped.push(`collegamenti ${code}`)
      continue
    }
    collegamentiCompressoriSerbatoi[code] = (serbatoi ?? []).filter((s) => {
      if (codes.has(s)) return true
      dropped.push(`collegamento ${code} → ${s}`)
      return false
    })
  }

  const spessimetrica = (src.spessimetrica ?? []).filter((code) => {
    if (codes.has(code)) return true
    dropped.push(`spessimetrica ${code}`)
    return false
  })

  return {
    info: { ...src, compressoriGiri, spessimetrica, collegamentiCompressoriSerbatoi },
    dropped,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/equipmentCodes.test.ts`
Expected: PASS — 42 test (35 + 7 nuovi)

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentCodes.ts src/utils/__tests__/equipmentCodes.test.ts
git commit -m "feat(dm329): pulizia dei riferimenti obsoleti in additional_info"
```

---

### Task 4: La tabella mostra il codice memorizzato

Il cuore della correzione. La tabella smette di calcolare il codice dall'indice, ordina le righe per codice e alloca i nuovi codici sul buco più basso.

**Files:**
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`

**Interfaces:**
- Consumes: `compareCodes`, `nextFreeCode` da Task 1; `EQUIPMENT_LIMITS` da `@/types`.
- Produces: niente per i task successivi.

Nessun test unitario: da convenzioni di progetto non si testa l'interfaccia. La verifica è typecheck, lint e passi manuali.

- [ ] **Step 1: Sostituire l'import di `generateEquipmentCode`**

In `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`, riga 17, sostituire:

```ts
import { generateEquipmentCode, type CategoriaPED, type EquipmentCatalogType } from '@/types'
```

con:

```ts
import { EQUIPMENT_LIMITS, type CategoriaPED, type EquipmentCatalogType } from '@/types'
import { compareCodes, nextFreeCode } from '@/utils/equipmentCodes'
```

- [ ] **Step 2: Aggiungere gli helper a livello di modulo**

Subito dopo la costante `ENABLE_ADD_TO_CATALOG` (riga 28), inserire:

```tsx
/**
 * Righe da rendere, ordinate per codice. `i` resta l'indice reale nell'array di React Hook Form:
 * l'ordinamento riguarda solo la resa, non i percorsi dei campi.
 *
 * Il codice si legge dai valori osservati (`values`), non da `fields` di `useFieldArray`, che non
 * si risincronizza dopo un `setValue` esterno come quello del batch OCR. `fields` resta come
 * ripiego finché l'osservazione non ha prodotto un valore.
 */
const sortedEntries = (fields: any[], values: any[] | undefined) =>
  fields
    .map((f: any, i: number) => ({ f, i, code: (values?.[i]?.codice ?? f?.codice ?? '') as string }))
    .sort((a, b) => compareCodes(a.code, b.code))

/** Codici correnti di un array, per calcolare il prossimo numero libero. */
const codesOf = (fields: any[], values: any[] | undefined) =>
  fields.map((f: any, i: number) => values?.[i]?.codice ?? f?.codice)
```

- [ ] **Step 3: Osservare i valori degli array**

Nel corpo di `UnifiedEquipmentTable`, subito dopo le otto chiamate a `useFieldArray` (riga 225, dopo `const separatori = useFieldArray(...)`), inserire:

```tsx
  // I codici vengono dai valori del form, non da `fields`: vedi sortedEntries.
  const serbatoiVals = useWatch({ control, name: 'serbatoi' }) as any[] | undefined
  const compressoriVals = useWatch({ control, name: 'compressori' }) as any[] | undefined
  const disoleatoriVals = useWatch({ control, name: 'disoleatori' }) as any[] | undefined
  const essiccatoriVals = useWatch({ control, name: 'essiccatori' }) as any[] | undefined
  const scambiatoriVals = useWatch({ control, name: 'scambiatori' }) as any[] | undefined
  const filtriVals = useWatch({ control, name: 'filtri' }) as any[] | undefined
  const recipientiVals = useWatch({ control, name: 'recipienti_filtro' }) as any[] | undefined
  const separatoriVals = useWatch({ control, name: 'separatori' }) as any[] | undefined

  /** Conteggio e massimo per i tipi creabili: serve a disabilitare la voce di menu. */
  const newKindState: Record<string, { count: number; max: number }> = {
    serbatoio: { count: serbatoi.fields.length, max: EQUIPMENT_LIMITS.serbatoi.max },
    compressore: { count: compressori.fields.length, max: EQUIPMENT_LIMITS.compressori.max },
    essiccatore: { count: essiccatori.fields.length, max: EQUIPMENT_LIMITS.essiccatori.max },
    filtro: { count: filtri.fields.length, max: EQUIPMENT_LIMITS.filtri.max },
    separatore: { count: separatori.fields.length, max: EQUIPMENT_LIMITS.separatori.max },
  }
```

- [ ] **Step 4: Allocare i nuovi codici sul buco più basso**

Sostituire integralmente `addNew` (righe 229-243) con:

```tsx
  const addNew = (kind: EquipmentKind) => {
    setMenuAnchor(null)
    switch (kind) {
      case 'serbatoio': {
        const codice = nextFreeCode('S', codesOf(serbatoi.fields, serbatoiVals), EQUIPMENT_LIMITS.serbatoi.max)
        if (codice) serbatoi.append({ codice, valvola_sicurezza: {}, manometro: {} })
        break
      }
      case 'compressore': {
        const codice = nextFreeCode('C', codesOf(compressori.fields, compressoriVals), EQUIPMENT_LIMITS.compressori.max)
        if (codice) compressori.append({ codice, ha_disoleatore: false })
        break
      }
      case 'essiccatore': {
        const codice = nextFreeCode('E', codesOf(essiccatori.fields, essiccatoriVals), EQUIPMENT_LIMITS.essiccatori.max)
        if (codice) essiccatori.append({ codice, ha_scambiatore: false })
        break
      }
      case 'filtro': {
        const codice = nextFreeCode('F', codesOf(filtri.fields, filtriVals), EQUIPMENT_LIMITS.filtri.max)
        if (codice) filtri.append({ codice, ha_recipiente: false })
        break
      }
      case 'separatore': {
        const codice = nextFreeCode('SEP', codesOf(separatori.fields, separatoriVals), EQUIPMENT_LIMITS.separatori.max)
        if (codice) separatori.append({ codice })
        break
      }
    }
  }
```

- [ ] **Step 5: Rendere le righe dal codice memorizzato, ordinate**

Sostituire integralmente i cinque cicli di costruzione delle righe (righe 247-306, da `serbatoi.fields.forEach(` fino alla chiusura del ciclo dei separatori) con:

```tsx
  sortedEntries(serbatoi.fields, serbatoiVals).forEach(({ f, i, code }) => {
    rows.push(<EqRow key={`s-${f.id}`} control={control} def={EQUIPMENT_DEFS.serbatoio} base={`serbatoi.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i }}
      onDelete={() => { if (confirmDel('il serbatoio', code)) serbatoi.remove(i) }}
      append={null} />)
    rows.push(<EqRow key={`s-${f.id}-v`} control={control} def={EQUIPMENT_DEFS.valvola} base={`serbatoi.${i}.valvola_sicurezza`} code={`${code}.1`} depth={1} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i, componentType: 'valvola_sicurezza' }} onDelete={null} append={null} />)
  })

  sortedEntries(compressori.fields, compressoriVals).forEach(({ f, i, code }) => {
    const dIdx = (disoleatoriVals ?? disoleatori.fields).findIndex((d: any) => d?.compressore_associato === code)
    rows.push(<EqRow key={`c-${f.id}`} control={control} def={EQUIPMENT_DEFS.compressore} base={`compressori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Compressori', equipmentIndex: i }}
      onDelete={() => { if (confirmDel('il compressore', code)) { if (dIdx >= 0) disoleatori.remove(dIdx); compressori.remove(i) } }}
      append={dIdx === -1 ? { label: 'Disoleatore', onClick: () => { disoleatori.append({ codice: `${code}.1`, compressore_associato: code, valvola_sicurezza: {} }); setValue(`compressori.${i}.ha_disoleatore`, true) } } : null} />)
    if (dIdx >= 0) {
      rows.push(<EqRow key={`c-${f.id}-d`} control={control} def={EQUIPMENT_DEFS.disoleatore} base={`disoleatori.${dIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx }}
        onDelete={() => { if (confirmDel('il disoleatore', `${code}.1`)) { disoleatori.remove(dIdx); setValue(`compressori.${i}.ha_disoleatore`, false) } }} append={null} />)
      rows.push(<EqRow key={`c-${f.id}-dv`} control={control} def={EQUIPMENT_DEFS.valvola} base={`disoleatori.${dIdx}.valvola_sicurezza`} code={`${code}.2`} depth={2} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx, componentType: 'valvola_sicurezza' }} onDelete={null} append={null} />)
    }
  })

  sortedEntries(essiccatori.fields, essiccatoriVals).forEach(({ f, i, code }) => {
    const sIdx = (scambiatoriVals ?? scambiatori.fields).findIndex((s: any) => s?.essiccatore_associato === code)
    rows.push(<EqRow key={`e-${f.id}`} control={control} def={EQUIPMENT_DEFS.essiccatore} base={`essiccatori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Essiccatori', equipmentIndex: i }}
      onDelete={() => { if (confirmDel("l'essiccatore", code)) { if (sIdx >= 0) scambiatori.remove(sIdx); essiccatori.remove(i) } }}
      append={sIdx === -1 ? { label: 'Scambiatore', onClick: () => { scambiatori.append({ codice: `${code}.1`, essiccatore_associato: code }); setValue(`essiccatori.${i}.ha_scambiatore`, true) } } : null} />)
    if (sIdx >= 0) {
      rows.push(<EqRow key={`e-${f.id}-s`} control={control} def={EQUIPMENT_DEFS.scambiatore} base={`scambiatori.${sIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Scambiatori', equipmentIndex: sIdx }}
        onDelete={() => { if (confirmDel('lo scambiatore', `${code}.1`)) { scambiatori.remove(sIdx); setValue(`essiccatori.${i}.ha_scambiatore`, false) } }} append={null} />)
    }
  })

  sortedEntries(filtri.fields, filtriVals).forEach(({ f, i, code }) => {
    const rIdx = (recipientiVals ?? recipienti.fields).findIndex((r: any) => r?.filtro_associato === code)
    rows.push(<EqRow key={`f-${f.id}`} control={control} def={EQUIPMENT_DEFS.filtro} base={`filtri.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Filtri', equipmentIndex: i }}
      onDelete={() => { if (confirmDel('il filtro', code)) { if (rIdx >= 0) recipienti.remove(rIdx); filtri.remove(i) } }}
      append={(showRecipienteFiltro && rIdx === -1) ? { label: 'Recipiente', onClick: () => { recipienti.append({ codice: `${code}.1`, filtro_associato: code }); setValue(`filtri.${i}.ha_recipiente`, true) } } : null} />)
    if (rIdx >= 0 && showRecipienteFiltro) {
      rows.push(<EqRow key={`f-${f.id}-r`} control={control} def={EQUIPMENT_DEFS.recipiente} base={`recipienti_filtro.${rIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Recipienti filtro', equipmentIndex: rIdx }}
        onDelete={() => { if (confirmDel('il recipiente', `${code}.1`)) { recipienti.remove(rIdx); setValue(`filtri.${i}.ha_recipiente`, false) } }} append={null} />)
    }
  })

  sortedEntries(separatori.fields, separatoriVals).forEach(({ f, i, code }) => {
    rows.push(<EqRow key={`sep-${f.id}`} control={control} def={EQUIPMENT_DEFS.separatore} base={`separatori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Separatori', equipmentIndex: i }}
      onDelete={() => { if (confirmDel('il separatore', code)) separatori.remove(i) }} append={null} />)
  })
```

- [ ] **Step 6: Disabilitare la voce di menu al raggiungimento del massimo**

Sostituire il blocco `<MenuItem>` (righe 319-324) con:

```tsx
          {NEW_EQUIPMENT_KINDS.map((k) => (
            <MenuItem key={k} onClick={() => addNew(k)} disabled={newKindState[k].count >= newKindState[k].max}>
              <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: KIND_COLOR[k], mr: 1.5 }} />
              {EQUIPMENT_DEFS[k].label}
              {newKindState[k].count >= newKindState[k].max && (
                <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 1 }}>
                  (max {newKindState[k].max})
                </Typography>
              )}
            </MenuItem>
          ))}
```

- [ ] **Step 7: Verificare typecheck e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npm run lint`
Expected: nessun errore, nessun warning. In particolare `generateEquipmentCode` non deve più risultare importato e non usato.

- [ ] **Step 8: Verificare a mano il comportamento**

Run: `npm run dev`, aprire una scheda dati DM329 con almeno 3 serbatoi.

1. Eliminare il secondo serbatoio. Atteso: le righe restanti mostrano `S1` e `S3`, non `S1` e `S2`.
2. Aggiungere un serbatoio. Atteso: riceve `S2` e compare **fra** S1 e S3, non in fondo.
3. Aggiungere serbatoi fino a 7. Atteso: la voce «Serbatoio» del menu risulta disabilitata con l'indicazione `(max 7)`.
4. Su un compressore con disoleatore, eliminare il compressore. Atteso: sparisce anche il disoleatore e le sue righe valvola.
5. Ricaricare la pagina. Atteso: i codici mostrati sono identici a prima del ricaricamento.

- [ ] **Step 9: Commit**

```bash
git add src/components/technicalSheet/table/UnifiedEquipmentTable.tsx
git commit -m "fix(dm329): la tabella mostra il codice memorizzato, non quello dell'indice"
```

---

### Task 5: Normalizzazione al caricamento della scheda

Chi apre una scheda con codici mancanti — le 2 schede importate via batch OCR — la vede riparata, e la riparazione viene persistita.

**Files:**
- Modify: `src/pages/TechnicalDetails.tsx:103-116`

**Interfaces:**
- Consumes: `normalizeSchedaCodes` da Task 2.
- Produces: niente per i task successivi.

- [ ] **Step 1: Aggiungere l'import**

In `src/pages/TechnicalDetails.tsx`, fra gli import esistenti:

```ts
import { normalizeSchedaCodes } from '@/utils/equipmentCodes'
```

- [ ] **Step 2: Normalizzare dopo il parsing di equipment_data**

Sostituire il blocco alle righe 103-116:

```ts
        // Parse equipment_data da JSONB
        if (data && data.equipment_data) {
          const parsedData = data.equipment_data as SchedaDatiCompleta

          // Precompilazione nome_tecnico se vuoto e richiesta assegnata
          if (!parsedData.dati_generali?.nome_tecnico && request?.assigned_user?.full_name) {
            parsedData.dati_generali = {
              ...parsedData.dati_generali,
              nome_tecnico: request.assigned_user.full_name,
            }
          }

          setFormData(parsedData)
        }
```

con:

```ts
        // Parse equipment_data da JSONB
        if (data && data.equipment_data) {
          const parsedData = data.equipment_data as SchedaDatiCompleta

          // Precompilazione nome_tecnico se vuoto e richiesta assegnata
          if (!parsedData.dati_generali?.nome_tecnico && request?.assigned_user?.full_name) {
            parsedData.dati_generali = {
              ...parsedData.dati_generali,
              nome_tecnico: request.assigned_user.full_name,
            }
          }

          // Completa i codici mancanti: il codice mostrato è quello memorizzato, quindi un record
          // senza codice comparirebbe con la colonna vuota. Idempotente, quindi a regime non fa
          // nulla; la persistenza non è bloccante perché la scheda è già utilizzabile.
          const { scheda: normalized, changed } = normalizeSchedaCodes(parsedData)
          if (changed) {
            try {
              await technicalDataApi.updateEquipmentData(id, normalized)
            } catch (normErr) {
              console.error('[normalizeSchedaCodes] Errore nel salvataggio dei codici:', normErr)
            }
          }

          setFormData(normalized)
        }
```

- [ ] **Step 3: Verificare typecheck e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npm run lint`
Expected: nessun errore.

- [ ] **Step 4: Verificare a mano su una scheda con codici mancanti**

Run: `npm run dev`, aprire la scheda della richiesta `81e04b73-2aa7-427d-b7e8-397f45660ba0`.

Atteso: i tre compressori mostrano `C1`, `C2`, `C3` e l'essiccatore `E1`, invece di celle vuote. Ricaricando la pagina i codici restano gli stessi (la normalizzazione è stata persistita e non riparte).

Nota: il disoleatore con `codice: "undefined.1"` e `compressore_associato: null` **non** viene riparato qui — senza un riferimento valido il codice non è derivabile. Lo sistema la migrazione del Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TechnicalDetails.tsx
git commit -m "fix(dm329): normalizza i codici apparecchiatura al caricamento della scheda"
```

---

### Task 6: Il batch OCR assegna i codici

Chiude il secondo produttore di codici: oggi `handleBatchOCRComplete` costruisce i record senza il campo `codice` e riempie i buchi con `{}`. È l'origine dei 9 codici nulli in produzione.

**Files:**
- Modify: `src/components/technicalSheet/TechnicalSheetForm.tsx:75-82` (destrutturazione), `:186-298` (handler)

**Interfaces:**
- Consumes: `normalizeSchedaCodes` da Task 2; `EQUIPMENT_LIMITS` da `@/types`.
- Produces: niente per i task successivi.

- [ ] **Step 1: Aggiungere import e mappa dei riferimenti**

In `src/components/technicalSheet/TechnicalSheetForm.tsx`, fra gli import esistenti:

```ts
import { EQUIPMENT_LIMITS } from '@/types'
import { normalizeSchedaCodes } from '@/utils/equipmentCodes'
```

Se `@/types` è già importato nel file, aggiungere `EQUIPMENT_LIMITS` all'import esistente invece di duplicarlo.

Subito prima di `export const TechnicalSheetForm = forwardRef...` (riga 43), aggiungere:

```ts
/** Campo di riferimento al padre, per gli array dipendenti. */
const CHILD_REF_FIELD: Record<string, string> = {
  disoleatori: 'compressore_associato',
  scambiatori: 'essiccatore_associato',
  recipienti_filtro: 'filtro_associato',
}
```

- [ ] **Step 2: Estrarre `getValues` e `reset` da `methods`**

Sostituire la destrutturazione alle righe 75-82:

```ts
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = methods
```

con:

```ts
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = methods
```

- [ ] **Step 3: Assegnare il codice al record creato**

In `handleBatchOCRComplete`, subito dopo la costruzione di `newEquipment` e dei suoi campi specifici (dopo il blocco `if (equipmentType === 'Disoleatori') { ... }`, riga 271) e **prima** di `// Inserisci nell'array all'indice corretto`, inserire:

```ts
      // Il nome del file codifica la posizione voluta dal tecnico: "S3.jpg" ⇒ S3.
      const limits = (EQUIPMENT_LIMITS as Record<string, { prefix: string; max: number }>)[fieldName]
      const refField = limits ? CHILD_REF_FIELD[fieldName] : undefined
      if (limits) {
        if (refField) {
          // Array dipendente: il codice deriva dal padre, es. disoleatore di C1 ⇒ C1.1.
          const parentCode = `${limits.prefix}${(item.parsedParentIndex ?? item.parsedIndex) + 1}`
          newEquipment.codice = `${parentCode}.1`
          newEquipment[refField] = parentCode
        } else {
          newEquipment.codice = `${limits.prefix}${item.parsedIndex + 1}`
        }
      }
```

- [ ] **Step 4: Inserire i record dipendenti per riferimento, non per posizione**

Riempire per indice un array dipendente produce segnaposto `{}` privi di riferimento al padre, e senza padre non esiste codice da derivare: la normalizzazione non può completarli. Un'apparecchiatura dipendente si individua comunque dal proprio riferimento — la tabella cerca il disoleatore con `compressore_associato === code`, non quello in posizione *n* — quindi la posizione nell'array non porta informazione.

Sostituire il blocco di inserimento (righe 273-285, da `// Inserisci nell'array all'indice corretto` fino al `setValue` incluso) con:

```ts
      // Inserisci nell'array
      const newArray = [...currentArray]

      if (refField) {
        // Array dipendente: il record si individua dal riferimento al padre. Riempire per indice
        // creerebbe segnaposto senza padre, quindi senza codice derivabile.
        const existing = newArray.findIndex((r: any) => r?.[refField] === newEquipment[refField])
        if (existing >= 0) newArray[existing] = newEquipment
        else newArray.push(newEquipment)
        console.log(`💾 Salvando in ${fieldName} per ${newEquipment[refField]}:`, newEquipment)
      } else {
        // Array principale: la posizione conta, il nome del file la codifica.
        while (newArray.length <= item.parsedIndex) {
          newArray.push({})
        }
        newArray[item.parsedIndex] = newEquipment
        console.log(`💾 Salvando in ${fieldName}[${item.parsedIndex}]:`, newEquipment)
      }

      console.log(`📊 Nuovo array ${fieldName}:`, newArray)
      setValue(fieldName as any, newArray, { shouldValidate: true, shouldDirty: true })
```

- [ ] **Step 5: Completare i segnaposto dopo l'applicazione dei risultati**

Subito dopo la chiusura di `completedItems.forEach(...)` (riga 286, la riga `})`) e **prima** della chiamata ad `alert(`, inserire:

```ts
    // I segnaposto `{}` inseriti negli array principali per raggiungere la posizione richiesta
    // restano privi di codice: la normalizzazione li completa col numero libero più basso. Gli
    // array dipendenti non ne producono più (Step 4). `reset` riscrive nel form la scheda
    // normalizzata, che è un oggetto nuovo, in un colpo solo invece di un setValue per array.
    const { scheda: normalized, changed } = normalizeSchedaCodes(getValues())
    if (changed) reset(normalized)
```

- [ ] **Step 6: Verificare typecheck e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npm run lint`
Expected: nessun errore.

- [ ] **Step 7: Verificare a mano un import batch**

Run: `npm run dev`, aprire una scheda dati DM329 vuota e usare il batch OCR con due file nominati per saltare una posizione, per esempio `S1.jpg` e `S3.jpg`.

Atteso:
1. Le due apparecchiature riconosciute mostrano `S1` e `S3`.
2. Il segnaposto in posizione 2 mostra `S2`, non una cella vuota.
3. Ricaricando la pagina i codici sono invariati.

Ripetere con un file di disoleatore, per esempio `C1.1.jpg`, su una scheda che ha già `C1`. Atteso: il disoleatore compare agganciato a `C1` con codice `C1.1`, e negli array dipendenti non compaiono righe vuote senza codice.

- [ ] **Step 8: Commit**

```bash
git add src/components/technicalSheet/TechnicalSheetForm.tsx
git commit -m "fix(dm329): il batch OCR assegna il codice alle apparecchiature create"
```

---

### Task 7: Il dialog relazione pulisce i riferimenti obsoleti

Oggi il dialog rideriva le opzioni dalla scheda ma risalva lo stato grezzo, quindi le voci obsolete sopravvivono e vengono riscritte a ogni generazione.

**Files:**
- Modify: `src/components/relazione/RelazioneDataDialog.tsx:56-130`, `:137-141`

**Interfaces:**
- Consumes: `collectCodes`, `pruneAdditionalInfo` da Task 2 e Task 3.
- Produces: niente per i task successivi.

- [ ] **Step 1: Aggiungere gli import**

In `src/components/relazione/RelazioneDataDialog.tsx`, aggiungere `Alert` all'import da `@mui/material` e il nuovo import:

```ts
import { collectCodes, pruneAdditionalInfo } from '@/utils/equipmentCodes'
```

- [ ] **Step 2: Calcolare l'insieme dei codici e lo stato degli scarti**

Subito dopo `spessimetricaOptions` (riga 69), inserire:

```tsx
  /** Codici realmente presenti nella scheda: valida i riferimenti salvati in additional_info. */
  const schedaCodes = useMemo(() => collectCodes(scheda), [scheda])
```

E fra le dichiarazioni di stato, dopo `const [saving, setSaving] = useState(false)` (riga 76):

```tsx
  const [droppedRefs, setDroppedRefs] = useState<string[]>([])
```

- [ ] **Step 3: Pulire all'apertura del dialog**

Sostituire l'effetto alle righe 79-87:

```tsx
  useEffect(() => {
    if (!open) return
    const info = initialAdditionalInfo ?? {}
    setDescrizioneAttivita(info.descrizioneAttivita || customer?.descrizione_attivita || '')
    setMotivoRevisione(info.motivoRevisione || '')
    setGiri(info.compressoriGiri || {})
    setSpessimetrica(info.spessimetrica || [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi || {})
  }, [open, initialAdditionalInfo, customer])
```

con:

```tsx
  useEffect(() => {
    if (!open) return
    // Scarta i riferimenti ad apparecchiature non più presenti: la scheda può essere cambiata
    // dopo che questi dati sono stati redatti.
    const { info, dropped } = pruneAdditionalInfo(initialAdditionalInfo, schedaCodes)
    setDescrizioneAttivita(info.descrizioneAttivita || customer?.descrizione_attivita || '')
    setMotivoRevisione(info.motivoRevisione || '')
    setGiri(info.compressoriGiri ?? {})
    setSpessimetrica(info.spessimetrica ?? [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi ?? {})
    setDroppedRefs(dropped)
  }, [open, initialAdditionalInfo, customer, schedaCodes])
```

- [ ] **Step 4: Pulire anche al salvataggio**

Sostituire la costruzione di `candidate` in `handleGenera` (righe 96-102):

```tsx
    const candidate: AdditionalInfo = {
      descrizioneAttivita: descrizioneAttivita.trim(),
      motivoRevisione: motivoRevisione.trim() || undefined,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
    }
```

con:

```tsx
    // Si persiste il solo oggetto ripulito: altrimenti una voce obsoleta sopravvivrebbe a ogni
    // generazione successiva.
    const { info: candidate } = pruneAdditionalInfo(
      {
        descrizioneAttivita: descrizioneAttivita.trim(),
        motivoRevisione: motivoRevisione.trim() || undefined,
        compressoriGiri: giri,
        spessimetrica,
        collegamentiCompressoriSerbatoi: collegamenti,
      },
      schedaCodes
    )
```

- [ ] **Step 5: Avvisare l'utente di cosa è stato rimosso**

Nel `DialogContent`, come primo figlio dello `<Stack>` (subito dopo `<Stack spacing={3} sx={{ mt: 1 }}>`, riga 138):

```tsx
          {droppedRefs.length > 0 && (
            <Alert severity="warning">
              Alcuni riferimenti salvati non corrispondono più ad apparecchiature presenti nella
              scheda e sono stati rimossi: {droppedRefs.join('; ')}. Ricontrolla i dati qui sotto
              prima di generare la relazione.
            </Alert>
          )}
```

- [ ] **Step 6: Verificare typecheck e lint**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npm run lint`
Expected: nessun errore. Se `AdditionalInfo` non risulta più usato come tipo nel file, rimuoverlo dall'import.

- [ ] **Step 7: Verificare a mano**

Run: `npm run dev`.

1. Su una scheda con almeno 2 compressori e 2 serbatoi, aprire «Dati relazione», impostare i giri e collegare C1 a S2, generare la relazione.
2. Tornare alla scheda ed eliminare S2.
3. Riaprire «Dati relazione». Atteso: un avviso giallo segnala `collegamento C1 → S2` fra i riferimenti rimossi, e il collegamento non risulta più selezionato.

- [ ] **Step 8: Commit**

```bash
git add src/components/relazione/RelazioneDataDialog.tsx
git commit -m "fix(dm329): il dialog relazione scarta i riferimenti a codici inesistenti"
```

---

### Task 8: Bonifica delle schede con codici mai assegnati

Rende il database coerente senza dipendere dall'apertura delle schede.

**Files:**
- Create: `supabase/migrations/20260730000000_fix_dm329_missing_equipment_codes.sql`

**Interfaces:**
- Consumes: niente.
- Produces: niente.

- [ ] **Step 1: Scrivere la migrazione**

Create `supabase/migrations/20260730000000_fix_dm329_missing_equipment_codes.sql`:

```sql
-- Bonifica dei codici apparecchiatura mancanti nelle schede DM329.
--
-- Origine: il batch OCR costruiva i record senza il campo `codice` e riempiva i buchi con `{}`.
-- Al 2026-07-30 la situazione in produzione è: 44 apparecchiature in 15 schede, di cui 35 con
-- codice corretto, 9 con codice nullo in 2 schede, 0 fuori sequenza.
--
-- La migrazione NON rinumera nulla: i codici già validi restano dove sono, coerentemente con
-- l'identità stabile (eliminando S2 da S1/S2/S3 l'ex S3 resta S3). Assegna soltanto un codice a
-- chi non ne ha uno valido, in base alla posizione nell'array.
--
-- Entrambe le istruzioni sono idempotenti: rieseguirle non produce ulteriori modifiche.

-- 1. Codici mancanti negli array principali.
with parents(arr, prefix) as (
  values ('serbatoi', 'S'), ('compressori', 'C'), ('essiccatori', 'E'),
         ('filtri', 'F'), ('separatori', 'SEP')
),
per_array as (
  select d.id,
         p.arr,
         (
           select jsonb_agg(
                    case
                      when elem->>'codice' ~ ('^' || p.prefix || '[0-9]+$') then elem
                      else jsonb_set(elem, '{codice}', to_jsonb(p.prefix || ord::text))
                    end
                    order by ord
                  )
           from jsonb_array_elements(d.equipment_data->p.arr) with ordinality as t(elem, ord)
         ) as new_arr
  from dm329_technical_data d
  cross join parents p
  where jsonb_typeof(d.equipment_data->p.arr) = 'array'
    and jsonb_array_length(d.equipment_data->p.arr) > 0
),
merged as (
  select id, jsonb_object_agg(arr, new_arr) as patch
  from per_array
  where new_arr is not null
  group by id
)
update dm329_technical_data d
set equipment_data = d.equipment_data || m.patch,
    updated_at = now()
from merged m
where d.id = m.id
  -- Idempotenza: aggiorna solo le righe che cambiano davvero.
  and (d.equipment_data || m.patch) <> d.equipment_data;

-- 2. Disoleatore orfano della richiesta 81e04b73: `codice: "undefined.1"` e riferimento nullo.
--    L'attribuzione è determinata, non indovinata: il terzo compressore (C3) è l'unico con
--    `ha_disoleatore` a true.
update dm329_technical_data
set equipment_data = jsonb_set(
      equipment_data,
      '{disoleatori,0}',
      (equipment_data->'disoleatori'->0)
        || jsonb_build_object('codice', 'C3.1', 'compressore_associato', 'C3')
    ),
    updated_at = now()
where request_id = '81e04b73-2aa7-427d-b7e8-397f45660ba0'
  and equipment_data->'disoleatori'->0->>'codice' = 'undefined.1';
```

- [ ] **Step 2: Contare le anomalie prima di applicare**

Le credenziali sono in `.env.local` nella radice del repository principale (git-ignored), non nel worktree. Non stampare mai i valori delle chiavi.

```bash
cd "$(git rev-parse --show-toplevel)/../.." 2>/dev/null || cd "C:/Users/FrancescoBertin/Desktop/CLAUDE CODE/OFF-TICKET_UT"
set -a && . ./.env.local && set +a
D="C:/Users/FRANCE~1/AppData/Local/Temp/claude"
cat > "$D/verifica.sql" <<'SQL'
with prefixes(arr_name,prefix) as (values ('serbatoi','S'),('compressori','C'),('essiccatori','E'),('filtri','F'),('separatori','SEP')),
items as (
  select d.request_id, p.prefix, ord, elem->>'codice' as codice
  from dm329_technical_data d
  cross join prefixes p
  cross join lateral jsonb_array_elements(coalesce(d.equipment_data->p.arr_name,'[]'::jsonb)) with ordinality as t(elem,ord)
)
select count(*) as tot,
       count(*) filter (where codice = prefix||ord::text) as in_sequenza,
       count(*) filter (where codice is null) as codice_null,
       count(*) filter (where codice is not null and codice <> prefix||ord::text) as fuori_sequenza
from items;
SQL
python -c "import json;open(r'$D/verifica.json','w').write(json.dumps({'query':open(r'$D/verifica.sql').read()}))"
curl -s -X POST "https://api.supabase.com/v1/projects/uphftgpwisdiubuhohnc/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @"$D/verifica.json"
```

Expected: `{"tot":44,"in_sequenza":35,"codice_null":9,"fuori_sequenza":0}`

- [ ] **Step 3: Applicare la migrazione**

Il token Management API sta in `.env.local`. `urllib` è bloccato da Cloudflare: usare `curl`.

```bash
cd "C:/Users/FrancescoBertin/Desktop/CLAUDE CODE/OFF-TICKET_UT"
set -a && . ./.env.local && set +a
D="C:/Users/FRANCE~1/AppData/Local/Temp/claude"
W=".claude/worktrees/infallible-hypatia-53ed14"
python -c "import json;open(r'$D/mig.json','w').write(json.dumps({'query':open(r'$W/supabase/migrations/20260730000000_fix_dm329_missing_equipment_codes.sql',encoding='utf-8').read()}))"
curl -s -X POST "https://api.supabase.com/v1/projects/uphftgpwisdiubuhohnc/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @"$D/mig.json"
```

Expected: `[]` (nessuna riga ritornata dalle UPDATE) e nessun campo `message` di errore.

- [ ] **Step 4: Verificare il risultato**

Rieseguire il comando dello Step 2.

Expected: `{"tot":44,"in_sequenza":44,"codice_null":0,"fuori_sequenza":0}`

Verificare anche il disoleatore riparato:

```bash
cd "C:/Users/FrancescoBertin/Desktop/CLAUDE CODE/OFF-TICKET_UT"
set -a && . ./.env.local && set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/dm329_technical_data?select=equipment_data->disoleatori&request_id=eq.81e04b73-2aa7-427d-b7e8-397f45660ba0" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: il primo disoleatore ha `"codice": "C3.1"` e `"compressore_associato": "C3"`.

- [ ] **Step 5: Verificare l'idempotenza**

Rieseguire lo Step 3, poi lo Step 2.

Expected: i conteggi restano `{"tot":44,"in_sequenza":44,"codice_null":0,"fuori_sequenza":0}`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260730000000_fix_dm329_missing_equipment_codes.sql
git commit -m "fix(dm329): bonifica dei codici apparecchiatura mancanti in produzione"
```

---

### Task 9: Verifica finale

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS su tutti i file, inclusi i test preesistenti di `src/services/relazione/__tests__/`.

- [ ] **Step 2: Build con typecheck**

Run: `npx tsc --noEmit` poi `npx vite build`

`npm run build:check` (che è `tsc && vite build`) **non può passare** in questo repository: al
2026-07-30 esistono 4 errori TypeScript preesistenti, in `AddInstallerDialog.tsx` (2),
`BillingReport.tsx` e `billingReports.ts`, che non rientrano in questo lavoro. La verifica corretta
è quindi in due parti:

- `npx tsc --noEmit` deve riportare **esattamente quei 4 errori** e nessun altro. Qualunque errore
  in un altro file è una regressione di questo lavoro.
- `npx vite build` deve completare la build del bundle.

- [ ] **Step 3: Lint**

Run: `npx eslint` sui soli file toccati.

`npm run lint` usa `--max-warnings 0` su un baseline di ~380 warning preesistenti e fallisce a
prescindere: il bar "nessun warning" del piano non era raggiungibile. La verifica corretta è che i
file toccati non introducano **errori** — i warning `no-explicit-any` sono coerenti con il resto
del repository.

- [ ] **Step 4: Verificare che l'aritmetica sugli indici sia scomparsa dai percorsi attivi**

Run: `grep -rn "generateEquipmentCode" src/components/technicalSheet/table/UnifiedEquipmentTable.tsx src/pages/TechnicalDetails.tsx src/components/relazione/RelazioneDataDialog.tsx`
Expected: nessun risultato.

Nota: `generateEquipmentCode` resta in `src/types/technicalSheet.ts` e nelle cinque tabelle per-tipo legacy, che sono codice morto non montato (decisione registrata nello spec, rimozione a task separato).

- [ ] **Step 5: Commit finale se necessario**

Se lint o typecheck hanno richiesto aggiustamenti:

```bash
git add -A
git commit -m "chore(dm329): rifiniture dopo la verifica finale"
```

## Self-Review

**Copertura dello spec:**

| Requisito dello spec | Task |
|---|---|
| `compareCodes`, `nextFreeCode`, `childCode` | 1 |
| `normalizeSchedaCodes`, `collectCodes` | 2 |
| `pruneAdditionalInfo` | 3 |
| Tabella legge il codice memorizzato | 4 (Step 5) |
| Ordinamento righe per codice | 4 (Step 2, 5) |
| `addNew` usa `nextFreeCode` | 4 (Step 4) |
| Limite `max` applicato al menu | 4 (Step 6) |
| Lettura via `useWatch` e non da `fields` | 4 (Step 3) |
| Normalizzazione al caricamento | 5 |
| Batch OCR assegna i codici | 6 (Step 3) |
| Record dipendenti inseriti per riferimento, non per posizione | 6 (Step 4) — deviazione approvata dopo la revisione del Task 2 |
| Prune all'apertura, al salvataggio, con avviso | 7 |
| Bonifica SQL delle 2 schede + disoleatore orfano | 8 |
| Test su nextFreeCode, compareCodes, normalizeSchedaCodes, pruneAdditionalInfo | 1, 2, 3 |
| Filtro difensivo in `buildRelazioneModel` | **nessun task, di proposito** — verificato già soddisfatto per costruzione; motivazione in *File Structure* |
| Tabelle legacy intatte | nessun task, per decisione |
| `posizioni_compressori_spessimetrati` fuori scopo | nessun task, per decisione |
