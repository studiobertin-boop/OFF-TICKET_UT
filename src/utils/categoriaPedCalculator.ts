import type { CategoriaPED } from '@/types/technicalSheet'

/**
 * Calcola categoria PED basata su PS × Volume
 *
 * Formula:
 * - PS × V < 200 → I
 * - PS × V < 1000 → II
 * - PS × V < 3000 → III
 * - PS × V >= 3000 → IV
 *
 * @param ps Pressione massima (bar)
 * @param volume Volume (litri)
 * @returns Categoria PED (I, II, III, IV) o undefined se dati insufficienti
 */
export function calculateCategoriaPED(
  ps: number | undefined | null,
  volume: number | undefined | null
): CategoriaPED | undefined {
  // Verifica che entrambi i valori siano validi
  if (ps === undefined || ps === null || volume === undefined || volume === null) {
    return undefined
  }

  // Verifica che siano numeri positivi
  if (isNaN(ps) || isNaN(volume) || ps <= 0 || volume <= 0) {
    return undefined
  }

  const psv = ps * volume

  if (psv < 200) return 'I'
  if (psv < 1000) return 'II'
  if (psv < 3000) return 'III'
  return 'IV'
}

/**
 * Restituisce la descrizione testuale della categoria PED
 *
 * @param categoria Categoria PED
 * @returns Descrizione testuale
 */
export function getCategoriaPEDDescription(categoria: CategoriaPED | undefined): string {
  switch (categoria) {
    case 'I':
      return 'Categoria I (PS × V < 200)'
    case 'II':
      return 'Categoria II (PS × V < 1000)'
    case 'III':
      return 'Categoria III (PS × V < 3000)'
    case 'IV':
      return 'Categoria IV (PS × V ≥ 3000)'
    default:
      return 'Non calcolabile (inserire PS e Volume)'
  }
}

/**
 * Verifica se la categoria PED manuale corrisponde a quella calcolata
 *
 * @param manuale Categoria impostata manualmente
 * @param ps Pressione massima (bar)
 * @param volume Volume (litri)
 * @returns true se corrispondono, false altrimenti
 */
export function isCategoriaPEDConsistent(
  manuale: CategoriaPED | undefined,
  ps: number | undefined | null,
  volume: number | undefined | null
): boolean {
  const calcolata = calculateCategoriaPED(ps, volume)

  // Se non è possibile calcolare, consideriamo consistente
  if (calcolata === undefined) return true

  // Se non c'è valore manuale, consideriamo inconsistente
  if (manuale === undefined) return false

  return manuale === calcolata
}
