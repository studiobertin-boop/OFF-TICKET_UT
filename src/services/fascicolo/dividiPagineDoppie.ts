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
