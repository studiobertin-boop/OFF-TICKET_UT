import { fascicoloDocumentiApi } from '@/services/api/fascicoloDocumenti'
import type { DocumentoFascicolo } from './types'

/**
 * Da dove prendere i byte di un documento.
 *
 * Un documento appena trascinato ha il `File` in memoria; uno riletto dal database ha solo il
 * percorso nel bucket. Chi compone il PDF non deve sapere quale dei due ha davanti.
 */

export const eUnImmagine = (doc: DocumentoFascicolo): boolean => {
  if (doc.mime) return doc.mime.startsWith('image/')
  return /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(doc.nome)
}

/** I byte del documento, scaricandoli dallo Storage se non sono già in memoria. */
export const apriDocumento = async (doc: DocumentoFascicolo): Promise<File> => {
  if (doc.file) return doc.file
  if (!doc.filePath) throw new Error(`Il documento «${doc.nome}» non ha né file né percorso`)
  const blob = await fascicoloDocumentiApi.scarica(doc.filePath)
  return new File([blob], doc.nome, { type: doc.mime ?? blob.type })
}
