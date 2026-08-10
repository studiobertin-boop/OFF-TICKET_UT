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
import * as pdfjsLib from 'pdfjs-dist'
import type { SchemaImpianto } from '@/services/relazione/types'
import { riquadroDiRitaglio, mmAPx } from '@/services/relazione/schemaCrop'
import { isPDFFile, convertPDFPageToImage } from '@/utils/pdfToImage'

/** Formati che il dialog accetta in scelta o trascinamento. */
export const FORMATI_SCHEMA = ['image/png', 'image/jpeg', 'application/pdf'] as const

/**
 * Limite di buon senso: oltre, il .docx diventa ingestibile da allegare via email. Si
 * applica al file originale caricato, prima di qualunque conversione da PDF a immagine.
 */
export const SCHEMA_MAX_BYTE = 10 * 1024 * 1024

/**
 * Budget di pixel dell'immagine finale (dopo ritaglio): ~2 megapixel, ben oltre i 640px
 * di larghezza a cui lo schema finisce stampato (`dimensioniSchema()` in
 * `renderRelazione.ts`), ma abbastanza contenuto da limitare sia la dimensione del PNG
 * risultante — che altrimenti può superare abbondantemente `SCHEMA_MAX_BYTE` su una foto
 * ad alta risoluzione, dato che quel limite si applica solo al file originale caricato —
 * sia l'area del canvas sul lato PDF (Safari rifiuta silenziosamente canvas oltre ~16.7M
 * px, restituendo un'immagine bianca).
 */
const BUDGET_PX = 2_000_000

/**
 * Scala massima di rendering PDF: adatta ai formati comuni (A4/A3). Sui grandi formati
 * CAD (A1/A0), tipici di questa funzionalità, la scala effettiva scende sotto questo
 * tetto per restare entro `BUDGET_PX` — vedi `scalaRenderPdf`.
 */
const PDF_SCALA_MAX = 2.0

/** Scala minima di rendering PDF: sotto, una pagina degenere renderizzerebbe a una
 *  risoluzione inutilizzabile. */
const PDF_SCALA_MIN = 0.5

/**
 * Dpi assunti per un'immagine raster: nessun formato bitmap qui accettato porta la
 * risoluzione fisica in modo affidabile, quindi si assume la stessa convenzione già
 * documentata per `SCHEMA_LARGHEZZA_PX` in `renderRelazione.ts`.
 */
const RASTER_DPI_ASSUNTO = 96

/** Margine di ritaglio oltre il contenuto rilevato. */
const MARGINE_MM = 1

/**
 * Scala di rendering della pagina PDF, calcolata sulla dimensione nativa della pagina
 * (a 72dpi, l'unità nativa PDF) così da restare entro `BUDGET_PX` anche sui grandi
 * formati CAD (A1/A0), clampata fra `PDF_SCALA_MIN` e `PDF_SCALA_MAX`. Sui formati
 * comuni (A4/A3) la scala resta al tetto di 2.0, invariata rispetto a prima.
 *
 * Interroga il PDF direttamente con `pdfjs-dist` (lo stesso import usato da
 * `pdfToImage.ts`, che configura il worker come side-effect al proprio import: qui non
 * va riconfigurato) perché `convertPDFPageToImage` non espone le dimensioni native prima
 * di renderizzare.
 */
async function scalaRenderPdf(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pagina = await pdf.getPage(1)
  const nativa = pagina.getViewport({ scale: 1 })
  const scala = Math.sqrt(BUDGET_PX / (nativa.width * nativa.height))
  return Math.min(PDF_SCALA_MAX, Math.max(PDF_SCALA_MIN, scala))
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
    try {
      const scala = await scalaRenderPdf(file)
      const pagina = await convertPDFPageToImage(file, 1, scala)
      immagine = pagina.blob
      dpi = scala * 72
    } catch {
      // Un pdf.js grezzo (PDF protetto, corrotto, o un file con estensione .pdf che non
      // lo è) non deve arrivare in un toast: qui, come nel resto della funzione, l'utente
      // vede solo frasi italiane complete.
      throw new Error('PDF non leggibile: potrebbe essere protetto o danneggiato.')
    }
  }

  const ctx = await disegnaSuCanvas(immagine)
  const larghezza = ctx.canvas.width
  const altezza = ctx.canvas.height
  const pixel = ctx.getImageData(0, 0, larghezza, altezza).data

  const riquadro = riquadroDiRitaglio(pixel, larghezza, altezza, mmAPx(MARGINE_MM, dpi))

  const larghezzaRitaglio = riquadro.maxX - riquadro.minX
  const altezzaRitaglio = riquadro.maxY - riquadro.minY

  // Il canvas finale può essere più piccolo del ritaglio: se l'area ritagliata supera il
  // budget di pixel (tipico di una foto ad alta risoluzione — il lato PDF arriva già
  // vicino al budget da `scalaRenderPdf`), si sotto-campiona nello stesso `drawImage` che
  // esegue il ritaglio, invece di ritagliare a piena risoluzione e ridimensionare dopo.
  // Non si ingrandisce mai: un ritaglio già sotto budget resta 1:1.
  const areaRitaglio = larghezzaRitaglio * altezzaRitaglio
  const scalaFinale = areaRitaglio > BUDGET_PX ? Math.sqrt(BUDGET_PX / areaRitaglio) : 1
  const larghezzaFinale = Math.max(1, Math.round(larghezzaRitaglio * scalaFinale))
  const altezzaFinale = Math.max(1, Math.round(altezzaRitaglio * scalaFinale))

  const ritaglio = document.createElement('canvas')
  ritaglio.width = larghezzaFinale
  ritaglio.height = altezzaFinale
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
    larghezzaFinale,
    altezzaFinale
  )

  const blob = await canvasABlobPng(ritaglio)
  const buffer = await blob.arrayBuffer()

  return {
    dati: new Uint8Array(buffer),
    larghezzaPx: larghezzaFinale,
    altezzaPx: altezzaFinale,
    nomeFile: file.name,
  }
}
