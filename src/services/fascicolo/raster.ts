/**
 * Riduzione di immagini e pagine a JPEG, per far rientrare il fascicolo nel limite di peso.
 *
 * È l'unica parte del fascicolo che ha bisogno del browser: disegna su `canvas`. Il resto —
 * ordine, inquadratura, composizione — è calcolo puro.
 */

/** Quanto si vuole ottenere: risoluzione della pagina e qualità della ricompressione JPEG. */
export interface Riduzione {
  /** Punti per pollice del foglio A4 finito: 150 è la stampa onesta, 72 lo schermo. */
  dpi: number
  /** 0-1, qualità JPEG. */
  qualita: number
}

/** Un'immagine pronta da incorporare nel PDF. */
export interface ImmagineRidotta {
  bytes: Uint8Array
  larghezza: number
  altezza: number
  /** `jpeg` sempre, tranne quando l'originale si incorpora così com'è. */
  tipo: 'jpeg' | 'png'
}

/** Lato lungo e lato corto di un A4 in pixel alla risoluzione data. */
const latiA4 = (dpi: number) => ({ lungo: 11.69 * dpi, corto: 8.27 * dpi })

/**
 * Fattore per far stare un'immagine di `w × h` dentro un A4 alla risoluzione richiesta.
 *
 * Il lato lungo dell'immagine va sul lato lungo del foglio qualunque sia il suo orientamento:
 * le immagini orizzontali vengono ruotate in composizione, quindi ridurle come se dovessero
 * stare dritte le renderebbe più piccole del necessario.
 */
const fattoreRiduzione = (w: number, h: number, dpi: number) => {
  const { lungo, corto } = latiA4(dpi)
  return Math.min(1, lungo / Math.max(w, h), corto / Math.min(w, h))
}

const canvasInJpeg = (canvas: HTMLCanvasElement, qualita: number): Promise<Blob> =>
  new Promise((risolvi, rifiuta) => {
    canvas.toBlob(
      (blob) => (blob ? risolvi(blob) : rifiuta(new Error('Conversione della pagina in JPEG fallita'))),
      'image/jpeg',
      qualita
    )
  })

const bytesDi = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer())

const contesto2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Il browser non ha concesso un contesto 2D per comporre il fascicolo')
  return ctx
}

/** Carica un file immagine come bitmap disegnabile, con ripiego per i browser senza `createImageBitmap`. */
const apriImmagine = async (file: File | Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((risolvi, rifiuta) => {
      const img = new Image()
      img.onload = () => risolvi(img)
      img.onerror = () => rifiuta(new Error('Immagine illeggibile'))
      img.src = url
    })
  } finally {
    // Il browser ha già decodificato: l'URL non serve più nemmeno al ripiego.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

const dimensioniDi = (img: ImageBitmap | HTMLImageElement) => ({
  larghezza: 'naturalWidth' in img ? img.naturalWidth : img.width,
  altezza: 'naturalHeight' in img ? img.naturalHeight : img.height,
})

/**
 * Ridisegna un'immagine come JPEG alla risoluzione richiesta.
 *
 * Senza `riduzione` la si riporta a JPEG a piena risoluzione e qualità alta: serve ai formati
 * che pdf-lib non sa incorporare (webp, gif, bmp, heic), che altrimenti resterebbero fuori.
 */
export const ricomprimiImmagine = async (
  file: File | Blob,
  riduzione?: Riduzione
): Promise<ImmagineRidotta> => {
  const img = await apriImmagine(file)
  const { larghezza, altezza } = dimensioniDi(img)
  const fattore = riduzione ? fattoreRiduzione(larghezza, altezza, riduzione.dpi) : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(larghezza * fattore))
  canvas.height = Math.max(1, Math.round(altezza * fattore))

  const ctx = contesto2d(canvas)
  // Il JPEG non ha trasparenza: senza fondo bianco le zone trasparenti dei PNG diventano nere.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  if ('close' in img) img.close()

  const blob = await canvasInJpeg(canvas, riduzione?.qualita ?? 0.92)
  return { bytes: await bytesDi(blob), larghezza: canvas.width, altezza: canvas.height, tipo: 'jpeg' }
}

/**
 * Trasforma le pagine di un PDF in immagini JPEG.
 *
 * Si usa solo quando il fascicolo non rientra nel limite di peso nemmeno dopo aver ridotto le
 * foto: un certificato rasterizzato perde il testo selezionabile e la nitidezza, quindi è
 * l'ultima cosa che si sacrifica.
 */
export const rasterizzaPdf = async (
  file: File | Blob,
  riduzione: Riduzione
): Promise<ImmagineRidotta[]> => {
  // pdfjs si carica al momento dell'uso: all'import chiede `DOMMatrix`, che esiste in un browser
  // ma non nell'ambiente dei test. Importandolo qui, la composizione del fascicolo resta
  // verificabile senza un browser — e questa è l'unica funzione che pdfjs le serve davvero.
  const { pdfjsLib } = await import('@/utils/pdfjs')
  const documento = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pagine: ImmagineRidotta[] = []

  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n)
      // Il viewport a scala 1 è in punti tipografici, cioè 72 dpi.
      const viewport = pagina.getViewport({ scale: riduzione.dpi / 72 })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))

      const ctx = contesto2d(canvas)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await pagina.render({ canvasContext: ctx, viewport, canvas }).promise

      const blob = await canvasInJpeg(canvas, riduzione.qualita)
      pagine.push({
        bytes: await bytesDi(blob),
        larghezza: canvas.width,
        altezza: canvas.height,
        tipo: 'jpeg',
      })
    }
  } finally {
    await documento.destroy()
  }

  return pagine
}
