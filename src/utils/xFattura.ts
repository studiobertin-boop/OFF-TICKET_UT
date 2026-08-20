/**
 * Calcolo automatico di X Fattura (custom_fields.x_fattura) dal numero di apparecchiature
 * soggette a dichiarazione o verifica CIVA in una scheda dati.
 *
 * A differenza di `filterCIVAEquipment` (usata dal Riepilogo Dati CIVA), qui non serve il
 * costruttore censito a anagrafica: la fatturazione conta le apparecchiature che richiedono
 * CIVA per classificazione (volume/pressione), non quelle già pronte da copiare sul portale.
 */

import type { SchedaDatiCompleta } from '@/types'
import { determineTipoPratica } from './civaFiltering'

export function countApparecchiCIVA(equipmentData: SchedaDatiCompleta | null | undefined): number {
  if (!equipmentData) return 0

  const tutti = [
    ...(equipmentData.serbatoi ?? []),
    ...(equipmentData.scambiatori ?? []),
    ...(equipmentData.disoleatori ?? []),
    ...(equipmentData.recipienti_filtro ?? [])
  ]

  return tutti.filter(
    apparecchio =>
      apparecchio.volume &&
      apparecchio.ps_pressione_max &&
      determineTipoPratica(apparecchio.volume, apparecchio.ps_pressione_max) !== 'NESSUNA'
  ).length
}

/** Una fattura ogni 3 apparecchiature soggette a CIVA (1-3 → 1, 4-6 → 2, 7-9 → 3, ...). */
export function computeXFattura(numeroApparecchiCIVA: number): number {
  return Math.max(1, Math.ceil(numeroApparecchiCIVA / 3))
}
