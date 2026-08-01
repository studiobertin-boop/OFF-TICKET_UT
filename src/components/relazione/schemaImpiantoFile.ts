/**
 * Lettura del file dello schema d'impianto scelto nel dialog.
 *
 * Vive fuori da `services/relazione` perché dipende dal DOM: misura le dimensioni native
 * con un elemento `Image`, mentre il motore resta puro e testabile in Node.
 *
 * Il file non viene caricato da nessuna parte: si legge in memoria, entra nel .docx e
 * finisce lì. È la ragione per cui lo schema non occupa spazio su Supabase.
 */
import type { SchemaImpianto } from '@/services/relazione/types'

/** Formati che Word incorpora in modo affidabile in un .docx. */
export const FORMATI_SCHEMA = ['image/png', 'image/jpeg'] as const

/** Limite di buon senso: oltre, il .docx diventa ingestibile da allegare via email. */
export const SCHEMA_MAX_BYTE = 10 * 1024 * 1024

function misuraImmagine(file: File): Promise<{ larghezzaPx: number; altezzaPx: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ larghezzaPx: img.naturalWidth, altezzaPx: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Immagine non leggibile.'))
    }
    img.src = url
  })
}

export async function leggiSchemaImpianto(file: File): Promise<SchemaImpianto> {
  if (!(FORMATI_SCHEMA as readonly string[]).includes(file.type)) {
    throw new Error('Formato non supportato: lo schema dev’essere un PNG o un JPEG.')
  }
  if (file.size > SCHEMA_MAX_BYTE) {
    throw new Error(
      `Immagine troppo grande (${Math.round(file.size / 1024 / 1024)} MB): il limite è 10 MB.`
    )
  }

  const [dati, dimensioni] = await Promise.all([
    file.arrayBuffer().then((b) => new Uint8Array(b)),
    misuraImmagine(file),
  ])

  return { dati, ...dimensioni, nomeFile: file.name }
}
