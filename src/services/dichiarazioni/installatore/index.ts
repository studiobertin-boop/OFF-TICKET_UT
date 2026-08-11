/**
 * Entry point della dichiarazione installatore: collega raggruppamento (chi va dichiarato),
 * impaginazione (quante pagine servono) e disegno (il PDF vero e proprio).
 */
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { raggruppaApparecchiatureInstallatore } from './raggruppa'
import { impagina } from './impagina'
import { disegnaDichiarazioneInstallatore, type DatiDichiarazioneInstallatore } from './disegna'

export type { DatiDichiarazioneInstallatore, DatiInstallatore } from './disegna'
export type { RigaTabella, ApparecchiaturaRiga } from './raggruppa'

/**
 * Capacità per pagina, in "unità di peso" di `impagina` (2 per gruppo principale+dipendente,
 * 1 per riga standalone — vedi `impagina.ts`). Un gruppo occupa realmente ~9-10 righe di testo
 * a `disegna.ts` (bullet+4 campi, "dotato di:", altri 4 campi), una riga standalone ~4-5: il
 * rapporto 2:1 fra i pesi approssima bene quello reale (~2,1:1), quindi non serve cambiare i
 * pesi — basta calibrare la capacità assoluta sullo spazio vero disponibile.
 *
 * Sulla prima pagina il paragrafo introduttivo ha lunghezza variabile (contiene ragione
 * sociale e indirizzo dell'installatore): non impagina.ts la conosce in anticipo, quindi si
 * riserva uno spazio prudente e fisso invece di misurarla riga per riga. Il blocco di chiusura
 * (campi sito produttivo, i due paragrafi legali fissi, firma) non è invece riservato qui: se
 * non entra nell'ultima pagina, `disegna.ts` lo sposta da solo su una pagina dedicata.
 */
const RIGHE_PER_PAGINA_PRIMA = 6
const RIGHE_PER_PAGINA_SUCCESSIVE = 9

export interface GeneraDichiarazioneInstallatoreInput extends DatiDichiarazioneInstallatore {
  scheda: SchedaDatiCompleta
  templateBytes: Uint8Array | ArrayBuffer
}

export async function generaDichiarazioneInstallatore(
  input: GeneraDichiarazioneInstallatoreInput
): Promise<Uint8Array> {
  const righe = raggruppaApparecchiatureInstallatore(input.scheda)
  const pagine = impagina(righe, {
    righePerPaginaPrima: RIGHE_PER_PAGINA_PRIMA,
    righePerPaginaSuccessive: RIGHE_PER_PAGINA_SUCCESSIVE,
  })

  return disegnaDichiarazioneInstallatore(pagine, input.templateBytes, {
    installer: input.installer,
    customer: input.customer,
    sitoProduttivo: input.sitoProduttivo,
    data: input.data,
    luogo: input.luogo,
    firma: input.firma,
  })
}
