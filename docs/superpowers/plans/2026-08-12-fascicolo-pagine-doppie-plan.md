# Fascicolo: separazione pagine doppie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riconoscere le pagine A4 orizzontali del fascicolo apparecchiatura che in realtà
contengono due pagine verticali affiancate (tipiche di certi certificati sorgente, es. SICC)
e separarle in due pagine verticali distinte prima della composizione finale.

**Architecture:** Un modulo puro (`paginaDoppia.ts`) riconosce la forma e calcola i ritagli;
un modulo DOM (`dividiPagineDoppie.ts`) rasterizza la pagina doppia (riusando `rasterizzaPdf`
già esistente), la ritaglia e ruota via canvas, e ricostruisce il PDF sorgente con le pagine
separate al posto di quella doppia. Un wrapper in `fascicolo/componiPdf.ts` applica questo
passaggio prima di delegare al motore generico di composizione (`pdfCompose/componiPdf.ts`),
che resta completamente invariato.

**Tech Stack:** TypeScript, `pdf-lib` (manipolazione PDF), Canvas 2D + `createImageBitmap`
(ritaglio/rotazione raster), `pdfjs` indirettamente via `rasterizzaPdf` già esistente, Vitest
+ jsdom per i test.

## Global Constraints

- Tolleranza di rilevamento pagina doppia: ±8% attorno al rapporto ISO √2 (spec, confermato
  con l'utente in brainstorming — non 4% come nella prima bozza).
- Rasterizzazione della pagina doppia prima del ritaglio: 200 dpi, qualità JPEG 0.9.
- Ricompressione JPEG di ciascuna metà dopo ritaglio e rotazione: qualità 0.92.
- Ordine delle due metà in output: sinistra, poi destra (assunzione da spec, da confermare
  sui file reali nel Task 5).
- Verso di rotazione: costante singola e isolata (`GRADI_ROTAZIONE`), valore di partenza
  `-90`, da confermare/correggere sui file reali nel Task 5 — non dedurlo altrove nel codice.
- Il motore generico `src/services/pdfCompose/componiPdf.ts` non va modificato in nessun task.
- jsdom in questo repo non ha un contesto canvas 2D reale (nessun pacchetto `canvas` o mock
  installato): qualunque codice che chiama `canvas.getContext('2d')` non è testabile con
  Vitest, solo a mano nel browser vero — stesso limite già accettato per
  `src/services/pdfCompose/raster.ts`.

---

## File Structure

- **Create** `src/services/fascicolo/paginaDoppia.ts` — riconoscimento puro (nessuna
  dipendenza DOM), testabile in Node.
- **Create** `src/services/fascicolo/__tests__/paginaDoppia.test.ts`
- **Create** `src/services/fascicolo/dividiPagineDoppie.ts` — orchestrazione: apre il PDF,
  trova le pagine doppie, le rasterizza/ritaglia/ruota (canvas), ricostruisce il file.
- **Create** `src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts` — solo il percorso
  senza pagine doppie (l'unico eseguibile senza canvas reale).
- **Modify** `src/services/fascicolo/componiPdf.ts` — da re-export puro a wrapper che separa
  le pagine doppie prima di comporre.
- **Modify** `src/services/fascicolo/__tests__/componiPdf.test.ts` — aggiunge un test sul
  nuovo campo `pagineSeparate`.
- **Modify** `src/components/technicalSheet/fascicolo/FascicoloSection.tsx` — mostra
  `pagineSeparate` nell'Alert di riepilogo (nessun test: il progetto non copre la UI con
  Vitest, per convenzione già in uso in questo file per `ridotti`/`scartati`).

---

### Task 1: Riconoscimento pagina doppia — modulo puro

**Files:**
- Create: `src/services/fascicolo/paginaDoppia.ts`
- Test: `src/services/fascicolo/__tests__/paginaDoppia.test.ts`

**Interfaces:**
- Produces: `ePaginaDoppia(larghezza: number, altezza: number, tolleranza = 0.08): boolean`,
  `interface Rettaglio { sx: number; sy: number; sw: number; sh: number }`,
  `rettagliMeta(larghezza: number, altezza: number): [Rettaglio, Rettaglio]` — usati dal
  Task 2.

- [ ] **Step 1: Scrivi i test (falliranno finché il modulo non esiste)**

```ts
// src/services/fascicolo/__tests__/paginaDoppia.test.ts
import { describe, test, expect } from 'vitest'
import { ePaginaDoppia, rettagliMeta } from '../paginaDoppia'

describe('ePaginaDoppia', () => {
  test('riconosce due A4 verticali affiancati', () => {
    // Due A4 (595.28×841.89) affiancati in orizzontale: 1190.56×841.89.
    expect(ePaginaDoppia(1190.56, 841.89)).toBe(true)
  })

  test('riconosce il rapporto ISO esatto, a qualunque scala', () => {
    expect(ePaginaDoppia(2 * Math.SQRT2, 2)).toBe(true)
    expect(ePaginaDoppia(200 * Math.SQRT2, 200)).toBe(true)
  })

  test('accetta fino al bordo della tolleranza dell’8%, rifiuta appena oltre', () => {
    const base = Math.SQRT2
    expect(ePaginaDoppia(2, base * 1.079)).toBe(true)
    expect(ePaginaDoppia(2, base * 1.081)).toBe(false)
  })

  test('una pagina verticale non è mai doppia', () => {
    expect(ePaginaDoppia(595, 842)).toBe(false)
  })

  test('una pagina quadrata non è doppia', () => {
    expect(ePaginaDoppia(1000, 1000)).toBe(false)
  })

  test('una pagina orizzontale con proporzioni lontane da √2 non è doppia', () => {
    // Uno schema panoramico 2:1, non due pagine affiancate.
    expect(ePaginaDoppia(1000, 500)).toBe(false)
  })
})

describe('rettagliMeta', () => {
  test('divide a metà in verticale, sinistra poi destra', () => {
    const [sinistra, destra] = rettagliMeta(1190, 842)

    expect(sinistra).toEqual({ sx: 0, sy: 0, sw: 595, sh: 842 })
    expect(destra).toEqual({ sx: 595, sy: 0, sw: 595, sh: 842 })
  })

  test('gestisce larghezze dispari senza perdere pixel ai bordi', () => {
    const [sinistra, destra] = rettagliMeta(1191, 842)

    expect(sinistra.sx).toBe(0)
    expect(sinistra.sw).toBe(595.5)
    expect(destra.sx).toBe(595.5)
    expect(destra.sx + destra.sw).toBe(1191)
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/fascicolo/__tests__/paginaDoppia.test.ts`
Expected: FAIL — `Cannot find module '../paginaDoppia'` (il file non esiste ancora).

- [ ] **Step 3: Scrivi il modulo**

```ts
// src/services/fascicolo/paginaDoppia.ts
/**
 * Riconoscimento delle pagine "doppie": un foglio orizzontale che in realtà contiene due
 * pagine verticali affiancate, tipico di alcuni certificati sorgente (es. SICC).
 *
 * Puro calcolo su numeri, senza dipendenze dal DOM: la parte che tocca canvas/pdf-lib per
 * l'estrazione vera vive in `dividiPagineDoppie.ts`.
 */

/** Rapporto larghezza/altezza di un foglio ISO 216 (A4, A5, ...): √2. */
const RAPPORTO_ISO = Math.SQRT2

/**
 * Vero se una pagina larghezza×altezza è probabilmente due pagine verticali affiancate in
 * orizzontale, secondo la stessa relazione geometrica con cui la serie ISO 216 costruisce
 * ogni formato raddoppiando quello immediatamente più piccolo (A3 orizzontale = due A4
 * verticali affiancati, e così via) — funziona a qualunque scala, senza assumere dimensioni
 * assolute.
 */
export function ePaginaDoppia(larghezza: number, altezza: number, tolleranza = 0.08): boolean {
  if (larghezza <= altezza) return false
  const rapporto = altezza / (larghezza / 2)
  return Math.abs(rapporto - RAPPORTO_ISO) / RAPPORTO_ISO <= tolleranza
}

/** Ritaglio in pixel: origine e dimensioni dentro il bitmap sorgente. */
export interface Rettaglio {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Le due metà — sinistra e destra, in quest'ordine — di un bitmap larghezza×altezza già
 * riconosciuto come pagina doppia.
 */
export function rettagliMeta(larghezza: number, altezza: number): [Rettaglio, Rettaglio] {
  const meta = larghezza / 2
  return [
    { sx: 0, sy: 0, sw: meta, sh: altezza },
    { sx: meta, sy: 0, sw: larghezza - meta, sh: altezza },
  ]
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/fascicolo/__tests__/paginaDoppia.test.ts`
Expected: PASS — 8 test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/services/fascicolo/paginaDoppia.ts src/services/fascicolo/__tests__/paginaDoppia.test.ts
git commit -m "feat(fascicolo): riconosce le pagine doppie e calcola i ritagli"
```

---

### Task 2: Separazione effettiva — modulo DOM

**Files:**
- Create: `src/services/fascicolo/dividiPagineDoppie.ts`
- Test: `src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts`

**Interfaces:**
- Consumes: `ePaginaDoppia`, `rettagliMeta`, `Rettaglio` da `./paginaDoppia` (Task 1);
  `rasterizzaPdf(file: File | Blob, riduzione: { dpi: number; qualita: number }): Promise<{ bytes: Uint8Array; larghezza: number; altezza: number; tipo: 'jpeg' | 'png' }[]>`
  da `@/services/pdfCompose/raster` (già esistente).
- Produces: `interface RisultatoDivisione { file: File; pagineSeparate: number[] }`,
  `dividiPagineDoppie(file: File): Promise<RisultatoDivisione>` — usati dal Task 3.

**Nota**: solo il percorso "nessuna pagina doppia" è coperto da test automatici (vedi Global
Constraints — niente contesto canvas reale in jsdom). Il percorso di ritaglio/rotazione va
verificato a mano nel Task 5.

- [ ] **Step 1: Scrivi i test dei percorsi senza canvas (falliranno finché il modulo non esiste)**

Oltre al percorso "nessuna pagina doppia", mockando `rasterizzaPdf` si può testare anche la
gestione d'errore per-pagina (Global Constraints, spec §4) senza toccare canvas: se la
rasterizzazione di una pagina doppia fallisce, quella pagina deve restare intatta, non
sparire né far fallire l'intero file.

```ts
// src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts
import { describe, test, expect, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import * as raster from '@/services/pdfCompose/raster'
import { dividiPagineDoppie } from '../dividiPagineDoppie'

const pdfDiProva = async (pagine: [number, number][]): Promise<File> => {
  const doc = await PDFDocument.create()
  pagine.forEach(([w, h]) => { doc.addPage([w, h]) })
  const bytes = await doc.save()
  return new File([bytes.slice()], 'prova.pdf', { type: 'application/pdf' })
}

describe('dividiPagineDoppie', () => {
  test('un PDF senza pagine doppie torna invariato (stesso file, nessuna ricodifica)', async () => {
    const file = await pdfDiProva([[595, 842], [595, 842]])
    const risultato = await dividiPagineDoppie(file)

    expect(risultato.file).toBe(file)
    expect(risultato.pagineSeparate).toEqual([])
  })

  test('un file non apribile torna invariato invece di far fallire il chiamante', async () => {
    const rotto = new File([new Uint8Array([1, 2, 3])], 'rotto.pdf', { type: 'application/pdf' })
    const risultato = await dividiPagineDoppie(rotto)

    expect(risultato.file).toBe(rotto)
    expect(risultato.pagineSeparate).toEqual([])
  })

  test('se la rasterizzazione di una pagina doppia fallisce, la pagina resta intatta invece di sparire', async () => {
    const spia = vi.spyOn(raster, 'rasterizzaPdf').mockRejectedValue(new Error('rasterizzazione fallita'))
    try {
      // 1190.56×841.89: due A4 verticali affiancati, riconosciuta come doppia.
      const file = await pdfDiProva([[1190.56, 841.89]])
      const risultato = await dividiPagineDoppie(file)

      expect(risultato.pagineSeparate).toEqual([])
      const rilegato = await PDFDocument.load(await risultato.file.arrayBuffer())
      expect(rilegato.getPageCount()).toBe(1)
    } finally {
      spia.mockRestore()
    }
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts`
Expected: FAIL — `Cannot find module '../dividiPagineDoppie'`.

- [ ] **Step 3: Scrivi il modulo**

```ts
// src/services/fascicolo/dividiPagineDoppie.ts
/**
 * Separa le pagine "doppie" (due pagine verticali affiancate in orizzontale) di un PDF in
 * due pagine distinte, ciascuna ruotata e ridimensionata correttamente.
 *
 * Tocca canvas e pdfjs (attraverso `rasterizzaPdf`): non è coperta da test automatici oltre
 * al percorso "nessuna pagina doppia" — jsdom non ha un contesto 2D reale senza il pacchetto
 * `canvas`, stesso limite di `pdfCompose/raster.ts`. Il percorso di ritaglio va verificato a
 * mano generando un fascicolo vero da un file con pagine doppie.
 */
import { PDFDocument } from 'pdf-lib'
import { rasterizzaPdf } from '@/services/pdfCompose/raster'
import { ePaginaDoppia, rettagliMeta, type Rettaglio } from './paginaDoppia'

export interface RisultatoDivisione {
  file: File
  /** Indici 1-based, nel documento ORIGINALE, delle pagine separate. Vuoto se invariato. */
  pagineSeparate: number[]
}

/**
 * Verso di rotazione delle due metà, in gradi (positivo = orario nel sistema di coordinate
 * di canvas 2D, che ha l'asse y verso il basso). Punto unico da correggere se la verifica sui
 * file reali (Task 5) mostra testo capovolto: basta invertire il segno.
 */
const GRADI_ROTAZIONE = -90

/** Qualità di ricompressione JPEG di ciascuna metà dopo ritaglio e rotazione. */
const QUALITA_RITAGLIO = 0.92

const estraiPaginaSingola = async (sorgente: PDFDocument, indice: number): Promise<File> => {
  const nuovo = await PDFDocument.create()
  const [copiata] = await nuovo.copyPages(sorgente, [indice])
  nuovo.addPage(copiata)
  const bytes = await nuovo.save()
  return new File([bytes.slice()], `pagina-${indice + 1}.pdf`, { type: 'application/pdf' })
}

/** Ritaglia e ruota di 90° una metà di un bitmap già rasterizzato. */
const tagliaERuota = async (
  immagine: { bytes: Uint8Array },
  rettaglio: Rettaglio
): Promise<{ bytes: Uint8Array; larghezza: number; altezza: number }> => {
  const bitmap = await createImageBitmap(new Blob([immagine.bytes.slice()], { type: 'image/jpeg' }))

  // Ruotata di 90°: le dimensioni si scambiano.
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rettaglio.sh)
  canvas.height = Math.round(rettaglio.sw)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Il browser non ha concesso un contesto 2D per separare la pagina doppia')

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((GRADI_ROTAZIONE * Math.PI) / 180)
  ctx.drawImage(
    bitmap,
    rettaglio.sx, rettaglio.sy, rettaglio.sw, rettaglio.sh,
    -rettaglio.sw / 2, -rettaglio.sh / 2, rettaglio.sw, rettaglio.sh
  )
  bitmap.close()

  const blob: Blob = await new Promise((risolvi, rifiuta) =>
    canvas.toBlob(
      (b) => (b ? risolvi(b) : rifiuta(new Error('Conversione della metà pagina in JPEG fallita'))),
      'image/jpeg',
      QUALITA_RITAGLIO
    )
  )

  return { bytes: new Uint8Array(await blob.arrayBuffer()), larghezza: canvas.width, altezza: canvas.height }
}

export async function dividiPagineDoppie(file: File): Promise<RisultatoDivisione> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const sorgente = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const indici = sorgente.getPageIndices()

    const doppie = new Set(
      indici.filter((i) => {
        const { width, height } = sorgente.getPage(i).getSize()
        return ePaginaDoppia(width, height)
      })
    )

    if (doppie.size === 0) {
      return { file, pagineSeparate: [] }
    }

    const out = await PDFDocument.create()
    const pagineSeparate: number[] = []

    for (const i of indici) {
      if (!doppie.has(i)) {
        const [copiata] = await out.copyPages(sorgente, [i])
        out.addPage(copiata)
        continue
      }

      try {
        const paginaEstratta = await estraiPaginaSingola(sorgente, i)
        const [rasterizzata] = await rasterizzaPdf(paginaEstratta, { dpi: 200, qualita: 0.9 })
        const [sinistra, destra] = rettagliMeta(rasterizzata.larghezza, rasterizzata.altezza)

        for (const rettaglio of [sinistra, destra]) {
          const meta = await tagliaERuota(rasterizzata, rettaglio)
          const embedded = await out.embedJpg(meta.bytes)
          const paginaOut = out.addPage([meta.larghezza, meta.altezza])
          paginaOut.drawImage(embedded, { x: 0, y: 0, width: meta.larghezza, height: meta.altezza })
        }
        pagineSeparate.push(i + 1)
      } catch {
        // Non si riesce a separarla: meglio la pagina doppia intatta che nessuna pagina.
        const [copiata] = await out.copyPages(sorgente, [i])
        out.addPage(copiata)
      }
    }

    const nuoviBytes = await out.save()
    return {
      file: new File([nuoviBytes.slice()], file.name, { type: 'application/pdf' }),
      pagineSeparate,
    }
  } catch {
    return { file, pagineSeparate: [] }
  }
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts`
Expected: PASS — 3 test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/services/fascicolo/dividiPagineDoppie.ts src/services/fascicolo/__tests__/dividiPagineDoppie.test.ts
git commit -m "feat(fascicolo): separa le pagine doppie in due pagine verticali"
```

---

### Task 3: Integrazione nel wrapper del fascicolo

**Files:**
- Modify: `src/services/fascicolo/componiPdf.ts` (oggi 6 righe, re-export puro)
- Modify: `src/services/fascicolo/__tests__/componiPdf.test.ts`

**Interfaces:**
- Consumes: `dividiPagineDoppie` (Task 2); `componiFascicolo`, `EsitoComposizione`,
  `OpzioniComposizione`, `SorgenteFascicolo` da `@/services/pdfCompose/componiPdf`
  (esistenti, invariati).
- Produces: `EsitoComposizioneFascicolo` (estende `EsitoComposizione` con
  `pagineSeparate: string[]`), `componiFascicolo(sorgenti, opzioni?): Promise<EsitoComposizioneFascicolo>`
  — usati dal Task 4 e da tutti i chiamanti esistenti (stessa firma di prima, campo in più
  nel risultato).

- [ ] **Step 1: Scrivi il test (fallirà: `pagineSeparate` non esiste ancora sul risultato)**

Aggiungi al file esistente `src/services/fascicolo/__tests__/componiPdf.test.ts`, dentro il
blocco `describe('fascicolo/componiPdf (re-export)', ...)` già presente:

```ts
  test('pagineSeparate è vuoto quando nessun documento ha pagine doppie', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([595, 842])
    const file = new File([(await doc.save()).slice()], 'prova.pdf', { type: 'application/pdf' })

    const esito = await componiFascicolo([{ file, etichetta: 'prova.pdf', foto: false }])
    expect(esito.pagineSeparate).toEqual([])
  })
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/fascicolo/__tests__/componiPdf.test.ts`
Expected: FAIL — `esito.pagineSeparate` è `undefined`, non un array.

- [ ] **Step 3: Riscrivi il wrapper**

```ts
// src/services/fascicolo/componiPdf.ts
/**
 * Punto d'importazione del fascicolo: il motore di composizione vero e proprio è generico e
 * vive in `services/pdfCompose/`, condiviso anche con "dichiarazioni". Qui si aggiunge solo
 * ciò che è specifico del fascicolo apparecchiatura: la separazione delle pagine doppie prima
 * di comporre, che il motore generico non conosce e non deve conoscere.
 */
import {
  componiFascicolo as componiFascicoloBase,
  type EsitoComposizione,
  type OpzioniComposizione,
  type SorgenteFascicolo,
} from '@/services/pdfCompose/componiPdf'
import { dividiPagineDoppie } from './dividiPagineDoppie'

export * from '@/services/pdfCompose/componiPdf'

export interface EsitoComposizioneFascicolo extends EsitoComposizione {
  /** Documenti (con numero di pagina) che avevano pagine doppie, separate prima di comporre. */
  pagineSeparate: string[]
}

const eUnPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

export async function componiFascicolo(
  sorgenti: SorgenteFascicolo[],
  opzioni?: OpzioniComposizione
): Promise<EsitoComposizioneFascicolo> {
  const pagineSeparate: string[] = []

  const sorgentiDivise = await Promise.all(
    sorgenti.map(async (s) => {
      if (!eUnPdf(s.file)) return s
      const { file, pagineSeparate: pagine } = await dividiPagineDoppie(s.file)
      if (pagine.length > 0) {
        pagineSeparate.push(`${s.etichetta} (pag. ${pagine.join(', ')})`)
      }
      return { ...s, file }
    })
  )

  const esito = await componiFascicoloBase(sorgentiDivise, opzioni)
  return { ...esito, pagineSeparate }
}
```

`export * from '@/services/pdfCompose/componiPdf'` continua a esportare tutto il resto
(`A4`, `A4_ORIZZONTALE`, `LIMITE_BYTE`, `inquadraInA4`, `inquadraInFoglio`, i tipi...): la
dichiarazione locale di `componiFascicolo` prende precedenza su quella ri-esportata con lo
stesso nome, per risoluzione standard dei moduli ES — nessun conflitto, nessun errore.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/fascicolo/__tests__/componiPdf.test.ts`
Expected: PASS — tutti i test verdi, incluso quello nuovo.

- [ ] **Step 5: Esegui l'intera suite per assicurarti di non aver rotto nulla altrove**

Run: `npx vitest run`
Expected: PASS — tutti i test del repo, incluso `pdfCompose/__tests__/componiPdf.test.ts`
(motore generico, invariato) e tutti i test che usano `fascicolo/componiPdf` indirettamente.

- [ ] **Step 6: Commit**

```bash
git add src/services/fascicolo/componiPdf.ts src/services/fascicolo/__tests__/componiPdf.test.ts
git commit -m "feat(fascicolo): separa le pagine doppie prima di comporre il fascicolo"
```

---

### Task 4: Report in UI

**Files:**
- Modify: `src/components/technicalSheet/fascicolo/FascicoloSection.tsx:40-47` (interfaccia
  `Esito`), `:480-485` (Alert di riepilogo)

**Interfaces:**
- Consumes: `EsitoComposizioneFascicolo.pagineSeparate` (Task 3) — arriva già dentro
  `composto` a riga 297 (`const composto = await componiFascicolo(pagine, ...)`), quindi
  `setEsito({ ...composto, mancanti })` a riga 315 non richiede modifiche: lo spread include
  già il campo nuovo.

Nessun test automatico per questo task: il progetto non copre la UI con Vitest (convenzione
già in uso in questo stesso file per `ridotti`/`scartati`, nessun test dedicato a quelle
righe).

- [ ] **Step 1: Estendi l'interfaccia locale `Esito`**

In `src/components/technicalSheet/fascicolo/FascicoloSection.tsx`, righe 40-47:

```ts
/** Esito della generazione, da mostrare finché non si tocca di nuovo l'elenco. */
interface Esito {
  pagine: number
  byte: number
  sottoLimite: boolean
  ridotti: string[]
  scartati: { etichetta: string; motivo: string }[]
  pagineSeparate: string[]
  mancanti: RuoloDocumento[]
}
```

- [ ] **Step 2: Aggiungi la riga all'Alert di riepilogo**

Righe 480-485, aggiungi una riga dopo quella di `scartati`:

```tsx
      {esito && (
        <Alert severity={esito.sottoLimite ? 'success' : 'warning'} sx={{ py: 0.25 }}>
          Fascicolo di {esito.pagine} pagine, {peso(esito.byte)}
          {!esito.sottoLimite && ` — oltre il limite di ${peso(LIMITE_BYTE)}`}.
          {esito.mancanti.length > 0 && ` Mancano: ${esito.mancanti.map((r) => etichettaRuolo(r, contesto)).join('; ')}.`}
          {esito.ridotti.length > 0 && ` Ridotti per rientrare nel peso: ${esito.ridotti.join(', ')}.`}
          {esito.scartati.length > 0 && ` Non leggibili: ${esito.scartati.map((s) => s.etichetta).join(', ')}.`}
          {esito.pagineSeparate.length > 0 && ` Pagine doppie separate: ${esito.pagineSeparate.join(', ')}.`}
        </Alert>
      )}
```

- [ ] **Step 3: Verifica che il progetto compili senza errori di tipo**

Run: `npx tsc --noEmit`
Expected: nessun errore — `composto` (tipizzato `EsitoComposizioneFascicolo` dal Task 3) ha
già `pagineSeparate`, quindi `{ ...composto, mancanti }` soddisfa la nuova `Esito`.

- [ ] **Step 4: Esegui l'intera suite dei test**

Run: `npx vitest run`
Expected: PASS — nessuna regressione.

- [ ] **Step 5: Commit**

```bash
git add src/components/technicalSheet/fascicolo/FascicoloSection.tsx
git commit -m "feat(fascicolo): mostra in UI le pagine doppie separate"
```

---

### Task 5: Verifica manuale con i certificati reali

**Files:** nessuno (verifica, non implementazione).

Questo task richiede i due PDF di esempio già allegati in chat durante il brainstorming
(`631-S1_CERTIFICATI_MANUALI_FOTO_00-2026.pdf`, che contiene una pagina doppia a pag. 3, e
`1801438001-1801438080 LT. 500.pdf`, lo stesso certificato isolato) salvati su disco — non
sono raggiungibili da file system al momento di scrivere questo piano, vanno richiesti
all'utente con un percorso concreto (es. caricati nello scratchpad, o in una cartella del
repo).

- [ ] **Step 1: Ottieni i file su disco**

Chiedi all'utente il percorso dei due PDF (o chiedigli di salvarli in
`tests/fixtures/fascicolo/` o nello scratchpad di sessione).

- [ ] **Step 2: Avvia il dev server**

Run: `npm run dev`

- [ ] **Step 3: Genera un fascicolo di prova**

Nell'app, apri una pratica di test, sezione "Fascicolo apparecchiatura", carica
`1801438001-1801438080 LT. 500.pdf` come documento sorgente (qualunque ruolo), genera il
fascicolo.

- [ ] **Step 4: Apri il PDF generato e controlla la pagina separata**

Verifica che:
- il conteggio pagine sia aumentato di uno rispetto all'originale (la pagina doppia è
  diventata due pagine);
- l'Alert in UI riporti "Pagine doppie separate: ... (pag. 3)" (o l'indice corretto);
- le due pagine risultanti siano leggibili in verticale, non capovolte né ruotate nel verso
  sbagliato.

- [ ] **Step 5: Se il verso di rotazione è sbagliato, correggilo**

In `src/services/fascicolo/dividiPagineDoppie.ts`, cambia `GRADI_ROTAZIONE` da `-90` a `90`
(l'unico punto del codice che controlla il verso), rigenera il fascicolo e ripeti lo Step 4.

- [ ] **Step 6: Ripeti con il fascicolo completo**

Carica anche `631-S1_CERTIFICATI_MANUALI_FOTO_00-2026.pdf` (contiene anche il certificato
valvola e la foto targhetta oltre al certificato serbatoio) e genera di nuovo: verifica che
le pagine non doppie (certificato valvola, foto) restino invariate e nell'ordine corretto
insieme a quelle separate.

- [ ] **Step 7: Se è stata necessaria una correzione, esegui di nuovo l'intera suite e fai commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add src/services/fascicolo/dividiPagineDoppie.ts
git commit -m "fix(fascicolo): corregge il verso di rotazione delle pagine doppie separate"
```

Se invece il verso era già corretto al primo tentativo, non serve alcun commit aggiuntivo:
la funzionalità è completa.
