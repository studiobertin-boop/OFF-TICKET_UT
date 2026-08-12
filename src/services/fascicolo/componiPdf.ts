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
