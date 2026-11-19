import { ARRAY_RECIPIENTI } from '@/types/technicalSheet'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'

/**
 * Posizioni dei recipienti segnati per la verifica di integrità (prova spessimetrica).
 *
 * Il dato vive sulla singola apparecchiatura, nel suo dettaglio in scheda dati: relazione
 * tecnica e riepilogo CIVA lo ereditano da lì. Fino al 28-09-2026 si dichiarava invece come
 * elenco di codici in `additional_info.spessimetrica`, compilato alla generazione della
 * relazione — un elenco a parte che non seguiva l'apparecchiatura quando la si rinumerava.
 */
export function codiciSpessimetrica(scheda: SchedaDatiCompleta): string[] {
  const recipienti: { codice: string; spessimetrica?: boolean }[] = []
  // I disoleatori vengono per primi, come prima dell'introduzione di `ARRAY_RECIPIENTI`: l'ordine
  // dell'elenco è osservabile nei documenti e per le schede esistenti non deve cambiare.
  const ordine = ['disoleatori', ...ARRAY_RECIPIENTI.filter((a) => a !== 'disoleatori')] as (typeof ARRAY_RECIPIENTI)[number][]
  for (const array of ordine) recipienti.push(...((scheda[array] as typeof recipienti | undefined) ?? []))
  return recipienti
    .filter((r) => r?.spessimetrica === true && r.codice)
    .map((r) => r.codice)
}
