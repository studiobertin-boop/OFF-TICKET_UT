import * as pdfjsLib from 'pdfjs-dist'

// Configura worker per pdfjs - usa il worker locale da node_modules
// Vite servirà automaticamente questo file come static asset
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export interface PDFPageImage {
  pageNumber: number
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

export interface PDFConversionResult {
  pages: PDFPageImage[]
  totalPages: number
  fileName: string
}

/**
 * Converte un file PDF in array di immagini (una per pagina)
 *
 * @param file - File PDF da convertire
 * @param scale - Fattore di scala per rendering (default: 2.0 per alta qualità)
 * @param maxPages - Numero massimo di pagine da convertire (default: 10)
 * @returns Promise con array di immagini e metadati
 */
export async function convertPDFToImages(
  file: File,
  scale: number = 2.0,
  maxPages: number = 10
): Promise<PDFConversionResult> {
  console.log(`📄 Inizio conversione PDF: ${file.name}`)

  try {
    // Leggi file come ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Carica documento PDF
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    console.log(`📄 PDF caricato: ${pdf.numPages} pagine`)

    // Limita il numero di pagine
    const pagesToProcess = Math.min(pdf.numPages, maxPages)

    if (pdf.numPages > maxPages) {
      console.warn(`⚠️ PDF ha ${pdf.numPages} pagine, verranno elaborate solo le prime ${maxPages}`)
    }

    const pages: PDFPageImage[] = []

    // Processa ogni pagina
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      console.log(`🔄 Conversione pagina ${pageNum}/${pagesToProcess}...`)

      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })

      // Crea canvas per rendering
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Impossibile creare contesto canvas')
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      // Renderizza pagina su canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise

      // Converti canvas in Blob (PNG è più universale e non ha perdita)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result)
            } else {
              reject(new Error('Conversione canvas to blob fallita'))
            }
          },
          'image/png'
        )
      })

      // Crea data URL base64 per preview (NON blob URL!)
      // Questo è necessario perché il File creato deve poter essere convertito in base64
      const dataUrl = canvas.toDataURL('image/png')

      pages.push({
        pageNumber: pageNum,
        blob,
        dataUrl,
        width: viewport.width,
        height: viewport.height
      })

      console.log(`✅ Pagina ${pageNum} convertita (${blob.size} bytes, PNG format)`)
    }

    console.log(`✅ Conversione completata: ${pages.length} pagine`)

    return {
      pages,
      totalPages: pdf.numPages,
      fileName: file.name
    }
  } catch (error) {
    console.error('❌ Errore conversione PDF:', error)
    throw new Error(
      error instanceof Error
        ? `Errore conversione PDF: ${error.message}`
        : 'Errore sconosciuto durante conversione PDF'
    )
  }
}

/**
 * Converte una singola pagina PDF in immagine
 * Utile per preview o elaborazione selettiva
 *
 * @param file - File PDF
 * @param pageNumber - Numero pagina (1-based)
 * @param scale - Fattore di scala
 * @returns Promise con immagine della pagina
 */
export async function convertPDFPageToImage(
  file: File,
  pageNumber: number,
  scale: number = 2.0
): Promise<PDFPageImage> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Numero pagina non valido: ${pageNumber} (totale: ${pdf.numPages})`)
  }

  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Impossibile creare contesto canvas')
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas
  }).promise

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
        } else {
          reject(new Error('Conversione canvas to blob fallita'))
        }
      },
      'image/png'
    )
  })

  // Crea data URL base64 per preview (NON blob URL!)
  const dataUrl = canvas.toDataURL('image/png')

  return {
    pageNumber,
    blob,
    dataUrl,
    width: viewport.width,
    height: viewport.height
  }
}

/**
 * Verifica se un file è un PDF valido
 *
 * @param file - File da verificare
 * @returns true se è un PDF valido
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

/**
 * Converte qualsiasi immagine in PNG per garantire compatibilità con OpenAI
 * @param file - File immagine da convertire
 * @returns Promise con il File PNG convertito
 */
export async function convertImageToPNG(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Se è già PNG, restituiscilo direttamente
    if (file.type === 'image/png') {
      resolve(file)
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        // Crea canvas con dimensioni originali
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Impossibile ottenere il contesto canvas'))
          return
        }

        // Disegna l'immagine
        ctx.drawImage(img, 0, 0)

        // Converti in PNG blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl)

            if (blob) {
              // Crea nuovo File PNG
              const pngFile = new File(
                [blob],
                file.name.replace(/\.(jpe?g|gif|webp|bmp)$/i, '.png'),
                { type: 'image/png' }
              )
              resolve(pngFile)
            } else {
              reject(new Error('Conversione immagine a PNG fallita'))
            }
          },
          'image/png'
        )
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Impossibile caricare l\'immagine'))
    }

    img.src = objectUrl
  })
}

/**
 * Stima dimensione in memoria delle immagini risultanti
 * Utile per validazione prima della conversione
 *
 * @param numPages - Numero di pagine
 * @param scale - Fattore di scala
 * @returns Stima in MB
 */
export function estimatePDFImageSize(numPages: number, scale: number = 2.0): number {
  // Stima approssimativa: A4 @ 300dpi ~ 2-3MB per pagina
  const avgMBPerPage = 2.5 * (scale / 2.0)
  return numPages * avgMBPerPage
}
