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
