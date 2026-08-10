import { PDFDocument } from 'pdf-lib'
import { rasterizzaPdf, ricomprimiImmagine } from './raster'

/**
 * Prove da cui si riconosce un documento.
 *
 * Non si manda il file intero: un manuale di quaranta pagine costa quanto quaranta immagini e
 * si riconosce dalle prime tre. Di ogni PDF si ritagliano le prime pagine, delle immagini si
 * manda una miniatura. Il numero di pagine viaggia a parte, perché è un indizio forte di per sé:
 * un documento di una pagina è un certificato, uno di trenta è un manuale.
 */

/** Quante pagine bastano a capire di che documento si tratta. */
const PAGINE_PROVA = 3

/** Oltre questa soglia il ritaglio si rasterizza: sono scansioni, e pesano quanto il file intero. */
const SOGLIA_RITAGLIO = 3 * 1024 * 1024

/** Riduzione delle scansioni troppo pesanti: leggibile da una macchina, non da stampare. */
const RIDUZIONE_PROVA = { dpi: 110, qualita: 0.6 }

/** Un pezzo di prova, nella forma che la funzione di classificazione sa tradurre. */
export type BloccoProva =
  | { kind: 'pdf'; base64: string }
  | { kind: 'immagine'; mediaType: string; base64: string }

export interface ProvaDocumento {
  id: string
  nome: string
  /** Pagine del PDF d'origine; `null` per le immagini. */
  pagine: number | null
  blocchi: BloccoProva[]
}

/**
 * Base64 di una sequenza di byte.
 *
 * A blocchi perché `String.fromCharCode` prende gli argomenti sullo stack: passargli un file
 * intero come lista di argomenti fa saltare lo stack ben prima di finire i megabyte.
 */
const base64Di = (bytes: Uint8Array): string => {
  let stringa = ''
  const blocco = 0x8000
  for (let i = 0; i < bytes.length; i += blocco) {
    stringa += String.fromCharCode(...bytes.subarray(i, i + blocco))
  }
  return btoa(stringa)
}

const eUnPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

/** Le prime pagine di un PDF, come PDF a sé. */
const ritagliaPrimePagine = async (bytes: Uint8Array, quante: number) => {
  const sorgente = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const indici = sorgente.getPageIndices().slice(0, quante)

  const ritaglio = await PDFDocument.create()
  const pagine = await ritaglio.copyPages(sorgente, indici)
  pagine.forEach((p) => ritaglio.addPage(p))

  return { bytes: await ritaglio.save(), totale: sorgente.getPageCount() }
}

/** Prove di un singolo file. Un file illeggibile non ne produce: lo si classificherà dal nome. */
export const provaDi = async (id: string, file: File): Promise<ProvaDocumento> => {
  const base: ProvaDocumento = { id, nome: file.name, pagine: null, blocchi: [] }

  try {
    if (!eUnPdf(file)) {
      const miniatura = await ricomprimiImmagine(file, RIDUZIONE_PROVA)
      return { ...base, blocchi: [{ kind: 'immagine', mediaType: 'image/jpeg', base64: base64Di(miniatura.bytes) }] }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const { bytes: ritaglio, totale } = await ritagliaPrimePagine(bytes, PAGINE_PROVA)

    // Un ritaglio ancora pesante è fatto di pagine scansionate: si mandano come immagini ridotte,
    // che è ciò che sono, invece di far viaggiare la scansione a piena risoluzione.
    if (ritaglio.byteLength > SOGLIA_RITAGLIO) {
      const pagine = await rasterizzaPdf(new Blob([ritaglio.slice()]), RIDUZIONE_PROVA)
      return {
        ...base,
        pagine: totale,
        blocchi: pagine.map((p) => ({ kind: 'immagine', mediaType: 'image/jpeg', base64: base64Di(p.bytes) })),
      }
    }

    return { ...base, pagine: totale, blocchi: [{ kind: 'pdf', base64: base64Di(ritaglio) }] }
  } catch {
    return base
  }
}

/** Prove di tutti i file caricati, nell'ordine in cui sono stati caricati. */
export const proveDi = async (documenti: { id: string; file: File }[]): Promise<ProvaDocumento[]> =>
  Promise.all(documenti.map((d) => provaDi(d.id, d.file)))
