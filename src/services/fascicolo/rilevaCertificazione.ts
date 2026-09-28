import type { CertificazioneRecipiente } from '@/types/technicalSheet'
import { classificaDocumenti } from './classifica'
import { certificazioneDaDirettive } from './certificazione'
import { apriDocumento } from './sorgente'
import type { ContestoFascicolo, DocumentoFascicolo } from './types'

/** Esito della lettura del regime da un certificato, con la riga da mostrare all'utente. */
export interface EsitoCertificazione {
  regime: CertificazioneRecipiente | null
  messaggio: string
}

/**
 * Messaggio sull'esito, a partire dalle direttive trascritte. `null` = lettura non riuscita.
 * Separata dalla chiamata perché serve anche dopo la classificazione al caricamento, che le
 * direttive le ha già.
 */
export const esitoDaDirettive = (direttive: string[] | null, nomeFile: string): EsitoCertificazione => {
  if (direttive === null) {
    return { regime: null, messaggio: `Non è stato possibile leggere il certificato «${nomeFile}»: scegli RSP o PED a mano.` }
  }
  const regime = certificazioneDaDirettive(direttive)
  if (regime) {
    return { regime, messaggio: `Certificazione ${regime} letta da «${nomeFile}» (${direttive.join(', ')}).` }
  }
  return {
    regime: null,
    messaggio: direttive.length
      ? `«${nomeFile}» cita ${direttive.join(', ')}: non basta a dire se è RSP o PED, sceglilo a mano.`
      : `«${nomeFile}» non cita direttive riconoscibili: scegli RSP o PED a mano.`,
  }
}

/**
 * Legge il regime da un certificato già salvato nel fascicolo.
 *
 * Passa dalla stessa classificazione del caricamento, di cui qui interessano solo le direttive:
 * i ruoli già assegnati al documento non si toccano. Se la classificazione ripiega sul nome del
 * file, le direttive non ci sono e la lettura si dà per non riuscita.
 */
export const rilevaCertificazione = async (
  doc: DocumentoFascicolo,
  contesto: ContestoFascicolo
): Promise<EsitoCertificazione> => {
  try {
    const file = await apriDocumento(doc)
    const { risultati, avviso } = await classificaDocumenti([{ id: doc.id, file }], contesto)
    const r = risultati[0]
    if (avviso || !r || r.origine !== 'ai') return esitoDaDirettive(null, doc.nome)
    return esitoDaDirettive(r.direttive ?? [], doc.nome)
  } catch {
    return esitoDaDirettive(null, doc.nome)
  }
}
