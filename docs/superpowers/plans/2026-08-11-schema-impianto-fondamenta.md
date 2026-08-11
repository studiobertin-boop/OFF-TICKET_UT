# Schema d'impianto — fondamenta dell'editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare all'editor dello schema d'impianto le fondamenta che gli mancano — punti di aggancio dichiarati dai simboli, tubazioni che si attaccano lì e che si possono instradare a mano, layout che sopravvive alla chiusura del dialog, strumenti di allineamento.

**Architecture:** La libreria simboli diventa un registro di definizioni dove le ancore sono dato puro e solo il disegno è funzione, così il Blocco 3 potrà spostarla su tabella senza riscriverla. Gli archi smettono di puntare a un nodo e puntano a `{nodo, ancora}`; la compatibilità fra stile della tubazione e tipo di ancora è una funzione pura riusata da modello, editor e preflight. Il layout si serializza in `additional_info.schemaLayout` e si riconcilia con la scheda all'apertura.

**Tech Stack:** TypeScript (strict=false), React 18, @xyflow/react 12.11, MUI 6, Zod, Vitest, Supabase (PostgREST, colonna JSONB `additional_info`).

## Global Constraints

- Riferimento grafico autorevole: `DOCUMENTAZIONE/relazione/Blocchi.pdf`. Nessun simbolo si inventa.
- Test con Vitest solo su logica pura: modello, layout, render, allineamento, persistenza. **Nessun test di UI** (convenzione di progetto in `CLAUDE.md`).
- Commenti e identificatori in italiano, come tutto il modulo `schemaImpianto`.
- `renderSvg` resta una funzione pura senza DOM: deve girare in Node.
- Il PNG non si persiste: si rigenera sempre dal layout.
- Le ancore riusano gli identificativi già in uso nell'editor (`sx`, `dx`, `alto-in`, `alto-out`, `basso-out`) dove il significato coincide, per non spezzare la corrispondenza con `ATTACCO` durante la migrazione.
- Conventional Commits.

---

### Task 1: Tipi delle ancore e chiave di variante

**Files:**
- Modify: `src/services/schemaImpianto/types.ts`
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts` (create)

**Interfaces:**
- Produces: `SchemaTipoAggancio`, `SchemaAncora`, `SchemaCapo`, `ChiaveSimbolo`, `chiaveSimbolo(nodo)`

Il serbatoio è l'unico simbolo la cui geometria cambia con una variante (verticale/orizzontale), e le ancore cambiano con essa. Per tenere le ancore dato puro — condizione perché il Blocco 3 le sposti su tabella — il registro si indicizza per **chiave di variante**, non per tipo.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/services/schemaImpianto/__tests__/simboli.test.ts
import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'

describe('chiaveSimbolo', () => {
  it('distingue le due varianti del serbatoio', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'VERTICALE' })).toBe('serbatoio:VERTICALE')
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' })).toBe('serbatoio:ORIZZONTALE')
  })

  it('assume il serbatoio verticale quando l’orientamento manca', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio' })).toBe('serbatoio:VERTICALE')
  })

  it('per gli altri tipi la chiave è il tipo stesso', () => {
    expect(chiaveSimbolo({ tipo: 'compressore' })).toBe('compressore')
    expect(chiaveSimbolo({ tipo: 'tanica' })).toBe('tanica')
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: FAIL — `chiaveSimbolo` non è esportata da `../types`

- [ ] **Step 3: Implementare i tipi**

In `src/services/schemaImpianto/types.ts`, aggiungere:

```ts
/** Cosa può agganciarsi a un punto di attacco di un simbolo. */
export type SchemaTipoAggancio = 'aria' | 'condensa' | 'valvola_sicurezza'

/**
 * Punto di attacco dichiarato dal simbolo, in coordinate locali al riquadro d'ingombro.
 * È dato puro — nessuna funzione — perché il Blocco 3 lo sposterà su tabella.
 */
export interface SchemaAncora {
  /** Stabile e parlante: entra negli archi salvati, cambiarlo invalida i layout esistenti. */
  id: string
  x: number
  y: number
  /** Mai vuoto: un'ancora che non accetta nulla non serve. */
  accetta: SchemaTipoAggancio[]
}

/** Capo di una tubazione: non più solo il nodo, ma il punto preciso su cui si innesta. */
export interface SchemaCapo {
  nodo: string
  ancora: string
}

/**
 * Chiave del registro simboli. Coincide col tipo, tranne dove la geometria cambia con una
 * variante: il serbatoio orizzontale ha corpo e ancore diversi da quello verticale.
 */
export type ChiaveSimbolo = string

export function chiaveSimbolo(nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' }): ChiaveSimbolo {
  if (nodo.tipo === 'serbatoio') return `serbatoio:${nodo.orientamento ?? 'VERTICALE'}`
  return nodo.tipo
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): tipi delle ancore e chiave di variante dei simboli"
```

---

### Task 2: Registro dei simboli con ancore e ingombri

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts`
- Modify: `src/services/schemaImpianto/layout.ts` (rimuovere `DIMENSIONI_NODO`, reimportarlo dal registro)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `SchemaAncora`, `ChiaveSimbolo`, `chiaveSimbolo` (Task 1)
- Produces: `DefinizioneSimbolo`, `REGISTRO_SIMBOLI: Record<ChiaveSimbolo, DefinizioneSimbolo>`, `definizioneDi(nodo): DefinizioneSimbolo`, `ancoraDi(nodo, id): SchemaAncora | undefined`, `DIMENSIONI_NODO` (riesportato per compatibilità)

Oggi ingombri (`DIMENSIONI_NODO` in `layout.ts`) e disegno (`symbols/index.ts`) vivono in file diversi e vanno tenuti d'accordo a mano. Il registro li unisce.

Coordinate delle ancore, ricavate dalla geometria già scritta in `symbols/index.ts` e `corpoNodo`:

| Chiave | Ancora | x, y | accetta |
|---|---|---|---|
| `compressore` (160×150) | `alto-out` | 80, 0 | aria |
| | `basso-out` | 80, 150 | condensa |
| `serbatoio:VERTICALE` (150×260) | `sx` | 33, 150 | aria |
| | `dx` | 117, 150 | aria |
| | `alto-in` | 75, 40 | aria, valvola_sicurezza |
| | `basso-out` | 75, 260 | condensa |
| `serbatoio:ORIZZONTALE` (150×260) | `sx` | 0, 130 | aria |
| | `dx` | 150, 130 | aria |
| | `alto-in` | 33, 88 | aria, valvola_sicurezza |
| | `basso-out` | 117, 172 | condensa |
| `essiccatore`, `filtro` (110×110) | `sx` | 6, 49 | aria |
| | `dx` | 104, 49 | aria |
| | `basso-out` | 55, 88 | condensa |
| | `alto-in` | 55, 10 | aria |
| `separatore` (110×110) | `sx` | 6, 49 | aria, condensa |
| | `dx` | 104, 49 | aria, condensa |
| | `basso-out` | 55, 88 | condensa |
| | `alto-in` | 55, 10 | aria |
| `tanica` (80×70) | `alto-in` | 40, 6 | condensa |

Il separatore ha ancore proprie perché è l'unico rombo che fa da pozzo di raccolta, e la corsia delle condense **vi arriva di fianco**: in `555_RELAZIONE_TECNICA` la linea tratteggiata corre in orizzontale e entra nel vertice sinistro di SEP. Le apparecchiature scaricano invece **verso il basso** (`basso-out`), e solo la tanica riceve **dall'alto**.
| `pacco_bombole` (120×100) | `dx` | 114, 60 | aria |

- [ ] **Step 1: Scrivere il test che fallisce**

Aggiungere a `src/services/schemaImpianto/__tests__/simboli.test.ts`:

```ts
import { REGISTRO_SIMBOLI, definizioneDi, ancoraDi } from '../symbols'

describe('registro dei simboli', () => {
  it('ogni definizione dichiara almeno un’ancora, con identificativi distinti', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      expect(def.ancore.length, chiave).toBeGreaterThan(0)
      const ids = def.ancore.map((a) => a.id)
      expect(new Set(ids).size, chiave).toBe(ids.length)
    }
  })

  it('ogni ancora accetta almeno un tipo e cade dentro il riquadro d’ingombro', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      for (const a of def.ancore) {
        expect(a.accetta.length, `${chiave}/${a.id}`).toBeGreaterThan(0)
        expect(a.x, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.x, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.larghezza)
        expect(a.y, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.y, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.altezza)
      }
    }
  })

  it('il serbatoio orizzontale ha ancore diverse dal verticale', () => {
    const v = ancoraDi({ tipo: 'serbatoio', orientamento: 'VERTICALE' }, 'sx')
    const o = ancoraDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }, 'sx')
    expect(v).toBeDefined()
    expect(o).toBeDefined()
    expect(v).not.toEqual(o)
  })

  it('definizioneDi risolve la variante del nodo', () => {
    expect(definizioneDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }).dimensioni.larghezza).toBe(150)
    expect(definizioneDi({ tipo: 'tanica' }).dimensioni.larghezza).toBe(80)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: FAIL — `REGISTRO_SIMBOLI` non esportato

- [ ] **Step 3: Implementare il registro**

In `symbols/index.ts`, aggiungere in coda (le funzioni `simbolo*` esistenti restano e diventano il campo `disegna`):

```ts
export interface DefinizioneSimbolo {
  dimensioni: { larghezza: number; altezza: number }
  ancore: SchemaAncora[]
  disegna: (nodo: SchemaNodoPosizionato) => string
}

/** Ancore condivise dai tre simboli a rombo, che hanno la stessa geometria. */
const ANCORE_ROMBO: SchemaAncora[] = [
  { id: 'sx', x: 6, y: 49, accetta: ['aria'] },
  { id: 'dx', x: 104, y: 49, accetta: ['aria'] },
  { id: 'alto-in', x: 55, y: 10, accetta: ['aria'] },
  { id: 'basso-out', x: 55, y: 88, accetta: ['condensa'] },
]

export const REGISTRO_SIMBOLI: Record<ChiaveSimbolo, DefinizioneSimbolo> = {
  compressore: {
    dimensioni: { larghezza: 160, altezza: 150 },
    ancore: [
      { id: 'alto-out', x: 80, y: 0, accetta: ['aria'] },
      { id: 'basso-out', x: 80, y: 150, accetta: ['condensa'] },
    ],
    disegna: simboloCompressore,
  },
  'serbatoio:VERTICALE': {
    dimensioni: { larghezza: 150, altezza: 260 },
    ancore: [
      { id: 'sx', x: 33, y: 150, accetta: ['aria'] },
      { id: 'dx', x: 117, y: 150, accetta: ['aria'] },
      { id: 'alto-in', x: 75, y: 40, accetta: ['aria', 'valvola_sicurezza'] },
      { id: 'basso-out', x: 75, y: 260, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  'serbatoio:ORIZZONTALE': {
    dimensioni: { larghezza: 150, altezza: 260 },
    ancore: [
      { id: 'sx', x: 0, y: 130, accetta: ['aria'] },
      { id: 'dx', x: 150, y: 130, accetta: ['aria'] },
      { id: 'alto-in', x: 33, y: 88, accetta: ['aria', 'valvola_sicurezza'] },
      { id: 'basso-out', x: 117, y: 172, accetta: ['condensa'] },
    ],
    disegna: simboloSerbatoio,
  },
  essiccatore: { dimensioni: { larghezza: 110, altezza: 110 }, ancore: ANCORE_ROMBO, disegna: simboloEssiccatore },
  filtro: { dimensioni: { larghezza: 110, altezza: 110 }, ancore: ANCORE_ROMBO, disegna: simboloFiltro },
  separatore: { dimensioni: { larghezza: 110, altezza: 110 }, ancore: ANCORE_ROMBO, disegna: simboloSeparatore },
  tanica: {
    dimensioni: { larghezza: 80, altezza: 70 },
    ancore: [{ id: 'alto-in', x: 40, y: 6, accetta: ['condensa'] }],
    disegna: simboloTanica,
  },
  pacco_bombole: {
    dimensioni: { larghezza: 120, altezza: 100 },
    ancore: [{ id: 'dx', x: 114, y: 60, accetta: ['aria'] }],
    disegna: simboloPaccoBombole,
  },
}

export function definizioneDi(nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' }): DefinizioneSimbolo {
  return REGISTRO_SIMBOLI[chiaveSimbolo(nodo)]
}

export function ancoraDi(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  id: string
): SchemaAncora | undefined {
  return definizioneDi(nodo).ancore.find((a) => a.id === id)
}

/** Ingombri per tipo, ricavati dal registro. Conserva la forma che `layout.ts` già usa. */
export const DIMENSIONI_NODO: Record<SchemaNodoTipo, { larghezza: number; altezza: number }> = {
  compressore: REGISTRO_SIMBOLI.compressore.dimensioni,
  serbatoio: REGISTRO_SIMBOLI['serbatoio:VERTICALE'].dimensioni,
  essiccatore: REGISTRO_SIMBOLI.essiccatore.dimensioni,
  filtro: REGISTRO_SIMBOLI.filtro.dimensioni,
  separatore: REGISTRO_SIMBOLI.separatore.dimensioni,
  tanica: REGISTRO_SIMBOLI.tanica.dimensioni,
  pacco_bombole: REGISTRO_SIMBOLI.pacco_bombole.dimensioni,
}
```

Poi in `layout.ts` cancellare la costante `DIMENSIONI_NODO` e sostituirla con un riesporto, così i consumatori esistenti (`renderSvg`, `SchemaNodeSymbol`, `SchemaEditor`) non cambiano import:

```ts
export { DIMENSIONI_NODO } from './symbols'
```

Attenzione al ciclo: `symbols/index.ts` oggi importa `DIMENSIONI_NODO` da `../layout`. Va cambiato in modo che legga il proprio `REGISTRO_SIMBOLI` — le funzioni `simbolo*` devono usare `REGISTRO_SIMBOLI[...].dimensioni` oppure ricevere gli ingombri per parametro. Scegliere la via minima: dichiarare le costanti di ingombro in cima al file e farle usare sia dal registro sia dalle funzioni di disegno.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto`
Expected: PASS — i test esistenti di layout e renderSvg restano verdi (il riesporto conserva ingombri identici)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore, nessun ciclo di import

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema-impianto): registro dei simboli con ancore e ingombri"
```

---

### Task 3: Regola di compatibilità fra stile della tubazione e ancora

**Files:**
- Create: `src/services/schemaImpianto/agganci.ts`
- Test: `src/services/schemaImpianto/__tests__/agganci.test.ts`

**Interfaces:**
- Consumes: `SchemaAncora`, `SchemaArcoStile`, `ancoraDi` (Task 2)
- Produces: `tipoAggancioPerStile(stile): SchemaTipoAggancio`, `ancoraAmmette(ancora, stile): boolean`, `capoValido(nodo, ancoraId, stile): boolean`

Vive in un file suo perché la usano tre consumatori distanti fra loro: il costruttore del modello, l'editor (per rifiutare una connessione mentre la si traccia) e il preflight del Blocco 2.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/services/schemaImpianto/__tests__/agganci.test.ts
import { describe, it, expect } from 'vitest'
import { tipoAggancioPerStile, ancoraAmmette, capoValido } from '../agganci'

describe('compatibilità degli agganci', () => {
  it('mandata rigida e flessibile chiedono entrambe un aggancio d’aria', () => {
    expect(tipoAggancioPerStile('standard')).toBe('aria')
    expect(tipoAggancioPerStile('flessibile')).toBe('aria')
    expect(tipoAggancioPerStile('condensa')).toBe('condensa')
  })

  it('un’ancora di sola aria rifiuta una linea condense', () => {
    const ancora = { id: 'dx', x: 0, y: 0, accetta: ['aria' as const] }
    expect(ancoraAmmette(ancora, 'standard')).toBe(true)
    expect(ancoraAmmette(ancora, 'condensa')).toBe(false)
  })

  it('lo scarico del serbatoio accetta la condensa ma non la mandata', () => {
    const serbatoio = { tipo: 'serbatoio' as const, orientamento: 'VERTICALE' as const }
    expect(capoValido(serbatoio, 'basso-out', 'condensa')).toBe(true)
    expect(capoValido(serbatoio, 'basso-out', 'standard')).toBe(false)
    expect(capoValido(serbatoio, 'dx', 'standard')).toBe(true)
  })

  it('un’ancora inesistente non è mai valida', () => {
    expect(capoValido({ tipo: 'tanica' as const }, 'inventata', 'condensa')).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/agganci.test.ts`
Expected: FAIL — il modulo `../agganci` non esiste

- [ ] **Step 3: Implementare**

```ts
// src/services/schemaImpianto/agganci.ts
/**
 * Regola unica su cosa può agganciarsi dove. Sta in un file suo perché la consultano il
 * costruttore del modello, l'editor (che rifiuta una connessione illegale mentre la si
 * traccia) e il preflight: tre punti distanti che devono dire la stessa cosa.
 */
import { ancoraDi } from './symbols'
import type { SchemaAncora, SchemaArcoStile, SchemaNodoTipo, SchemaTipoAggancio } from './types'

/** La tubazione flessibile è pur sempre aria: cambia il tratto, non il fluido. */
export function tipoAggancioPerStile(stile: SchemaArcoStile): SchemaTipoAggancio {
  return stile === 'condensa' ? 'condensa' : 'aria'
}

export function ancoraAmmette(ancora: SchemaAncora, stile: SchemaArcoStile): boolean {
  return ancora.accetta.includes(tipoAggancioPerStile(stile))
}

export function capoValido(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE' },
  ancoraId: string,
  stile: SchemaArcoStile
): boolean {
  const ancora = ancoraDi(nodo, ancoraId)
  return Boolean(ancora && ancoraAmmette(ancora, stile))
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/agganci.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/agganci.ts src/services/schemaImpianto/__tests__/agganci.test.ts
git commit -m "feat(schema-impianto): regola di compatibilita' fra tubazione e ancora"
```

---

### Task 4: Archi con capi tipizzati, scelti da `buildSchemaModel`

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (`SchemaArco.da`/`a` diventano `SchemaCapo`; `SchemaNodo.origine`)
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts`
- Modify: `src/services/schemaImpianto/layout.ts` (`riceveSoloCondensa` confronta `a.a.nodo`)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (indice archi: `arco.da.nodo`)
- Modify: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
- Test: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`

**Interfaces:**
- Consumes: `SchemaCapo` (Task 1), `capoValido` (Task 3)
- Produces: `SchemaArco { da: SchemaCapo; a: SchemaCapo; punti?: {x,y}[] }`, `SchemaNodo.origine: 'scheda' | 'manuale'`

Le scelte di ancoraggio oggi sono sepolte nei router di `renderSvg` (la mandata parte dal cielo, la condensa dallo scarico). Qui diventano esplicite nel modello.

- [ ] **Step 1: Scrivere il test che fallisce**

Aggiungere a `__tests__/buildSchemaModel.test.ts`:

```ts
import { capoValido } from '../agganci'

describe('ancoraggio degli archi automatici', () => {
  it('la mandata del compressore parte dal cielo ed entra nel fianco del serbatoio', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const mandata = model.archi.find((a) => a.stile === 'flessibile')

    expect(mandata?.da).toEqual({ nodo: 'C1', ancora: 'alto-out' })
    expect(mandata?.a).toEqual({ nodo: 'S1', ancora: 'sx' })
  })

  it('ogni arco generato usa ancore che ne accettano lo stile', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const perId = new Map(model.nodi.map((n) => [n.id, n]))

    expect(model.archi.length).toBeGreaterThan(0)
    for (const arco of model.archi) {
      expect(capoValido(perId.get(arco.da.nodo)!, arco.da.ancora, arco.stile), `${arco.id} da`).toBe(true)
      expect(capoValido(perId.get(arco.a.nodo)!, arco.a.ancora, arco.stile), `${arco.id} a`).toBe(true)
    }
  })

  it('i nodi dedotti dalla scheda si dichiarano tali', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }) })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    expect(model.nodi.every((n) => n.origine === 'scheda')).toBe(true)
  })
})
```

Aggiornare inoltre le asserzioni esistenti che confrontano `a.da`/`a.a` con stringhe: diventano `a.da.nodo`/`a.a.nodo`. Sono in `buildSchemaModel.test.ts` (i test su catena di trattamento, condense e manifold) e in `renderSvg.test.ts`.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run src/services/schemaImpianto`
Expected: FAIL — `arco.da` è una stringa, non un oggetto

- [ ] **Step 3: Implementare**

In `types.ts`:

```ts
export interface SchemaArco {
  id: string
  da: SchemaCapo
  a: SchemaCapo
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute. Assente: percorso automatico. */
  punti?: { x: number; y: number }[]
}
```

e su `SchemaNodo`:

```ts
  /**
   * Da dove viene il nodo. La riconciliazione col contenuto della scheda tocca solo quelli
   * di origine 'scheda': un nodo aggiunto a mano dalla palette è una scelta deliberata.
   */
  origine: 'scheda' | 'manuale'
```

In `buildSchemaModel.ts`, tutte le funzioni `build*Nodo` aggiungono `origine: 'scheda'`, e `buildArchi` sceglie le ancore:

```ts
  for (const [compressoreId, serbatoiIds] of Object.entries(input.collegamentiCompressoriSerbatoi)) {
    for (const serbatoioId of serbatoiIds) {
      archi.push({
        id: prossimoId('flex'),
        da: { nodo: compressoreId, ancora: 'alto-out' },
        a: { nodo: serbatoioId, ancora: 'sx' },
        stile: 'flessibile',
      })
    }
  }
```

La catena di trattamento usa `{ ancora: 'dx' }` in partenza e `{ ancora: 'sx' }` in arrivo.

Le condense partono sempre da `{ ancora: 'basso-out' }`, ma **l'arrivo dipende dal tipo di pozzo**: la tanica le riceve dall'alto (`alto-in`), il separatore di fianco (`sx`). È la convenzione degli schemi storici — in `555_RELAZIONE_TECNICA` la corsia entra nel vertice sinistro di SEP — e va rispettata, o `capoValido` rifiuta l'arco che il motore stesso ha generato.

In `layout.ts`, `riceveSoloCondensa` filtra su `a.a.nodo === id`. In `renderSvg.ts`, `renderArchi` risolve con `indice.get(arco.da.nodo)` e `indice.get(arco.a.nodo)`.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto && npx tsc --noEmit`
Expected: PASS, nessun errore di tipo

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/
git commit -m "feat(schema-impianto): gli archi dichiarano su quale ancora si innestano"
```

---

### Task 5: Il render attacca le tubazioni alle ancore

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts`
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `ancoraDi` (Task 2), `SchemaArco.da/a` (Task 4)
- Produces: `posizioneAncora(nodo, ancoraId): { x: number; y: number }`

I tre router (`renderMandataCompressore`, `renderMandataLinea`, `renderLineaCondense`) smettono di calcolare il punto d'attacco da `corpoNodo` e partono dall'ancora dichiarata. `corpoNodo` resta, ma solo per la geometria del corpo (serve ancora a `quotaCorsiaCondense`).

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
describe('attacco alle ancore', () => {
  it('la polilinea della mandata comincia esattamente sull’ancora del compressore', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const compressore = layout.nodi.find((n) => n.id === 'C1')!
    const svg = renderSvg(layout)

    // ancora 'alto-out' del compressore: (larghezza/2, 0) in coordinate locali
    const atteso = `M ${compressore.x + 80} ${compressore.y}`
    expect(svg).toContain(atteso)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "ancora del compressore"`
Expected: FAIL — la polilinea parte dal corpo, non dall'ancora

- [ ] **Step 3: Implementare**

In `renderSvg.ts`:

```ts
/** Posizione assoluta di un'ancora del nodo. Fallisce piano: senza ancora, il centro del corpo. */
export function posizioneAncora(nodo: SchemaNodoPosizionato, ancoraId: string): Punto {
  const ancora = ancoraDi(nodo, ancoraId)
  if (!ancora) {
    const corpo = corpoNodo(nodo)
    return { x: corpo.x + corpo.larghezza / 2, y: corpo.y + corpo.altezza / 2 }
  }
  return { x: nodo.x + ancora.x, y: nodo.y + ancora.y }
}
```

I router ricevono gli identificativi delle ancore e usano `posizioneAncora(da, arco.da.ancora)` e `posizioneAncora(a, arco.a.ancora)` come primo e ultimo punto della polilinea, al posto di `centro(...)`/`corpoNodo(...)`.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto`
Expected: PASS. Se il test dei varchi nel muro fallisce, è perché le quote sono cambiate: verificare che le quote di attraversamento restino scoperte, non riallineare il test alle nuove coordinate senza guardare il disegno.

- [ ] **Step 5: Verifica visiva**

Rigenerare lo schema in app (`http://localhost:5176`, pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d`, "Genera relazione") e controllare che nessuna tubazione resti staccata dal simbolo.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/
git commit -m "feat(schema-impianto): le tubazioni si attaccano alle ancore dichiarate"
```

---

### Task 6: Punti di passaggio nel percorso delle tubazioni

**Files:**
- Modify: `src/services/schemaImpianto/renderSvg.ts`
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `SchemaArco.punti` (Task 4), `posizioneAncora` (Task 5)

Quando `punti` è presente la polilinea ci passa in mezzo, con raccordi ortogonali fra un punto e il successivo. Quando è assente resta il percorso automatico.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
describe('punti di passaggio', () => {
  it('la polilinea attraversa i gomiti imposti, nell’ordine dato', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.archi[0].punti = [{ x: 300, y: 500 }]

    const svg = renderSvg(layout)
    expect(svg).toContain('300 500')
  })

  it('senza punti il percorso resta quello automatico', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const automatico = renderSvg(layout)

    layout.archi[0].punti = []
    expect(renderSvg(layout)).toBe(automatico)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "gomiti imposti"`
Expected: FAIL — `300 500` non compare

- [ ] **Step 3: Implementare**

```ts
/**
 * Raccorda due punti con due tratti ortogonali. Il verso lo decide la distanza maggiore:
 * si esce nella direzione in cui c'è più strada, che è il modo in cui si instrada a mano.
 */
function raccordoOrtogonale(da: Punto, a: Punto): Punto[] {
  if (da.x === a.x || da.y === a.y) return [a]
  return Math.abs(a.x - da.x) >= Math.abs(a.y - da.y)
    ? [{ x: a.x, y: da.y }, a]
    : [{ x: da.x, y: a.y }, a]
}

/** Polilinea che parte dall'ancora, tocca i gomiti imposti e arriva all'altra ancora. */
function polilineaConGomiti(inizio: Punto, gomiti: Punto[], fine: Punto): Punto[] {
  const punti: Punto[] = [inizio]
  let corrente = inizio
  for (const g of [...gomiti, fine]) {
    punti.push(...raccordoOrtogonale(corrente, g))
    corrente = g
  }
  return punti
}
```

In `renderArchi`, quando `arco.punti?.length` è maggiore di zero si usa `polilineaConGomiti` al posto del router automatico, conservando le decorazioni dello stile (onde del flessibile, tratteggio della condensa, freccia). `quoteAttraversamento` continua a ricevere la polilinea risultante, quindi i varchi nel muro si aprono da soli anche sui percorsi imposti.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/
git commit -m "feat(schema-impianto): percorso delle tubazioni con gomiti imposti a mano"
```

---

### Task 7: Il muro segue le apparecchiature

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` (estrarre `calcolaMuro`)
- Modify: `src/components/schemaImpianto/conversioneFlow.ts` (`flowALayout` ricalcola invece di trasportare)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfaces:**
- Produces: `calcolaMuro(nodi: SchemaNodoPosizionato[]): SchemaMuroSeparazione | null`

Oggi `flowALayout` riporta il muro calcolato dall'auto-layout: se si spostano le apparecchiature, il muro resta dov'era.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
import { calcolaMuro } from '../layout'

describe('calcolaMuro', () => {
  it('segue il bordo destro della sala compressori', () => {
    const base = { tipo: 'compressore' as const, etichetta: '', valvoleSicurezza: [], origine: 'scheda' as const }
    const primo = calcolaMuro([
      { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 40, y: 200 },
      { ...base, id: 'E1', tipo: 'essiccatore', gruppo: 'LINEA_DISTRIBUZIONE', x: 500, y: 200 },
    ])
    const spostato = calcolaMuro([
      { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 240, y: 200 },
      { ...base, id: 'E1', tipo: 'essiccatore', gruppo: 'LINEA_DISTRIBUZIONE', x: 700, y: 200 },
    ])

    expect(primo).not.toBeNull()
    expect(spostato!.x).toBeGreaterThan(primo!.x)
  })

  it('non c’è muro se manca uno dei due lati', () => {
    const base = { tipo: 'compressore' as const, etichetta: '', valvoleSicurezza: [], origine: 'scheda' as const }
    expect(calcolaMuro([{ ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 40, y: 200 }])).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t "calcolaMuro"`
Expected: FAIL — `calcolaMuro` non esportata

- [ ] **Step 3: Implementare**

Estrarre da `layoutSchema` il calcolo del muro in `calcolaMuro(nodi)`, esportarla, e farla chiamare sia da `layoutSchema` sia da `flowALayout`:

```ts
// conversioneFlow.ts — la firma perde il parametro `muro`
export function flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout {
  const nodi = nodes.map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }))
  return { nodi, archi: /* … */, muro: calcolaMuro(nodi) }
}
```

Aggiornare i due chiamanti in `SchemaEditor.tsx` (`conferma` e il calcolo dell'anteprima), che non passano più `layout.muro`.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto src/components/schemaImpianto && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEditor.tsx src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "fix(schema-impianto): il muro si ricalcola dalle posizioni correnti"
```

---

### Task 8: Serializzazione e riconciliazione del layout

**Files:**
- Create: `src/services/schemaImpianto/persistenza.ts`
- Test: `src/services/schemaImpianto/__tests__/persistenza.test.ts`

**Interfaces:**
- Consumes: `SchemaLayout`, `SchemaModel`, `layoutSchema`
- Produces: `serializzaLayout(layout): LayoutSalvato`, `deserializzaLayout(salvato): SchemaLayout | null`, `riconcilia(salvato, modello): { layout: SchemaLayout; aggiunti: string[]; rimossi: string[] }`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/services/schemaImpianto/__tests__/persistenza.test.ts
import { describe, it, expect } from 'vitest'
import { makeCompressore, makeDatiImpianto, makeScheda, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema } from '../layout'
import { serializzaLayout, deserializzaLayout, riconcilia } from '../persistenza'

function modelloDiProva(codiciCompressore: string[]) {
  const scheda = makeScheda({
    compressori: codiciCompressore.map((c) => makeCompressore({ codice: c, ha_disoleatore: false })),
    disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
    serbatoi: [makeSerbatoio()],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { [codiciCompressore[0]]: ['S1'] } })
}

describe('serializzazione', () => {
  it('l’andata e ritorno conserva nodi, archi e posizioni', () => {
    const layout = layoutSchema(modelloDiProva(['C1']))
    const tornato = deserializzaLayout(serializzaLayout(layout))!

    expect(tornato.nodi).toEqual(layout.nodi)
    expect(tornato.archi).toEqual(layout.archi)
  })

  it('rifiuta un contenuto di versione sconosciuta', () => {
    expect(deserializzaLayout({ versione: 99, nodi: [], archi: [] } as never)).toBeNull()
  })
})

describe('riconciliazione con la scheda', () => {
  it('aggiunge le apparecchiature comparse in scheda, senza spostare le altre', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1', 'C2']))

    expect(esito.aggiunti).toEqual(['C2'])
    expect(esito.layout.nodi.find((n) => n.id === 'C1')!.x).toBe(salvato.nodi.find((n) => n.id === 'C1')!.x)
  })

  it('toglie i nodi di origine scheda spariti dalla scheda', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1', 'C2'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1']))

    expect(esito.rimossi).toEqual(['C2'])
    expect(esito.layout.nodi.map((n) => n.id)).not.toContain('C2')
  })

  it('conserva sempre i nodi aggiunti a mano', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1'])))
    salvato.nodi.push({
      id: 'PB1', tipo: 'pacco_bombole', etichetta: 'Pacco bombole', gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [], origine: 'manuale', x: 900, y: 400,
    })

    const esito = riconcilia(salvato, modelloDiProva(['C1']))
    expect(esito.layout.nodi.map((n) => n.id)).toContain('PB1')
    expect(esito.rimossi).not.toContain('PB1')
  })

  it('scarta gli archi che puntano a un nodo non più presente', () => {
    const salvato = serializzaLayout(layoutSchema(modelloDiProva(['C1', 'C2'])))
    const esito = riconcilia(salvato, modelloDiProva(['C1']))
    const idNodi = new Set(esito.layout.nodi.map((n) => n.id))

    for (const arco of esito.layout.archi) {
      expect(idNodi.has(arco.da.nodo)).toBe(true)
      expect(idNodi.has(arco.a.nodo)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts`
Expected: FAIL — il modulo `../persistenza` non esiste

- [ ] **Step 3: Implementare**

```ts
// src/services/schemaImpianto/persistenza.ts
/**
 * Salvataggio e ripristino del layout ritoccato.
 *
 * La scheda resta autorevole su *cosa* esiste, il layout salvato su *dove* sta: alla
 * riapertura le due cose vanno rimesse d'accordo senza buttare il lavoro di disposizione.
 * Il muro non si salva — è derivato dalle posizioni e si ricalcola.
 */
import { calcolaMuro, layoutSchema } from './layout'
import type { SchemaArco, SchemaLayout, SchemaModel, SchemaNodoPosizionato } from './types'

const VERSIONE = 1

export interface LayoutSalvato {
  versione: number
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
}

export function serializzaLayout(layout: SchemaLayout): LayoutSalvato {
  return { versione: VERSIONE, nodi: layout.nodi, archi: layout.archi }
}

export function deserializzaLayout(salvato: LayoutSalvato | null | undefined): SchemaLayout | null {
  if (!salvato || salvato.versione !== VERSIONE) return null
  return { nodi: salvato.nodi, archi: salvato.archi, muro: calcolaMuro(salvato.nodi) }
}

export interface EsitoRiconciliazione {
  layout: SchemaLayout
  aggiunti: string[]
  rimossi: string[]
}

export function riconcilia(salvato: LayoutSalvato, modello: SchemaModel): EsitoRiconciliazione {
  const inScheda = new Set(modello.nodi.map((n) => n.id))
  const salvatiPerId = new Map(salvato.nodi.map((n) => [n.id, n]))

  // Un nodo salvato sopravvive se la scheda lo conosce ancora, o se l'ha messo l'utente.
  const superstiti = salvato.nodi.filter((n) => n.origine === 'manuale' || inScheda.has(n.id))
  const rimossi = salvato.nodi.filter((n) => !superstiti.includes(n)).map((n) => n.id)

  // Le apparecchiature nuove entrano nelle posizioni che l'auto-layout darebbe loro oggi,
  // traslate sotto il disegno esistente: in mezzo coprirebbero quello che c'è già.
  const nuovi = modello.nodi.filter((n) => !salvatiPerId.has(n.id))
  const piede = superstiti.length > 0 ? Math.max(...superstiti.map((n) => n.y)) + 320 : 0
  const automatico = layoutSchema(modello)
  const aggiunti = nuovi.map((n) => n.id)
  const posizionati = nuovi.map((n) => {
    const proposto = automatico.nodi.find((p) => p.id === n.id)!
    return { ...proposto, y: proposto.y + piede }
  })

  const nodi = [...superstiti, ...posizionati]
  const idNodi = new Set(nodi.map((n) => n.id))

  // Gli archi salvati restano solo se entrambi i capi esistono ancora; per le apparecchiature
  // nuove si prendono quelli che il modello propone.
  const archiSalvati = salvato.archi.filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))
  const idArchi = new Set(archiSalvati.map((a) => a.id))
  const archiNuovi = modello.archi.filter(
    (a) => !idArchi.has(a.id) && (aggiunti.includes(a.da.nodo) || aggiunti.includes(a.a.nodo))
  )
  const archi = [...archiSalvati, ...archiNuovi].filter((a) => idNodi.has(a.da.nodo) && idNodi.has(a.a.nodo))

  return { layout: { nodi, archi, muro: calcolaMuro(nodi) }, aggiunti, rimossi }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/persistenza.ts src/services/schemaImpianto/__tests__/persistenza.test.ts
git commit -m "feat(schema-impianto): serializzazione e riconciliazione del layout"
```

---

### Task 9: Il layout sopravvive alla chiusura del dialog

**Files:**
- Modify: `src/services/relazione/schema.ts` (`schemaLayout` in `additionalInfoSchema`)
- Modify: `src/services/relazione/types.ts` (`AdditionalInfo.schemaLayout`)
- Modify: `src/components/relazione/RelazioneDataDialog.tsx:152` (non azzerare più)
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx`
- Test: `src/services/relazione/__tests__/schemaLayoutPersistito.test.ts` (create)

**Interfaces:**
- Consumes: `serializzaLayout`, `deserializzaLayout`, `riconcilia` (Task 8)

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/services/relazione/__tests__/schemaLayoutPersistito.test.ts
import { describe, it, expect } from 'vitest'
import { additionalInfoSchema } from '../schema'

describe('schemaLayout in additional_info', () => {
  it('accetta un layout salvato e lo conserva', () => {
    const layout = { versione: 1, nodi: [{ id: 'C1', tipo: 'compressore', x: 40, y: 220 }], archi: [] }
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova', schemaLayout: layout })
    expect(esito.schemaLayout).toEqual(layout)
  })

  it('resta valido quando il layout non c’è', () => {
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova' })
    expect(esito.schemaLayout).toBeUndefined()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/relazione/__tests__/schemaLayoutPersistito.test.ts`
Expected: FAIL — `schemaLayout` viene rimosso dallo schema Zod

- [ ] **Step 3: Implementare**

In `services/relazione/schema.ts`, dentro `additionalInfoSchema`:

```ts
  /**
   * Layout dello schema d'impianto ritoccato a mano. Struttura libera per Zod: la validazione
   * vera la fa `deserializzaLayout`, che sa riconoscere una versione che non capisce.
   */
  schemaLayout: z.any().optional(),
```

In `services/relazione/types.ts`, aggiungere a `AdditionalInfo`:

```ts
  /** §2.3 — disposizione dello schema salvata dall'editor. Vedi schemaImpianto/persistenza. */
  schemaLayout?: LayoutSalvato
```

In `RelazioneDataDialog.tsx`, sostituire `setSchema(null)` con il ripristino del layout salvato, e passarlo a `SchemaImpiantoSection` come `layoutSalvato={info.schemaLayout}`. Al salvataggio, includere `schemaLayout: layout ? serializzaLayout(layout) : undefined` nell'`additionalInfo` inviato.

In `SchemaImpiantoSection.tsx`:
- accettare `layoutSalvato?: LayoutSalvato` e `onLayoutChange: (layout: SchemaLayout | null) => void`
- alla prima generazione: se c'è un layout salvato, `riconcilia(layoutSalvato, modello)` invece di `layoutSchema(modello)`
- mostrare l'esito della riconciliazione in un `Alert severity="info"` sopra l'anteprima quando `aggiunti` o `rimossi` non sono vuoti, con il testo: `Aggiunte dalla scheda: C2. Rimosse perché non più in scheda: C3.`
- chiamare `onLayoutChange` a ogni `disegna`, così il dialog ha sempre il layout corrente da salvare

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/relazione && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Verifica in app**

Aprire la pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d`, "Genera relazione", "Rifinisci schema", spostare un nodo, confermare, salvare la bozza, **chiudere e riaprire il dialog**: la posizione deve essere quella lasciata.

- [ ] **Step 6: Commit**

```bash
git add src/services/relazione/ src/components/relazione/
git commit -m "feat(schema-impianto): il layout ritoccato sopravvive alla chiusura del dialog"
```

---

### Task 10: Allineamento e distribuzione

**Files:**
- Create: `src/services/schemaImpianto/allineamento.ts`
- Test: `src/services/schemaImpianto/__tests__/allineamento.test.ts`

**Interfaces:**
- Produces: `allinea(nodi, bordo): SchemaNodoPosizionato[]`, `distribuisci(nodi, asse): SchemaNodoPosizionato[]`, tipi `Bordo = 'sinistra' | 'destra' | 'alto' | 'basso' | 'centroX' | 'centroY'`, `Asse = 'orizzontale' | 'verticale'`

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/services/schemaImpianto/__tests__/allineamento.test.ts
import { describe, it, expect } from 'vitest'
import { allinea, distribuisci } from '../allineamento'
import type { SchemaNodoPosizionato } from '../types'

function nodo(id: string, x: number, y: number): SchemaNodoPosizionato {
  return { id, tipo: 'essiccatore', etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'manuale', x, y }
}

describe('allinea', () => {
  it('porta tutti sul bordo sinistro più a sinistra', () => {
    const esito = allinea([nodo('A', 100, 0), nodo('B', 40, 50), nodo('C', 300, 90)], 'sinistra')
    expect(esito.map((n) => n.x)).toEqual([40, 40, 40])
  })

  it('non tocca l’altro asse', () => {
    const esito = allinea([nodo('A', 100, 0), nodo('B', 40, 50)], 'sinistra')
    expect(esito.map((n) => n.y)).toEqual([0, 50])
  })

  it('con un solo nodo non cambia nulla', () => {
    const uno = [nodo('A', 100, 30)]
    expect(allinea(uno, 'destra')).toEqual(uno)
  })
})

describe('distribuisci', () => {
  it('spaziatura uguale fra il primo e l’ultimo, che restano fermi', () => {
    const esito = distribuisci([nodo('A', 0, 0), nodo('B', 10, 0), nodo('C', 300, 0)], 'orizzontale')
    expect(esito.map((n) => n.x)).toEqual([0, 150, 300])
  })

  it('con meno di tre nodi non cambia nulla', () => {
    const due = [nodo('A', 0, 0), nodo('B', 100, 0)]
    expect(distribuisci(due, 'orizzontale')).toEqual(due)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/allineamento.test.ts`
Expected: FAIL — il modulo `../allineamento` non esiste

- [ ] **Step 3: Implementare**

```ts
// src/services/schemaImpianto/allineamento.ts
/**
 * Allineamento e distribuzione della selezione. Funzioni pure su nodi posizionati: l'editor
 * le chiama e basta, e restano verificabili senza DOM.
 *
 * L'allineamento ragiona sul riquadro d'ingombro, non sul corpo disegnato: è quello che
 * l'utente vede muoversi quando trascina.
 */
import { DIMENSIONI_NODO } from './symbols'
import type { SchemaNodoPosizionato } from './types'

export type Bordo = 'sinistra' | 'destra' | 'alto' | 'basso' | 'centroX' | 'centroY'
export type Asse = 'orizzontale' | 'verticale'

export function allinea(nodi: SchemaNodoPosizionato[], bordo: Bordo): SchemaNodoPosizionato[] {
  if (nodi.length < 2) return nodi
  const dim = (n: SchemaNodoPosizionato) => DIMENSIONI_NODO[n.tipo]

  switch (bordo) {
    case 'sinistra': {
      const x = Math.min(...nodi.map((n) => n.x))
      return nodi.map((n) => ({ ...n, x }))
    }
    case 'destra': {
      const bordoDestro = Math.max(...nodi.map((n) => n.x + dim(n).larghezza))
      return nodi.map((n) => ({ ...n, x: bordoDestro - dim(n).larghezza }))
    }
    case 'alto': {
      const y = Math.min(...nodi.map((n) => n.y))
      return nodi.map((n) => ({ ...n, y }))
    }
    case 'basso': {
      const bordoBasso = Math.max(...nodi.map((n) => n.y + dim(n).altezza))
      return nodi.map((n) => ({ ...n, y: bordoBasso - dim(n).altezza }))
    }
    case 'centroX': {
      const centro = nodi.reduce((s, n) => s + n.x + dim(n).larghezza / 2, 0) / nodi.length
      return nodi.map((n) => ({ ...n, x: Math.round(centro - dim(n).larghezza / 2) }))
    }
    case 'centroY': {
      const centro = nodi.reduce((s, n) => s + n.y + dim(n).altezza / 2, 0) / nodi.length
      return nodi.map((n) => ({ ...n, y: Math.round(centro - dim(n).altezza / 2) }))
    }
  }
}

/** Spaziatura uguale fra gli estremi, che restano dove sono: sono il riferimento scelto. */
export function distribuisci(nodi: SchemaNodoPosizionato[], asse: Asse): SchemaNodoPosizionato[] {
  if (nodi.length < 3) return nodi
  const chiave = asse === 'orizzontale' ? 'x' : 'y'
  const ordinati = [...nodi].sort((a, b) => a[chiave] - b[chiave])
  const primo = ordinati[0][chiave]
  const ultimo = ordinati[ordinati.length - 1][chiave]
  const passo = (ultimo - primo) / (ordinati.length - 1)

  const nuova = new Map(ordinati.map((n, i) => [n.id, Math.round(primo + passo * i)]))
  return nodi.map((n) => ({ ...n, [chiave]: nuova.get(n.id)! }))
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/schemaImpianto/__tests__/allineamento.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/allineamento.ts src/services/schemaImpianto/__tests__/allineamento.test.ts
git commit -m "feat(schema-impianto): allineamento e distribuzione della selezione"
```

---

### Task 11: Handle per ancora e connessioni rifiutate quando illegali

**Files:**
- Modify: `src/components/schemaImpianto/SchemaNodeSymbol.tsx`
- Modify: `src/components/schemaImpianto/conversioneFlow.ts`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`

**Interfaces:**
- Consumes: `definizioneDi` (Task 2), `capoValido` (Task 3), `SchemaCapo` (Task 4)
- Produces: `SchemaEdgeData { stile: SchemaArcoStile; punti?: { x: number; y: number }[] }` — il campo `punti` si aggiunge qui perché `flowALayout` deve già saperlo trasportare; a disegnarlo ci pensa il Task 12

`ATTACCO` sparisce: gli identificativi degli handle diventano quelli delle ancore del registro. Poiché gli id coincidono con quelli già in uso, i layout in circolazione durante lo sviluppo non si rompono.

- [ ] **Step 1: Un handle per ancora**

In `SchemaNodeSymbol.tsx`, sostituire i cinque `Handle` fissi con una generazione dal registro. La posizione react-flow si sceglie dal lato più vicino dell'ancora, e `type` è `source` o `target` a seconda che l'ancora accetti uscite o ingressi — per semplicità ogni ancora ospita entrambi, sovrapposti, così una tubazione può partire o arrivare dallo stesso punto:

```tsx
const def = definizioneDi(nodo)

function latoDi(ancora: SchemaAncora, dim: { larghezza: number; altezza: number }): Position {
  const distanze = [
    { lato: Position.Left, d: ancora.x },
    { lato: Position.Right, d: dim.larghezza - ancora.x },
    { lato: Position.Top, d: ancora.y },
    { lato: Position.Bottom, d: dim.altezza - ancora.y },
  ]
  return distanze.reduce((a, b) => (a.d <= b.d ? a : b)).lato
}

// dentro il componente, prima dell'<svg>:
{def.ancore.flatMap((ancora) => {
  const stile = { ...ANCORA, left: ancora.x, top: ancora.y, transform: 'translate(-50%, -50%)' }
  return [
    <Handle key={`s-${ancora.id}`} type="source" id={ancora.id} position={latoDi(ancora, def.dimensioni)} style={stile} />,
    <Handle key={`t-${ancora.id}`} type="target" id={ancora.id} position={latoDi(ancora, def.dimensioni)} style={stile} />,
  ]
})}
```

- [ ] **Step 2: Conversione fra archi e collegamenti react-flow**

In `conversioneFlow.ts`, `layoutAFlow` usa `sourceHandle: arco.da.ancora` e `targetHandle: arco.a.ancora`; `attacchiPerStile` non serve più e va rimossa. `flowALayout` ricostruisce i capi:

```ts
    archi: edges.map((e) => ({
      id: e.id,
      da: { nodo: e.source, ancora: e.sourceHandle ?? '' },
      a: { nodo: e.target, ancora: e.targetHandle ?? '' },
      stile: ((e.data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile,
      punti: (e.data as SchemaEdgeData | undefined)?.punti,
    })),
```

- [ ] **Step 3: Rifiutare le connessioni illegali**

In `SchemaEditor.tsx`, passare a `<ReactFlow>` una `isValidConnection`:

```tsx
const isValidConnection = useCallback(
  (c: Connection | Edge) => {
    const partenza = stato.nodes.find((n) => n.id === c.source)
    const arrivo = stato.nodes.find((n) => n.id === c.target)
    if (!partenza || !arrivo) return false
    // Una tubazione nuova nasce rigida: è lo stile con cui `onConnect` la crea.
    const nodoDa = (partenza.data as SchemaNodeData).nodo
    const nodoA = (arrivo.data as SchemaNodeData).nodo
    return (
      capoValido(nodoDa, c.sourceHandle ?? '', 'standard') &&
      capoValido(nodoA, c.targetHandle ?? '', 'standard')
    )
  },
  [stato.nodes]
)
```

Quando si cambia lo stile di una tubazione già tracciata, `cambiaStile` deve rifiutare il cambio se le ancore correnti non accettano il nuovo stile, e dirlo con un toast: `Questa tubazione non può diventare una linea condense: gli attacchi a cui è collegata non la accettano.`

- [ ] **Step 4: Typecheck e verifica in app**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

In app: provare a tracciare una linea condense dal fianco di un serbatoio — deve essere rifiutata; dallo scarico — deve essere accettata.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/
git commit -m "feat(schema-impianto): gli attacchi dell'editor vengono dal registro simboli"
```

---

### Task 12: Gomiti trascinabili sulle tubazioni

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`

**Interfaces:**
- Consumes: `SchemaArco.punti` (Task 4), `SchemaEdgeData.punti` (Task 11)

- [ ] **Step 1: Disegnare i gomiti**

In `SchemaEdgeTubazione.tsx`, quando `data.punti` è presente il percorso non viene più da `getSmoothStepPath` ma dalla polilinea imposta, e su ogni gomito si disegna una maniglia trascinabile. Il componente oggi fa `const [path, labelX, labelY] = getSmoothStepPath({...})`: quella riga resta, e il percorso effettivo si sceglie dopo.

```tsx
const [pathAutomatico, labelX, labelY] = getSmoothStepPath({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
})
const punti = (data as SchemaEdgeData | undefined)?.punti ?? []
const path = punti.length
  ? [`M ${sourceX} ${sourceY}`, ...punti.map((p) => `L ${p.x} ${p.y}`), `L ${targetX} ${targetY}`].join(' ')
  : pathAutomatico
```

Le maniglie si disegnano in `EdgeLabelRenderer` come `div` posizionati su `p.x`/`p.y`, con `pointerEvents: 'all'` e `cursor: 'move'`.

- [ ] **Step 2: Creare, spostare e togliere un gomito**

L'editor espone due callback tramite il contesto di react-flow (o via `data`, che è più semplice): doppio clic sulla tubazione aggiunge un gomito nel punto cliccato, convertito in coordinate del flow con `screenToFlowPosition` di `useReactFlow`; il trascinamento della maniglia aggiorna il punto; doppio clic sulla maniglia lo toglie.

In `SchemaEditor.tsx`:

```tsx
const spostaGomito = useCallback(
  (arcoId: string, indice: number, posizione: { x: number; y: number }, concluso: boolean) => {
    const aggiorna = concluso ? applica : aggiornaSenzaCronologia
    aggiorna((s) => ({
      ...s,
      edges: s.edges.map((e) => {
        if (e.id !== arcoId) return e
        const punti = [...(((e.data as SchemaEdgeData).punti) ?? [])]
        punti[indice] = posizione
        return { ...e, data: { ...e.data, punti } }
      }),
    }))
  },
  [applica, aggiornaSenzaCronologia]
)
```

Come per i nodi, solo il gesto concluso entra in cronologia.

- [ ] **Step 3: Typecheck e verifica in app**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

In app: creare un gomito su una mandata, trascinarlo, verificare che **l'anteprima a destra** mostri il percorso imposto; annullare con Ctrl+Z e verificare che torni dov'era.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/
git commit -m "feat(schema-impianto): gomiti trascinabili sulle tubazioni"
```

---

### Task 13: Barra di allineamento e spostamento con le frecce

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`

**Interfaces:**
- Consumes: `allinea`, `distribuisci` (Task 10)

- [ ] **Step 1: Applicare allineamento e distribuzione alla selezione**

```tsx
const applicaAllineamento = useCallback(
  (bordo: Bordo) => {
    const selezionati = new Set(selezione.nodes.map((n) => n.id))
    if (selezionati.size < 2) return
    applica((s) => {
      const nodi = s.nodes.filter((n) => selezionati.has(n.id)).map((n) => (n.data as SchemaNodeData).nodo)
      const spostati = new Map(allinea(nodi, bordo).map((n) => [n.id, n]))
      return {
        ...s,
        nodes: s.nodes.map((n) => {
          const nuovo = spostati.get(n.id)
          return nuovo ? { ...n, position: { x: nuovo.x, y: nuovo.y }, data: { nodo: nuovo } } : n
        }),
      }
    })
  },
  [applica, selezione.nodes]
)
```

Analogo per `distribuisci`. I pulsanti stanno nella barra, disabilitati sotto i due (o tre) nodi selezionati.

- [ ] **Step 2: Frecce della tastiera**

Estendere il gestore `keydown` già presente per Ctrl+Z:

```tsx
const PASSI: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

const sposta = useCallback(
  (dx: number, dy: number) => {
    const selezionati = new Set(selezione.nodes.map((n) => n.id))
    if (selezionati.size === 0) return
    applica((s) => ({
      ...s,
      nodes: s.nodes.map((n) => {
        if (!selezionati.has(n.id)) return n
        const nodo = (n.data as SchemaNodeData).nodo
        const x = nodo.x + dx
        const y = nodo.y + dy
        return { ...n, position: { x, y }, data: { nodo: { ...nodo, x, y } } }
      }),
    }))
  },
  [applica, selezione.nodes]
)
```

e dentro il gestore `suTasto` già presente, dopo la gestione di Ctrl+Z:

```tsx
const passo = PASSI[e.key]
if (passo && selezione.nodes.length > 0) {
  e.preventDefault()
  const fattore = e.shiftKey ? 10 : 1
  sposta(passo[0] * fattore, passo[1] * fattore)
}
```

`sposta` va fra le dipendenze dello `useEffect` che registra il gestore.

- [ ] **Step 3: Griglia visibile**

`<Background gap={20} />` diventa `<Background gap={10} />`, coerente con `snapGrid={[10, 10]}`: oggi la griglia mostra un passo che non è quello a cui i nodi si agganciano.

- [ ] **Step 4: Guide durante il trascinamento**

Il calcolo è puro e va in `allineamento.ts`, accanto ai suoi parenti, con il proprio test:

```ts
// src/services/schemaImpianto/allineamento.ts
/** Tolleranza entro cui due bordi si considerano in riga: mezzo passo di griglia. */
const TOLLERANZA = 5

export interface Guida {
  orientamento: 'verticale' | 'orizzontale'
  /** x se verticale, y se orizzontale. */
  quota: number
}

/**
 * Quote su cui il nodo trascinato si trova in riga con almeno un altro. Si confrontano i
 * tre riferimenti che l'occhio usa — bordo iniziale, centro, bordo finale — su entrambi gli assi.
 */
export function guideDiAllineamento(
  trascinato: SchemaNodoPosizionato,
  altri: SchemaNodoPosizionato[]
): Guida[] {
  const rif = (n: SchemaNodoPosizionato) => {
    const d = DIMENSIONI_NODO[n.tipo]
    return {
      x: [n.x, n.x + d.larghezza / 2, n.x + d.larghezza],
      y: [n.y, n.y + d.altezza / 2, n.y + d.altezza],
    }
  }
  const mio = rif(trascinato)
  const guide: Guida[] = []

  for (const altro of altri) {
    const suo = rif(altro)
    for (const q of mio.x) {
      for (const s of suo.x) {
        if (Math.abs(q - s) <= TOLLERANZA) guide.push({ orientamento: 'verticale', quota: s })
      }
    }
    for (const q of mio.y) {
      for (const s of suo.y) {
        if (Math.abs(q - s) <= TOLLERANZA) guide.push({ orientamento: 'orizzontale', quota: s })
      }
    }
  }

  // Più coppie possono concordare sulla stessa quota: una riga sola basta a dirlo.
  return guide.filter(
    (g, i) => guide.findIndex((h) => h.orientamento === g.orientamento && h.quota === g.quota) === i
  )
}
```

Test da aggiungere in `__tests__/allineamento.test.ts`:

```ts
describe('guideDiAllineamento', () => {
  it('segnala i bordi sinistri in riga', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 102, 400)])
    expect(guide).toContainEqual({ orientamento: 'verticale', quota: 102 })
  })

  it('tace quando nessun riferimento coincide', () => {
    expect(guideDiAllineamento(nodo('A', 0, 0), [nodo('B', 500, 500)])).toEqual([])
  })

  it('non ripete la stessa quota per più vicini', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 100, 300), nodo('C', 100, 600)])
    const verticali = guide.filter((g) => g.orientamento === 'verticale' && g.quota === 100)
    expect(verticali).toHaveLength(1)
  })
})
```

Nell'editor, `onNodeDrag` calcola le guide del nodo trascinato contro gli altri e le tiene in stato locale (non in cronologia: sono un aiuto visivo, non una modifica); `onNodeDragStop` le azzera. Si disegnano dentro `<ViewportPortal>` di react-flow, che rende in coordinate del flow, come linee sottili tratteggiate estese oltre i bordi del disegno.

- [ ] **Step 5: Typecheck e verifica in app**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

In app: selezionare due simboli, allinearli a sinistra, spostarne uno con le frecce, annullare; trascinare un simbolo finché non si mette in riga con un altro e verificare che compaia la guida.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx src/services/schemaImpianto/allineamento.ts src/services/schemaImpianto/__tests__/allineamento.test.ts
git commit -m "feat(schema-impianto): allineamento, distribuzione, frecce e guide di trascinamento"
```

---

### Task 14: Foglio di confronto con i blocchi CAD

**Files:**
- Create: `scripts/tavola-simboli.ts`

**Interfaces:**
- Consumes: `REGISTRO_SIMBOLI` (Task 2)

Le differenze residue fra i simboli generati e `Blocchi.pdf` vanno viste, non descritte. Questo task produce l'artefatto su cui il committente annota.

È uno **strumento, non un test**: sta in `scripts/` insieme agli altri script del progetto e si esegue con `tsx`. Fuori da `__tests__` non entra nella suite, e nessuno lo scambia per un test che ha dimenticato le asserzioni.

- [ ] **Step 1: Emettere la tavola**

Uno script che scrive un SVG con tutti i simboli del registro affiancati, ciascuno col proprio nome, e **con le ancore evidenziate** — un pallino per ancora, colorato per tipo accettato — così si controlla in un colpo solo la resa e la posizione degli attacchi.

```ts
// scripts/tavola-simboli.ts
import { writeFileSync } from 'node:fs'
import { REGISTRO_SIMBOLI } from '../src/services/schemaImpianto/symbols'
import type { SchemaNodoPosizionato } from '../src/services/schemaImpianto/types'

const OUT = process.env.SCHEMA_OUT ?? '.'
const COLORE: Record<string, string> = {
  aria: '#1976d2',
  condensa: '#d32f2f',
  valvola_sicurezza: '#2e7d32',
}

function emettiTavola(): void {
  let x = 40
  const parti: string[] = []

    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      const nodo = {
        id: chiave.startsWith('serbatoio') ? 'S1' : 'X1',
        tipo: chiave.split(':')[0],
        orientamento: chiave.split(':')[1],
        etichetta: '',
        gruppo: 'ALTRO',
        valvoleSicurezza: [{ codice: 'S1.1', etichetta: '' }],
        origine: 'scheda',
        x: 0,
        y: 0,
      } as unknown as SchemaNodoPosizionato

      const pallini = def.ancore
        .map(
          (a) =>
            `<circle cx="${a.x}" cy="${a.y}" r="5" fill="${COLORE[a.accetta[0]]}" />` +
            `<text x="${a.x + 8}" y="${a.y}" font-size="10" font-family="Arial">${a.id}</text>`
        )
        .join('')

      parti.push(
        `<g transform="translate(${x} 80)">${def.disegna(nodo)}${pallini}</g>`,
        `<text x="${x}" y="60" font-size="14" font-family="Arial">${chiave}</text>`
      )
      x += def.dimensioni.larghezza + 90
    }

  writeFileSync(
    `${OUT}/tavola.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="420" viewBox="0 0 ${x} 420">` +
      `<rect width="${x}" height="420" fill="#fff" />${parti.join('')}</svg>`
  )
  console.log(`Tavola scritta in ${OUT}/tavola.svg`)
}

emettiTavola()
```

L'indentazione del corpo del ciclo va normalizzata a due spazi dentro `emettiTavola`.

- [ ] **Step 2: Produrre l'immagine**

```bash
SCHEMA_OUT=<cartella> npx tsx scripts/tavola-simboli.ts
node -e "const s=require('sharp');s('<cartella>/tavola.svg',{density:160}).png().toFile('<cartella>/tavola.png')"
```

- [ ] **Step 3: Confrontare e raccogliere le differenze**

Affiancare `tavola.png` alla pagina di `Blocchi.pdf` (rasterizzabile con `pdfjs-dist`, già fra le dipendenze) e annotare le differenze. **Fermarsi qui e sottoporle al committente**: le correzioni grafiche vanno decise da chi conosce i blocchi, non dedotte.

- [ ] **Step 4: Commit**

```bash
git add scripts/tavola-simboli.ts
git commit -m "chore(schema-impianto): tavola di confronto dei simboli con le ancore"
```

---

## Verifica finale

- [ ] `npx tsc --noEmit` — nessun errore
- [ ] `npx vitest run` — tutta la suite verde
- [ ] In app, sulla pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d`: generazione automatica, ritocco nell'editor (spostamento, allineamento, gomito su una tubazione), conferma, **riapertura del dialog con il layout intatto**, generazione del `.docx` e controllo del PNG in §2.3
- [ ] Nessun file temporaneo o di harness rimasto: `git status --short` pulito
