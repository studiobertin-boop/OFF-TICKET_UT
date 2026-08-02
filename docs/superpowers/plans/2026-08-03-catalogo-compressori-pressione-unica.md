# Una pressione sola per i compressori a catalogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il catalogo apparecchiature mostra una pressione sola per i compressori — la massima di targa, accoppiata alla portata — il `+` avvisa prima di aggiungere una variante a un modello già presente, e le varianti tornano tutte raggiungibili dalla scheda dati.

**Architecture:** Il contratto canonico dei dati tecnici (`CANONICAL_SPECS`) acquisisce un flag `isInternal`: la definizione di `pressione_esercizio` resta — è la chiave dell'indice unico e senza di lei due modelli ASD collassano — ma l'interfaccia la salta. Il raggruppamento delle varianti di un modello esce da `equipmentCatalog.ts` e diventa logica pura in `src/utils/equipmentVarianti.ts`, testabile senza mock di Supabase, e viene riallineato alla chiave dell'indice invece che alla sola pressione di targa. La stessa logica alimenta il menu della colonna PS e il testo dell'avviso.

**Tech Stack:** TypeScript, React 18, Material UI 6, React Hook Form, Zod, Vitest, Supabase (PostgreSQL).

## Global Constraints

- Specifica di riferimento: `docs/superpowers/specs/2026-08-03-catalogo-compressori-pressione-unica-design.md`. In caso di divergenza vince la specifica.
- **Nessuna migrazione di merito sulle pressioni.** `pressione_esercizio` non si cancella, non si rinomina, non si sposta. L'unica migration prevista è l'arrotondamento dei float (Task 6).
- **L'indice unico non si tocca:** `equipment_catalog_unique_compressori ON (tipo_apparecchiatura, marca, modello, COALESCE(specs->>'pressione_esercizio', specs->>'pressione_max')) WHERE tipo_apparecchiatura = 'Compressori' AND is_active`.
- **Il motore della relazione non si tocca.** La colonna pressione dei compressori continua a leggere `c.pressione_max` dalla scheda dati.
- **Nessun campo nuovo nella scheda dati**, nessuna colonna nuova nella tabella apparecchiature, nessun meccanismo di selezione per soglia.
- Test con Vitest sulla logica, non sulla UI (convenzione del progetto, `CLAUDE.md`). Comando: `npx vitest run <percorso>`.
- Commenti e copy in italiano, secondo lo stile dei file toccati. Conventional Commits, un commit per task.
- `strict: false` nel `tsconfig`: non fare affidamento sul narrowing automatico dei tipi nullable.

---

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `src/services/equipmentAudit/specsNormalization.ts` | Contratto canonico: aggiunge `isInternal`, lo applica a `pressione_esercizio` | 1 |
| `src/utils/equipmentCatalogValidation.ts` | `specsFieldsFor` diventa l'unico filtro di visibilità; messaggio del modello | 1 |
| `src/components/equipmentCatalog/EquipmentCatalogTable.tsx` | Le chip passano dal filtro condiviso | 1 |
| `src/utils/equipmentVarianti.ts` (nuovo) | Raggruppamento delle varianti, etichetta a video, testo dell'avviso | 2, 5 |
| `src/utils/__tests__/equipmentVarianti.test.ts` (nuovo) | Test del modulo sopra | 2, 5 |
| `src/services/api/equipmentCatalog.ts` | `getVarianti` delega al raggruppamento puro | 3 |
| `src/components/technicalSheet/table/PressioneCatalogCell.tsx` | Opzioni oggetto, portata a video | 4 |
| `src/components/technicalSheet/EquipmentAutocomplete.tsx` | Conferma prima del dialog di inserimento | 5 |
| `supabase/migrations/20260806000000_normalizza_float_specs.sql` (nuovo) | Arrotondamento dei valori con code di virgola mobile | 6 |

---

## Task 1: `isInternal` nel contratto canonico e filtro unico per l'interfaccia

Rende `pressione_esercizio` invisibile in tabella e nel form senza toglierla dai dati. Il filtro sta in un solo posto — `specsFieldsFor` — così tabella e form non possono divergere.

**Files:**
- Modify: `src/services/equipmentAudit/specsNormalization.ts:28-63` (interfaccia `CanonicalSpecDef`), `:93-102` (def di `pressione_esercizio`)
- Modify: `src/utils/equipmentCatalogValidation.ts:43-51` (messaggio del modello), `:138-151` (`specsFieldsFor`)
- Modify: `src/components/equipmentCatalog/EquipmentCatalogTable.tsx:24` (import), `:38-52` (`chipsSpecs`)
- Test: `src/utils/__tests__/equipmentCatalogValidation.test.ts`, `src/services/equipmentAudit/__tests__/specsNormalization.test.ts`

**Interfaces:**
- Consumes: niente da task precedenti.
- Produces: `CanonicalSpecDef.isInternal?: boolean`. `specsFieldsFor(tipo: EquipmentCatalogType | null, specs?: Record<string, unknown> | null): readonly CanonicalSpecDef[]` — firma invariata, ora esclude anche le definizioni interne.

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/utils/__tests__/equipmentCatalogValidation.test.ts`, aggiungere in coda al file:

```ts
describe('specsFieldsFor — definizioni interne', () => {
  it('non propone la pressione di esercizio fra i campi dei compressori', () => {
    const chiavi = specsFieldsFor('Compressori', {}).map(d => d.key)
    expect(chiavi).not.toContain('pressione_esercizio')
    expect(chiavi).toContain('pressione_max')
    expect(chiavi).toContain('fad')
  })

  it('non toglie nulla ai tipi che non hanno definizioni interne', () => {
    expect(specsFieldsFor('Serbatoi', {}).map(d => d.key)).toEqual([
      'volume', 'ps', 'ts', 'categoria_ped',
    ])
  })

  it('continua a nascondere i giri sui compressori che non sono a vite', () => {
    const chiavi = specsFieldsFor('Compressori', { tipo_compressore: 'SCROLL' }).map(d => d.key)
    expect(chiavi).not.toContain('giri')
  })
})
```

Verificare che `specsFieldsFor` sia fra gli import in testa al file; se manca, aggiungerlo alla riga di import esistente da `@/utils/equipmentCatalogValidation`.

In `src/services/equipmentAudit/__tests__/specsNormalization.test.ts`, aggiungere in coda:

```ts
describe('pressione_esercizio resta operativa pur essendo interna', () => {
  it('regge ancora la chiave di variante', () => {
    expect(variantSpecKey('Compressori')).toBe('pressione_esercizio')
    expect(variantSpecKeys('Compressori')).toEqual(['pressione_esercizio', 'pressione_max'])
    expect(readVariantValue('Compressori', { pressione_esercizio: 7.5, pressione_max: 8 })).toBe(7.5)
  })

  it('non entra fra i campi obbligatori mancanti', () => {
    expect(
      missingCanonicalSpecs('Compressori', { fad: 2000, pressione_max: 8 }).map(d => d.key)
    ).toEqual([])
  })

  it('sopravvive alla normalizzazione', () => {
    const r = normalizeSpecs('Compressori', { pressione_esercizio: '10', pressione_max: '11', volume: '1680' })
    expect(r.canonical).toEqual({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 })
  })
})
```

Verificare che `variantSpecKey`, `variantSpecKeys`, `readVariantValue`, `missingCanonicalSpecs`, `normalizeSpecs` siano già importati in testa al file; aggiungere quelli mancanti.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npx vitest run src/utils/__tests__/equipmentCatalogValidation.test.ts src/services/equipmentAudit/__tests__/specsNormalization.test.ts
```

Atteso: FAIL sul primo test del primo blocco — `chiavi` contiene ancora `pressione_esercizio`. Gli altri passano già: sono la rete che protegge dalle regressioni al Passo 3.

- [ ] **Step 3: Aggiungere il flag al contratto**

In `src/services/equipmentAudit/specsNormalization.ts`, dentro `interface CanonicalSpecDef`, subito dopo il campo `isSheetPressure`:

```ts
  /**
   * Il dato serve al funzionamento ma non si mostra e non si modifica.
   *
   * La pressione di esercizio dei compressori è la chiave che distingue le varianti
   * nell'indice unico a database: toglierla dai dati renderebbe indistinguibili le due
   * varianti di ASD 50 SFC, che condividono la massima di 13 bar con portate diverse.
   * Il catalogo però ne dichiara una sola, la massima di targa, che è quella che la
   * scheda dati porta in relazione. Resta quindi nel contratto — `variantSpecKey` la
   * legge da qui — e l'interfaccia la salta.
   */
  isInternal?: boolean
```

Nella stessa riga della def di `pressione_esercizio` dentro `CANONICAL_SPECS.Compressori`, aggiungere `isInternal: true` accanto a `isVariantKey: true`:

```ts
    {
      key: 'pressione_esercizio',
      label: 'Pressione di esercizio',
      unit: 'bar',
      kind: 'number',
      min: 0,
      max: 100,
      isVariantKey: true,
      isInternal: true,
      variantFallbackKey: 'pressione_max',
    },
```

- [ ] **Step 4: Applicare il filtro in `specsFieldsFor`**

In `src/utils/equipmentCatalogValidation.ts`, sostituire il blocco `specsFieldsFor` (commento incluso) con:

```ts
/**
 * Definizioni dei dati tecnici del tipo che l'interfaccia deve mostrare.
 *
 * È l'unico filtro di visibilità del catalogo: lo usano sia i campi del form sia le chip
 * della tabella, così le due non possono divergere. Esclude le definizioni interne — dati
 * che servono al funzionamento ma non si mostrano — e quelle che non si applicano alla
 * riga: la regolazione dei giri compare solo sui compressori rotativi a vite.
 *
 * `specs` serve a valutare le condizioni; omettendolo si ottengono tutte le definizioni
 * non interne.
 */
export function specsFieldsFor(
  tipo: EquipmentCatalogType | null,
  specs?: Record<string, unknown> | null
): readonly CanonicalSpecDef[] {
  const defs = (tipo ? CANONICAL_SPECS[tipo] ?? [] : []).filter(d => !d.isInternal)
  if (!specs) return defs
  return defs.filter(d => !d.appliesWhen || d.appliesWhen(specs))
}
```

Nello stesso file, aggiornare il messaggio di `modelloSchema` (riga ~50), che rimanda a un campo che non esiste più nel form:

```ts
  .refine(v => parseModello(v).pattern === 'plain', {
    message:
      'La pressione va nei dati tecnici, non nel nome: toglila dal modello e compila «PS — pressione massima»',
  })
```

Nota: `specsSchemaFor` continua a iterare `CANONICAL_SPECS` senza filtro. È voluto — lo schema valida ciò che è memorizzato, e le righe esistenti contengono `pressione_esercizio`.

- [ ] **Step 5: Far passare la tabella dal filtro condiviso**

In `src/components/equipmentCatalog/EquipmentCatalogTable.tsx`, cambiare l'import di riga 24 e la funzione `chipsSpecs`:

```ts
import { missingCanonicalSpecs, readSpec } from '@/services/equipmentAudit'
import { specsFieldsFor } from '@/utils/equipmentCatalogValidation'
```

```ts
/** Dati tecnici della riga, compattati: al massimo tre, quelli che identificano la voce. */
function chipsSpecs(item: EquipmentCatalogItem) {
  const tipo = item.tipo_apparecchiatura ?? null

  return specsFieldsFor(tipo, item.specs)
    .map(def => {
      const v = readSpec(tipo, item.specs, def.key)
      if (v === null) return null
      const nome = def.label.split('—')[0].trim()
      return { key: def.key, testo: `${nome} ${v}${def.unit ? ` ${def.unit}` : ''}` }
    })
    .filter((x): x is { key: string; testo: string } => x !== null)
    .slice(0, 3)
}
```

Verificare che `CANONICAL_SPECS` non sia più usato altrove nel file; se non lo è, è già stato tolto dall'import sopra.

- [ ] **Step 6: Eseguire i test e verificare che passino**

```bash
npx vitest run src/utils/__tests__/equipmentCatalogValidation.test.ts src/services/equipmentAudit/__tests__/specsNormalization.test.ts
```

Atteso: PASS su tutti.

- [ ] **Step 7: Verificare che non si sia rotto nulla altrove**

```bash
npx vitest run && npx tsc --noEmit
```

Atteso: PASS, nessun errore di tipo.

- [ ] **Step 8: Commit**

```bash
git add src/services/equipmentAudit/specsNormalization.ts src/utils/equipmentCatalogValidation.ts src/components/equipmentCatalog/EquipmentCatalogTable.tsx src/utils/__tests__/equipmentCatalogValidation.test.ts src/services/equipmentAudit/__tests__/specsNormalization.test.ts
git commit -m "feat(catalogo): i compressori dichiarano una pressione sola

La pressione di esercizio resta la chiave che distingue le varianti nell'indice
unico — senza di lei le due varianti di ASD 50 SFC, che condividono la massima di
13 bar, diventerebbero indistinguibili — ma esce dall'interfaccia: il catalogo
mostra la massima di targa, che e' quella che la scheda dati porta in relazione.

Il filtro di visibilita' sta in specsFieldsFor, unico posto da cui passano sia i
campi del form sia le chip della tabella.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Raggruppamento delle varianti come logica pura

Estrae da `getVarianti` la parte che non parla con la rete e la riallinea alla chiave dell'indice unico. È il rimedio al difetto adiacente: oggi la deduplica avviene per pressione di targa, più grossolana dell'indice, e su ASD 50 SFC scarta una variante buona.

**Files:**
- Create: `src/utils/equipmentVarianti.ts`
- Test: `src/utils/__tests__/equipmentVarianti.test.ts`

**Interfaces:**
- Consumes: da Task 1 niente di vincolante. Dal codice esistente: `readVariantValue`, `readSheetPressure`, `readNumericSpec`, `missingCanonicalSpecs`, `capacityKey`, `CANONICAL_SPECS`, tutti esportati da `@/services/equipmentAudit`.
- Produces:
  - `interface VarianteCatalogo { value: number; variante: number; item: EquipmentCatalogItem }`
  - `raggruppaVarianti(tipo: EquipmentCatalogType, rows: EquipmentCatalogItem[]): VarianteCatalogo[]`
  - `etichettaVariante(tipo: EquipmentCatalogType, v: VarianteCatalogo): string`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/utils/__tests__/equipmentVarianti.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import { etichettaVariante, raggruppaVarianti } from '@/utils/equipmentVarianti'

/**
 * I numeri sono quelli di produzione, verificati sulle brochure KAESER:
 * SK 22 ha tre varianti con pressioni di lavoro 7,5/10/13 e massime 8/11/15;
 * ASD 50 SFC ne ha tre di cui due condividono la massima di 13 bar.
 */
let seq = 0
const riga = (specs: Record<string, unknown>): EquipmentCatalogItem =>
  ({
    id: `r${++seq}`,
    tipo: 'Compressori',
    tipo_apparecchiatura: 'Compressori',
    marca: 'KAESER KOMPRESSOREN SE',
    modello: 'SK 22',
    specs,
    is_active: true,
    is_user_defined: false,
    usage_count: 0,
    created_at: '',
    updated_at: '',
  }) as EquipmentCatalogItem

describe('raggruppaVarianti', () => {
  it('indicizza per la pressione dichiarata alla scheda', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 }),
      riga({ pressione_esercizio: 7.5, pressione_max: 8, fad: 2000 }),
      riga({ pressione_esercizio: 13, pressione_max: 15, fad: 1320 }),
    ])
    expect(v.map(x => x.value)).toEqual([8, 11, 15])
    expect(v.map(x => x.variante)).toEqual([7.5, 10, 13])
  })

  it('tiene distinte due varianti che condividono la massima — ASD 50 SFC', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 7.5, pressione_max: 8.5, fad: 5270 }),
      riga({ pressione_esercizio: 10, pressione_max: 13, fad: 4580 }),
      riga({ pressione_esercizio: 13, pressione_max: 13, fad: 3820 }),
    ])
    expect(v).toHaveLength(3)
    expect(v.map(x => [x.value, x.variante])).toEqual([[8.5, 7.5], [13, 10], [13, 13]])
  })

  it('collassa le righe quasi-duplicate tenendo quella piu completa', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_max: 10 }),
      riga({ pressione_esercizio: 10, pressione_max: 10, fad: 1000 }),
    ])
    expect(v).toHaveLength(1)
    expect(v[0].item.specs?.fad).toBe(1000)
  })

  it('scarta le righe senza alcuna pressione', () => {
    expect(raggruppaVarianti('Compressori', [riga({ fad: 1000 })])).toEqual([])
  })

  it('legge le chiavi generiche dell import per gli altri tipi', () => {
    const serbatoio = {
      ...riga({ pressione: '11', volume: '500' }),
      tipo_apparecchiatura: 'Serbatoi',
    } as EquipmentCatalogItem
    const v = raggruppaVarianti('Serbatoi', [serbatoio])
    expect(v.map(x => x.value)).toEqual([11])
  })
})

describe('etichettaVariante', () => {
  it('accosta la portata alla pressione, con la virgola decimale', () => {
    const [a] = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 7.5, pressione_max: 8.5, fad: 5270 }),
    ])
    expect(etichettaVariante('Compressori', a)).toBe('8,5 bar · 5270 l/min')
  })

  it('distingue a video due varianti alla stessa pressione', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 10, pressione_max: 13, fad: 4580 }),
      riga({ pressione_esercizio: 13, pressione_max: 13, fad: 3820 }),
    ])
    expect(v.map(x => etichettaVariante('Compressori', x))).toEqual([
      '13 bar · 4580 l/min',
      '13 bar · 3820 l/min',
    ])
  })

  it('resta la sola pressione quando la capacita manca', () => {
    const [a] = raggruppaVarianti('Compressori', [riga({ pressione_max: 11 })])
    expect(etichettaVariante('Compressori', a)).toBe('11 bar')
  })

  it('usa l unita del tipo — litri sui serbatoi', () => {
    const serbatoio = {
      ...riga({ ps: 11, volume: 500 }),
      tipo_apparecchiatura: 'Serbatoi',
    } as EquipmentCatalogItem
    const [a] = raggruppaVarianti('Serbatoi', [serbatoio])
    expect(etichettaVariante('Serbatoi', a)).toBe('11 bar · 500 l')
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npx vitest run src/utils/__tests__/equipmentVarianti.test.ts
```

Atteso: FAIL — `Failed to resolve import "@/utils/equipmentVarianti"`.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/utils/equipmentVarianti.ts`:

```ts
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import {
  CANONICAL_SPECS,
  capacityKey,
  missingCanonicalSpecs,
  readNumericSpec,
  readSheetPressure,
  readVariantValue,
} from '@/services/equipmentAudit'

/**
 * Le varianti di un modello a catalogo: come si raggruppano e come si presentano.
 *
 * Logica pura, senza Supabase: `getVarianti` le passa le righe già caricate. È qui e non
 * nel servizio API perché è la parte che va verificata sui casi reali, e perché la stessa
 * presentazione serve al menu della colonna PS e all'avviso del pulsante «+».
 */

/** Una riga di catalogo come la vede la scheda dati. */
export interface VarianteCatalogo {
  /** Pressione che la scheda dichiara nella colonna PS/Ptar: la massima di targa. */
  value: number
  /** Valore che distingue la riga dalle sue sorelle — la chiave dell'indice unico. */
  variante: number
  item: EquipmentCatalogItem
}

/**
 * Raggruppa le righe di un modello in varianti, ordinate per pressione crescente.
 *
 * Il raggruppamento avviene sulla chiave di variante — `COALESCE(pressione_esercizio,
 * pressione_max)` sui compressori — la stessa dell'indice unico a database. Indicizzare
 * per la sola pressione di targa era più grossolano dell'indice: su ASD 50 SFC, dove la
 * variante da 10 bar e quella da 13 dichiarano entrambe 13 di massima, una delle due
 * spariva e chi scriveva 13 nella colonna PS si prendeva 4580 o 3820 l/min a seconda
 * dell'ordine con cui il database restituiva le righe.
 *
 * Il catalogo contiene righe quasi-duplicate — stesso modello e stessa pressione, una con
 * la pressione di esercizio valorizzata e una senza — che condividono la chiave di
 * variante e continuano quindi a collassare: a parità si tiene quella con più dati tecnici
 * completi, così l'autocompilazione non ripiega su una riga monca.
 */
export function raggruppaVarianti(
  tipo: EquipmentCatalogType,
  rows: EquipmentCatalogItem[]
): VarianteCatalogo[] {
  const perVariante = new Map<number, VarianteCatalogo>()

  for (const item of rows) {
    const variante = readVariantValue(tipo, item.specs)
    const value = readSheetPressure(tipo, item.specs)
    if (variante === null || value === null) continue

    const presente = perVariante.get(variante)
    if (
      !presente ||
      missingCanonicalSpecs(tipo, item.specs).length <
        missingCanonicalSpecs(tipo, presente.item.specs).length
    ) {
      perVariante.set(variante, { value, variante, item })
    }
  }

  return [...perVariante.values()].sort((a, b) => a.value - b.value || a.variante - b.variante)
}

/**
 * Come la variante si presenta nel menu della colonna PS: pressione e capacità.
 *
 * La capacità non è decorazione: è ciò che distingue due varianti che dichiarano la stessa
 * pressione, e senza di essa il menu di ASD 50 SFC mostrerebbe due voci identiche.
 */
export function etichettaVariante(tipo: EquipmentCatalogType, v: VarianteCatalogo): string {
  const pressione = `${numeroIT(v.value)} bar`

  const chiave = capacityKey(tipo)
  const capacita = readNumericSpec(tipo, v.item.specs, chiave)
  if (capacita === null) return pressione

  const unita = (CANONICAL_SPECS[tipo] ?? []).find(d => d.key === chiave)?.unit
  return `${pressione} · ${numeroIT(capacita)}${unita ? ` ${unita}` : ''}`
}

/**
 * Virgola decimale, come si scrive in italiano.
 *
 * Non si importa `formatNumberIT` dal motore della relazione: quello serve i documenti
 * generati e non deve diventare una dipendenza dell'interfaccia.
 */
function numeroIT(n: number): string {
  return String(Number(n.toFixed(2))).replace('.', ',')
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npx vitest run src/utils/__tests__/equipmentVarianti.test.ts
```

Atteso: PASS su tutti i casi.

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentVarianti.ts src/utils/__tests__/equipmentVarianti.test.ts
git commit -m "fix(catalogo): le varianti si raggruppano come le distingue l'indice

Il raggruppamento avveniva per pressione di targa, piu' grossolano dell'indice
unico, che distingue le righe per COALESCE(pressione_esercizio, pressione_max).
Su ASD 50 SFC e ASD 50 T SFC — dove la variante da 10 bar e quella da 13
dichiarano entrambe 13 di massima — una spariva, e chi scriveva 13 nella colonna
PS si prendeva 4580 o 3820 l/min a seconda dell'ordine di ritorno del database,
senza alcun segnale. Il numero finiva in una relazione firmata.

La logica esce dal servizio API e diventa pura, verificabile sui casi reali senza
mock di Supabase.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `getVarianti` delega al raggruppamento puro

**Files:**
- Modify: `src/services/api/equipmentCatalog.ts:1-20` (import e tipo), `:147-186` (`getVarianti`)

**Interfaces:**
- Consumes: da Task 2, `raggruppaVarianti` e `VarianteCatalogo` da `@/utils/equipmentVarianti`.
- Produces: `equipmentCatalogApi.getVarianti(tipo, marca, modello): Promise<VarianteCatalogo[]>` — firma invariata, elementi ora con il campo `variante` in più. `VarianteCatalogo` resta ri-esportato da `@/services/api/equipmentCatalog` per non rompere chi lo importa da lì.

- [ ] **Step 1: Sostituire il corpo di `getVarianti`**

In `src/services/api/equipmentCatalog.ts`, togliere la dichiarazione locale di `VarianteCatalogo` (righe ~13-20, commento compreso) e sostituire gli import in testa al file con:

```ts
import { supabase } from '../supabase'
import type { EquipmentCatalogType, EquipmentCatalogItem, EquipmentSearchResult } from '@/types'
import { normalizeSpecs, variantSpecKey } from '@/services/equipmentAudit'
import { raggruppaVarianti, type VarianteCatalogo } from '@/utils/equipmentVarianti'

export type { VarianteCatalogo }
```

Nota: `missingCanonicalSpecs` e `readSheetPressure` non servono più in questo file — il raggruppamento li usa al posto suo. Toglierli dall'import.

Sostituire il metodo `getVarianti` (commento compreso) con:

```ts
  /**
   * Varianti di un modello, ordinate per pressione crescente.
   *
   * Il raggruppamento sta in `raggruppaVarianti`: qui resta solo la lettura dal database.
   */
  async getVarianti(
    tipo: EquipmentCatalogType,
    marca: string,
    modello: string
  ): Promise<VarianteCatalogo[]> {
    return raggruppaVarianti(tipo, await this.findVariants(tipo, marca, modello))
  },
```

- [ ] **Step 2: Verificare tipi e test**

```bash
npx tsc --noEmit && npx vitest run
```

Atteso: nessun errore di tipo, tutti i test passano. Se `tsc` segnala che `readSheetPressure` o `missingCanonicalSpecs` non sono usati, sono stati lasciati nell'import: toglierli.

- [ ] **Step 3: Commit**

```bash
git add src/services/api/equipmentCatalog.ts
git commit -m "refactor(catalogo): getVarianti legge dal database, il resto e' logica pura

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Il menu della colonna PS mostra la portata

Le opzioni passano da numeri a oggetti, perché due varianti possono ora dichiarare la stessa pressione e un elenco di numeri le renderebbe indistinguibili.

**Files:**
- Modify: `src/components/technicalSheet/table/PressioneCatalogCell.tsx:1-6` (import), `:79-143` (opzioni, `applicaVariante`, `Autocomplete`)

**Interfaces:**
- Consumes: da Task 2/3, `VarianteCatalogo` (con `value`, `variante`, `item`) e `etichettaVariante(tipo, v)`.
- Produces: nessuna API nuova. Il valore scritto nel form resta un `number`: la pressione dichiarata.

- [ ] **Step 1: Aggiornare gli import**

In `src/components/technicalSheet/table/PressioneCatalogCell.tsx`:

```ts
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { etichettaVariante, type VarianteCatalogo } from '@/utils/equipmentVarianti'
```

- [ ] **Step 2: Sostituire opzioni e applicazione della variante**

Sostituire il blocco che va da `const options = varianti.map(...)` fino alla fine di `applicaVariante` con:

```ts
  /**
   * La voce di catalogo è già in mano dal caricamento delle opzioni: nessuna seconda chiamata
   * di rete, e quindi nessuna finestra in cui gli indici delle righe possano scalare sotto.
   */
  const applica = (v: VarianteCatalogo) => {
    if (v.item?.specs) onSelected(v.item.specs as Record<string, any>, v.item)
  }

  /**
   * Digitazione libera: si applica la prima variante che dichiara quella pressione.
   *
   * Due varianti possono dichiararne una uguale — ASD 50 SFC ha la 10 bar e la 13 bar
   * entrambe a 13 di massima — e in quel caso solo la scelta dal menu, dove le distingue la
   * portata, dice quale si intende.
   */
  const applicaPressione = (pressione: number) => {
    const scelta = varianti.find((v) => v.value === pressione)
    if (scelta) applica(scelta)
  }
```

- [ ] **Step 3: Aggiornare l'`Autocomplete`**

Sostituire le prop `options`, `getOptionLabel`, `isOptionEqualToValue`, `onChange` e `renderOption` del componente `Autocomplete` con:

```ts
              options={varianti}
              loading={loading}
              slotProps={denseSlotProps}
              getOptionLabel={(o) =>
                o === null || o === undefined || o === '' ? '' : typeof o === 'object' ? String(o.value) : String(o)
              }
              // Il valore del campo è un numero, non una variante, e due varianti possono
              // dichiarare la stessa pressione: nessuna voce del menu si marca come scelta.
              isOptionEqualToValue={() => false}
              onChange={(_e, v) => {
                if (v === null || (v as any) === '') { field.onChange(undefined); return }
                if (typeof v === 'object') { field.onChange(v.value); applica(v); return }
                const num = typeof v === 'number' ? v : parseFloat(v)
                if (isNaN(num)) { field.onChange(undefined); return }
                field.onChange(num)
                applicaPressione(num)
              }}
```

e, più in basso:

```ts
              renderOption={(props, option) => {
                // La chiave che MUI mette in `props` deriva dall'etichetta, che due varianti
                // possono avere uguale: si scarta e si usa l'id della riga di catalogo.
                const { key: _key, ...rest } = props
                return (
                  <Box component="li" key={option.item.id} {...rest}>
                    {etichettaVariante(catalogType, option)}
                  </Box>
                )
              }}
```

`props` è già tipizzato da MUI come `React.HTMLAttributes<HTMLLIElement> & { key: any }`: la destrutturazione non richiede cast né import aggiuntivi. Se ESLint segnala `_key` come variabile non usata, il progetto ha già la convenzione del prefisso `_` — verificare in `.eslintrc` che `argsIgnorePattern`/`varsIgnorePattern` la coprano e, se non la copre, usare `delete (rest as any).key` al posto della destrutturazione.

- [ ] **Step 4: Verificare tipi e build**

```bash
npx tsc --noEmit && npx vitest run
```

Atteso: nessun errore.

- [ ] **Step 5: Verificare a schermo**

Avviare l'anteprima, aprire una scheda dati DM329, aggiungere un compressore e scegliere **KAESER KOMPRESSOREN SE / ASD 50 SFC**. Il menu della colonna PS deve mostrare tre voci:

```
8,5 bar · 5270 l/min
13 bar · 4580 l/min
13 bar · 3820 l/min
```

Scegliendo la seconda, la colonna PS deve valere 13 e la capacità 4580. Scegliendo la terza, 13 e 3820. Controllare la console del browser: nessun avviso React su chiavi duplicate.

- [ ] **Step 6: Commit**

```bash
git add src/components/technicalSheet/table/PressioneCatalogCell.tsx
git commit -m "feat(scheda dati): il menu della PS accosta la portata alla pressione

Serve a riconoscere quale macchina si ha davanti, e sulle due varianti di ASD 50
SFC che dichiarano entrambe 13 bar e' l'unica cosa che le distingue.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Avviso prima di aggiungere una variante

**Files:**
- Modify: `src/utils/equipmentVarianti.ts` (aggiunge `testoAvvisoVariante`)
- Modify: `src/utils/__tests__/equipmentVarianti.test.ts` (aggiunge il blocco di test)
- Modify: `src/components/technicalSheet/EquipmentAutocomplete.tsx:1-19` (import), `:94-101` (stato), `:168-198` (effetto), `:257-262` (`handleAddToCatalog`), `:375-392` (render)

**Interfaces:**
- Consumes: da Task 2, il modulo `@/utils/equipmentVarianti`. Dal codice esistente: `equipmentCatalogApi.findVariants`, `readSheetPressure`, `variantSpecKey`.
- Produces: `testoAvvisoVariante(params: { marca: string; modello: string; pressioniEsistenti: number[]; nuova: number | null }): { titolo: string; corpo: string } | null`.

- [ ] **Step 1: Scrivere i test che falliscono**

Nell'import in testa a `src/utils/__tests__/equipmentVarianti.test.ts`, aggiungere `testoAvvisoVariante`:

```ts
import { etichettaVariante, raggruppaVarianti, testoAvvisoVariante } from '@/utils/equipmentVarianti'
```

Poi aggiungere in coda al file:

```ts
describe('testoAvvisoVariante', () => {
  it('elenca le varianti esistenti e annuncia quella nuova', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'SK 22',
      pressioniEsistenti: [11, 8, 15],
      nuova: 9,
    })
    expect(a?.titolo).toBe('Variante nuova di un modello già a catalogo')
    expect(a?.corpo).toBe(
      'A catalogo KAESER KOMPRESSOREN SE SK 22 esiste già in 3 varianti: 8, 11 e 15 bar. ' +
        'Stai per aggiungerne una a 9 bar.'
    )
  })

  it('al singolare non parla di varianti', () => {
    const a = testoAvvisoVariante({
      marca: 'CECCATO ARIA COMPRESSA S.R.L.',
      modello: 'CSA 10',
      pressioniEsistenti: [8],
      nuova: 13,
    })
    expect(a?.corpo).toBe(
      'A catalogo CECCATO ARIA COMPRESSA S.R.L. CSA 10 esiste già a 8 bar. ' +
        'Stai per aggiungerne una a 13 bar.'
    )
  })

  it('tiene la virgola decimale', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'ASD 50',
      pressioniEsistenti: [8.5, 12, 15],
      nuova: 10.5,
    })
    expect(a?.corpo).toContain('8,5, 12 e 15 bar')
    expect(a?.corpo).toContain('a 10,5 bar')
  })

  it('regge la pressione nuova non ancora scritta', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'SK 22',
      pressioniEsistenti: [8, 11],
      nuova: null,
    })
    expect(a?.corpo).toContain("Stai per aggiungerne un'altra.")
  })

  it('tace quando il modello non e a catalogo: non c e nulla da segnalare', () => {
    expect(
      testoAvvisoVariante({ marca: 'ACME', modello: 'X1', pressioniEsistenti: [], nuova: 8 })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

```bash
npx vitest run src/utils/__tests__/equipmentVarianti.test.ts
```

Atteso: FAIL — `testoAvvisoVariante` non esportata.

- [ ] **Step 3: Scrivere la funzione**

Aggiungere in coda a `src/utils/equipmentVarianti.ts`, prima di `numeroIT`:

```ts
export interface AvvisoVariante {
  titolo: string
  corpo: string
}

/**
 * Avviso da mostrare prima di aggiungere a catalogo una variante di un modello che c'è già.
 *
 * Il pulsante «+» compare in due casi che si somigliano ma non sono la stessa cosa: il
 * modello manca del tutto, e allora non c'è niente da segnalare, oppure c'è ad altre
 * pressioni, e allora chi sta per aggiungerne una deve sapere quali. Restituisce `null` nel
 * primo caso.
 */
export function testoAvvisoVariante(params: {
  marca: string
  modello: string
  /** Pressioni che le righe già a catalogo dichiarano alla scheda dati. */
  pressioniEsistenti: number[]
  /** Pressione della variante che si sta per creare; `null` se la colonna PS è vuota. */
  nuova: number | null
}): AvvisoVariante | null {
  const { marca, modello, pressioniEsistenti, nuova } = params
  if (pressioniEsistenti.length === 0) return null

  const elenco = [...pressioniEsistenti].sort((a, b) => a - b).map(numeroIT)
  const esistenti =
    elenco.length === 1
      ? `esiste già a ${elenco[0]} bar`
      : `esiste già in ${elenco.length} varianti: ${elenco.slice(0, -1).join(', ')} e ${elenco[elenco.length - 1]} bar`

  const coda =
    nuova === null ? "Stai per aggiungerne un'altra." : `Stai per aggiungerne una a ${numeroIT(nuova)} bar.`

  return {
    titolo: 'Variante nuova di un modello già a catalogo',
    corpo: `A catalogo ${marca} ${modello} ${esistenti}. ${coda}`,
  }
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

```bash
npx vitest run src/utils/__tests__/equipmentVarianti.test.ts
```

Atteso: PASS.

- [ ] **Step 5: Tenere le righe in stato invece di scartarle**

In `src/components/technicalSheet/EquipmentAutocomplete.tsx`, aggiungere agli import:

```ts
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { testoAvvisoVariante, type AvvisoVariante } from '@/utils/equipmentVarianti'
```

(unire `Button` e i componenti `Dialog*` all'import di `@mui/material` già presente).

Aggiungere accanto agli altri `useState`:

```ts
  /**
   * Righe di catalogo del modello corrente, dall'ultima verifica di esistenza.
   *
   * Si tengono invece di scartarle: l'avviso deve elencare esattamente le varianti su cui
   * il pulsante è comparso, e rifare la query al momento del click potrebbe mostrarne altre.
   */
  const [righeCatalogo, setRigheCatalogo] = useState<EquipmentCatalogItem[]>([])
  const [avviso, setAvviso] = useState<AvvisoVariante | null>(null)
```

Nell'effetto che governa `showAddButton`, registrare le righe. Il corpo diventa:

```ts
  useEffect(() => {
    if (readOnly || isTecnicoDM329 || !marcaValue || !modelloValue) {
      setShowAddButton(false)
      setRigheCatalogo([])
      return
    }

    let annullato = false
    const timer = setTimeout(async () => {
      try {
        const righe = await equipmentCatalogApi.findVariants(equipmentType, marcaValue, modelloValue)
        if (annullato) return
        setRigheCatalogo(righe)

        // Modello del tutto assente: è una voce nuova.
        if (righe.length === 0) { setShowAddButton(true); return }

        // Il modello c'è e il tipo non ha varianti: non c'è nulla da aggiungere.
        if (!indicizzatoPerVariante) { setShowAddButton(false); return }

        // Il modello c'è: resta da vedere se manca proprio questa pressione. Il confronto è
        // con la pressione che la riga di catalogo dichiara alla scheda — la massima sui
        // compressori — che è la stessa che l'utente ha scritto nella colonna PS.
        const valori = righe.map((r) => readSheetPressure(equipmentType, r.specs))
        setShowAddButton(variantValue != null && !valori.includes(variantValue))
      } catch (error) {
        console.error('Errore nella verifica di esistenza a catalogo:', error)
        if (!annullato) { setShowAddButton(false); setRigheCatalogo([]) }
      }
    }, 300)

    return () => { annullato = true; clearTimeout(timer) }
  }, [readOnly, isTecnicoDM329, equipmentType, marcaValue, modelloValue, variantValue, indicizzatoPerVariante, refreshCatalogo])
```

- [ ] **Step 6: Interporre l'avviso al click sul `+`**

Sostituire `handleAddToCatalog` con:

```ts
  /**
   * Click sul «+»: se il modello è già a catalogo ad altre pressioni si avvisa prima, così
   * chi sta per creare una quarta variante di una macchina che ne ha tre lo sa.
   */
  const handleAddToCatalog = () => {
    const pressioni = righeCatalogo
      .map((r) => readSheetPressure(equipmentType, r.specs))
      .filter((p): p is number => p !== null)

    const testo = indicizzatoPerVariante
      ? testoAvvisoVariante({
          marca: marcaValue,
          modello: modelloValue,
          pressioniEsistenti: pressioni,
          nuova: variantValue ?? null,
        })
      : null

    if (testo) setAvviso(testo)
    else setDialogOpen(true)
  }

  const confermaAvviso = () => {
    setAvviso(null)
    setDialogOpen(true)
  }
```

- [ ] **Step 7: Rendere il dialog di conferma**

Aggiungere, subito prima di `<AddEquipmentDialog ... />` nel JSX:

```tsx
      {/* Conferma prima di creare una variante di un modello che c'è già.
          Non si usa window.confirm: basta che l'utente spunti una volta «impedisci a questa
          pagina di creare altre finestre di dialogo» perché il browser risponda false a ogni
          conferma successiva senza mostrarla. Stessa ragione già documentata in
          UnifiedEquipmentTable. */}
      <Dialog open={avviso !== null} onClose={() => setAvviso(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem' }}>{avviso?.titolo}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem' }}>{avviso?.corpo}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAvviso(null)}>Annulla</Button>
          <Button onClick={confermaAvviso} variant="contained">Aggiungi comunque</Button>
        </DialogActions>
      </Dialog>
```

- [ ] **Step 8: Verificare tipi e test**

```bash
npx tsc --noEmit && npx vitest run
```

Atteso: nessun errore, tutti i test passano.

- [ ] **Step 9: Verificare a schermo**

Nell'anteprima, su una scheda DM329:

1. Compressore **KAESER KOMPRESSOREN SE / SK 22**, colonna PS a **9**. Deve comparire il `+`; premendolo deve aprirsi l'avviso con «esiste già in 3 varianti: 8, 11 e 15 bar. Stai per aggiungerne una a 9 bar.» «Annulla» chiude senza aprire nulla; «Aggiungi comunque» apre il dialog di inserimento.
2. Marca e modello inventati, es. **ACME / XYZ-1**. Il `+` deve comparire e aprire il dialog di inserimento **senza** avviso.

- [ ] **Step 10: Commit**

```bash
git add src/utils/equipmentVarianti.ts src/utils/__tests__/equipmentVarianti.test.ts src/components/technicalSheet/EquipmentAutocomplete.tsx
git commit -m "feat(scheda dati): il + avvisa quando il modello e' gia' a catalogo

Aggiungere una quarta variante a una macchina che ne ha tre e' quasi sempre un
errore di lettura della PS, non un censimento nuovo. L'avviso elenca le varianti
che ci sono e chiede conferma; quando il modello manca del tutto tace, perche'
non c'e' niente da segnalare.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Ripulitura dei valori in virgola mobile

**Files:**
- Create: `supabase/migrations/20260806000000_normalizza_float_specs.sql`

**Interfaces:**
- Consumes: niente.
- Produces: niente per il codice. Effetto sui dati: sei righe attive con code di arrotondamento tornano ai valori attesi.

- [ ] **Step 1: Scrivere la migration**

Creare `supabase/migrations/20260806000000_normalizza_float_specs.sql`:

```sql
-- Code di arrotondamento nei dati tecnici del catalogo.
--
-- Sei righe attive portano valori come 4059.9999999999995 al posto di 4060, residuo di
-- conversioni m3/h -> l/min fatte in virgola mobile all'import. Il numero finisce tale e
-- quale nella scheda dati e nella tabella caratteristiche della relazione.
--
-- Ricognizione del 2026-08-03 sul catalogo attivo:
--   KAESER ASK 40            fad 4059.9999999999995 -> 4060
--   KAESER ASK 40 T          fad 4059.9999999999995 -> 4060
--   WORTHINGTON Rollair 1000 B   fad  996.0000000000001 ->  996
--   WORTHINGTON Rollair 2000 A   fad 2027.9999999999998 -> 2028
--   WORTHINGTON RLR 2500 BE7     fad 2583.3333333333335 -> 2583.33
--   WORTHINGTON Rollair RLR 750 B fad 691.6666666666666 ->  691.67
--
-- Le ultime due sono divisioni per 60 genuinamente periodiche e restano con i decimali:
-- l'arrotondamento e' a 2 cifre, non all'intero.
--
-- Solo i valori numerici JSON: i testuali non si toccano, perche' fra loro ci sono gli
-- intervalli di temperatura («-10 ÷ +200») che un arrotondamento distruggerebbe.
--
-- Il confronto e' numerico e non testuale: `'8' <> '8.00'` e' vero come stringhe, e una
-- condizione testuale riscriverebbe ogni valore intero del catalogo. `trim_scale` toglie
-- gli zeri di coda introdotti da `round`, cosi' 4060.00 torna 4060 e non 4060.00.

BEGIN;

UPDATE equipment_catalog c
SET specs = (
      SELECT jsonb_object_agg(
               e.key,
               CASE
                 WHEN jsonb_typeof(e.value) = 'number'
                      AND e.value::text::numeric <> round(e.value::text::numeric, 2)
                   THEN to_jsonb(trim_scale(round(e.value::text::numeric, 2)))
                 ELSE e.value
               END
             )
      FROM jsonb_each(c.specs) AS e
    ),
    updated_at = now()
WHERE c.is_active
  AND c.specs IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(c.specs) AS e
    WHERE jsonb_typeof(e.value) = 'number'
      AND e.value::text::numeric <> round(e.value::text::numeric, 2)
  );

COMMIT;
```

- [ ] **Step 2: Contare le righe che verranno toccate, prima di applicare**

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/preflight.json <<'EOF'
{"query":"SELECT marca, modello, e.key, e.value FROM equipment_catalog c, jsonb_each(c.specs) AS e WHERE c.is_active AND jsonb_typeof(e.value) = 'number' AND e.value::text::numeric <> round(e.value::text::numeric, 2) ORDER BY 1,2"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/preflight.json
```

Atteso: esattamente le sei righe elencate nel commento della migration. Se ne compaiono altre, fermarsi e riportarle: la ricognizione è del 2026-08-03 e il catalogo può essere cambiato.

- [ ] **Step 3: Applicare la migration a produzione**

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && python - <<'PY' > /tmp/mig.json
import json, pathlib
sql = pathlib.Path("supabase/migrations/20260806000000_normalizza_float_specs.sql").read_text(encoding="utf-8")
print(json.dumps({"query": sql}))
PY
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/mig.json
```

- [ ] **Step 4: Verificare l'esito**

Rieseguire il comando del Passo 2. Atteso: `[]`. Poi controllare i valori attesi:

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/verifica.json <<'EOF'
{"query":"SELECT modello, specs->>'fad' AS fad FROM equipment_catalog WHERE is_active AND modello IN ('ASK 40','ASK 40 T','Rollair 1000 B','Rollair 2000 A','RLR 2500 BE7','Rollair RLR 750 B') ORDER BY 1"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/verifica.json
```

Atteso: `4060`, `4060`, `996`, `2028`, `2583.33`, `691.67`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260806000000_normalizza_float_specs.sql
git commit -m "fix(db): via le code di arrotondamento dai dati tecnici del catalogo

Sei righe attive portavano valori come 4059.9999999999995 al posto di 4060,
residuo di conversioni m3/h -> l/min fatte in virgola mobile all'import. Il
numero finiva tale e quale nella scheda dati e nella relazione.

Arrotondamento a 2 decimali dei soli valori numerici: le due conversioni
genuinamente periodiche (divisioni per 60) restano con i decimali, e i valori
testuali non si toccano perche' fra loro ci sono gli intervalli di temperatura.

Migration gia' applicata al database di produzione.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verifica finale

- [ ] **Suite completa e tipi**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src --ext .ts,.tsx
```

- [ ] **Giro a schermo sulla pagina Apparecchiature**

Aprire la gestione apparecchiature, filtrare per Compressori:

- le chip di una riga mostrano `FAD … l/min` e `PS … bar`, **non** «Pressione di esercizio»;
- aprendo la matita di modifica, il form ha FAD, PS, Tipo costruttivo e Regolazione giri — **nessun** campo «Pressione di esercizio»;
- salvando senza toccare nulla, la riga resta identica: rileggere la voce dal database e verificare che `specs.pressione_esercizio` ci sia ancora.

Quest'ultimo controllo è il più importante del piano: se il salvataggio dal form cancellasse la chiave di variante, le varianti dello stesso modello collasserebbero al primo salvataggio.

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/controllo.json <<'EOF'
{"query":"SELECT count(*) FILTER (WHERE specs ? 'pressione_esercizio') AS con_esercizio, count(*) AS totale FROM equipment_catalog WHERE tipo_apparecchiatura = 'Compressori' AND is_active"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/controllo.json
```

Atteso: `con_esercizio` 473, `totale` 635 — gli stessi numeri di partenza.
