/**
 * Engine — §5.4 nota sulle tubazioni.
 *
 * La frase di esclusione ex art. 3 comma bb) era incondizionata: affermava DN ≤ 80 mm
 * senza confrontarla con i diametri effettivamente rilevati. Qui il confronto si fa, e
 * oltre soglia il documento segnala l'obbligo di denuncia invece di negarlo.
 *
 * I diametri sono attesi in DN (mm): la conversione da pollici avviene nel selettore
 * della scheda dati, non qui.
 */
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { DN_SOGLIA_ESCLUSIONE } from '@/utils/dm329Classification'
import { formatNumberIT } from '../helpers'
import type { TubazioniModel } from '../types'

export function buildTubazioni(scheda: SchedaDatiCompleta): TubazioniModel {
  const d = scheda.dati_impianto
  const diametri = [d?.dn_sala_max, d?.dn_distribuzione_max].filter(
    (v): v is number => typeof v === 'number' && v > 0
  )

  // Senza diametri rilevati si mantiene la formulazione di esclusione: è lo stato
  // storico del documento, e il preflight segnala il dato mancante a parte.
  if (diametri.length === 0) {
    return { escluse: true, dnMassimo: '' }
  }

  const dnMassimo = Math.max(...diametri)
  return {
    escluse: dnMassimo <= DN_SOGLIA_ESCLUSIONE,
    dnMassimo: formatNumberIT(dnMassimo),
  }
}
