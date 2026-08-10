# Schema d'impianto: caricamento PDF e ritaglio automatico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nel dialog "Dati relazione" della relazione tecnica DM329, permettere di caricare anche un PDF come schema d'impianto (§2.3) e ritagliare automaticamente l'immagine scelta (o la prima pagina del PDF) al contenuto effettivo del disegno, con un margine di 1 mm, prima di incorporarla nel documento.

**Architecture:** Un nuovo modulo puro (`schemaCrop.ts`) calcola il riquadro di ritaglio da un array di pixel RGBA, senza dipendenze dal DOM — testabile in Node. Il modulo DOM esistente (`schemaImpiantoFile.ts`) lo richiama dopo aver disegnato il file scelto (immagine, o prima pagina del PDF renderizzata con `pdfjs-dist`) su un `canvas`, e ritaglia di conseguenza prima di restituire i byte. La pipeline a valle (`renderRelazione.ts`, `dimensioniSchema`) non cambia: riceve dimensioni diverse (quelle del ritaglio) ma la stessa logica di impaginazione a piena pagina già implementata.

**Tech Stack:** React 18 + TypeScript, MUI 6, Vitest, `pdfjs-dist` (già dipendenza del progetto, già usata in `src/utils/pdfToImage.ts`).

## Global Constraints

- Il file scelto non va mai caricato su Supabase: resta in memoria nel browser fino all'incorporamento nel `.docx` (decisione invariata di Fase 4 del piano relazione DM329).
- Margine di ritaglio: 1 mm oltre il contenuto rilevato.
- Formati accettati: PNG, JPEG, PDF (solo la prima pagina, nessun selettore di pagina).
- Limite di dimensione file: 10 MB, applicato al file originale caricato, prima di qualunque conversione.
- `dimensioniSchema()` in `src/services/relazione/renderRelazione.ts` non si modifica.

---

### Task 1: Modulo puro di ritaglio (`schemaCrop.ts`)

**Files:**
- Create: `src/services/relazione/schemaCrop.ts`
- Test: `src/services/relazione/__tests__/schemaCrop.test.ts`

**Interfaces:**
- Produces:
  - `interface Riquadro { minX: number; minY: number; maxX: number; maxY: number }` (`maxX`/`maxY` esclusivi, come in uno `slice`)
  - `function riquadroContenuto(pixels: Uint8ClampedArray, larghezza: number, altezza: number, soglia?: number): Riquadro | null`
  - `function riquadroConMargine(r: Riquadro, marginePx: number, larghezza: number, altezza: number): Riquadro`

- [ ] **Step 1: Scrivi il file di test**

Crea `src/services/relazione/__tests__/schemaCrop.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { riquadroContenuto, riquadroConMargine } from '../schemaCrop'

type RGBA = [number, number, number, number]

function immaginePiena(larghezza: number, altezza: number, colore: RGBA = [255, 255, 255, 255]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(larghezza * altezza * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = colore[0]
    pixels[i + 1] = colore[1]
    pixels[i + 2] = colore[2]
    pixels[i + 3] = colore[3]
  }
  return pixels
}

function disegnaRettangolo(
  pixels: Uint8ClampedArray,
  larghezza: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colore: RGBA
): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * larghezza + x) * 4
      pixels[i] = colore[0]
      pixels[i + 1] = colore[1]
      pixels[i + 2] = colore[2]
      pixels[i + 3] = colore[3]
    }
  }
}

describe('riquadroContenuto', () => {
  test('trova il rettangolo di contenuto in posizione nota', () => {
    const larghezza = 10
    const altezza = 10
    const pixels = immaginePiena(larghezza, altezza)
    disegnaRettangolo(pixels, larghezza, 4, 4, 6, 6, [0, 0, 0, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 4, minY: 4, maxX: 6, maxY: 6 })
  })

  test('rileva il contenuto su sfondo trasparente (caso PDF)', () => {
    const larghezza = 8
    const altezza = 8
    const pixels = immaginePiena(larghezza, altezza, [0, 0, 0, 0])
    disegnaRettangolo(pixels, larghezza, 2, 3, 5, 6, [10, 10, 10, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 2, minY: 3, maxX: 5, maxY: 6 })
  })

  test('immagine completamente vuota non produce un riquadro', () => {
    const pixels = immaginePiena(5, 5)
    expect(riquadroContenuto(pixels, 5, 5)).toBeNull()
  })

  test('la soglia tollera un piccolo scarto cromatico dello sfondo', () => {
    const larghezza = 6
    const altezza = 6
    const pixels = immaginePiena(larghezza, altezza, [250, 250, 250, 255])
    // Rumore sotto soglia: non deve comparire nel riquadro.
    const i = (1 * larghezza + 1) * 4
    pixels[i] = 240
    pixels[i + 1] = 245
    pixels[i + 2] = 248
    // Contenuto vero, ben oltre soglia.
    disegnaRettangolo(pixels, larghezza, 3, 3, 5, 5, [0, 0, 0, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 3, minY: 3, maxX: 5, maxY: 5 })
  })
})

describe('riquadroConMargine', () => {
  test('espande simmetricamente entro i limiti dell\'immagine', () => {
    const r = { minX: 4, minY: 4, maxX: 6, maxY: 6 }
    expect(riquadroConMargine(r, 2, 10, 10)).toEqual({ minX: 2, minY: 2, maxX: 8, maxY: 8 })
  })

  test('non sconfina quando il contenuto tocca già un bordo', () => {
    const r = { minX: 0, minY: 0, maxX: 3, maxY: 3 }
    expect(riquadroConMargine(r, 5, 10, 10)).toEqual({ minX: 0, minY: 0, maxX: 8, maxY: 8 })
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/services/relazione/__tests__/schemaCrop.test.ts`
Expected: FAIL — `../schemaCrop` non esiste ancora.

- [ ] **Step 3: Implementa il modulo**

Crea `src/services/relazione/schemaCrop.ts`:

```ts
/**
 * Ritaglio dello schema d'impianto al contenuto: funzioni pure, senza DOM, testabili in
 * Node con array di pixel costruiti a mano. Il glue DOM (canvas, Image, lettura PDF) vive
 * in `components/relazione/schemaImpiantoFile.ts`.
 */

/** Riquadro in pixel; `maxX`/`maxY` esclusivi (come in uno `slice`). */
export interface Riquadro {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Tolleranza di default: quanto un canale (0-255) può scostarsi dal colore di sfondo
 * prima di essere considerato contenuto. Tunable: da rivedere se il ritaglio in
 * produzione risultasse troppo o troppo poco aggressivo.
 */
const SOGLIA_DEFAULT = 24

interface ColoreRif {
  r: number
  g: number
  b: number
  a: number
}

/** Colore di sfondo campionato dai 4 angoli dell'immagine, mediati. */
function campionaSfondo(pixels: Uint8ClampedArray, larghezza: number, altezza: number): ColoreRif {
  const angoli = [
    0,
    (larghezza - 1) * 4,
    (altezza - 1) * larghezza * 4,
    ((altezza - 1) * larghezza + larghezza - 1) * 4,
  ]
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  for (const i of angoli) {
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    a += pixels[i + 3]
  }
  return { r: r / 4, g: g / 4, b: b / 4, a: a / 4 }
}

/**
 * Un pixel è "contenuto" se il suo alpha si scosta significativamente dallo sfondo
 * (copre gli sfondi trasparenti, tipici di un PDF vettoriale senza riempimento di
 * pagina) oppure, a parità di alpha, se un canale RGB si scosta oltre soglia (copre gli
 * sfondi bianchi/chiari delle immagini raster, tollerando l'antialiasing).
 */
function eContenuto(pixels: Uint8ClampedArray, i: number, rif: ColoreRif, soglia: number): boolean {
  const a = pixels[i + 3]
  if (Math.abs(a - rif.a) > soglia) return true
  if (a === 0) return false
  return (
    Math.abs(pixels[i] - rif.r) > soglia ||
    Math.abs(pixels[i + 1] - rif.g) > soglia ||
    Math.abs(pixels[i + 2] - rif.b) > soglia
  )
}

/**
 * Bounding box del contenuto rilevato, o `null` se l'immagine è vuota (nessun pixel
 * supera la soglia rispetto allo sfondo): in quel caso il chiamante non ritaglia nulla,
 * l'immagine intera resta il fallback non bloccante.
 */
export function riquadroContenuto(
  pixels: Uint8ClampedArray,
  larghezza: number,
  altezza: number,
  soglia: number = SOGLIA_DEFAULT
): Riquadro | null {
  if (larghezza <= 0 || altezza <= 0) return null
  const rif = campionaSfondo(pixels, larghezza, altezza)

  let minX = larghezza
  let minY = altezza
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) {
      const i = (y * larghezza + x) * 4
      if (eContenuto(pixels, i, rif, soglia)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return null
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }
}

/** Espande il riquadro del margine richiesto, con clamp ai bordi dell'immagine. */
export function riquadroConMargine(
  r: Riquadro,
  marginePx: number,
  larghezza: number,
  altezza: number
): Riquadro {
  return {
    minX: Math.max(0, r.minX - marginePx),
    minY: Math.max(0, r.minY - marginePx),
    maxX: Math.min(larghezza, r.maxX + marginePx),
    maxY: Math.min(altezza, r.maxY + marginePx),
  }
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/services/relazione/__tests__/schemaCrop.test.ts`
Expected: PASS, 6 test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/services/relazione/schemaCrop.ts src/services/relazione/__tests__/schemaCrop.test.ts
git commit -m "feat(relazione): riquadro di ritaglio dello schema d'impianto, motore puro"
```

---

### Task 2: PDF e ritaglio in `schemaImpiantoFile.ts`

**Files:**
- Modify: `src/components/relazione/schemaImpiantoFile.ts` (intero file)

**Interfaces:**
- Consumes:
  - `riquadroContenuto(pixels: Uint8ClampedArray, larghezza: number, altezza: number, soglia?: number): Riquadro | null` (Task 1)
  - `riquadroConMargine(r: Riquadro, marginePx: number, larghezza: number, altezza: number): Riquadro` (Task 1)
  - `isPDFFile(file: File): boolean` da `@/utils/pdfToImage`
  - `convertPDFPageToImage(file: File, pageNumber: number, scale?: number): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; pageNumber: number }>` da `@/utils/pdfToImage`
- Produces (invariato rispetto a oggi, consumato da `RelazioneDataDialog.tsx`):
  - `FORMATI_SCHEMA: readonly string[]` — ora include `'application/pdf'`
  - `SCHEMA_MAX_BYTE: number`
  - `leggiSchemaImpianto(file: File): Promise<SchemaImpianto>` — stessa firma, ora ritaglia il risultato

Non c'è un ciclo TDD qui: il file dipende dal DOM (`Image`, `canvas`, `URL.createObjectURL`) e non è coperto da test unitari, per lo stesso motivo per cui non lo era prima di questa modifica — lo dichiara il commento di testa del file originale. La verifica è manuale, nel Task 4.

- [ ] **Step 1: Sostituisci il contenuto del file**

Sostituisci **l'intero contenuto** di `src/components/relazione/schemaImpiantoFile.ts` con:

```ts
/**
 * Lettura del file dello schema d'impianto scelto nel dialog.
 *
 * Vive fuori da `services/relazione` perché dipende dal DOM: disegna su un `canvas` per
 * misurare e ritagliare, mentre il motore di ritaglio (`schemaCrop.ts`) resta puro e
 * testabile in Node. Non coperto da test unitari per lo stesso motivo: verifica in app.
 *
 * Il file non viene caricato da nessuna parte: si legge in memoria, entra nel .docx e
 * finisce lì. È la ragione per cui lo schema non occupa spazio su Supabase.
 */
import type { SchemaImpianto } from '@/services/relazione/types'
import { riquadroContenuto, riquadroConMargine } from '@/services/relazione/schemaCrop'
import { isPDFFile, convertPDFPageToImage } from '@/utils/pdfToImage'

/** Formati che il dialog accetta in scelta o trascinamento. */
export const FORMATI_SCHEMA = ['image/png', 'image/jpeg', 'application/pdf'] as const

/**
 * Limite di buon senso: oltre, il .docx diventa ingestibile da allegare via email. Si
 * applica al file originale caricato, prima di qualunque conversione da PDF a immagine.
 */
export const SCHEMA_MAX_BYTE = 10 * 1024 * 1024

/**
 * Scala di rendering della prima pagina del PDF: 2.0 = 144 dpi (l'unità nativa PDF è 72
 * dpi). Serve a convertire il margine di ritaglio da mm a pixel con un dpi noto.
 */
const PDF_RENDER_SCALE = 2.0
const PDF_DPI = PDF_RENDER_SCALE * 72

/**
 * Dpi assunti per un'immagine raster: nessun formato bitmap qui accettato porta la
 * risoluzione fisica in modo affidabile, quindi si assume la stessa convenzione già
 * documentata per `SCHEMA_LARGHEZZA_PX` in `renderRelazione.ts`.
 */
const RASTER_DPI_ASSUNTO = 96

/** Margine di ritaglio oltre il contenuto rilevato. */
const MARGINE_MM = 1

function mmAPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4)
}

/**
 * Disegna un blob immagine su un canvas della sua dimensione nativa e ne ritorna il
 * contesto 2D, da cui si leggono i pixel o si ritaglia una porzione.
 */
function disegnaSuCanvas(blob: Blob): Promise<CanvasRenderingContext2D> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Impossibile ottenere il contesto canvas.'))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(ctx)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Immagine non leggibile.'))
    }
    img.src = url
  })
}

function canvasABlobPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Ritaglio dello schema fallito.'))
    }, 'image/png')
  })
}

export async function leggiSchemaImpianto(file: File): Promise<SchemaImpianto> {
  const ePdf = isPDFFile(file)
  if (!ePdf && !(FORMATI_SCHEMA as readonly string[]).includes(file.type)) {
    throw new Error('Formato non supportato: lo schema dev’essere un PNG, un JPEG o un PDF.')
  }
  if (file.size > SCHEMA_MAX_BYTE) {
    throw new Error(
      `Immagine troppo grande (${Math.round(file.size / 1024 / 1024)} MB): il limite è 10 MB.`
    )
  }

  let immagine: Blob = file
  let dpi = RASTER_DPI_ASSUNTO
  if (ePdf) {
    const pagina = await convertPDFPageToImage(file, 1, PDF_RENDER_SCALE)
    immagine = pagina.blob
    dpi = PDF_DPI
  }

  const ctx = await disegnaSuCanvas(immagine)
  const larghezza = ctx.canvas.width
  const altezza = ctx.canvas.height
  const pixel = ctx.getImageData(0, 0, larghezza, altezza).data

  const contenuto = riquadroContenuto(pixel, larghezza, altezza)
  const riquadro = contenuto
    ? riquadroConMargine(contenuto, mmAPx(MARGINE_MM, dpi), larghezza, altezza)
    : { minX: 0, minY: 0, maxX: larghezza, maxY: altezza }

  const larghezzaRitaglio = riquadro.maxX - riquadro.minX
  const altezzaRitaglio = riquadro.maxY - riquadro.minY

  const ritaglio = document.createElement('canvas')
  ritaglio.width = larghezzaRitaglio
  ritaglio.height = altezzaRitaglio
  const ctxRitaglio = ritaglio.getContext('2d')
  if (!ctxRitaglio) {
    throw new Error('Impossibile ottenere il contesto canvas.')
  }
  ctxRitaglio.drawImage(
    ctx.canvas,
    riquadro.minX,
    riquadro.minY,
    larghezzaRitaglio,
    altezzaRitaglio,
    0,
    0,
    larghezzaRitaglio,
    altezzaRitaglio
  )

  const blob = await canvasABlobPng(ritaglio)
  const buffer = await blob.arrayBuffer()

  return {
    dati: new Uint8Array(buffer),
    larghezzaPx: larghezzaRitaglio,
    altezzaPx: altezzaRitaglio,
    nomeFile: file.name,
  }
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun nuovo errore rispetto a prima della modifica (il progetto è pulito su questo fronte, vedi stato del piano relazione DM329).

- [ ] **Step 3: Commit**

```bash
git add src/components/relazione/schemaImpiantoFile.ts
git commit -m "feat(relazione): accetta PDF per lo schema d'impianto e lo ritaglia al contenuto"
```

---

### Task 3: Dialog — accetta PDF e mostra l'anteprima ritagliata

**Files:**
- Modify: `src/components/relazione/RelazioneDataDialog.tsx`

**Interfaces:**
- Consumes: `leggiSchemaImpianto(file: File): Promise<SchemaImpianto>` (Task 2, firma invariata) — `SchemaImpianto` ha `{ dati: Uint8Array; larghezzaPx: number; altezzaPx: number; nomeFile?: string }` (`src/services/relazione/types.ts`, invariato)

Nessun test automatico: il file dichiara esplicitamente in testa "UI non coperta dai test unitari". Verifica manuale nel Task 4.

- [ ] **Step 1: Aggiungi lo stato dell'anteprima e la sua pulizia**

In `src/components/relazione/RelazioneDataDialog.tsx`, subito dopo la riga (circa 133):

```ts
  const [schemaSopra, setSchemaSopra] = useState(false)
```

aggiungi:

```ts

  /** Object URL dell'anteprima dello schema già ritagliato: revocato dall'effect sotto
   *  ogni volta che cambia, così non si accumulano URL non più referenziati. */
  const [schemaPreviewUrl, setSchemaPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (schemaPreviewUrl) URL.revokeObjectURL(schemaPreviewUrl)
    }
  }, [schemaPreviewUrl])
```

- [ ] **Step 2: Azzera l'anteprima all'apertura del dialog**

Nell'`useEffect` di sincronizzazione all'apertura (circa riga 154-156), dove oggi c'è:

```ts
    // Lo schema non è persistito: a ogni apertura si riparte da vuoto.
    setSchema(null)
    setSchemaSopra(false)
```

sostituisci con:

```ts
    // Lo schema non è persistito: a ogni apertura si riparte da vuoto.
    setSchema(null)
    setSchemaPreviewUrl(null)
    setSchemaSopra(false)
```

- [ ] **Step 3: Costruisci l'anteprima quando si legge un nuovo file**

Sostituisci `handleSchemaFile` (circa righe 159-167):

```ts
  const handleSchemaFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setSchema(await leggiSchemaImpianto(file))
    } catch (err) {
      setSchema(null)
      toast.error(err instanceof Error ? err.message : 'Immagine non leggibile.')
    }
  }
```

con:

```ts
  const handleSchemaFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const letto = await leggiSchemaImpianto(file)
      setSchema(letto)
      setSchemaPreviewUrl(URL.createObjectURL(new Blob([letto.dati], { type: 'image/png' })))
    } catch (err) {
      setSchema(null)
      setSchemaPreviewUrl(null)
      toast.error(err instanceof Error ? err.message : 'Immagine non leggibile.')
    }
  }
```

- [ ] **Step 4: Aggiorna testo di aiuto, `accept` e pulsanti**

Sostituisci il blocco (circa righe 555-559):

```tsx
          <Typography variant="subtitle2">Schema d’impianto (§2.3)</Typography>
          <Typography variant="body2" color="text.secondary">
            L’immagine viene incorporata nel documento a larghezza fissa e non viene
            salvata: va riselezionata a ogni generazione. Formati PNG o JPEG, max 10 MB.
          </Typography>
```

con:

```tsx
          <Typography variant="subtitle2">Schema d’impianto (§2.3)</Typography>
          <Typography variant="body2" color="text.secondary">
            L’immagine (o la prima pagina, se scegli un PDF) viene ritagliata
            automaticamente al contenuto dello schema e incorporata nel documento alla
            dimensione massima possibile senza uscire dalla pagina. Non viene salvata: va
            riselezionata a ogni generazione. Formati PNG, JPEG o PDF, max 10 MB.
          </Typography>
```

Poi, nel pulsante di scelta file (circa righe 578-589):

```tsx
            <Button component="label" variant="outlined" size="small" disabled={saving}>
              {schema ? 'Sostituisci immagine' : 'Scegli immagine'}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  void handleSchemaFile(e.target.files?.[0])
                  // Consente di riselezionare lo stesso file dopo una rimozione.
                  e.target.value = ''
                }}
              />
            </Button>
```

sostituisci `'Sostituisci immagine' : 'Scegli immagine'` con `'Sostituisci schema' : 'Scegli schema'` e `accept="image/png,image/jpeg"` con `accept="image/png,image/jpeg,application/pdf"`.

Infine il testo del trascinamento (circa riga 602):

```tsx
              <Typography variant="body2" color="text.secondary">
                …oppure trascina qui l’immagine. Senza schema il paragrafo resterà vuoto.
              </Typography>
```

sostituisci `l’immagine` con `il file`.

- [ ] **Step 5: Aggiungi la miniatura di anteprima e aggiorna il pulsante Rimuovi**

Sostituisci il blocco (circa righe 591-599):

```tsx
            {schema ? (
              <>
                <Typography variant="body2">
                  {schema.nomeFile} — {schema.larghezzaPx}×{schema.altezzaPx} px
                </Typography>
                <Button size="small" color="inherit" onClick={() => setSchema(null)} disabled={saving}>
                  Rimuovi
                </Button>
              </>
            ) : (
```

con:

```tsx
            {schema ? (
              <>
                {schemaPreviewUrl && (
                  <Box
                    component="img"
                    src={schemaPreviewUrl}
                    alt="Anteprima schema d’impianto ritagliato"
                    sx={{
                      maxWidth: 160,
                      maxHeight: 120,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                )}
                <Typography variant="body2">
                  {schema.nomeFile} — {schema.larghezzaPx}×{schema.altezzaPx} px
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setSchema(null)
                    setSchemaPreviewUrl(null)
                  }}
                  disabled={saving}
                >
                  Rimuovi
                </Button>
              </>
            ) : (
```

- [ ] **Step 6: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun nuovo errore.

- [ ] **Step 7: Commit**

```bash
git add src/components/relazione/RelazioneDataDialog.tsx
git commit -m "feat(relazione): il dialog accetta PDF per lo schema e ne mostra l'anteprima ritagliata"
```

---

### Task 4: Verifica finale

**Files:** nessuna modifica — solo esecuzione e controllo manuale.

- [ ] **Step 1: Suite di test completa**

Run: `npx vitest run`
Expected: tutti i test verdi, inclusi i 6 nuovi di `schemaCrop.test.ts` e quelli esistenti di `schemaImpianto.test.ts` (che verificano `dimensioniSchema` e l'incorporamento nel `.docx`, non toccati da questo lavoro).

- [ ] **Step 2: Typecheck e build completi**

Run: `npm run build:check`
Expected: esce senza errori.

- [ ] **Step 3: Verifica manuale in app — caricamento e anteprima**

Run: `npm run dev`, apri una pratica DM329 con scheda dati compilata, apri il dialog "Dati relazione".

Prova in sequenza, controllando ogni volta la miniatura d'anteprima e il testo con le dimensioni:

1. Un PNG o JPEG con ampio margine bianco intorno al disegno → l'anteprima mostra il disegno ritagliato stretto, non il file originale con margine.
2. Un PDF a pagina singola con lo stesso tipo di schema → funziona come il PNG, l'anteprima è nitida.
3. Un'immagine già ritagliata a filo (nessun margine) → l'anteprima è sostanzialmente identica all'originale (il ritaglio non toglie contenuto).
4. Un file PDF a più pagine (se disponibile) → si usa solo la prima pagina, nessun errore né selettore.
5. Un formato non supportato (es. `.docx` o `.bmp`) → messaggio di errore "Formato non supportato…", nessun crash.
6. Rimuovi lo schema con "Rimuovi" e riscegline uno nuovo → l'anteprima si aggiorna, quella precedente scompare.

- [ ] **Step 4: Verifica manuale in app — documento generato**

Con uno degli schemi con margine ampio ancora caricato, premi "Genera e scarica .docx" (o "Genera comunque .docx" se compaiono segnalazioni non bloccanti), apri il file scaricato in Word.

Conferma che, in §2.3:
- l'immagine occupa la dimensione massima possibile sulla pagina, senza spingere il contenuto successivo alla pagina dopo;
- non c'è margine bianco eccessivo intorno al disegno (solo il margine di ritaglio previsto).

- [ ] **Step 5: Rigenera il documento di esempio (regressione sul percorso Node)**

Run: `npx tsx scripts/generate-relazione-sample.ts /tmp/verifica-schema.docx` (senza terzo argomento, quindi senza schema)

Expected: nessun errore — questo script non passa da `schemaImpiantoFile.ts` (costruisce `SchemaImpianto` leggendo l'header PNG direttamente, per uso da Node) e non è toccato da questo lavoro; la corsa conferma che `renderRelazione.ts` e il resto della pipeline restano intatti.

- [ ] **Step 6: Commit finale (se Step 5 ha richiesto correzioni)**

Solo se le verifiche manuali hanno fatto emergere una correzione: applica la correzione, ripeti gli step pertinenti, poi:

```bash
git add -A
git commit -m "fix(relazione): correzioni dalla verifica manuale del ritaglio dello schema"
```

Se nessuna correzione è stata necessaria, non c'è nulla da committare in questo step: i Task 1-3 hanno già ciascuno il proprio commit.
