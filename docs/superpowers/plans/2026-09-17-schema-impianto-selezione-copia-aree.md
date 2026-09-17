# Selezione multipla, copia-incolla e aree — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** nell'editor dello schema d'impianto DM329, un riquadro che seleziona anche testi, frecce e
aree; spostamento/cancellazione di gruppo in una voce di cronologia; Ctrl+C/Ctrl+V per utenze, TEE,
frecce, testi e aree; un rettangolo tratteggiato ridimensionabile con scritta spostabile, presente
anche nel .docx.

**Architecture:** la selezione di React Flow resta com'è; accanto vive una selezione propria
multipla (`ElementoLibero[]`) gestita da un hook. Tutta la logica sta in funzioni pure provate con
Vitest (`services/schemaImpianto/{aree,selezione,appunti}.ts` e gli export puri degli hook); i
componenti React fanno solo cablaggio. Le aree sono un campo opzionale nuovo del layout, disegnato
da `renderSvg` prima di tutto il resto.

**Tech Stack:** React 18 + TypeScript (`strict: false`) + @xyflow/react 12.11.2 + MUI 6 + Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-schema-impianto-selezione-copia-aree-design.md`
(leggere per intero, comprese le tre rettifiche «in fase di piano»).

## Global Constraints

- Lingua di codice, commenti e messaggi: **italiano**, come il resto del modulo; commenti che
  spiegano il *perché*, con la densità dei file vicini.
- Griglia: passo `PASSO_GRIGLIA = 10`, sempre con `allineaAllaGriglia` (`services/schemaImpianto/griglia.ts`) sulla posizione **assoluta** risultante.
- Nessuna coordinata negativa per nodi (y ≥ 0, regola già in `onNodesChange`) e per aree e loro scritta (x ≥ 0, y ≥ 0).
- Scarto di incolla: `20` unità per ripetizione. Prefissi manuali: `M-G…` (TEE), `M-U…` (utenze). Id testi `T…`, aree `A…`, frecce incollate `freccia-…`.
- Area nuova: 300×200, scritta `AREA`, scarto scritta `{ dx: 10, dy: 30 }`, lato minimo 40. Tratto area: `stroke="#333" stroke-width="1.5" stroke-dasharray="8 4"`.
- Aggiunta alla selezione: **Ctrl + clic (Cmd su Mac)**, non Shift. Riquadro: Shift + trascinamento (predefinito React Flow).
- Uno schema **senza aree** deve produrre un SVG identico byte per byte: le tre fixture in `src/services/schemaImpianto/__tests__/fixtures/` non si toccano.
- Un layout salvato senza aree deve serializzarsi identico a oggi (campo `aree` omesso se vuoto).
- `quoteInstradamento` non deve dipendere dalle aree.
- Modo taratura: ogni gesto nuovo spento.
- Test solo su logica pura (CLAUDE.md: niente test di interfaccia). Prima di ogni commit: `npx vitest run <file di test del task>`; a fine task anche `npx tsc --noEmit` e `npm run lint` (zero warning).
- Ambiente del worktree: `node_modules` è una giunzione al checkout principale e `.env.local` è già copiato (entrambi git-ignored). **Non** aggiungerli a git.
- Conventional Commits, messaggio in italiano, chiuso da `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Mappa dei file

| File | Stato | Responsabilità |
|---|---|---|
| `src/services/schemaImpianto/types.ts` | modifica | tipo `SchemaArea`, `SchemaLayout.aree?` |
| `src/services/schemaImpianto/aree.ts` | nuovo | geometria pura delle aree |
| `src/services/schemaImpianto/symbols/index.ts` | modifica | `rettangoloArea`, `simboloArea` |
| `src/services/schemaImpianto/renderSvg.ts` | modifica | aree nel documento e nel foglio |
| `src/services/schemaImpianto/persistenza.ts` | modifica | aree su disco, fix `idTerminale` |
| `src/components/relazione/SchemaImpiantoSection.tsx` | modifica | «Rigenera da capo» conserva le aree |
| `src/services/schemaImpianto/selezione.ts` | nuovo | elementi liberi, riquadro, spostamento di gruppo |
| `src/services/schemaImpianto/codici.ts` | modifica | `codiceManualeLibero` |
| `src/services/schemaImpianto/appunti.ts` | nuovo | appunto e incolla, puri |
| `src/components/schemaImpianto/conversioneFlow.ts` | modifica | aree nel ponte, frecce selezionate negli archi |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | modifica | clic sulla freccia, evidenza |
| `src/components/schemaImpianto/useSelezioneMultipla.ts` | nuovo | hook + helper puri sullo stato dell'editor |
| `src/components/schemaImpianto/useAppunti.ts` | nuovo | hook + helper puri del copia-incolla |
| `src/components/schemaImpianto/useAree.ts` | nuovo | gesti di creazione/ridimensionamento/scritta |
| `src/components/schemaImpianto/AreeImpianto.tsx` | nuovo | le aree sulla tela |
| `src/components/schemaImpianto/TestiLiberi.tsx` | modifica | selezione multipla |
| `src/components/schemaImpianto/MuroSeparazione.tsx` | modifica | Ctrl + clic |
| `src/components/schemaImpianto/SchemaEditor.tsx` | modifica | cablaggio |

---

### Task 1: Il dato «area» e la sua geometria pura

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (in coda al file, e dentro `SchemaLayout`)
- Create: `src/services/schemaImpianto/aree.ts`
- Test: `src/services/schemaImpianto/__tests__/aree.test.ts`

**Interfaces:**
- Produces:
  - `interface SchemaArea { id: string; x: number; y: number; larghezza: number; altezza: number; scritta: string; scartoScritta: { dx: number; dy: number } }`
  - `SchemaLayout.aree?: SchemaArea[]`
  - `type AngoloArea = 'no' | 'ne' | 'so' | 'se'`
  - `LATO_MINIMO_AREA = 40`, `LARGHEZZA_AREA_NUOVA = 300`, `ALTEZZA_AREA_NUOVA = 200`, `SCRITTA_AREA_NUOVA = 'AREA'`, `SCARTO_SCRITTA_NUOVA = { dx: 10, dy: 30 }`
  - `idAreaLibero(aree: SchemaArea[]): string`
  - `areaAggiunta(aree: SchemaArea[], id: string, posizione: { x: number; y: number }): SchemaArea[]`
  - `areaRidimensionata(area: SchemaArea, angolo: AngoloArea, punto: { x: number; y: number }): SchemaArea`
  - `areeConScarto(aree: SchemaArea[], id: string, posizioneScritta: { x: number; y: number }): SchemaArea[]`
  - `areeConScritta(aree: SchemaArea[], id: string, scritta: string): SchemaArea[]`
  - `puntoScritta(area: SchemaArea): { x: number; y: number }`
  - `ingombroArea(area: SchemaArea): { destra: number; basso: number }`

- [ ] **Step 1: Aggiungi il tipo**

In `types.ts`, subito prima di `/** Output di \`layout\`…` (l'interfaccia `SchemaLayout`), inserisci:

```ts
/**
 * Area impiantistica disegnata a mano: un rettangolo tratteggiato con una scritta propria, per
 * delimitare zone diverse dello stesso impianto (sala compressori, reparto, …). Come i testi
 * liberi non è un nodo — nessuna ancora, nessuna tubazione, niente lista né legenda — e la
 * riconciliazione con la scheda non la tocca mai.
 *
 * La scritta segue il rettangolo quando lo si sposta, ma si può spostare anche da sola: per questo
 * la sua posizione è uno SCARTO dall'angolo in alto a sinistra, non una coordinata assoluta.
 */
export interface SchemaArea {
  id: string
  /** Angolo in alto a sinistra, in unità del disegno. Mai negativo: il documento parte da zero. */
  x: number
  y: number
  larghezza: number
  altezza: number
  /** Può essere vuota (non si disegna nulla) o andare a capo, come un testo libero. */
  scritta: string
  /** Primo capo della prima riga della scritta, rispetto a (x, y). */
  scartoScritta: { dx: number; dy: number }
}
```

e dentro `SchemaLayout`, dopo `testi: SchemaTestoLibero[]`:

```ts
  /**
   * Aree tratteggiate. Opzionale anche in memoria, a differenza di `testi`: ogni lettore usa
   * `?? []`, e renderlo obbligatorio avrebbe rotto senza guadagno gli `SchemaLayout` letterali dei
   * test (vedi la rettifica nella specifica del 17-09-2026). Assente e vuoto sono la stessa cosa.
   */
  aree?: SchemaArea[]
```

- [ ] **Step 2: Scrivi il test che fallisce**

`src/services/schemaImpianto/__tests__/aree.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  areaAggiunta,
  areaRidimensionata,
  areeConScarto,
  areeConScritta,
  idAreaLibero,
  ingombroArea,
  puntoScritta,
  LATO_MINIMO_AREA,
} from '../aree'
import type { SchemaArea } from '../types'

function area(parziale: Partial<SchemaArea> = {}): SchemaArea {
  return {
    id: 'A1', x: 100, y: 100, larghezza: 300, altezza: 200, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 },
    ...parziale,
  }
}

describe('idAreaLibero', () => {
  it('salta gli id già in uso, anche dopo un buco', () => {
    expect(idAreaLibero([])).toBe('A1')
    expect(idAreaLibero([area({ id: 'A1' }), area({ id: 'A3' })])).toBe('A2')
  })
})

describe('areaAggiunta', () => {
  it('nasce 300×200 con scritta AREA, agganciata alla griglia', () => {
    const [nuova] = areaAggiunta([], 'A1', { x: 43, y: 58 })
    expect(nuova).toEqual({
      id: 'A1', x: 40, y: 60, larghezza: 300, altezza: 200, scritta: 'AREA', scartoScritta: { dx: 10, dy: 30 },
    })
  })

  it('non nasce a coordinate negative', () => {
    const [nuova] = areaAggiunta([], 'A1', { x: -80, y: -30 })
    expect(nuova.x).toBe(0)
    expect(nuova.y).toBe(0)
  })
})

describe('areaRidimensionata', () => {
  it('dall\'angolo in basso a destra tiene fermo quello in alto a sinistra', () => {
    expect(areaRidimensionata(area(), 'se', { x: 512, y: 347 })).toMatchObject({ x: 100, y: 100, larghezza: 410, altezza: 250 })
  })

  it('dall\'angolo in alto a sinistra tiene fermo quello in basso a destra', () => {
    expect(areaRidimensionata(area(), 'no', { x: 60, y: 80 })).toMatchObject({ x: 60, y: 80, larghezza: 340, altezza: 220 })
  })

  it('dagli angoli ne e so muove un lato per asse', () => {
    expect(areaRidimensionata(area(), 'ne', { x: 450, y: 50 })).toMatchObject({ x: 100, y: 50, larghezza: 350, altezza: 250 })
    expect(areaRidimensionata(area(), 'so', { x: 50, y: 400 })).toMatchObject({ x: 50, y: 100, larghezza: 350, altezza: 300 })
  })

  it('non scende sotto il lato minimo, anche trascinando oltre l\'angolo opposto', () => {
    const r = areaRidimensionata(area(), 'se', { x: 0, y: 0 })
    expect(r).toMatchObject({ x: 100, y: 100, larghezza: LATO_MINIMO_AREA, altezza: LATO_MINIMO_AREA })
    const n = areaRidimensionata(area(), 'no', { x: 900, y: 900 })
    expect(n).toMatchObject({ larghezza: LATO_MINIMO_AREA, altezza: LATO_MINIMO_AREA, x: 360, y: 260 })
  })

  it('non esce sopra o a sinistra dell\'origine', () => {
    expect(areaRidimensionata(area(), 'no', { x: -50, y: -50 })).toMatchObject({ x: 0, y: 0, larghezza: 400, altezza: 300 })
  })

  it('lascia intatti scritta e scarto: la scritta segue l\'angolo in alto a sinistra', () => {
    const r = areaRidimensionata(area(), 'no', { x: 60, y: 80 })
    expect(r.scritta).toBe('SALA')
    expect(r.scartoScritta).toEqual({ dx: 10, dy: 30 })
  })
})

describe('scritta dell\'area', () => {
  it('puntoScritta somma lo scarto all\'angolo', () => {
    expect(puntoScritta(area())).toEqual({ x: 110, y: 130 })
  })

  it('areeConScarto ricava lo scarto dalla posizione assoluta agganciata alla griglia', () => {
    const [r] = areeConScarto([area()], 'A1', { x: 247, y: 91 })
    expect(r.scartoScritta).toEqual({ dx: 150, dy: -10 })
  })

  it('areeConScarto non porta la scritta a coordinate negative', () => {
    const [r] = areeConScarto([area({ x: 20, y: 20 })], 'A1', { x: -100, y: -100 })
    expect(puntoScritta(r)).toEqual({ x: 0, y: 0 })
  })

  it('areeConScritta cambia solo la scritta dell\'area indicata', () => {
    const due = [area(), area({ id: 'A2' })]
    const r = areeConScritta(due, 'A2', 'REPARTO\n2')
    expect(r[0]).toBe(due[0])
    expect(r[1].scritta).toBe('REPARTO\n2')
  })
})

describe('ingombroArea', () => {
  it('senza scritta è il rettangolo', () => {
    expect(ingombroArea(area({ scritta: '' }))).toEqual({ destra: 400, basso: 300 })
  })

  it('una scritta che sporge allarga l\'ingombro', () => {
    const lunga = area({ scritta: 'X'.repeat(80), scartoScritta: { dx: 10, dy: 260 } })
    const i = ingombroArea(lunga)
    expect(i.destra).toBeGreaterThan(400)
    expect(i.basso).toBeGreaterThanOrEqual(360)
  })
})
```

- [ ] **Step 3: Esegui e verifica che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/aree.test.ts`
Expected: FAIL, «Failed to resolve import "../aree"».

- [ ] **Step 4: Implementa `aree.ts`**

```ts
/**
 * Geometria pura delle aree tratteggiate (`SchemaArea`): creazione, ridimensionamento dagli angoli,
 * scritta, ingombro. Sta fra i servizi e non nei componenti per la stessa ragione di `griglia.ts`:
 * il modulo non monta componenti nei test, e un calcolo dentro un componente non lo prova nessuno.
 *
 * Tutto ciò che si posa a mano si aggancia alla griglia sulla posizione ASSOLUTA (vedi
 * `testiConSpostamento`, useTestiLiberi.ts, per il difetto che questo evita) e non va sotto zero:
 * `renderSvg` taglia in silenzio ogni coordinata negativa.
 */
import { allineaAllaGriglia } from './griglia'
import { ingombroTesto } from './layout'
import type { SchemaArea } from './types'

export const LARGHEZZA_AREA_NUOVA = 300
export const ALTEZZA_AREA_NUOVA = 200
export const SCRITTA_AREA_NUOVA = 'AREA'
/** Dentro l'area, in alto a sinistra: una riga di scritta (corpo 20) sta sotto il bordo. */
export const SCARTO_SCRITTA_NUOVA = { dx: 10, dy: 30 }
/** Sotto questa misura le quattro maniglie degli angoli si sovrapporrebbero sulla tela. */
export const LATO_MINIMO_AREA = 40

export type AngoloArea = 'no' | 'ne' | 'so' | 'se'

function suGrigliaNonNegativo(valore: number): number {
  return Math.max(0, allineaAllaGriglia(valore))
}

/** Primo id libero, saltando quelli in uso (stesso principio di `idLibero` in useTestiLiberi.ts). */
export function idAreaLibero(aree: SchemaArea[]): string {
  const usati = new Set(aree.map((a) => a.id))
  for (let i = 1; ; i++) {
    const id = `A${i}`
    if (!usati.has(id)) return id
  }
}

/** L'id arriva da fuori: l'editor lo sceglie prima, per poter selezionare l'area appena nata. */
export function areaAggiunta(aree: SchemaArea[], id: string, posizione: { x: number; y: number }): SchemaArea[] {
  return [
    ...aree,
    {
      id,
      x: suGrigliaNonNegativo(posizione.x),
      y: suGrigliaNonNegativo(posizione.y),
      larghezza: LARGHEZZA_AREA_NUOVA,
      altezza: ALTEZZA_AREA_NUOVA,
      scritta: SCRITTA_AREA_NUOVA,
      scartoScritta: { ...SCARTO_SCRITTA_NUOVA },
    },
  ]
}

/**
 * L'angolo afferrato va sul punto (agganciato, mai negativo); l'angolo opposto resta fermo. Un
 * trascinamento oltre l'angolo opposto non ribalta il rettangolo: si ferma al lato minimo, che è
 * ciò che l'utente vede accadere sotto il puntatore.
 */
export function areaRidimensionata(area: SchemaArea, angolo: AngoloArea, punto: { x: number; y: number }): SchemaArea {
  const px = suGrigliaNonNegativo(punto.x)
  const py = suGrigliaNonNegativo(punto.y)
  let sinistra = area.x
  let alto = area.y
  let destra = area.x + area.larghezza
  let basso = area.y + area.altezza
  if (angolo === 'no' || angolo === 'so') sinistra = Math.min(px, destra - LATO_MINIMO_AREA)
  else destra = Math.max(px, sinistra + LATO_MINIMO_AREA)
  if (angolo === 'no' || angolo === 'ne') alto = Math.min(py, basso - LATO_MINIMO_AREA)
  else basso = Math.max(py, alto + LATO_MINIMO_AREA)
  return { ...area, x: sinistra, y: alto, larghezza: destra - sinistra, altezza: basso - alto }
}

export function puntoScritta(area: SchemaArea): { x: number; y: number } {
  return { x: area.x + area.scartoScritta.dx, y: area.y + area.scartoScritta.dy }
}

/** La scritta trascinata da sola: si riceve la posizione assoluta e si salva lo scarto. */
export function areeConScarto(aree: SchemaArea[], id: string, posizioneScritta: { x: number; y: number }): SchemaArea[] {
  return aree.map((a) =>
    a.id === id
      ? {
          ...a,
          scartoScritta: {
            dx: suGrigliaNonNegativo(posizioneScritta.x) - a.x,
            dy: suGrigliaNonNegativo(posizioneScritta.y) - a.y,
          },
        }
      : a
  )
}

export function areeConScritta(aree: SchemaArea[], id: string, scritta: string): SchemaArea[] {
  return aree.map((a) => (a.id === id ? { ...a, scritta } : a))
}

/**
 * Bordo destro e basso di ciò che l'area disegna, scritta compresa: serve a `renderSvg` per non
 * tagliare un'area posata oltre il disegno. La scritta si misura con `ingombroTesto`, la stessa
 * stima dei testi liberi, perché la disegna la stessa `testoMultiRiga`.
 */
export function ingombroArea(area: SchemaArea): { destra: number; basso: number } {
  const destra = area.x + area.larghezza
  const basso = area.y + area.altezza
  if (!area.scritta.trim()) return { destra, basso }
  const { x, y } = puntoScritta(area)
  const testo = ingombroTesto({ id: area.id, x, y, contenuto: area.scritta })
  return { destra: Math.max(destra, testo.destra), basso: Math.max(basso, testo.basso) }
}
```

- [ ] **Step 5: Esegui e verifica che passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/aree.test.ts`
Expected: PASS (15 test).

- [ ] **Step 6: Tipi e lint**

Run: `npx tsc --noEmit` e `npm run lint` — entrambi puliti.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/aree.ts src/services/schemaImpianto/__tests__/aree.test.ts
git commit -m "feat(schema): dato e geometria delle aree tratteggiate"
```

---

### Task 2: Le aree nel documento

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (accanto a `simboloMuro`)
- Modify: `src/services/schemaImpianto/renderSvg.ts:389-432` (`renderSvg`)
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts` (nuovo `describe` in coda)

**Interfaces:**
- Consumes: `SchemaArea`, `ingombroArea`, `puntoScritta` (Task 1)
- Produces: `STILE_AREA`, `rettangoloArea(x: number, y: number, larghezza: number, altezza: number): string`, `simboloArea(area: SchemaArea): string` da `symbols`

- [ ] **Step 1: Scrivi i test che falliscono**

In coda a `renderSvg.test.ts` (usa la `layoutMinimo()` già definita in testa al file):

```ts
describe('aree tratteggiate', () => {
  const sala = {
    id: 'A1', x: 20, y: 20, larghezza: 600, altezza: 400, scritta: 'SALA COMPRESSORI', scartoScritta: { dx: 10, dy: 30 },
  }

  it('disegna il rettangolo tratteggiato e la scritta', () => {
    const svg = renderSvg({ ...layoutMinimo(), aree: [sala] })
    expect(svg).toContain('<rect x="20" y="20" width="600" height="400" fill="none" stroke="#333" stroke-width="1.5" stroke-dasharray="8 4" />')
    expect(svg).toContain('>SALA COMPRESSORI</tspan>')
  })

  it('una scritta vuota non produce testo', () => {
    const svg = renderSvg({ ...layoutMinimo(), aree: [{ ...sala, scritta: '  ' }] })
    expect(svg).toContain('stroke-dasharray="8 4"')
    expect(svg.match(/<text/g)?.length).toBe(renderSvg(layoutMinimo()).match(/<text/g)?.length)
  })

  it('si disegna prima di tubi e nodi, subito dopo il fondo bianco', () => {
    const svg = renderSvg({ ...layoutMinimo(), aree: [sala] })
    const fondo = svg.indexOf('fill="#fff" />')
    const indiceArea = svg.indexOf('stroke-dasharray="8 4"')
    const indiceTubo = svg.indexOf('stroke-dasharray="10 7"')
    const indiceNodo = svg.indexOf('<circle cx="60" cy="60"')
    expect(fondo).toBeGreaterThan(-1)
    expect(indiceArea).toBeGreaterThan(fondo)
    expect(indiceArea).toBeLessThan(indiceTubo)
    expect(indiceArea).toBeLessThan(indiceNodo)
  })

  it('un\'area oltre il disegno allarga il foglio invece di essere tagliata', () => {
    const senza = renderSvg(layoutMinimo())
    const con = renderSvg({ ...layoutMinimo(), aree: [{ ...sala, x: 3000, y: 2500 }] })
    const misura = (svg: string, attr: string) => Number(svg.match(new RegExp(`${attr}="([0-9.]+)"`))![1])
    expect(misura(con, 'width')).toBeGreaterThanOrEqual(3600)
    expect(misura(con, 'height')).toBeGreaterThan(misura(senza, 'height'))
    expect(misura(con, 'height')).toBeGreaterThanOrEqual(2900)
  })

  it('le quote di instradamento non dipendono dalle aree', () => {
    const layout = layoutMinimo()
    expect(quoteInstradamento({ ...layout, aree: [{ ...sala, y: 5000 }] })).toEqual(quoteInstradamento(layout))
  })

  it('aree vuote o assenti danno lo stesso SVG di sempre', () => {
    expect(renderSvg({ ...layoutMinimo(), aree: [] })).toBe(renderSvg(layoutMinimo()))
  })
})
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "aree tratteggiate"`
Expected: FAIL sui primi quattro (nessun rettangolo, foglio non allargato); gli ultimi due possono già passare.

- [ ] **Step 3: I simboli**

In `symbols/index.ts`, subito dopo `simboloMuro` (aggiungi `SchemaArea` all'import dei tipi già presente in testa al file):

```ts
/** Tratto delle aree: grigio scuro e sottile, perché delimita e non deve competere col disegno. */
export const STILE_AREA = { colore: '#333', spessore: 1.5, tratteggio: '8 4' }

/**
 * Il solo rettangolo di un'area, parametrico sulla posizione: la tela lo disegna a (0, 0) dentro
 * un proprio `<svg>` e trasla il contenitore (AreeImpianto.tsx), il documento lo disegna alle
 * coordinate vere. Una funzione sola per entrambi, come `simboloMuro`.
 */
export function rettangoloArea(x: number, y: number, larghezza: number, altezza: number): string {
  return `<rect x="${x}" y="${y}" width="${larghezza}" height="${altezza}" fill="none" stroke="${STILE_AREA.colore}" stroke-width="${STILE_AREA.spessore}" stroke-dasharray="${STILE_AREA.tratteggio}" />`
}

/** Rettangolo e scritta di un'area, per il documento. Scritta vuota: nessun `<text>`. */
export function simboloArea(area: SchemaArea): string {
  const rettangolo = rettangoloArea(area.x, area.y, area.larghezza, area.altezza)
  if (!area.scritta.trim()) return rettangolo
  return (
    rettangolo +
    testoMultiRiga(area.x + area.scartoScritta.dx, area.y + area.scartoScritta.dy, area.scritta, TESTO_LIBERO.dimensione, 'start')
  )
}
```

Nota: se `TESTO_LIBERO` è dichiarato più in basso nel file di `simboloMuro` non è un problema — è usato dentro una funzione, non al caricamento del modulo.

- [ ] **Step 4: Il documento**

In `renderSvg.ts`:

1. Import: aggiungi `import { ingombroArea } from './aree'` e `simboloArea` all'import esistente da `'./symbols'`; aggiungi `SchemaArea` all'import dei tipi.
2. Sopra `renderSvg`, aggiungi:

```ts
/**
 * Il foglio allargato quanto serve a contenere le aree. Separato da `dimensioniLayout` apposta:
 * quella alimenta anche `quoteInstradamento` (la corsia delle condense corre sul fondo del
 * disegno), e se un'area ne allungasse l'altezza, disegnare un rettangolo sposterebbe i tubi.
 * Senza aree restituisce le dimensioni del disegno tali e quali: il documento non cambia di un byte.
 */
function foglioConAree(disegno: { larghezza: number; altezza: number }, aree: SchemaArea[]) {
  if (aree.length === 0) return disegno
  const ingombri = aree.map(ingombroArea)
  return {
    larghezza: Math.max(disegno.larghezza, ...ingombri.map((i) => i.destra + MARGINE)),
    altezza: Math.max(disegno.altezza, ...ingombri.map((i) => i.basso + MARGINE)),
  }
}
```

3. Dentro `renderSvg`, dopo `const dimensioniDisegno = dimensioniLayout(layout, libreria)`:

```ts
  const aree = layout.aree ?? []
  const foglio = foglioConAree(dimensioniDisegno, aree)
```

4. Sostituisci `const yNota = dimensioniDisegno.altezza + MARGINE` con `const yNota = foglio.altezza + MARGINE`.
5. Nel `Math.max` di `larghezzaTotale`, sostituisci `dimensioniDisegno.larghezza` con `foglio.larghezza`.
6. Nell'array restituito, subito dopo la riga del `<rect … fill="#fff" />`, aggiungi `aree.map(simboloArea).join(''),` (prima di `muro,`), con il commento:

```ts
    // Le aree per prime: delimitano, e tutto il resto va letto sopra di loro.
```

- [ ] **Step 5: Esegui**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: PASS, comprese le tre fixture preesistenti (`SVG_RIFERIMENTO_*`).

- [ ] **Step 6: Tipi, lint, suite del modulo**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/services/schemaImpianto`
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema): aree tratteggiate nel documento, foglio allargato senza toccare le rotte"
```

---

### Task 3: Aree su disco e terminale utenze non scambiabile con una copia

**Files:**
- Modify: `src/services/schemaImpianto/persistenza.ts` (`LayoutSalvato`, `serializzaLayout`, `deserializzaLayout`, `riconcilia`)
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx:433`
- Test: `src/services/schemaImpianto/__tests__/persistenza.test.ts` (due `describe` in coda)

**Interfaces:**
- Consumes: `SchemaArea` (Task 1)
- Produces: `LayoutSalvato.aree?: SchemaArea[]`; `deserializzaLayout` e `riconcilia` riportano `aree` solo se presenti.

- [ ] **Step 1: Scrivi i test che falliscono**

In coda a `persistenza.test.ts` (usa `modelloDiProva` e `layoutMinimo`/`modelloMinimo` già definiti in testa):

```ts
describe('aree tratteggiate', () => {
  const sala = { id: 'A1', x: 20, y: 20, larghezza: 600, altezza: 400, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } }

  it('un layout senza aree si salva come prima, senza il campo', () => {
    expect('aree' in serializzaLayout(layoutMinimo())).toBe(false)
    expect('aree' in serializzaLayout({ ...layoutMinimo(), aree: [] })).toBe(false)
  })

  it('andata e ritorno le conserva', () => {
    const salvato = serializzaLayout({ ...layoutMinimo(), aree: [sala] })
    expect(deserializzaLayout(salvato)!.aree).toEqual([sala])
  })

  it('la copia salvata non condivide oggetti con il layout in memoria', () => {
    const aree = [{ ...sala }]
    const salvato = serializzaLayout({ ...layoutMinimo(), aree })
    aree[0].x = 999
    expect(salvato.aree![0].x).toBe(20)
  })

  it('la riconciliazione con la scheda le lascia intatte', () => {
    const salvato = serializzaLayout({ ...layoutMinimo(), aree: [sala] })
    expect(layoutIniziale(salvato, modelloMinimo()).layout.aree).toEqual([sala])
  })

  it('un salvato senza aree non ne inventa', () => {
    const salvato = serializzaLayout(layoutMinimo())
    expect(layoutIniziale(salvato, modelloMinimo()).layout.aree).toBeUndefined()
  })
})

describe('una copia manuale del terminale utenze', () => {
  it('non prende il posto del terminale vero quando la sua tubazione va ripescata', () => {
    const modello = modelloDiProva(['C1'])
    const layout = layoutSchema(modello)
    const terminale = layout.nodi.find((n) => n.tipo === 'utenze' && n.origine !== 'manuale')
    expect(terminale).toBeDefined()
    const copia = { ...terminale!, id: 'M-U1', origine: 'manuale' as const, x: terminale!.x + 20, y: terminale!.y + 20 }
    // La copia sta DAVANTI nell'elenco e la tubazione del terminale vero manca: è il caso in cui
    // la riparazione sceglieva il nodo sbagliato.
    const salvato = serializzaLayout({
      ...layout,
      nodi: [copia, ...layout.nodi],
      archi: layout.archi.filter((a) => a.a.nodo !== terminale!.id),
    })
    const { layout: riaperto } = layoutIniziale(salvato, modello)
    expect(riaperto.archi.some((a) => a.a.nodo === terminale!.id)).toBe(true)
    expect(riaperto.archi.some((a) => a.a.nodo === 'M-U1')).toBe(false)
  })

  it('sopravvive alla riapertura con la propria scritta', () => {
    const modello = modelloDiProva(['C1'])
    const layout = layoutSchema(modello)
    const terminale = layout.nodi.find((n) => n.tipo === 'utenze')!
    const copia = { ...terminale, id: 'M-U1', origine: 'manuale' as const, etichetta: 'Utenze azoto', x: 900, y: 40 }
    const { layout: riaperto } = layoutIniziale(serializzaLayout({ ...layout, nodi: [...layout.nodi, copia] }), modello)
    expect(riaperto.nodi.find((n) => n.id === 'M-U1')?.etichetta).toBe('Utenze azoto')
  })
})
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts -t "aree tratteggiate|copia manuale del terminale"`
Expected: FAIL su «andata e ritorno», «la riconciliazione … intatte», «la copia salvata …» e «non prende il posto del terminale vero». Se il primo test del terminale **passa già**, fermati e segnalalo: il difetto non si riproduce con questa fixture e il test va rifatto prima di toccare il codice.

- [ ] **Step 3: Implementa**

In `persistenza.ts`:

1. Import dei tipi: aggiungi `SchemaArea`.
2. In `LayoutSalvato`, dopo `testi?`:

```ts
  /** Aree tratteggiate. Assente sui layout salvati prima del 17-09-2026 e su ogni layout che non
   *  ne ha: campo nuovo e opzionale, non un cambio di formato — non alza `VERSIONE`. */
  aree?: SchemaArea[]
```

3. In `serializzaLayout`, dopo la riga di `muroX`:

```ts
    // Omesse, non `[]`, quando non ce ne sono: un salvataggio senza aree resta identico a uno
    // scritto prima che il campo esistesse.
    ...(layout.aree && layout.aree.length > 0 ? { aree: structuredClone(layout.aree) } : {}),
```

4. In `deserializzaLayout`, nell'oggetto restituito dopo `testi: …`: `...(salvato.aree ? { aree: salvato.aree } : {}),`
5. Firma di `riconcilia`: il tipo di `salvato` diventa
   `Pick<SchemaLayout, 'nodi' | 'archi'> & { testi?: SchemaTestoLibero[]; muro?: SchemaLayout['muro']; aree?: SchemaArea[] }`.
6. In `riconcilia`, sostituisci la riga di `idTerminale` con:

```ts
  // Il terminale VERO, non la prima utenza dell'elenco: dal 17-09-2026 le utenze si incollano, e
  // una copia manuale posata davanti nell'elenco rubava al terminale la riparazione della sua
  // tubazione qui sotto (e lasciava passare fra gli `archiNuovi` quella che doveva escludere).
  // Le copie sono di origine 'manuale', come ogni nodo nato in editor.
  const idTerminale = nodi.find((n) => n.tipo === 'utenze' && n.origine !== 'manuale')?.id
```

7. In fondo a `riconcilia`, il `return` diventa:

```ts
  // Le aree, come i testi, sono manuali per definizione: la scheda non le conosce e le riporta intatte.
  return {
    layout: { nodi, archi, muro, testi, ...(salvato.aree ? { aree: salvato.aree } : {}) },
    aggiunti,
    aggiuntiDaScheda,
    rimossi,
    archiScartati,
    daZero: false,
  }
```

8. In `SchemaImpiantoSection.tsx`, in `rigenera`, la riga `void disegna({ ...daZero, testi: layout?.testi ?? [] })` diventa
   `void disegna({ ...daZero, testi: layout?.testi ?? [], aree: layout?.aree ?? [] })`
   e al commento sopra aggiungi: «Le aree seguono la stessa regola dei testi: sono disegno a mano.»

- [ ] **Step 4: Esegui**

Run: `npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts`
Expected: PASS, tutto il file.

- [ ] **Step 5: Tipi, lint, suite**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/services`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/persistenza.ts src/components/relazione/SchemaImpiantoSection.tsx src/services/schemaImpianto/__tests__/persistenza.test.ts
git commit -m "feat(schema): aree nel layout salvato; il terminale utenze non si scambia con una copia"
```

---

### Task 4: Selezione pura — elementi liberi, riquadro, spostamento di gruppo

**Files:**
- Create: `src/services/schemaImpianto/selezione.ts`
- Test: `src/services/schemaImpianto/__tests__/selezione.test.ts`

**Interfaces:**
- Consumes: `SchemaArea` (Task 1), `ingombroTesto` (layout.ts), `TESTO_LIBERO` (symbols), `Punto` (tratti.ts)
- Produces:
  - `type ElementoLibero = { tipo: 'muro' } | { tipo: 'testo'; id: string } | { tipo: 'area'; id: string } | { tipo: 'freccia'; arco: string; segno: string }`
  - `chiaveElemento(e: ElementoLibero): string`
  - `selezioneDopoPressione(selezione: ElementoLibero[], elemento: ElementoLibero, aggiungi: boolean): ElementoLibero[]`
  - `interface Riquadro { sinistra: number; alto: number; destra: number; basso: number }`
  - `riquadroDaPunti(a: Punto, b: Punto): Riquadro`
  - `interface FrecciaPosata { arco: string; segno: string; punto: Punto }`
  - `elementiNelRiquadro(r: Riquadro, contenuto: { testi: SchemaTestoLibero[]; aree: SchemaArea[]; frecce: FrecciaPosata[] }): ElementoLibero[]`
  - `interface PosizioniGruppo { nodi: Record<string, Punto>; testi: Record<string, Punto>; aree: Record<string, Punto> }`
  - `gruppoVuoto(p: PosizioniGruppo): boolean`
  - `posizioniSpostate(origini: PosizioniGruppo, dx: number, dy: number): PosizioniGruppo`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
import { describe, it, expect } from 'vitest'
import {
  chiaveElemento,
  elementiNelRiquadro,
  gruppoVuoto,
  posizioniSpostate,
  riquadroDaPunti,
  selezioneDopoPressione,
  type ElementoLibero,
} from '../selezione'

const T1: ElementoLibero = { tipo: 'testo', id: 'T1' }
const A1: ElementoLibero = { tipo: 'area', id: 'A1' }
const F1: ElementoLibero = { tipo: 'freccia', arco: 'e1', segno: 's1' }

describe('chiaveElemento', () => {
  it('distingue tipo e identità', () => {
    const chiavi = [T1, A1, F1, { tipo: 'muro' } as ElementoLibero, { tipo: 'testo', id: 'A1' } as ElementoLibero].map(chiaveElemento)
    expect(new Set(chiavi).size).toBe(5)
  })
})

describe('selezioneDopoPressione', () => {
  it('senza Ctrl su un elemento nuovo lo seleziona da solo', () => {
    expect(selezioneDopoPressione([T1, A1], F1, false)).toEqual([F1])
  })

  it('senza Ctrl su un elemento già selezionato tiene il gruppo, per poterlo trascinare', () => {
    const gruppo = [T1, A1]
    expect(selezioneDopoPressione(gruppo, { tipo: 'area', id: 'A1' }, false)).toBe(gruppo)
  })

  it('con Ctrl aggiunge o toglie', () => {
    expect(selezioneDopoPressione([T1], A1, true)).toEqual([T1, A1])
    expect(selezioneDopoPressione([T1, A1], { tipo: 'testo', id: 'T1' }, true)).toEqual([A1])
  })
})

describe('riquadro', () => {
  it('riquadroDaPunti normalizza il verso del trascinamento', () => {
    expect(riquadroDaPunti({ x: 300, y: 50 }, { x: 100, y: 250 })).toEqual({ sinistra: 100, alto: 50, destra: 300, basso: 250 })
  })

  it('prende solo ciò che ci sta tutto dentro', () => {
    const r = riquadroDaPunti({ x: 0, y: 0 }, { x: 500, y: 500 })
    const esito = elementiNelRiquadro(r, {
      testi: [
        { id: 'T1', x: 100, y: 100, contenuto: 'dentro' },
        { id: 'T2', x: 480, y: 100, contenuto: 'sporge a destra' },
      ],
      aree: [
        { id: 'A1', x: 50, y: 50, larghezza: 200, altezza: 200, scritta: 'X', scartoScritta: { dx: 10, dy: 30 } },
        { id: 'A2', x: 400, y: 400, larghezza: 200, altezza: 200, scritta: 'X', scartoScritta: { dx: 10, dy: 30 } },
      ],
      frecce: [
        { arco: 'e1', segno: 's1', punto: { x: 250, y: 250 } },
        { arco: 'e1', segno: 's2', punto: { x: 700, y: 250 } },
      ],
    })
    expect(esito).toEqual([
      { tipo: 'testo', id: 'T1' },
      { tipo: 'area', id: 'A1' },
      { tipo: 'freccia', arco: 'e1', segno: 's1' },
    ])
  })

  it('un testo la cui prima riga sporge sopra il riquadro resta fuori', () => {
    const r = riquadroDaPunti({ x: 0, y: 100 }, { x: 500, y: 500 })
    expect(elementiNelRiquadro(r, { testi: [{ id: 'T1', x: 50, y: 105, contenuto: 'a' }], aree: [], frecce: [] })).toEqual([])
  })

  it('il muro non entra mai: non è fra i contenuti che il riquadro guarda', () => {
    const r = riquadroDaPunti({ x: -1e6, y: -1e6 }, { x: 1e6, y: 1e6 })
    expect(elementiNelRiquadro(r, { testi: [], aree: [], frecce: [] })).toEqual([])
  })
})

describe('posizioniSpostate', () => {
  const origini = {
    nodi: { C1: { x: 40, y: 185 } },
    testi: { T1: { x: 100, y: 100 } },
    aree: { A1: { x: 10, y: 10 } },
  }

  it('sposta tutto dello stesso scarto e aggancia la posizione risultante alla griglia', () => {
    expect(posizioniSpostate(origini, 20, 30)).toEqual({
      nodi: { C1: { x: 60, y: 220 } },
      testi: { T1: { x: 120, y: 130 } },
      aree: { A1: { x: 30, y: 40 } },
    })
  })

  it('nodi e aree non vanno sotto zero; i testi seguono la regola di sempre', () => {
    const p = posizioniSpostate(origini, -200, -200)
    expect(p.nodi.C1).toEqual({ x: -160, y: 0 })
    expect(p.aree.A1).toEqual({ x: 0, y: 0 })
    expect(p.testi.T1).toEqual({ x: -100, y: -100 })
  })

  it('gruppoVuoto', () => {
    expect(gruppoVuoto({ nodi: {}, testi: {}, aree: {} })).toBe(true)
    expect(gruppoVuoto(origini)).toBe(false)
  })
})
```

Nota sul secondo test di `posizioniSpostate`: i nodi oggi vincolano solo `y ≥ 0` (vedi `onNodesChange` in SchemaEditor.tsx), e la x negativa di un nodo resta com'è; qui si replica la stessa regola, non se ne inventa una nuova.

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/selezione.test.ts`
Expected: FAIL, modulo mancante.

- [ ] **Step 3: Implementa `selezione.ts`**

```ts
/**
 * La selezione di ciò che React Flow non conosce — testi liberi, aree, frecce di direzione sui
 * tubi, muro — e le due operazioni che la rendono un gruppo: il riquadro e lo spostamento.
 * Funzioni pure: l'hook che le usa è `useSelezioneMultipla.ts`.
 *
 * Il muro fa parte della selezione (Ctrl + clic, Canc) ma non del riquadro né dello spostamento
 * di gruppo: ha una logica sua (si muove solo in orizzontale, l'altezza si ricava dal disegno) e
 * cancellarlo col riquadro sarebbe una sorpresa. Deciso col committente il 17-09-2026.
 */
import { allineaAllaGriglia } from './griglia'
import { ingombroTesto } from './layout'
import { TESTO_LIBERO } from './symbols'
import type { Punto } from './tratti'
import type { SchemaArea, SchemaTestoLibero } from './types'

export type ElementoLibero =
  | { tipo: 'muro' }
  | { tipo: 'testo'; id: string }
  | { tipo: 'area'; id: string }
  | { tipo: 'freccia'; arco: string; segno: string }

export function chiaveElemento(e: ElementoLibero): string {
  switch (e.tipo) {
    case 'muro':
      return 'muro'
    case 'freccia':
      return `freccia:${e.arco}:${e.segno}`
    default:
      return `${e.tipo}:${e.id}`
  }
}

/**
 * Cosa diventa la selezione quando si preme su un elemento. Con Ctrl lo si aggiunge o toglie. Senza
 * Ctrl si seleziona solo lui — tranne se era già selezionato: allora il gruppo resta intero, o non
 * si potrebbe mai trascinarlo (premere è l'inizio del trascinamento). Restituisce lo stesso array
 * quando non cambia nulla.
 */
export function selezioneDopoPressione(
  selezione: ElementoLibero[],
  elemento: ElementoLibero,
  aggiungi: boolean
): ElementoLibero[] {
  const chiave = chiaveElemento(elemento)
  const presente = selezione.some((e) => chiaveElemento(e) === chiave)
  if (aggiungi) return presente ? selezione.filter((e) => chiaveElemento(e) !== chiave) : [...selezione, elemento]
  return presente ? selezione : [elemento]
}

export interface Riquadro {
  sinistra: number
  alto: number
  destra: number
  basso: number
}

export function riquadroDaPunti(a: Punto, b: Punto): Riquadro {
  return {
    sinistra: Math.min(a.x, b.x),
    alto: Math.min(a.y, b.y),
    destra: Math.max(a.x, b.x),
    basso: Math.max(a.y, b.y),
  }
}

function contiene(r: Riquadro, sinistra: number, alto: number, destra: number, basso: number): boolean {
  return sinistra >= r.sinistra && alto >= r.alto && destra <= r.destra && basso <= r.basso
}

/** Una freccia sul tubo con il punto in cui la tela la disegna (`puntoSuTratto` sulla polilinea
 *  vera dell'arco): il servizio non conosce gli archi, e il punto lo calcola l'editor. */
export interface FrecciaPosata {
  arco: string
  segno: string
  punto: Punto
}

/**
 * Contenimento pieno, come React Flow per i nodi (`SelectionMode.Full`). Il testo si misura con
 * `ingombroTesto`, e il suo bordo alto è la `y` meno un corpo: `y` è la linea di base della prima
 * riga, e la scritta sale sopra di essa.
 */
export function elementiNelRiquadro(
  r: Riquadro,
  contenuto: { testi: SchemaTestoLibero[]; aree: SchemaArea[]; frecce: FrecciaPosata[] }
): ElementoLibero[] {
  const testi = contenuto.testi
    .filter((t) => {
      const ingombro = ingombroTesto(t)
      return contiene(r, t.x, t.y - TESTO_LIBERO.dimensione, ingombro.destra, ingombro.basso)
    })
    .map((t): ElementoLibero => ({ tipo: 'testo', id: t.id }))
  const aree = contenuto.aree
    .filter((a) => contiene(r, a.x, a.y, a.x + a.larghezza, a.y + a.altezza))
    .map((a): ElementoLibero => ({ tipo: 'area', id: a.id }))
  const frecce = contenuto.frecce
    .filter((f) => contiene(r, f.punto.x, f.punto.y, f.punto.x, f.punto.y))
    .map((f): ElementoLibero => ({ tipo: 'freccia', arco: f.arco, segno: f.segno }))
  return [...testi, ...aree, ...frecce]
}

/** Le posizioni di tutto ciò che uno spostamento di gruppo muove, per id. */
export interface PosizioniGruppo {
  nodi: Record<string, Punto>
  testi: Record<string, Punto>
  aree: Record<string, Punto>
}

export function gruppoVuoto(p: PosizioniGruppo): boolean {
  return Object.keys(p.nodi).length + Object.keys(p.testi).length + Object.keys(p.aree).length === 0
}

function mappa(origini: Record<string, Punto>, trasforma: (p: Punto) => Punto): Record<string, Punto> {
  return Object.fromEntries(Object.entries(origini).map(([id, p]) => [id, trasforma(p)]))
}

/**
 * Tutte le origini dello stesso scarto, con la posizione RISULTANTE agganciata alla griglia (lo
 * stesso criterio di `sposta` e di `testiConSpostamento`: un'origine fuori griglia non si trascina
 * dietro il proprio scarto per sempre). I vincoli sono quelli che ciascun tipo ha già da solo: y ≥ 0
 * per i nodi, x e y ≥ 0 per le aree, nessuno per i testi.
 */
export function posizioniSpostate(origini: PosizioniGruppo, dx: number, dy: number): PosizioniGruppo {
  const x = (p: Punto) => allineaAllaGriglia(p.x + dx)
  const y = (p: Punto) => allineaAllaGriglia(p.y + dy)
  return {
    nodi: mappa(origini.nodi, (p) => ({ x: x(p), y: Math.max(0, y(p)) })),
    testi: mappa(origini.testi, (p) => ({ x: x(p), y: y(p) })),
    aree: mappa(origini.aree, (p) => ({ x: Math.max(0, x(p)), y: Math.max(0, y(p)) })),
  }
}
```

- [ ] **Step 4: Esegui e verifica che passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/selezione.test.ts`
Expected: PASS. Se `import { TESTO_LIBERO } from './symbols'` produce un ciclo di import a runtime (errore «Cannot access before initialization»), leggi `TESTO_LIBERO` dentro la funzione — è già così — e verifica che il ciclo non sia fra `selezione.ts` e `layout.ts`: `layout.ts` non deve importare `selezione.ts`.

- [ ] **Step 5: Tipi e lint**, poi **commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/schemaImpianto/selezione.ts src/services/schemaImpianto/__tests__/selezione.test.ts
git commit -m "feat(schema): selezione pura di testi, aree e frecce, riquadro e spostamento di gruppo"
```

---

### Task 5: Appunti puri e codici manuali condivisi

**Files:**
- Modify: `src/services/schemaImpianto/codici.ts` (in coda)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:246-260` (`PREFISSO_MANUALE`, `codiceLibero`)
- Create: `src/services/schemaImpianto/appunti.ts`
- Test: `src/services/schemaImpianto/__tests__/appunti.test.ts`; il test esistente `src/components/schemaImpianto/__tests__/codiceLibero.test.ts` deve restare verde

**Interfaces:**
- Consumes: `SchemaArea` (Task 1)
- Produces:
  - `PREFISSO_MANUALE = 'M-'`, `codiceManualeLibero(prefisso: string, usati: Set<string>): string` (codici.ts)
  - `SCARTO_INCOLLA = 20`
  - `interface Appunto { nodi: SchemaNodoPosizionato[]; testi: SchemaTestoLibero[]; aree: SchemaArea[]; frecce: SchemaSegnoTubo[] }`
  - `appuntoDa(sorgente: Appunto): Appunto | null`
  - `interface ContestoIncolla { idNodi: Set<string>; idTesti: Set<string>; idAree: Set<string>; segniBersaglio: SchemaSegnoTubo[] | null }`
  - `interface EsitoIncolla { nodi: SchemaNodoPosizionato[]; testi: SchemaTestoLibero[]; aree: SchemaArea[]; frecce: SchemaSegnoTubo[]; frecceSaltate: boolean }`
  - `incollaAppunto(appunto: Appunto, contesto: ContestoIncolla, ripetizione: number): EsitoIncolla`
  - `esitoVuoto(esito: EsitoIncolla): boolean`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
import { describe, it, expect } from 'vitest'
import { appuntoDa, esitoVuoto, incollaAppunto, SCARTO_INCOLLA, type Appunto } from '../appunti'
import { codiceManualeLibero } from '../codici'
import type { SchemaNodoPosizionato } from '../types'

function nodo(parziale: Partial<SchemaNodoPosizionato>): SchemaNodoPosizionato {
  return {
    id: 'X', tipo: 'giunzione', etichetta: 'TEE', gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [],
    origine: 'scheda', x: 100, y: 100, ...parziale,
  }
}

const utenze = nodo({ id: 'UTENZE', tipo: 'utenze', etichetta: 'Utenze azoto', x: 800, y: 60 })
const tee = nodo({ id: 'M-G1', origine: 'manuale', x: 300, y: 200 })
const compressore = nodo({ id: 'C1', tipo: 'compressore', etichetta: 'Compressore' })
const testo = { id: 'T1', x: 50, y: 50, contenuto: 'Nota' }
const area = { id: 'A1', x: 10, y: 10, larghezza: 300, altezza: 200, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } }
const freccia = { id: 's9', tipo: 'freccia_direzione' as const, t: 0.3, stileAValle: 'flessibile' as const }
const valvola = { id: 's1', tipo: 'valvola_intercettazione' as const, t: 0.5 }

const vuoto = (): Appunto => ({ nodi: [], testi: [], aree: [], frecce: [] })

describe('codiceManualeLibero', () => {
  it('prefissa M- e salta i codici usati', () => {
    expect(codiceManualeLibero('U', new Set())).toBe('M-U1')
    expect(codiceManualeLibero('G', new Set(['M-G1', 'M-G2']))).toBe('M-G3')
  })
})

describe('appuntoDa', () => {
  it('tiene utenze, TEE, testi, aree e frecce, e scarta il resto in silenzio', () => {
    const a = appuntoDa({ nodi: [utenze, tee, compressore], testi: [testo], aree: [area], frecce: [freccia, valvola] })!
    expect(a.nodi.map((n) => n.id)).toEqual(['UTENZE', 'M-G1'])
    expect(a.frecce.map((f) => f.id)).toEqual(['s9'])
    expect(a.testi).toEqual([testo])
    expect(a.aree).toEqual([area])
  })

  it('senza nulla di copiabile restituisce null, così l\'appunto precedente resta', () => {
    expect(appuntoDa({ ...vuoto(), nodi: [compressore], frecce: [valvola] })).toBeNull()
  })

  it('copia in profondità: cambiare l\'originale non cambia l\'appunto', () => {
    const originale = { ...area, scartoScritta: { dx: 10, dy: 30 } }
    const a = appuntoDa({ ...vuoto(), aree: [originale] })!
    originale.scartoScritta.dx = 99
    expect(a.aree[0].scartoScritta.dx).toBe(10)
  })
})

describe('incollaAppunto', () => {
  const contesto = (parziale = {}) => ({
    idNodi: new Set(['UTENZE', 'M-G1', 'C1', 'M-U1']),
    idTesti: new Set(['T1']),
    idAree: new Set(['A1']),
    segniBersaglio: null,
    ...parziale,
  })

  it('i nodi tornano manuali, scollegati, con codici nuovi e spostati di 20 per ripetizione', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [utenze, tee] })!
    const primo = incollaAppunto(a, contesto(), 1)
    expect(primo.nodi.map((n) => n.id)).toEqual(['M-U2', 'M-G2'])
    expect(primo.nodi.every((n) => n.origine === 'manuale')).toBe(true)
    expect(primo.nodi[0]).toMatchObject({ tipo: 'utenze', etichetta: 'Utenze azoto', x: 820, y: 80 })
    const terzo = incollaAppunto(a, contesto(), 3)
    expect(terzo.nodi[1]).toMatchObject({ x: 300 + 3 * SCARTO_INCOLLA, y: 200 + 3 * SCARTO_INCOLLA })
  })

  it('un codice scritto a mano sull\'originale non passa alla copia', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [{ ...tee, codice: 'TEE-A' }] })!
    expect('codice' in incollaAppunto(a, contesto(), 1).nodi[0]).toBe(false)
  })

  it('due nodi dello stesso tipo nello stesso incolla non collidono fra loro', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [tee, { ...tee, id: 'M-G7' }] })!
    const ids = incollaAppunto(a, contesto(), 1).nodi.map((n) => n.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('testi e aree con id nuovi e lo stesso scarto', () => {
    const a = appuntoDa({ ...vuoto(), testi: [testo], aree: [area] })!
    const esito = incollaAppunto(a, contesto(), 1)
    expect(esito.testi).toEqual([{ id: 'T2', x: 70, y: 70, contenuto: 'Nota' }])
    expect(esito.aree[0]).toMatchObject({ id: 'A2', x: 30, y: 30, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } })
  })

  it('senza un tubo bersaglio le frecce si saltano e lo si dice', () => {
    const a = appuntoDa({ ...vuoto(), testi: [testo], frecce: [freccia] })!
    const esito = incollaAppunto(a, contesto(), 1)
    expect(esito.frecce).toEqual([])
    expect(esito.frecceSaltate).toBe(true)
    expect(esito.testi).toHaveLength(1)
  })

  it('sul tubo bersaglio una freccia va a metà, più frecce si distribuiscono', () => {
    const una = incollaAppunto(appuntoDa({ ...vuoto(), frecce: [freccia] })!, contesto({ segniBersaglio: [valvola] }), 1)
    expect(una.frecce).toEqual([{ id: 'freccia-1', tipo: 'freccia_direzione', t: 0.5 }])
    const tre = incollaAppunto(
      appuntoDa({ ...vuoto(), frecce: [freccia, { ...freccia, id: 's10' }, { ...freccia, id: 's11' }] })!,
      contesto({ segniBersaglio: [{ ...freccia, id: 'freccia-1' }] }),
      1
    )
    expect(tre.frecce.map((f) => f.t)).toEqual([0.25, 0.5, 0.75])
    expect(tre.frecce.map((f) => f.id)).toEqual(['freccia-2', 'freccia-3', 'freccia-4'])
    expect(tre.frecceSaltate).toBe(false)
  })

  it('esitoVuoto', () => {
    const a = appuntoDa({ ...vuoto(), frecce: [freccia] })!
    expect(esitoVuoto(incollaAppunto(a, contesto(), 1))).toBe(true)
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npx vitest run src/services/schemaImpianto/__tests__/appunti.test.ts`
Expected: FAIL, moduli/export mancanti.

- [ ] **Step 3: `codiceManualeLibero` in `codici.ts`**

In coda a `codici.ts`:

```ts
// I codici di scheda non hanno mai questo prefisso (S1, C1, SEP1, ...): senza, un nodo
// manuale "S2" collide con un vero S2 comparso più tardi in scheda, che la riconciliazione
// tratterebbe da lì in poi come il nodo manuale già presente — non entrerebbe mai fra gli
// `aggiunti`, e resterebbe "Serbatoio" per sempre, senza marca né valvole.
export const PREFISSO_MANUALE = 'M-'

/** Primo codice manuale libero, es. M-S1/M-S2 già usati → M-S3. Lo usano la palette
 *  (`codiceLibero`, SchemaEditor.tsx) e l'incolla (`incollaAppunto`, appunti.ts). */
export function codiceManualeLibero(prefisso: string, usati: Set<string>): string {
  for (let i = 1; ; i++) {
    const codice = `${PREFISSO_MANUALE}${prefisso}${i}`
    if (!usati.has(codice)) return codice
  }
}
```

In `SchemaEditor.tsx` elimina il commento e la costante `PREFISSO_MANUALE` locali (righe ~246-250) e riscrivi `codiceLibero` come delega, conservando la sua firma:

```ts
/** Primo codice libero per un nuovo nodo, es. S1/S2/S3 già presenti → M-S4. Il prefisso `M-` e
 *  il perché vivono in `codiceManualeLibero` (codici.ts), condiviso con l'incolla. */
export function codiceLibero(prefisso: string, nodes: Node[]): string {
  return codiceManualeLibero(prefisso, new Set(nodes.map((n) => n.id)))
}
```

e aggiungi `codiceManualeLibero` all'import esistente da `@/services/schemaImpianto/codici` (se non c'è un import da quel modulo, aggiungilo).

- [ ] **Step 4: Implementa `appunti.ts`**

```ts
/**
 * Copia-incolla dell'editor, in forma pura. L'appunto vive in memoria nell'editor (`useAppunti.ts`),
 * non negli appunti di sistema: nessuna copia fra pratiche diverse, per scelta.
 *
 * Si copiano soltanto terminali «alle utenze», TEE, testi, aree e frecce di direzione. Le
 * apparecchiature no: sono dati di scheda, e una copia sarebbe un doppione senza marca né valvole
 * in tabella. I tubi no: si incollano oggetti scollegati (deciso col committente il 17-09-2026).
 */
import { codiceManualeLibero } from './codici'
import type { SchemaArea, SchemaNodoPosizionato, SchemaNodoTipo, SchemaSegnoTubo, SchemaTestoLibero } from './types'

/** Due passi di griglia: la copia si vede subito accanto all'originale, senza coprirlo. */
export const SCARTO_INCOLLA = 20

/** Tipi di nodo copiabili e il prefisso del loro codice manuale. `G` è già quello della palette. */
const PREFISSO_COPIA: Partial<Record<SchemaNodoTipo, string>> = { utenze: 'U', giunzione: 'G' }

export interface Appunto {
  nodi: SchemaNodoPosizionato[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  frecce: SchemaSegnoTubo[]
}

/** Filtra ciò che si può copiare. `null` se non resta nulla: chi chiama tiene l'appunto di prima. */
export function appuntoDa(sorgente: Appunto): Appunto | null {
  const appunto: Appunto = structuredClone({
    nodi: sorgente.nodi.filter((n) => PREFISSO_COPIA[n.tipo] !== undefined),
    testi: sorgente.testi,
    aree: sorgente.aree,
    frecce: sorgente.frecce.filter((f) => f.tipo === 'freccia_direzione'),
  })
  const quanti = appunto.nodi.length + appunto.testi.length + appunto.aree.length + appunto.frecce.length
  return quanti > 0 ? appunto : null
}

export interface ContestoIncolla {
  idNodi: Set<string>
  idTesti: Set<string>
  idAree: Set<string>
  /** I segni del tubo selezionato, o `null` se non ce n'è esattamente uno. */
  segniBersaglio: SchemaSegnoTubo[] | null
}

export interface EsitoIncolla {
  nodi: SchemaNodoPosizionato[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  /** Le frecce da aggiungere al tubo bersaglio, con `t` già distribuite. */
  frecce: SchemaSegnoTubo[]
  /** Vero se l'appunto aveva frecce ma non c'era un tubo su cui posarle. */
  frecceSaltate: boolean
}

function idLibero(prefisso: string, usati: Set<string>): string {
  for (let i = 1; ; i++) {
    const id = `${prefisso}${i}`
    if (!usati.has(id)) {
      usati.add(id)
      return id
    }
  }
}

/**
 * `ripetizione` parte da 1 al primo incolla dello stesso appunto e cresce a ogni Ctrl+V: le copie
 * scendono in diagonale invece di impilarsi sullo stesso punto.
 */
export function incollaAppunto(appunto: Appunto, contesto: ContestoIncolla, ripetizione: number): EsitoIncolla {
  const s = SCARTO_INCOLLA * ripetizione
  const idNodi = new Set(contesto.idNodi)
  const idTesti = new Set(contesto.idTesti)
  const idAree = new Set(contesto.idAree)

  const nodi = appunto.nodi.map((n) => {
    // Il codice scritto a mano resta all'originale: due righe uguali in tabella sarebbero un
    // doppione, e la copia mostra il proprio identificativo finché non la si rinomina.
    const { codice: _codice, ...resto } = structuredClone(n)
    const id = codiceManualeLibero(PREFISSO_COPIA[n.tipo]!, idNodi)
    idNodi.add(id)
    return { ...resto, id, origine: 'manuale' as const, x: n.x + s, y: n.y + s }
  })
  const testi = appunto.testi.map((t) => ({ ...structuredClone(t), id: idLibero('T', idTesti), x: t.x + s, y: t.y + s }))
  const aree = appunto.aree.map((a) => ({ ...structuredClone(a), id: idLibero('A', idAree), x: a.x + s, y: a.y + s }))

  if (contesto.segniBersaglio === null) {
    return { nodi, testi, aree, frecce: [], frecceSaltate: appunto.frecce.length > 0 }
  }
  const idSegni = new Set(contesto.segniBersaglio.map((g) => g.id))
  const n = appunto.frecce.length
  // Solo tipo e posizione: `stileAValle` non vale per la freccia (types.ts) e un `ancoraggio`
  // parlerebbe dei vertici del tubo d'origine, non di questo.
  const frecce = appunto.frecce.map((_, i): SchemaSegnoTubo => ({
    id: idLibero('freccia-', idSegni),
    tipo: 'freccia_direzione',
    t: (i + 1) / (n + 1),
  }))
  return { nodi, testi, aree, frecce, frecceSaltate: false }
}

export function esitoVuoto(e: EsitoIncolla): boolean {
  return e.nodi.length + e.testi.length + e.aree.length + e.frecce.length === 0
}
```

- [ ] **Step 5: Esegui**

Run: `npx vitest run src/services/schemaImpianto/__tests__/appunti.test.ts src/components/schemaImpianto/__tests__/codiceLibero.test.ts`
Expected: PASS entrambi.

- [ ] **Step 6: Tipi, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/schemaImpianto/codici.ts src/services/schemaImpianto/appunti.ts src/services/schemaImpianto/__tests__/appunti.test.ts src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): appunto e incolla puri per utenze, TEE, testi, aree e frecce"
```

---

### Task 6: Il ponte verso React Flow — aree nello stato, frecce selezionabili

**Files:**
- Modify: `src/components/schemaImpianto/conversioneFlow.ts` (`layoutAFlow`, `flowALayout`, `fondiDatiArchi`)
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (`SchemaEdgeData`, `SchemaSegnoProps`, `SchemaSegno`, resa dei segni)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (`StatoEditor`, chiamata a `flowALayout`)
- Modify: `src/components/schemaImpianto/__tests__/conversioneFlow.test.ts`, `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts` (firme)
- Test: `conversioneFlow.test.ts`, `fondiDatiArchi.test.ts`

**Interfaces:**
- Consumes: `SchemaArea` (Task 1)
- Produces:
  - `layoutAFlow(layout, libreria?)` → `{ nodes; edges; testi; aree: SchemaArea[] }`
  - `flowALayout(nodes, edges, testi, aree: SchemaArea[], muroX, libreria?)` — **`aree` è il quarto parametro, obbligatorio**
  - `fondiDatiArchi(…, arcoEvidenziato, bloccato = false, frecce?: FrecceDegliArchi)` con `interface FrecceDegliArchi { selezionate: Map<string, string[]>; onSeleziona: (arco: string, segno: string, aggiungi: boolean) => void }`
  - `SchemaEdgeData.frecceSelezionate?: string[]`, `SchemaEdgeData.onSelezionaFreccia?: (arco: string, segno: string, aggiungi: boolean) => void`
  - `StatoEditor.aree: SchemaArea[]`

- [ ] **Step 1: Scrivi i test che falliscono**

In `conversioneFlow.test.ts`, prima aggiorna **tutte** le chiamate esistenti a `flowALayout` inserendo `[]` come quarto argomento (sono in righe 52, 80, 89, 101, 110, 123, 131: es. `flowALayout(nodes, edges, [], null)` → `flowALayout(nodes, edges, [], [], null)`; `flowALayout(flow.nodes, flow.edges, flow.testi, null)` → `flowALayout(flow.nodes, flow.edges, flow.testi, [], null)`). Poi aggiungi dentro `describe('layoutAFlow / flowALayout', …)`:

```ts
  it('le aree attraversano il ponte senza trasformazioni', () => {
    const area = { id: 'A1', x: 10, y: 10, larghezza: 300, altezza: 200, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } }
    const flow = layoutAFlow({ ...layoutDiProva(), aree: [area] })
    expect(flow.aree).toEqual([area])
    expect(flowALayout(flow.nodes, flow.edges, flow.testi, flow.aree, null).aree).toEqual([area])
  })

  it('un layout senza aree ne porta una lista vuota nello stato dell\'editor', () => {
    expect(layoutAFlow(layoutDiProva()).aree).toEqual([])
  })
```

In `instradamentoCondiviso.test.ts` riga 85-86: `const { nodes, edges, testi } = layoutAFlow(layout)` → `const { nodes, edges, testi, aree } = layoutAFlow(layout)` e `flowALayout(nodes, edges, testi, null)` → `flowALayout(nodes, edges, testi, aree, null)`.

In `fondiDatiArchi.test.ts` aggiungi (usa le costanti già definite nel file: `conGomiti`, `conSegni`, `conTrascinamento`, `QUOTE`, `CAPI`):

```ts
  it('senza frecce selezionabili non aggiunge chiavi agli archi', () => {
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null)
    expect(fusi.every((e) => !('frecceSelezionate' in (e.data as object)))).toBe(true)
  })

  it('porta a ogni arco le sue frecce selezionate e il gestore del clic', () => {
    const onSeleziona = () => {}
    const selezionate = new Map([[conGomiti[0].id, ['s1']]])
    const fusi = fondiDatiArchi(conGomiti, conSegni, conTrascinamento, QUOTE, CAPI, null, false, { selezionate, onSeleziona })
    expect((fusi[0].data as { frecceSelezionate: string[] }).frecceSelezionate).toEqual(['s1'])
    expect((fusi[1]?.data as { frecceSelezionate?: string[] } | undefined)?.frecceSelezionate ?? []).toEqual([])
    expect((fusi[0].data as { onSelezionaFreccia: unknown }).onSelezionaFreccia).toBe(onSeleziona)
  })
```

Se `conGomiti` ha un solo arco, il secondo `expect` passa comunque (usa `?? []`).

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npx vitest run src/components/schemaImpianto/__tests__/conversioneFlow.test.ts src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts`
Expected: FAIL sui test nuovi.

- [ ] **Step 3: `conversioneFlow.ts`**

1. Import tipi: aggiungi `SchemaArea`.
2. `layoutAFlow`: tipo di ritorno `{ nodes: Node[]; edges: Edge[]; testi: SchemaTestoLibero[]; aree: SchemaArea[] }` e `return { nodes, edges, testi: layout.testi ?? [], aree: layout.aree ?? [] }`.
3. `flowALayout`: nuova firma

```ts
export function flowALayout(
  nodes: Node[],
  edges: Edge[],
  testi: SchemaTestoLibero[],
  aree: SchemaArea[],
  muroX: number | null,
  libreria: Tarature = {}
): SchemaLayout {
```

e nel `return`, dopo `testi,`: `aree,` con il commento «Obbligatorio per la stessa ragione di `testi`: un default lascerebbe perdere le aree in silenzio a chi dimentica di passarle.»

4. `fondiDatiArchi`: sopra la funzione

```ts
/** Le frecce di direzione selezionate, per arco, e il gestore del loro clic (useSelezioneMultipla.ts). */
export interface FrecceDegliArchi {
  selezionate: Map<string, string[]>
  onSeleziona: (arco: string, segno: string, aggiungi: boolean) => void
}
```

aggiungi il parametro finale `frecce?: FrecceDegliArchi` e nell'oggetto `data`, dopo `bloccato,`:

```ts
      // Solo se l'editor le passa: i test e i chiamanti che non selezionano frecce restano identici.
      ...(frecce ? { frecceSelezionate: frecce.selezionate.get(e.id) ?? [], onSelezionaFreccia: frecce.onSeleziona } : {}),
```

- [ ] **Step 4: `SchemaEdgeTubazione.tsx`**

1. In `SchemaEdgeData`, dopo `bloccato?`:

```ts
  /** Id delle frecce di direzione di questo arco che fanno parte della selezione dell'editor. */
  frecceSelezionate?: string[]
  /** Clic su una freccia: `aggiungi` è Ctrl/Cmd premuto. Le altre due specie di segno non si selezionano. */
  onSelezionaFreccia?: (arco: string, segno: string, aggiungi: boolean) => void
```

2. In `SchemaSegnoProps`: `selezionato?: boolean` e `onSeleziona?: (aggiungi: boolean) => void`; aggiungili alla destrutturazione di `SchemaSegno`.
3. In `SchemaSegno`, prima del `return`:

```ts
  // La freccia si seleziona premendo, come testi e muro: il click lo mangerebbe il trascinamento.
  // Le valvole e i riduttori no — il loro clic apre il menu del tipo di tubo.
  const suPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tipo === 'freccia_direzione') onSeleziona?.(e.ctrlKey || e.metaKey)
      suInizio(e)
    },
    [onSeleziona, suInizio, tipo]
  )
```

4. Sul `<div className="nopan" …>`: `onPointerDown={suPointerDown}` al posto di `onPointerDown={suInizio}`, e nello `style` aggiungi
   `outline: selezionato ? '1px dashed #1976d2' : 'none', outlineOffset: -6,`
5. Nella resa `(edgeData?.segni ?? []).map(...)` passa a `<SchemaSegno>`:

```tsx
              selezionato={edgeData?.frecceSelezionate?.includes(segno.id) ?? false}
              onSeleziona={(aggiungi) => edgeData?.onSelezionaFreccia?.(id, segno.id, aggiungi)}
```

- [ ] **Step 5: `SchemaEditor.tsx`, solo quanto serve a compilare**

1. Import tipi: aggiungi `SchemaArea` all'import da `@/services/schemaImpianto/types`.
2. In `interface StatoEditor`, dopo `testi`:

```ts
  // Le aree tratteggiate, per la stessa ragione dei testi: non sono nodi di react-flow, vivono qui
  // e la cronologia le copre gratis.
  aree: SchemaArea[]
```

3. `layoutCorrente`: `flowALayout(stato.nodes, stato.edges, stato.testi, stato.aree, stato.muroX, libreriaEffettiva)` e aggiungi `stato.aree` alle dipendenze del `useMemo`.
   (`iniziale` porta già `aree` perché fa lo spread di `layoutAFlow`.)

- [ ] **Step 6: Esegui**

Run: `npx vitest run src/components/schemaImpianto` poi `npx tsc --noEmit` e `npm run lint`
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/__tests__/conversioneFlow.test.ts src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts
git commit -m "feat(schema): aree nello stato dell'editor e frecce di direzione selezionabili"
```

---

### Task 7: Hook della selezione multipla e i suoi helper puri

**Files:**
- Create: `src/components/schemaImpianto/useSelezioneMultipla.ts`
- Test: `src/components/schemaImpianto/__tests__/useSelezioneMultipla.test.ts`

**Interfaces:**
- Consumes: `ElementoLibero`, `selezioneDopoPressione`, `chiaveElemento`, `riquadroDaPunti`, `elementiNelRiquadro`, `FrecciaPosata`, `PosizioniGruppo`, `posizioniSpostate`, `gruppoVuoto` (Task 4); `SchemaEdgeData` (Task 6)
- Produces:
  - `interface StatoSelezionabile { nodes: Node[]; edges: Edge[]; testi: SchemaTestoLibero[]; aree: SchemaArea[]; muroX: number | null }`
  - `originiDelGruppo(s: StatoSelezionabile, libere: ElementoLibero[]): PosizioniGruppo`
  - `statoConPosizioni<T extends StatoSelezionabile>(s: T, p: PosizioniGruppo): T`
  - `selezioneVuota(s: StatoSelezionabile, libere: ElementoLibero[]): boolean`
  - `statoSenzaSelezione<T extends StatoSelezionabile>(s: T, libere: ElementoLibero[]): T`
  - `libereEsistenti(s: StatoSelezionabile, libere: ElementoLibero[]): ElementoLibero[]`
  - `interface PressioneSullaTela { nodi: Set<string>; archi: Set<string>; aggiungi: boolean }`
  - `useSelezioneMultipla<T extends StatoSelezionabile>(stato: T, applica: Aggiorna<T>, aggiornaSenzaCronologia: Aggiorna<T>)` →
    `{ libere, impostaLibere, svuotaLibere, deselezionaReactFlow, premiLibero(el, aggiungi), spostaGruppoDa(afferrato: { tipo: 'testo' | 'area'; id: string }, posizione: Punto, concluso: boolean), iniziaTrascinamentoNodi(nodo: Node, pressione: PressioneSullaTela | null), seguiTrascinamentoNodi(nodo: Node), concludiTrascinamentoNodi(nodo: Node), clicSuReactFlow(id: string, tipo: 'nodo' | 'arco', pressione: PressioneSullaTela | null), spostaConTastiera(dx, dy, ripetuto), eliminaSelezione(), iniziaRiquadro(punto: Punto), concludiRiquadro(punto: Punto, frecce: FrecciaPosata[]) }`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  libereEsistenti,
  originiDelGruppo,
  selezioneVuota,
  statoConPosizioni,
  statoSenzaSelezione,
  type StatoSelezionabile,
} from '../useSelezioneMultipla'

function stato(): StatoSelezionabile {
  const nodes = [
    { id: 'C1', position: { x: 40, y: 40 }, data: {}, selected: true },
    { id: 'S1', position: { x: 300, y: 40 }, data: {}, selected: false },
    { id: 'G1', position: { x: 500, y: 40 }, data: {}, selected: false },
  ] as Node[]
  const edges = [
    { id: 'e1', source: 'C1', target: 'S1', data: { stile: 'standard' } },
    { id: 'e2', source: 'S1', target: 'G1', selected: true, data: { stile: 'standard' } },
    {
      id: 'e3', source: 'G1', target: 'S1',
      data: { stile: 'standard', segni: [{ id: 'f1', tipo: 'freccia_direzione', t: 0.3 }, { id: 'v1', tipo: 'valvola_intercettazione', t: 0.6 }] },
    },
  ] as Edge[]
  return {
    nodes,
    edges,
    testi: [{ id: 'T1', x: 10, y: 10, contenuto: 'a' }, { id: 'T2', x: 20, y: 20, contenuto: 'b' }],
    aree: [{ id: 'A1', x: 0, y: 0, larghezza: 300, altezza: 200, scritta: '', scartoScritta: { dx: 10, dy: 30 } }],
    muroX: 250,
  }
}

describe('originiDelGruppo e statoConPosizioni', () => {
  it('raccoglie nodi selezionati, testi e aree della selezione libera (non muro né frecce)', () => {
    const o = originiDelGruppo(stato(), [{ tipo: 'testo', id: 'T2' }, { tipo: 'area', id: 'A1' }, { tipo: 'muro' }, { tipo: 'freccia', arco: 'e3', segno: 'f1' }])
    expect(o).toEqual({ nodi: { C1: { x: 40, y: 40 } }, testi: { T2: { x: 20, y: 20 } }, aree: { A1: { x: 0, y: 0 } } })
  })

  it('scrive le posizioni e lascia identici gli oggetti non toccati', () => {
    const s = stato()
    const dopo = statoConPosizioni(s, { nodi: { C1: { x: 60, y: 60 } }, testi: { T2: { x: 5, y: 5 } }, aree: {} })
    expect(dopo.nodes[0].position).toEqual({ x: 60, y: 60 })
    expect(dopo.nodes[1]).toBe(s.nodes[1])
    expect(dopo.testi[0]).toBe(s.testi[0])
    expect(dopo.testi[1]).toMatchObject({ x: 5, y: 5 })
    expect(dopo.aree[0]).toBe(s.aree[0])
  })
})

describe('statoSenzaSelezione', () => {
  it('toglie in un colpo nodi con i loro tubi, archi, testi, aree, frecce e muro selezionati', () => {
    const dopo = statoSenzaSelezione(stato(), [
      { tipo: 'testo', id: 'T1' },
      { tipo: 'area', id: 'A1' },
      { tipo: 'freccia', arco: 'e3', segno: 'f1' },
      { tipo: 'muro' },
    ])
    expect(dopo.nodes.map((n) => n.id)).toEqual(['S1', 'G1'])
    // e1 cade con C1, e2 perché selezionato; e3 resta ma senza la freccia, con la valvola.
    expect(dopo.edges.map((e) => e.id)).toEqual(['e3'])
    expect((dopo.edges[0].data as { segni: { id: string }[] }).segni.map((g) => g.id)).toEqual(['v1'])
    expect(dopo.testi.map((t) => t.id)).toEqual(['T2'])
    expect(dopo.aree).toEqual([])
    expect(dopo.muroX).toBeNull()
  })

  it('selezioneVuota', () => {
    const s = stato()
    expect(selezioneVuota(s, [])).toBe(false)
    const senza = { ...s, nodes: s.nodes.map((n) => ({ ...n, selected: false })), edges: s.edges.map((e) => ({ ...e, selected: false })) }
    expect(selezioneVuota(senza, [])).toBe(true)
    expect(selezioneVuota(senza, [{ tipo: 'muro' }])).toBe(false)
  })
})

describe('libereEsistenti', () => {
  it('scarta ciò che non esiste più (un Ctrl+Z, un\'eliminazione dal dialogo)', () => {
    const s = { ...stato(), muroX: null }
    expect(
      libereEsistenti(s, [
        { tipo: 'testo', id: 'T1' },
        { tipo: 'testo', id: 'T9' },
        { tipo: 'area', id: 'A2' },
        { tipo: 'freccia', arco: 'e3', segno: 'f1' },
        { tipo: 'freccia', arco: 'e3', segno: 'v1' },
        { tipo: 'muro' },
      ])
    ).toEqual([{ tipo: 'testo', id: 'T1' }, { tipo: 'freccia', arco: 'e3', segno: 'f1' }])
  })
})
```

Nota: `{ tipo: 'freccia', arco: 'e3', segno: 'v1' }` è scartata perché `v1` non è una freccia di direzione.

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useSelezioneMultipla.test.ts`
Expected: FAIL, modulo mancante.

- [ ] **Step 3: Implementa `useSelezioneMultipla.ts`**

```ts
/**
 * La selezione multipla dell'editor: quella di React Flow (nodi e archi, flag `selected` nello
 * stato) più quella propria di testi, aree, frecce di direzione e muro (`ElementoLibero[]`). Le due
 * restano separate — React Flow non conosce le annotazioni — ma agiscono come un gruppo solo:
 * si spostano insieme e si cancellano insieme, in UNA voce di cronologia.
 *
 * Gli helper puri in testa sono provati in `__tests__/useSelezioneMultipla.test.ts`; l'hook in
 * fondo è cablaggio (CLAUDE.md: niente test di interfaccia).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  chiaveElemento,
  elementiNelRiquadro,
  gruppoVuoto,
  posizioniSpostate,
  riquadroDaPunti,
  selezioneDopoPressione,
  type ElementoLibero,
  type FrecciaPosata,
  type PosizioniGruppo,
} from '@/services/schemaImpianto/selezione'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea, SchemaTestoLibero } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

export interface StatoSelezionabile {
  nodes: Node[]
  edges: Edge[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  muroX: number | null
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

function idsLiberi(libere: ElementoLibero[], tipo: 'testo' | 'area'): Set<string> {
  return new Set(libere.flatMap((e) => (e.tipo === tipo ? [e.id] : [])))
}

export function originiDelGruppo(s: StatoSelezionabile, libere: ElementoLibero[]): PosizioniGruppo {
  const testi = idsLiberi(libere, 'testo')
  const aree = idsLiberi(libere, 'area')
  return {
    nodi: Object.fromEntries(s.nodes.filter((n) => n.selected).map((n) => [n.id, { ...n.position }])),
    testi: Object.fromEntries(s.testi.filter((t) => testi.has(t.id)).map((t) => [t.id, { x: t.x, y: t.y }])),
    aree: Object.fromEntries(s.aree.filter((a) => aree.has(a.id)).map((a) => [a.id, { x: a.x, y: a.y }])),
  }
}

/** Scrive le posizioni date; ciò che non compare in `p` resta lo stesso oggetto. */
export function statoConPosizioni<T extends StatoSelezionabile>(s: T, p: PosizioniGruppo): T {
  return {
    ...s,
    nodes: s.nodes.map((n) => (p.nodi[n.id] ? { ...n, position: p.nodi[n.id] } : n)),
    testi: s.testi.map((t) => (p.testi[t.id] ? { ...t, ...p.testi[t.id] } : t)),
    aree: s.aree.map((a) => (p.aree[a.id] ? { ...a, ...p.aree[a.id] } : a)),
  }
}

export function selezioneVuota(s: StatoSelezionabile, libere: ElementoLibero[]): boolean {
  return libere.length === 0 && !s.nodes.some((n) => n.selected) && !s.edges.some((e) => e.selected)
}

/**
 * Tutto il selezionato tolto in un solo stato — e quindi in una sola voce di cronologia. Fino al
 * 17-09-2026 il Canc passava da DUE strade (react-flow per nodi e archi, un listener su `window`
 * per muro e testi): con una selezione mista un Ctrl+Z ne annullava metà.
 */
export function statoSenzaSelezione<T extends StatoSelezionabile>(s: T, libere: ElementoLibero[]): T {
  const nodi = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id))
  const archi = new Set(s.edges.filter((e) => e.selected).map((e) => e.id))
  const testi = idsLiberi(libere, 'testo')
  const aree = idsLiberi(libere, 'area')
  const frecce = new Map<string, Set<string>>()
  for (const e of libere) if (e.tipo === 'freccia') frecce.set(e.arco, new Set([...(frecce.get(e.arco) ?? []), e.segno]))
  const muro = libere.some((e) => e.tipo === 'muro')
  return {
    ...s,
    nodes: s.nodes.filter((n) => !nodi.has(n.id)),
    // Un'apparecchiatura rimossa si porta via le tubazioni che vi arrivavano (come `eliminaSelezione` di prima).
    edges: s.edges
      .filter((e) => !archi.has(e.id) && !nodi.has(e.source) && !nodi.has(e.target))
      .map((e) => {
        const via = frecce.get(e.id)
        if (!via) return e
        const data = e.data as SchemaEdgeData
        return { ...e, data: { ...data, segni: (data.segni ?? []).filter((g) => !via.has(g.id)) } satisfies SchemaEdgeData }
      }),
    testi: s.testi.filter((t) => !testi.has(t.id)),
    aree: s.aree.filter((a) => !aree.has(a.id)),
    muroX: muro ? null : s.muroX,
  }
}

/** La selezione libera ripulita da ciò che non esiste più (Ctrl+Z, eliminazione dal dialogo). */
export function libereEsistenti(s: StatoSelezionabile, libere: ElementoLibero[]): ElementoLibero[] {
  return libere.filter((e) => {
    switch (e.tipo) {
      case 'muro':
        return s.muroX !== null
      case 'testo':
        return s.testi.some((t) => t.id === e.id)
      case 'area':
        return s.aree.some((a) => a.id === e.id)
      case 'freccia': {
        const arco = s.edges.find((a) => a.id === e.arco)
        return ((arco?.data as SchemaEdgeData | undefined)?.segni ?? []).some((g) => g.id === e.segno && g.tipo === 'freccia_direzione')
      }
    }
  })
}

/**
 * Cosa era selezionato in react-flow nell'istante in cui il puntatore è sceso sulla tela, e se Ctrl
 * era premuto. Lo registra l'editor in `onPointerDownCapture` sul contenitore della tela, cioè PRIMA
 * che react-flow cambi la selezione per conto suo: dopo non si potrebbe più sapere se il nodo
 * afferrato faceva già parte del gruppo.
 */
export interface PressioneSullaTela {
  nodi: Set<string>
  archi: Set<string>
  aggiungi: boolean
}

export function useSelezioneMultipla<T extends StatoSelezionabile>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  const [libere, setLibere] = useState<ElementoLibero[]>([])
  // I gestori dei gesti leggono selezione e stato da qui, non dalla chiusura del render: un gesto
  // comincia fra due render, e l'istantanea catturata può essere di quello prima.
  const libereRef = useRef(libere)
  const statoRef = useRef(stato)
  statoRef.current = stato

  const impostaLibere = useCallback((nuove: ElementoLibero[]) => {
    libereRef.current = nuove
    setLibere(nuove)
  }, [])

  const svuotaLibere = useCallback(() => {
    if (libereRef.current.length > 0) impostaLibere([])
  }, [impostaLibere])

  // Stesso gesto di prima (`deselezionaReactFlow` in SchemaEditor.tsx), ma con la guardia DENTRO
  // l'updater: restituire lo stato identico quando nulla è selezionato evita il giro a vuoto con
  // `onSelectionChange` senza dover leggere una `selezione` catturata.
  const deselezionaReactFlow = useCallback(() => {
    aggiornaSenzaCronologia((s) =>
      s.nodes.some((n) => n.selected) || s.edges.some((e) => e.selected)
        ? {
            ...s,
            nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
          }
        : s
    )
  }, [aggiornaSenzaCronologia])

  /** Pressione su un testo, un'area, una freccia o il muro. */
  const premiLibero = useCallback(
    (elemento: ElementoLibero, aggiungi: boolean) => {
      const prima = libereRef.current
      const giaDentro = prima.some((e) => chiaveElemento(e) === chiaveElemento(elemento))
      // Un elemento nuovo senza Ctrl ricomincia la selezione da capo, anche quella di react-flow;
      // uno già selezionato tiene il gruppo intero, perché premere è l'inizio del trascinamento.
      if (!aggiungi && !giaDentro) deselezionaReactFlow()
      impostaLibere(selezioneDopoPressione(prima, elemento, aggiungi))
    },
    [deselezionaReactFlow, impostaLibere]
  )

  /** Clic (senza trascinamento) su un nodo o un arco: stessa regola di `premiLibero`, lato react-flow. */
  const clicSuReactFlow = useCallback(
    (id: string, tipo: 'nodo' | 'arco', pressione: PressioneSullaTela | null) => {
      if (pressione?.aggiungi) return
      const giaDentro = tipo === 'nodo' ? pressione?.nodi.has(id) : pressione?.archi.has(id)
      if (!giaDentro) svuotaLibere()
    },
    [svuotaLibere]
  )

  // Gesto di gruppo partito da un testo o da un'area. Il PRIMO evento entra in cronologia, gli altri
  // no — lo stesso principio di `spostaTesto` (useTestiLiberi.ts). Le origini si congelano lì.
  const gestoLibero = useRef<{ origini: PosizioniGruppo; afferrato: Punto } | null>(null)

  const spostaGruppoDa = useCallback(
    (afferrato: { tipo: 'testo' | 'area'; id: string }, posizione: Punto, concluso: boolean) => {
      const primo = gestoLibero.current === null
      if (primo) {
        const s = statoRef.current
        const proprio = afferrato.tipo === 'testo' ? s.testi.find((t) => t.id === afferrato.id) : s.aree.find((a) => a.id === afferrato.id)
        if (!proprio) return
        const origini = originiDelGruppo(s, libereRef.current)
        // L'afferrato si muove anche se, per una corsa fra render, non risultasse selezionato.
        ;(afferrato.tipo === 'testo' ? origini.testi : origini.aree)[afferrato.id] = { x: proprio.x, y: proprio.y }
        gestoLibero.current = { origini, afferrato: { x: proprio.x, y: proprio.y } }
      }
      const { origini, afferrato: o } = gestoLibero.current!
      const posizioni = posizioniSpostate(origini, posizione.x - o.x, posizione.y - o.y)
      if (concluso) gestoLibero.current = null
      ;(primo ? applica : aggiornaSenzaCronologia)((s) => statoConPosizioni(s, posizioni))
    },
    [applica, aggiornaSenzaCronologia]
  )

  // Gesto di gruppo partito da un nodo: i nodi li muove react-flow (e `onNodesChange` scrive la voce
  // di cronologia al primo evento, PRIMA di `onNodeDrag` — ordine verificato in XYDrag), qui si
  // accodano testi e aree selezionati, sempre senza cronologia: stanno nella stessa voce.
  const gestoNodi = useRef<{ origini: PosizioniGruppo; partenza: Punto } | null>(null)

  const iniziaTrascinamentoNodi = useCallback(
    (nodo: Node, pressione: PressioneSullaTela | null) => {
      gestoNodi.current = null
      if (!pressione?.aggiungi && !pressione?.nodi.has(nodo.id)) {
        // Un nodo che non era nel gruppo ricomincia la selezione: react-flow ha già tenuto solo lui.
        svuotaLibere()
        return
      }
      const { testi, aree } = originiDelGruppo(statoRef.current, libereRef.current)
      const origini = { nodi: {}, testi, aree }
      if (gruppoVuoto(origini)) return
      gestoNodi.current = { origini, partenza: { ...nodo.position } }
    },
    [svuotaLibere]
  )

  const seguiTrascinamentoNodi = useCallback(
    (nodo: Node) => {
      const g = gestoNodi.current
      if (!g) return
      const posizioni = posizioniSpostate(g.origini, nodo.position.x - g.partenza.x, nodo.position.y - g.partenza.y)
      aggiornaSenzaCronologia((s) => statoConPosizioni(s, posizioni))
    },
    [aggiornaSenzaCronologia]
  )

  const concludiTrascinamentoNodi = useCallback(
    (nodo: Node) => {
      seguiTrascinamentoNodi(nodo)
      gestoNodi.current = null
    },
    [seguiTrascinamentoNodi]
  )

  /** Frecce della tastiera: solo la prima pressione entra in cronologia (vedi il vecchio `sposta`). */
  const spostaConTastiera = useCallback(
    (dx: number, dy: number, ripetuto: boolean) => {
      if (gruppoVuoto(originiDelGruppo(statoRef.current, libereRef.current))) return
      const libereOra = libereRef.current
      ;(ripetuto ? aggiornaSenzaCronologia : applica)((s) =>
        statoConPosizioni(s, posizioniSpostate(originiDelGruppo(s, libereOra), dx, dy))
      )
    },
    [applica, aggiornaSenzaCronologia]
  )

  const eliminaSelezione = useCallback(() => {
    const libereOra = libereRef.current
    if (selezioneVuota(statoRef.current, libereOra)) return
    applica((s) => statoSenzaSelezione(s, libereOra))
    impostaLibere([])
  }, [applica, impostaLibere])

  // Il riquadro: react-flow sceglie i suoi oggetti da sé; qui si raccolgono gli altri a fine gesto.
  const inizioRiquadro = useRef<Punto | null>(null)

  const iniziaRiquadro = useCallback(
    (punto: Punto) => {
      inizioRiquadro.current = punto
      svuotaLibere()
    },
    [svuotaLibere]
  )

  const concludiRiquadro = useCallback(
    (punto: Punto, frecce: FrecciaPosata[]) => {
      const inizio = inizioRiquadro.current
      inizioRiquadro.current = null
      if (!inizio) return
      const s = statoRef.current
      impostaLibere(elementiNelRiquadro(riquadroDaPunti(inizio, punto), { testi: s.testi, aree: s.aree, frecce }))
    },
    [impostaLibere]
  )

  // Una selezione che punta a qualcosa sparito (Ctrl+Z, «Elimina» nel dialogo del testo) si ripulisce
  // da sé: un Canc dopo consumerebbe una voce di cronologia a vuoto.
  useEffect(() => {
    const valide = libereEsistenti(stato, libere)
    if (valide.length !== libere.length) impostaLibere(valide)
  }, [stato, libere, impostaLibere])

  return {
    libere,
    impostaLibere,
    svuotaLibere,
    deselezionaReactFlow,
    premiLibero,
    clicSuReactFlow,
    spostaGruppoDa,
    iniziaTrascinamentoNodi,
    seguiTrascinamentoNodi,
    concludiTrascinamentoNodi,
    spostaConTastiera,
    eliminaSelezione,
    iniziaRiquadro,
    concludiRiquadro,
  }
}
```

- [ ] **Step 4: Esegui**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useSelezioneMultipla.test.ts`, poi `npx tsc --noEmit`, `npm run lint`
Expected: verde. Se il lint segnala `no-extra-semi` sulle righe che iniziano con `;(`, riscrivile con una variabile: `const aggiorna = primo ? applica : aggiornaSenzaCronologia; aggiorna(...)`.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useSelezioneMultipla.ts src/components/schemaImpianto/__tests__/useSelezioneMultipla.test.ts
git commit -m "feat(schema): hook della selezione multipla con spostamento e cancellazione di gruppo"
```

---

### Task 8: Le aree sulla tela

**Files:**
- Create: `src/components/schemaImpianto/useAree.ts`
- Create: `src/components/schemaImpianto/AreeImpianto.tsx`

Nessun test nuovo: la logica è tutta in `aree.ts` (Task 1), qui c'è solo cablaggio (CLAUDE.md).

**Interfaces:**
- Consumes: `areaAggiunta`, `areaRidimensionata`, `areeConScarto`, `areeConScritta`, `puntoScritta`, `AngoloArea` (Task 1); `rettangoloArea` (Task 2); `useGestoPuntatore`
- Produces:
  - `useAree<T extends { aree: SchemaArea[] }>(applica, aggiornaSenzaCronologia)` → `{ aggiungiArea(id: string, posizione: (s: T) => Punto): void; ridimensionaArea(id, angolo, punto, concluso): void; spostaScrittaArea(id, posizione, concluso): void; riscriviArea(id, scritta): void }`
  - `<AreeImpianto aree selezionate onPremi onSposta onRidimensiona onSpostaScritta onModifica bloccato />` con `AreeImpiantoProps` come sotto

- [ ] **Step 1: `useAree.ts`**

```ts
/**
 * Gesti propri delle aree tratteggiate: crearle, ridimensionarle dagli angoli, spostarne la sola
 * scritta, riscriverla. Lo spostamento dell'area intera NON sta qui: è uno spostamento di gruppo
 * (`spostaGruppoDa`, useSelezioneMultipla.ts), perché un'area selezionata insieme ad altro si
 * trascina insieme ad altro. Stesso schema di useTestiLiberi.ts/useMuro.ts.
 */
import { useCallback, useRef } from 'react'
import { areaAggiunta, areaRidimensionata, areeConScarto, areeConScritta, type AngoloArea } from '@/services/schemaImpianto/aree'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea } from '@/services/schemaImpianto/types'

interface StatoConAree {
  aree: SchemaArea[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

export function useAree<T extends StatoConAree>(applica: Aggiorna<T>, aggiornaSenzaCronologia: Aggiorna<T>) {
  // La posizione come funzione dello stato, per la stessa ragione di `aggiungiTesto`: va calcolata
  // sul disegno che il reducer sta per aggiornare, non su quello catturato nel render.
  const aggiungiArea = useCallback(
    (id: string, posizione: (corrente: T) => Punto) => {
      applica((s) => ({ ...s, aree: areaAggiunta(s.aree, id, posizione(s)) }))
    },
    [applica]
  )

  // Un solo riferimento per i due gesti: non possono essere in corso insieme, e il riarmo a fine
  // gesto (`concluso`) vale per entrambi. Primo evento in cronologia, gli altri no.
  const gestoAvviato = useRef(false)
  const aggiornaPerGesto = useCallback(
    (concluso: boolean) => {
      const primo = !gestoAvviato.current
      gestoAvviato.current = !concluso
      return primo ? applica : aggiornaSenzaCronologia
    },
    [applica, aggiornaSenzaCronologia]
  )

  const ridimensionaArea = useCallback(
    (id: string, angolo: AngoloArea, punto: Punto, concluso: boolean) => {
      aggiornaPerGesto(concluso)((s) => ({
        ...s,
        aree: s.aree.map((a) => (a.id === id ? areaRidimensionata(a, angolo, punto) : a)),
      }))
    },
    [aggiornaPerGesto]
  )

  const spostaScrittaArea = useCallback(
    (id: string, posizione: Punto, concluso: boolean) => {
      aggiornaPerGesto(concluso)((s) => ({ ...s, aree: areeConScarto(s.aree, id, posizione) }))
    },
    [aggiornaPerGesto]
  )

  const riscriviArea = useCallback(
    (id: string, scritta: string) => {
      applica((s) => ({ ...s, aree: areeConScritta(s.aree, id, scritta) }))
    },
    [applica]
  )

  return { aggiungiArea, ridimensionaArea, spostaScrittaArea, riscriviArea }
}
```

- [ ] **Step 2: `AreeImpianto.tsx`**

```tsx
/**
 * Le aree tratteggiate come si vedono e si maneggiano sulla tela. Il rettangolo lo disegna
 * `rettangoloArea` — la STESSA funzione del documento, come fa MuroSeparazione con `simboloMuro`.
 *
 * Si afferra SOLO dal bordo: quattro fasce trasparenti più larghe della linea. L'interno lascia
 * passare il puntatore, così dentro un'area si continuano a selezionare apparecchiature e tubi e a
 * tirare il riquadro. Il portale della viewport sta sopra i nodi, ma il tratteggio non ha
 * riempimento e non intercetta nulla: l'effetto pratico è quello di un'area disegnata sotto.
 *
 * Nessun test automatico: è un componente React (CLAUDE.md). La logica sta in aree.ts.
 */
import { useRef } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { puntoScritta, type AngoloArea } from '@/services/schemaImpianto/aree'
import { FONT, INTERLINEA_TESTO, rettangoloArea, TESTO_LIBERO } from '@/services/schemaImpianto/symbols'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea } from '@/services/schemaImpianto/types'
import { useGestoPuntatore } from './useGestoPuntatore'

/** Larghezza della fascia di presa sul bordo, in unità del disegno. */
const PRESA = 14
/** Lato delle maniglie agli angoli, in pixel a schermo: si divide per lo zoom. */
const LATO_MANIGLIA_PX = 10
const MEZZA_RIGA = (TESTO_LIBERO.dimensione * INTERLINEA_TESTO) / 2
const ANGOLI: AngoloArea[] = ['no', 'ne', 'so', 'se']

export interface AreeImpiantoProps {
  aree: SchemaArea[]
  /** Id delle aree nella selezione dell'editor. */
  selezionate: string[]
  /** Pressione sul bordo o sulla scritta: `aggiungi` è Ctrl/Cmd. */
  onPremi: (id: string, aggiungi: boolean) => void
  /** Trascinamento dal bordo: posizione desiderata dell'angolo in alto a sinistra. */
  onSposta: (id: string, posizione: Punto, concluso: boolean) => void
  onRidimensiona: (id: string, angolo: AngoloArea, punto: Punto, concluso: boolean) => void
  /** Trascinamento della sola scritta: posizione assoluta desiderata del suo primo capo. */
  onSpostaScritta: (id: string, posizione: Punto, concluso: boolean) => void
  onModifica: (id: string) => void
  /** Modo taratura: le aree si vedono ma non si toccano (vedi `MuroSeparazioneProps.bloccato`). */
  bloccato?: boolean
}

interface AreaProps extends Omit<AreeImpiantoProps, 'aree' | 'selezionate'> {
  area: SchemaArea
  selezionata: boolean
}

function Area({ area, selezionata, onPremi, onSposta, onRidimensiona, onSpostaScritta, onModifica, bloccato }: AreaProps) {
  const { screenToFlowPosition } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const bordo = useGestoPuntatore<HTMLDivElement, Punto>()
  const scritta = useGestoPuntatore<HTMLDivElement, Punto>()
  const maniglia = useGestoPuntatore<HTMLDivElement, Punto>()
  // Scostamento fra puntatore e punto afferrato, congelato al pointerdown (stessa cautela di TestoLibero).
  const scostamento = useRef({ x: 0, y: 0 })

  const puntatore = (e: React.PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY })
  const menoScostamento = (e: React.PointerEvent) => {
    const p = puntatore(e)
    return { x: p.x - scostamento.current.x, y: p.y - scostamento.current.y }
  }
  const eventiAttivi = bloccato ? 'none' : 'all'

  const premiBordo = (e: React.PointerEvent<HTMLDivElement>) => {
    onPremi(area.id, e.ctrlKey || e.metaKey)
    const p = puntatore(e)
    scostamento.current = { x: p.x - area.x, y: p.y - area.y }
    bordo.suInizio(e)
  }
  const gestoriBordo = {
    className: 'nopan',
    onPointerDown: premiBordo,
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => bordo.suMovimento(e, menoScostamento(e), (p) => onSposta(area.id, p, false)),
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => bordo.suFine(e, menoScostamento(e), (p) => onSposta(area.id, p, true)),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => bordo.suAnnullamento(e, (p) => onSposta(area.id, p, true)),
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      onModifica(area.id)
    },
  }
  const fascia = (left: number, top: number, width: number, height: number, cursor: string) => (
    <div
      {...gestoriBordo}
      style={{ position: 'absolute', left, top, width, height, cursor: bloccato ? 'default' : cursor, pointerEvents: eventiAttivi }}
    />
  )

  const { x, y, larghezza: l, altezza: h } = area
  const lato = LATO_MANIGLIA_PX / zoom
  const posScritta = puntoScritta(area)
  const contorno = selezionata
    ? `<rect x="-4" y="-4" width="${l + 8}" height="${h + 8}" fill="none" stroke="#1976d2" stroke-width="1" stroke-dasharray="4 3" />`
    : ''

  return (
    <>
      <svg
        width={l}
        height={h}
        style={{ position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: rettangoloArea(0, 0, l, h) + contorno }}
      />
      {fascia(x - PRESA / 2, y - PRESA / 2, l + PRESA, PRESA, 'move')}
      {fascia(x - PRESA / 2, y + h - PRESA / 2, l + PRESA, PRESA, 'move')}
      {fascia(x - PRESA / 2, y - PRESA / 2, PRESA, h + PRESA, 'move')}
      {fascia(x + l - PRESA / 2, y - PRESA / 2, PRESA, h + PRESA, 'move')}

      {area.scritta.trim() && (
        <div
          className="nopan"
          title={bloccato ? undefined : 'Trascina per spostare la scritta, doppio clic per cambiarla'}
          onPointerDown={(e) => {
            onPremi(area.id, e.ctrlKey || e.metaKey)
            const p = puntatore(e)
            scostamento.current = { x: p.x - posScritta.x, y: p.y - posScritta.y }
            scritta.suInizio(e)
          }}
          onPointerMove={(e) => scritta.suMovimento(e, menoScostamento(e), (p) => onSpostaScritta(area.id, p, false))}
          onPointerUp={(e) => scritta.suFine(e, menoScostamento(e), (p) => onSpostaScritta(area.id, p, true))}
          onPointerCancel={(e) => scritta.suAnnullamento(e, (p) => onSpostaScritta(area.id, p, true))}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onModifica(area.id)
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${posScritta.x}px, ${posScritta.y - MEZZA_RIGA}px)`,
            fontFamily: FONT,
            fontSize: TESTO_LIBERO.dimensione,
            lineHeight: INTERLINEA_TESTO,
            whiteSpace: 'pre',
            color: '#000',
            cursor: bloccato ? 'default' : 'move',
            pointerEvents: eventiAttivi,
            userSelect: 'none',
          }}
        >
          {area.scritta}
        </div>
      )}

      {selezionata &&
        !bloccato &&
        ANGOLI.map((angolo) => {
          const cx = angolo === 'no' || angolo === 'so' ? x : x + l
          const cy = angolo === 'no' || angolo === 'ne' ? y : y + h
          const chiudi = (p: Punto) => onRidimensiona(area.id, angolo, p, true)
          return (
            <div
              key={angolo}
              className="nopan"
              onPointerDown={maniglia.suInizio}
              onPointerMove={(e) => maniglia.suMovimento(e, puntatore(e), (p) => onRidimensiona(area.id, angolo, p, false))}
              onPointerUp={(e) => maniglia.suFine(e, puntatore(e), chiudi)}
              onPointerCancel={(e) => maniglia.suAnnullamento(e, chiudi)}
              style={{
                position: 'absolute',
                left: cx - lato / 2,
                top: cy - lato / 2,
                width: lato,
                height: lato,
                background: '#fff',
                border: `${1 / zoom}px solid #1976d2`,
                boxSizing: 'border-box',
                cursor: angolo === 'no' || angolo === 'se' ? 'nwse-resize' : 'nesw-resize',
                pointerEvents: 'all',
              }}
            />
          )
        })}
    </>
  )
}

/** Dentro `<ViewportPortal>`, come TestiLiberi: coordinate del disegno, senza conversioni. */
export function AreeImpianto({ aree, selezionate, ...resto }: AreeImpiantoProps) {
  return (
    <>
      {aree.map((area) => (
        <Area key={area.id} area={area} selezionata={selezionate.includes(area.id)} {...resto} />
      ))}
    </>
  )
}
```

Verifica prima di scrivere: `FONT` e `INTERLINEA_TESTO` devono essere esportati da `@/services/schemaImpianto/symbols` (li usa già `TestiLiberi.tsx`: copia il suo import se il percorso è diverso).

- [ ] **Step 3: Tipi e lint**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: puliti. Il componente non è ancora montato: si prova nel Task 9.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/useAree.ts src/components/schemaImpianto/AreeImpianto.tsx
git commit -m "feat(schema): aree tratteggiate sulla tela, con maniglie e scritta spostabile"
```

---

### Task 9: Cablaggio nell'editor — selezione multipla, riquadro, gruppo, Canc, aree

**Files:**
- Modify: `src/components/schemaImpianto/TestiLiberi.tsx`
- Modify: `src/components/schemaImpianto/MuroSeparazione.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`

**Interfaces:**
- Consumes: tutto dai Task 1-8.
- Produces: `TestiLiberiProps.selezionati: string[]`, `TestiLiberiProps.onSeleziona: (id: string, aggiungi: boolean) => void`; `MuroSeparazioneProps.onSeleziona: (aggiungi: boolean) => void`.

- [ ] **Step 1: `TestiLiberi.tsx`**

1. In `TestiLiberiProps`: sostituisci `selezionato: string | null` con

```ts
  /** Gli id delle annotazioni nella selezione dell'editor (Canc le cancella, si trascinano insieme). */
  selezionati: string[]
```

   e `onSeleziona: (id: string) => void` con

```ts
  /** Pressione su un'annotazione: `aggiungi` è Ctrl/Cmd (vedi `premiLibero`, useSelezioneMultipla.ts). */
  onSeleziona: (id: string, aggiungi: boolean) => void
```

2. `TestoLiberoProps` (l'interfaccia della singola annotazione, sopra `TestoLibero`): `onSeleziona: (id: string, aggiungi: boolean) => void`; `selezionato: boolean` resta.
3. In `suPointerDown` di `TestoLibero`: `onSeleziona(testo.id)` → `onSeleziona(testo.id, e.ctrlKey || e.metaKey)`.
4. In `TestiLiberi`: destruttura `selezionati` al posto di `selezionato` e passa `selezionato={selezionati.includes(testo.id)}`.

- [ ] **Step 2: `MuroSeparazione.tsx`**

`onSeleziona: () => void` → `onSeleziona: (aggiungi: boolean) => void` (commento: «`aggiungi` è Ctrl/Cmd: il muro entra nella selezione multipla, ma non nel riquadro né nello spostamento di gruppo.»), e in `suPointerDown` `onSeleziona()` → `onSeleziona(e.ctrlKey || e.metaKey)`.

- [ ] **Step 3: `SchemaEditor.tsx` — import e rimozioni**

1. Import nuovi:

```ts
import { idAreaLibero } from '@/services/schemaImpianto/aree'
import { puntoSuTratto } from '@/services/schemaImpianto/tratti'
import type { FrecciaPosata } from '@/services/schemaImpianto/selezione'
import { AreeImpianto } from './AreeImpianto'
import { polilineaDellArco } from './conversioneFlow'
import { useAree } from './useAree'
import { useSelezioneMultipla, type PressioneSullaTela } from './useSelezioneMultipla'
```

   (unisci agli import esistenti dagli stessi moduli invece di duplicarli; aggiungi `useReactFlow` all'import da `@xyflow/react`).
2. **Elimina**: il tipo `SelezioneLibera` (riga ~157), lo `useState<SelezioneLibera>` e il suo commento (riga ~296-300), `deselezionaReactFlow`, `selezionaLibero`, l'effetto «La selezione libera può restare stantia», `eliminaSelezione` e `sposta` (righe ~986-1080). Tutti e sei li sostituisce l'hook.

- [ ] **Step 4: `SchemaEditor.tsx` — gli hook**

Subito dopo la riga `const { aggiungiMuro, spostaMuro, rimuoviMuro } = useMuro<StatoEditor>(…)`:

```ts
  // La selezione multipla (testi, aree, frecce, muro accanto a quella di react-flow) e i gesti di
  // gruppo: logica in un hook suo (useSelezioneMultipla.ts). Sta QUI, prima di `edgesConGomiti`,
  // perché le frecce selezionate viaggiano nei dati degli archi.
  const {
    libere,
    impostaLibere,
    svuotaLibere,
    deselezionaReactFlow,
    premiLibero,
    clicSuReactFlow,
    spostaGruppoDa,
    iniziaTrascinamentoNodi,
    seguiTrascinamentoNodi,
    concludiTrascinamentoNodi,
    spostaConTastiera,
    eliminaSelezione,
    iniziaRiquadro,
    concludiRiquadro,
  } = useSelezioneMultipla<StatoEditor>(stato, applica, aggiornaSenzaCronologia)

  // Aree tratteggiate: creazione, angoli, scritta (useAree.ts). Lo spostamento intero è di gruppo.
  const { aggiungiArea, ridimensionaArea, spostaScrittaArea, riscriviArea } = useAree<StatoEditor>(applica, aggiornaSenzaCronologia)

  // Cosa era selezionato in react-flow quando il puntatore è sceso sulla tela: vedi `PressioneSullaTela`.
  const pressione = useRef<PressioneSullaTela | null>(null)

  const frecceSelezionate = useMemo(() => {
    const perArco = new Map<string, string[]>()
    for (const e of libere) if (e.tipo === 'freccia') perArco.set(e.arco, [...(perArco.get(e.arco) ?? []), e.segno])
    return perArco
  }, [libere])

  const premiFreccia = useCallback(
    (arco: string, segno: string, aggiungi: boolean) => premiLibero({ tipo: 'freccia', arco, segno }, aggiungi),
    [premiLibero]
  )
```

- [ ] **Step 5: `SchemaEditor.tsx` — archi, trascinamenti, clic, riquadro**

1. `edgesConGomiti`: aggiungi l'ultimo argomento `{ selezionate: frecceSelezionate, onSeleziona: premiFreccia }` a `fondiDatiArchi(...)` e `frecceSelezionate, premiFreccia` alle dipendenze.
2. Sostituisci i tre gestori composti del trascinamento:

```ts
  const suInizioTrascinamentoNodo = useCallback(
    (_evento: MouseEvent | TouchEvent, nodo: Node) => {
      iniziaTrascinamentoTee(nodo)
      iniziaTrascinamentoNodi(nodo, pressione.current)
    },
    [iniziaTrascinamentoTee, iniziaTrascinamentoNodi]
  )
  const suTrascinamentoNodo = useCallback(
    (evento: MouseEvent | TouchEvent, nodo: Node, nodi: Node[]) => {
      onNodeDrag(evento, nodo, nodi)
      seguiTrascinamentoTee(nodo, nodi)
      seguiTrascinamentoNodi(nodo)
    },
    [onNodeDrag, seguiTrascinamentoTee, seguiTrascinamentoNodi]
  )
  const suFineTrascinamentoNodo = useCallback(
    (_evento: MouseEvent | TouchEvent, nodo: Node, nodi: Node[]) => {
      onNodeDragStop()
      concludiTrascinamentoTee(nodo, nodi)
      concludiTrascinamentoNodi(nodo)
    },
    [onNodeDragStop, concludiTrascinamentoTee, concludiTrascinamentoNodi]
  )
```

3. `onSelectionChange` non svuota più la selezione libera (lo fanno clic, trascinamento e riquadro, che sanno se Ctrl era premuto e se l'oggetto era già nel gruppo):

```ts
  const onSelectionChange = useCallback((s: { nodes: Node[]; edges: Edge[] }) => {
    setSelezione(s)
  }, [])
```

4. Dopo `onSelectionChange`, aggiungi:

```ts
  const { screenToFlowPosition } = useReactFlow()

  /** Le frecce di direzione con il punto in cui la tela le disegna, per il riquadro. */
  const frecceSullaTela = useCallback(
    (): FrecciaPosata[] =>
      edgesConGomiti.flatMap((e) => {
        const data = e.data as SchemaEdgeData
        if (!data.capi) return []
        const polilinea = polilineaDellArco(data.capi, data)
        return (data.segni ?? [])
          .filter((g) => g.tipo === 'freccia_direzione')
          .map((g) => ({ arco: e.id, segno: g.id, punto: puntoSuTratto(polilinea, g.t).punto }))
      }),
    [edgesConGomiti]
  )

  const aggiungiAreaDallaBarra = useCallback(() => {
    const id = idAreaLibero(stato.aree)
    aggiungiArea(id, (s) => sopraIlBordoSinistro(s.nodes, s.testi, libreriaEffettiva))
    deselezionaReactFlow()
    impostaLibere([{ tipo: 'area', id }])
  }, [aggiungiArea, deselezionaReactFlow, impostaLibere, libreriaEffettiva, stato.aree])

  const apriArea = useCallback(
    (id: string) => {
      const area = stato.aree.find((a) => a.id === id)
      if (area) setScrittura({ bersaglio: 'area', id, valore: area.scritta })
    },
    [stato.aree]
  )
```

- [ ] **Step 6: `SchemaEditor.tsx` — tastiera**

Nel gestore `suTasto`:

1. Ramo Escape, fuori taratura: `deselezionaReactFlow(); setSelezioneLibera(null)` → `deselezionaReactFlow(); svuotaLibere()`.
2. Sostituisci il blocco `if ((e.key === 'Delete' || e.key === 'Backspace') && selezioneLibera) { … }` con:

```ts
      // Canc passa SOLO da qui, anche per nodi e archi: `deleteKeyCode={null}` su `<ReactFlow>`.
      // Con due strade (react-flow e questo listener) una selezione mista finiva in due voci di
      // cronologia, e Ctrl+Z ne annullava metà.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        eliminaSelezione()
        return
      }
```

3. Sostituisci il blocco delle frecce:

```ts
      const passo = PASSI[e.key]
      const qualcosaDaSpostare =
        selezione.nodes.length > 0 || libere.some((l) => l.tipo === 'testo' || l.tipo === 'area')
      if (passo && qualcosaDaSpostare) {
        e.preventDefault()
        const fattore = e.shiftKey ? PASSO_GRIGLIA * 5 : PASSO_GRIGLIA
        spostaConTastiera(passo[0] * fattore, passo[1] * fattore, e.repeat)
      }
```

4. Dipendenze dell'effetto: togli `rimuoviMuro`, `rimuoviTesto`, `selezioneLibera`, `sposta`; aggiungi `eliminaSelezione`, `libere`, `spostaConTastiera`, `svuotaLibere`. (Se `rimuoviMuro`/`rimuoviTesto` restano usati altrove, restano importati dagli hook; altrimenti togli la destrutturazione inutilizzata per il lint.)

- [ ] **Step 7: `SchemaEditor.tsx` — barra, tela, dialogo**

1. Pulsante «Elimina»: `onClick={eliminaSelezione}` e
   `disabled={(selezione.nodes.length === 0 && selezione.edges.length === 0 && libere.length === 0) || modoTaratura}`.
2. Dopo il pulsante «Muro», aggiungi:

```tsx
        <Tooltip title="Un rettangolo tratteggiato per delimitare un'area dell'impianto: si trascina dal bordo, si ridimensiona dagli angoli, doppio clic sulla scritta (o sul bordo) per cambiarla">
          <span>
            <Button size="small" startIcon={<AddIcon />} onClick={aggiungiAreaDallaBarra} disabled={modoTaratura}>
              Area
            </Button>
          </span>
        </Tooltip>
```

3. Sul `<Box>` che contiene `<ReactFlow>` aggiungi:

```tsx
        // Prima di react-flow (fase di cattura sul contenitore): cosa era selezionato e se Ctrl era
        // premuto, per decidere dopo se un nodo afferrato faceva parte del gruppo.
        onPointerDownCapture={(e) => {
          pressione.current = {
            nodi: new Set(stato.nodes.filter((n) => n.selected).map((n) => n.id)),
            archi: new Set(stato.edges.filter((a) => a.selected).map((a) => a.id)),
            aggiungi: e.ctrlKey || e.metaKey,
          }
        }}
```

4. Su `<ReactFlow>`:
   - `onPaneClick={() => setSelezioneLibera(null)}` → `onPaneClick={svuotaLibere}`
   - aggiungi `onNodeClick={(_, nodo) => clicSuReactFlow(nodo.id, 'nodo', pressione.current)}`
   - aggiungi `onEdgeClick={(_, arco) => clicSuReactFlow(arco.id, 'arco', pressione.current)}`
   - aggiungi `onSelectionStart={(e) => iniziaRiquadro(screenToFlowPosition({ x: e.clientX, y: e.clientY }))}`
   - aggiungi `onSelectionEnd={(e) => concludiRiquadro(screenToFlowPosition({ x: e.clientX, y: e.clientY }), frecceSullaTela())}`
   - `deleteKeyCode={modoTaratura ? null : ['Delete', 'Backspace']}` → `deleteKeyCode={null}` e riscrivi il commento sopra:
     «Sempre `null`: il Canc lo gestisce solo l'editor (`eliminaSelezione`, useSelezioneMultipla.ts), per nodi, archi e annotazioni insieme, in una voce di cronologia. In modo taratura il listener esce prima (ramo `modoTaratura`), quindi il pericolo di cancellare l'apparecchiatura credendo di togliere un'ancora resta chiuso.»
5. Nel `<ViewportPortal>`, **prima** di `<GuideAllineamento …>`:

```tsx
            <AreeImpianto
              aree={stato.aree}
              selezionate={libere.flatMap((l) => (l.tipo === 'area' ? [l.id] : []))}
              onPremi={(id, aggiungi) => premiLibero({ tipo: 'area', id }, aggiungi)}
              onSposta={(id, posizione, concluso) => spostaGruppoDa({ tipo: 'area', id }, posizione, concluso)}
              onRidimensiona={ridimensionaArea}
              onSpostaScritta={spostaScrittaArea}
              onModifica={apriArea}
              bloccato={modoTaratura}
            />
```

6. `<TestiLiberi>`: `onSposta={spostaTesto}` → `onSposta={(id, posizione, concluso) => spostaGruppoDa({ tipo: 'testo', id }, posizione, concluso)}`;
   `selezionato={…}` → `selezionati={libere.flatMap((l) => (l.tipo === 'testo' ? [l.id] : []))}`;
   `onSeleziona={(id) => selezionaLibero({ tipo: 'testo', id })}` → `onSeleziona={(id, aggiungi) => premiLibero({ tipo: 'testo', id }, aggiungi)}`.
   Se `spostaTesto` non è più usato, toglilo dalla destrutturazione di `useTestiLiberi`.
7. `<MuroSeparazione>`: `selezionato={libere.some((l) => l.tipo === 'muro')}` e `onSeleziona={(aggiungi) => premiLibero({ tipo: 'muro' }, aggiungi)}`.
8. Dialogo di scrittura:
   - tipo di `scrittura.bersaglio`: `'terminale' | 'testo' | 'apparecchiatura' | 'area'`;
   - `const scritturaConfermabile = (scrittaValida || scrittura?.bersaglio === 'area') && rifiutoCodice === null` con il commento «Un'area può restare senza scritta: il rettangolo si vede e si riafferra comunque dal bordo.»;
   - `dizioneConferma`: il ramo `apparecchiatura` diventa `scrittura.bersaglio === 'apparecchiatura' || scrittura.bersaglio === 'area'` → `'Salva'`;
   - in `confermaScrittura`, **prima** di `if (!contenuto) return`:

```ts
    if (bersaglio === 'area') {
      if (id !== null) riscriviArea(id, contenuto)
      return
    }
```

     e aggiungi `riscriviArea` alle dipendenze;
   - `DialogTitle`: aggiungi il caso `scrittura?.bersaglio === 'area' ? "Scritta dell'area"` in testa alla catena;
   - `helperText` del campo: caso `area` → `'Per esempio «SALA COMPRESSORI». Può restare vuota. Invio va a capo, Ctrl+Invio conferma.'`.

- [ ] **Step 8: Tipi, lint, test**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run src/components/schemaImpianto src/services/schemaImpianto`
Expected: tutto verde.

- [ ] **Step 9: Prova in pagina (mouse vero)**

Avvia il dev server del worktree con `preview_start` (crea `.claude/launch.json` se manca, porta diversa da 5173 — vedi memoria «Dev server: porte e orfani»), accedi, apri una pratica DM329 con schema (ORVED o LOWA R&D), finestra SC. **Non salvare** sulla pratica cliente: esci con «Annulla modifiche». Verifica e annota l'esito di ciascun punto:

1. «Area» crea un rettangolo selezionato con maniglie; trascinato dal bordo si sposta; gli angoli ridimensionano; non va sotto 0.
2. La scritta si trascina da sola; spostando il bordo la scritta segue; doppio clic apre «Scritta dell'area»; svuotata e salvata, il rettangolo resta.
3. Clic dentro l'area su un'apparecchiatura la seleziona (l'interno non blocca).
4. Shift + trascinamento che racchiude un compressore, un testo, un'area e una freccia: tutti evidenziati.
5. Trascinando il compressore del gruppo si spostano anche testo e area; **un** Ctrl+Z riporta tutto.
6. Trascinando il testo del gruppo si sposta anche il compressore; un Ctrl+Z riporta tutto.
7. Ctrl + clic aggiunge/toglie testo, area, freccia, muro e nodo; clic senza Ctrl su un nodo esterno riparte da lui solo.
8. Frecce della tastiera spostano il gruppo misto; Canc lo elimina tutto; **un** Ctrl+Z lo riporta tutto.
9. Escape svuota; modo taratura: aree e testi inerti, Canc non tocca nulla dell'impianto.
10. Anteprima: l'area compare dietro al disegno; le linee dei tubi non si spostano quando l'area si allunga in basso.

Se un punto fallisce, correggi seguendo superpowers:systematic-debugging prima di proseguire.

- [ ] **Step 10: Commit**

```bash
git add src/components/schemaImpianto/TestiLiberi.tsx src/components/schemaImpianto/MuroSeparazione.tsx src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): selezione multipla, riquadro e gesti di gruppo nell'editor; pulsante Area"
```

---

### Task 10: Copia-incolla nell'editor

**Files:**
- Create: `src/components/schemaImpianto/useAppunti.ts`
- Test: `src/components/schemaImpianto/__tests__/useAppunti.test.ts`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (hook e tasti)

**Interfaces:**
- Consumes: `appuntoDa`, `incollaAppunto`, `esitoVuoto`, `Appunto`, `EsitoIncolla` (Task 5); `StatoSelezionabile`, `ElementoLibero` (Task 4/7); `TIPO_NODO_FLOW`; `SchemaNodeData`, `SchemaEdgeData`
- Produces:
  - `sorgenteDaStato(s: StatoSelezionabile, libere: ElementoLibero[]): Appunto`
  - `statoConIncollato<T extends StatoSelezionabile>(s: T, esito: EsitoIncolla, arcoBersaglio: string | null, libreria: Tarature): T`
  - `selezioneIncollata(esito: EsitoIncolla, arcoBersaglio: string | null): ElementoLibero[]`
  - `useAppunti<T extends StatoSelezionabile>(stato: T, applica: Aggiorna<T>, libere: ElementoLibero[], impostaLibere: (l: ElementoLibero[]) => void, libreria: Tarature)` → `{ copia(): void; incolla(): void }`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { selezioneIncollata, sorgenteDaStato, statoConIncollato } from '../useAppunti'
import type { StatoSelezionabile } from '../useSelezioneMultipla'
import { TIPO_NODO_FLOW } from '../conversioneFlow'

const nodoDati = (id: string, tipo: string) => ({
  id, tipo, etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'scheda',
})

function stato(): StatoSelezionabile {
  return {
    nodes: [
      { id: 'UTENZE', position: { x: 800, y: 60 }, data: { nodo: nodoDati('UTENZE', 'utenze') }, selected: true },
      { id: 'C1', position: { x: 40, y: 40 }, data: { nodo: nodoDati('C1', 'compressore') }, selected: true },
    ] as Node[],
    edges: [
      { id: 'e1', source: 'C1', target: 'UTENZE', selected: true, data: { stile: 'standard', segni: [{ id: 'f1', tipo: 'freccia_direzione', t: 0.4 }] } },
    ] as Edge[],
    testi: [{ id: 'T1', x: 10, y: 10, contenuto: 'a' }],
    aree: [],
    muroX: null,
  }
}

describe('sorgenteDaStato', () => {
  it('prende i nodi selezionati con la loro posizione, e testi/aree/frecce dalla selezione libera', () => {
    const s = sorgenteDaStato(stato(), [{ tipo: 'testo', id: 'T1' }, { tipo: 'freccia', arco: 'e1', segno: 'f1' }])
    expect(s.nodi.map((n) => [n.id, n.x, n.y])).toEqual([['UTENZE', 800, 60], ['C1', 40, 40]])
    expect(s.testi.map((t) => t.id)).toEqual(['T1'])
    expect(s.frecce.map((f) => f.id)).toEqual(['f1'])
  })
})

describe('statoConIncollato', () => {
  const esito = {
    nodi: [{ ...nodoDati('M-U1', 'utenze'), origine: 'manuale' as const, x: 820, y: 80 }] as never[],
    testi: [{ id: 'T2', x: 30, y: 30, contenuto: 'a' }],
    aree: [],
    frecce: [{ id: 'freccia-1', tipo: 'freccia_direzione' as const, t: 0.5 }],
    frecceSaltate: false,
  }

  it('aggiunge i nodi selezionati, deseleziona il resto e mette le frecce sul tubo bersaglio', () => {
    const libreria = {}
    const dopo = statoConIncollato(stato(), esito, 'e1', libreria)
    const nuovo = dopo.nodes.find((n) => n.id === 'M-U1')!
    expect(nuovo).toMatchObject({ type: TIPO_NODO_FLOW, position: { x: 820, y: 80 }, selected: true })
    expect((nuovo.data as { libreria: unknown }).libreria).toBe(libreria)
    expect(dopo.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['M-U1'])
    expect(dopo.edges.every((e) => !e.selected)).toBe(true)
    expect((dopo.edges[0].data as { segni: { id: string }[] }).segni.map((g) => g.id)).toEqual(['f1', 'freccia-1'])
    expect(dopo.testi.map((t) => t.id)).toEqual(['T1', 'T2'])
  })

  it('selezioneIncollata elenca testi, aree e frecce incollati', () => {
    expect(selezioneIncollata(esito, 'e1')).toEqual([
      { tipo: 'testo', id: 'T2' },
      { tipo: 'freccia', arco: 'e1', segno: 'freccia-1' },
    ])
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useAppunti.test.ts`
Expected: FAIL, modulo mancante.

- [ ] **Step 3: Implementa `useAppunti.ts`**

```ts
/**
 * Ctrl+C / Ctrl+V dell'editor: il ponte fra lo stato di react-flow e le funzioni pure di
 * `appunti.ts`. L'appunto vive in un ref, non nello stato: non si disegna e non va in cronologia.
 */
import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { appuntoDa, esitoVuoto, incollaAppunto, type Appunto, type EsitoIncolla } from '@/services/schemaImpianto/appunti'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { ElementoLibero } from '@/services/schemaImpianto/selezione'
import { TIPO_NODO_FLOW } from './conversioneFlow'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'
import type { StatoSelezionabile } from './useSelezioneMultipla'

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

export function sorgenteDaStato(s: StatoSelezionabile, libere: ElementoLibero[]): Appunto {
  const chiavi = new Set(libere.map((e) => (e.tipo === 'freccia' ? `${e.arco}/${e.segno}` : e.tipo === 'muro' ? 'muro' : `${e.tipo}:${e.id}`)))
  return {
    nodi: s.nodes.filter((n) => n.selected).map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y })),
    testi: s.testi.filter((t) => chiavi.has(`testo:${t.id}`)),
    aree: s.aree.filter((a) => chiavi.has(`area:${a.id}`)),
    frecce: s.edges.flatMap((e) => ((e.data as SchemaEdgeData).segni ?? []).filter((g) => chiavi.has(`${e.id}/${g.id}`))),
  }
}

/**
 * Lo stato dopo l'incolla. Tutto ciò che c'era esce dalla selezione, archi compresi: il tubo
 * bersaglio resta NON selezionato, o il Canc subito dopo un incolla — per togliere ciò che si è
 * appena incollato — si porterebbe via anche il tubo.
 */
export function statoConIncollato<T extends StatoSelezionabile>(s: T, esito: EsitoIncolla, arcoBersaglio: string | null, libreria: Tarature): T {
  return {
    ...s,
    nodes: [
      ...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...esito.nodi.map(({ x, y, ...nodo }) => ({
        id: nodo.id,
        type: TIPO_NODO_FLOW,
        position: { x, y },
        selected: true,
        data: { nodo, libreria } satisfies SchemaNodeData,
      })),
    ],
    edges: s.edges.map((e) => {
      const deselezionato = e.selected ? { ...e, selected: false } : e
      if (e.id !== arcoBersaglio || esito.frecce.length === 0) return deselezionato
      const data = e.data as SchemaEdgeData
      return { ...deselezionato, data: { ...data, segni: [...(data.segni ?? []), ...esito.frecce] } satisfies SchemaEdgeData }
    }),
    testi: [...s.testi, ...esito.testi],
    aree: [...s.aree, ...esito.aree],
  }
}

export function selezioneIncollata(esito: EsitoIncolla, arcoBersaglio: string | null): ElementoLibero[] {
  return [
    ...esito.testi.map((t): ElementoLibero => ({ tipo: 'testo', id: t.id })),
    ...esito.aree.map((a): ElementoLibero => ({ tipo: 'area', id: a.id })),
    ...(arcoBersaglio ? esito.frecce.map((f): ElementoLibero => ({ tipo: 'freccia', arco: arcoBersaglio, segno: f.id })) : []),
  ]
}

export function useAppunti<T extends StatoSelezionabile>(
  stato: T,
  applica: Aggiorna<T>,
  libere: ElementoLibero[],
  impostaLibere: (libere: ElementoLibero[]) => void,
  libreria: Tarature
) {
  const appunto = useRef<Appunto | null>(null)
  const ripetizione = useRef(0)
  const statoRef = useRef(stato)
  statoRef.current = stato
  const libereRef = useRef(libere)
  libereRef.current = libere

  const copia = useCallback(() => {
    const nuovo = appuntoDa(sorgenteDaStato(statoRef.current, libereRef.current))
    // Niente di copiabile (solo apparecchiature o tubi): l'appunto di prima resta com'era.
    if (!nuovo) return
    appunto.current = nuovo
    ripetizione.current = 0
  }, [])

  const incolla = useCallback(() => {
    const a = appunto.current
    if (!a) return
    const s = statoRef.current
    const archiSelezionati = s.edges.filter((e) => e.selected)
    const bersaglio = archiSelezionati.length === 1 ? archiSelezionati[0] : null
    ripetizione.current += 1
    const esito = incollaAppunto(
      a,
      {
        idNodi: new Set(s.nodes.map((n) => n.id)),
        idTesti: new Set(s.testi.map((t) => t.id)),
        idAree: new Set(s.aree.map((x) => x.id)),
        segniBersaglio: bersaglio ? ((bersaglio.data as SchemaEdgeData).segni ?? []) : null,
      },
      ripetizione.current
    )
    if (esito.frecceSaltate) toast('Per incollare le frecce di direzione seleziona prima un solo tubo.')
    if (esitoVuoto(esito)) return
    const idBersaglio = bersaglio?.id ?? null
    applica((corrente) => statoConIncollato(corrente, esito, idBersaglio, libreria))
    impostaLibere(selezioneIncollata(esito, idBersaglio))
  }, [applica, impostaLibere, libreria])

  return { copia, incolla }
}
```

- [ ] **Step 4: Esegui**

Run: `npx vitest run src/components/schemaImpianto/__tests__/useAppunti.test.ts`
Expected: PASS.

- [ ] **Step 5: Cabla nell'editor**

In `SchemaEditor.tsx`:

1. `import { useAppunti } from './useAppunti'`.
2. Subito dopo `useSelezioneMultipla(...)`:

```ts
  // Ctrl+C / Ctrl+V: utenze, TEE, testi, aree e frecce (useAppunti.ts, appunti.ts).
  const { copia, incolla } = useAppunti<StatoEditor>(stato, applica, libere, impostaLibere, libreriaEffettiva)
```

   Se `libreriaEffettiva` è dichiarata più in basso di questa riga, sposta la chiamata subito dopo la sua dichiarazione.
3. In `suTasto`, **dopo** il blocco `if (modoTaratura) { … return }` e prima del ramo Canc:

```ts
      // Copia e incolla dell'impianto. Dopo il ramo della taratura, che esce prima: lì restano quelli
      // del browser. Il dialogo di scrittura ferma già i suoi tasti, quindi dentro un campo di testo
      // Ctrl+C/Ctrl+V copiano il testo come sempre. Un testo selezionato altrove nella pagina (una
      // riga della barra) si lascia copiare al browser.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (window.getSelection()?.toString()) return
        e.preventDefault()
        copia()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        incolla()
        return
      }
```

   e aggiungi `copia, incolla` alle dipendenze dell'effetto.
4. Nel `title` del pulsante «Area» e del pulsante «Testo» non serve altro; aggiungi invece al tooltip di «Elimina» (se non ha un tooltip, avvolgilo come gli altri pulsanti) il testo: «Elimina la selezione (Canc). Shift + trascinamento per selezionare a riquadro, Ctrl + clic per aggiungere, Ctrl+C / Ctrl+V per copiare utenze, TEE, testi, aree e frecce.»

- [ ] **Step 6: Tipi, lint, suite**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`
Expected: tutto verde (la suite completa; con `.env.local` presente `sorgente.test.ts` carica).

- [ ] **Step 7: Prova in pagina (mouse vero)**

Stessa pratica e stesse cautele del Task 9 (nessun salvataggio sulla pratica cliente). Verifica:

1. Seleziona il terminale utenze + un TEE → Ctrl+C → Ctrl+V: compaiono `M-U…` e `M-G…` spostati di 20, scollegati, selezionati; un secondo Ctrl+V li mette 20 più in là; **un** Ctrl+Z toglie un incolla intero.
2. Doppio clic sull'utenza copiata apre «Scritta del terminale» con la scritta originale.
3. Testo e area copiati e incollati: id nuovi, stessa scritta.
4. Copia una freccia, seleziona un altro tubo, Ctrl+V: la freccia compare a metà del tubo, selezionata; senza tubo selezionato compare l'avviso e il resto si incolla.
5. Selezione di sole apparecchiature → Ctrl+C non cambia l'appunto (Ctrl+V incolla ancora l'appunto precedente).
6. Nel dialogo di un testo, Ctrl+C/Ctrl+V lavorano sul testo del campo.
7. In modo taratura Ctrl+V non incolla nulla.
8. «Conferma schema» con un'area e un'utenza copiata, poi riapri SC **su una pratica di prova** (non ORVED/LOWA): area e copia ci sono ancora; genera la relazione e controlla l'area nel .docx. Se non esiste una pratica di prova, fermati e chiedi al committente quale usare.

- [ ] **Step 8: Commit**

```bash
git add src/components/schemaImpianto/useAppunti.ts src/components/schemaImpianto/__tests__/useAppunti.test.ts src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): copia e incolla di utenze, TEE, testi, aree e frecce nell'editor"
```

---

### Task 11: Chiusura

**Files:**
- Modify: `DOCUMENTAZIONE/fixes.md` (solo dopo deploy verificato, vedi memoria «fixes.md, il quaderno dei fix»)
- Modify: questo piano (paragrafo «Cosa è andato diversamente» in coda)

- [ ] **Step 1: Verifica finale completa**

Run: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npx vite build`
Expected: tutto verde; annota il numero di test.

- [ ] **Step 2: Paragrafo «Cosa è andato diversamente»**

In coda a questo file, elenca ogni scostamento dal piano con il perché (API di React Flow diverse dal previsto, difetti trovati solo in pagina, correzioni di test).

- [ ] **Step 3: Commit della documentazione e consegna al committente**

```bash
git add docs/superpowers/plans/2026-09-17-schema-impianto-selezione-copia-aree.md
git commit -m "docs: esito del piano selezione, copia-incolla e aree dello schema"
```

Poi usa superpowers:finishing-a-development-branch. **Nessun push su `main` senza l'ok esplicito del committente** (il push su `main` va in produzione). Prima del merge: `git fetch` e `git merge-tree` contro `origin/main` (memorie «Worktree paralleli e push in produzione», «Conflitto RelazioneDataDialog»). `fixes.md` si aggiorna solo a deploy READY verificato.
