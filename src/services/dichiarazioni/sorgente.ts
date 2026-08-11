import { dichiarazioniDocumentiApi } from '@/services/api/dichiarazioniDocumenti'

export const eUnImmagineDichiarazione = (doc: { nome: string; mime?: string | null }): boolean => {
  if (doc.mime) return doc.mime.startsWith('image/')
  return /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(doc.nome)
}

/** I byte di un documento delle dichiarazioni, scaricandoli dallo Storage. */
export const apriDocumentoDichiarazione = async (doc: {
  nome: string
  filePath: string
  mime?: string | null
}): Promise<File> => {
  const blob = await dichiarazioniDocumentiApi.scarica(doc.filePath)
  return new File([blob], doc.nome, { type: doc.mime ?? blob.type })
}
