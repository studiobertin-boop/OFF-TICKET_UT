/**
 * Engine — §7.2 SCADENZE DI RIQUALIFICAZIONE PERIODICA.
 *
 * Le relazioni storiche riportavano la sola tabella dell'Allegato B, lasciando al
 * valutatore l'incrocio fra categoria di ciascun recipiente e frequenza applicabile.
 * Qui l'incrocio è già fatto, una riga per apparecchiatura soggetta.
 *
 * Nessuna eccezione per i recipienti zincati: la deroga suggerita dalle guide dei
 * fabbricanti non ha base nel testo del decreto.
 *
 * Deriva dalle righe di §5.2 anziché rileggere la scheda, così le due tabelle non
 * possono divergere.
 */
import type { EsitoRow, RiqualificazioneRow } from '../types'
import type { CategoriaPED } from '@/types/technicalSheet'
import { comportaAdempimento, frequenzeRiqualificazione } from '@/utils/dm329Classification'

const CATEGORIE_VALIDE: CategoriaPED[] = ['I', 'II', 'III', 'IV']

function asCategoria(valore: string): CategoriaPED | undefined {
  return CATEGORIE_VALIDE.find((c) => c === valore)
}

export function buildRiqualificazione(esiti: EsitoRow[]): RiqualificazioneRow[] {
  const rows: RiqualificazioneRow[] = []

  for (const e of esiti) {
    if (!comportaAdempimento(e.esito)) continue

    const frequenze = frequenzeRiqualificazione(asCategoria(e.categoria))
    rows.push({
      pos: e.pos,
      apparecchiatura: e.apparecchiatura,
      categoria: e.categoria,
      // Senza categoria la frequenza non è determinabile: dirlo esplicitamente è
      // preferibile a una cella vuota, che si legge come "nessun obbligo".
      verificaFunzionamento: frequenze
        ? `ogni ${frequenze.funzionamentoAnni} anni`
        : 'da determinare (categoria mancante)',
      verificaIntegrita: frequenze ? `ogni ${frequenze.integritaAnni} anni` : 'ogni 10 anni',
    })
  }

  return rows
}
