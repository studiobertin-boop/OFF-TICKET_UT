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
  return [
    ...(scheda.disoleatori ?? []),
    ...(scheda.serbatoi ?? []),
    ...(scheda.scambiatori ?? []),
    ...(scheda.recipienti_filtro ?? []),
  ]
    .filter((r) => r?.spessimetrica === true && r.codice)
    .map((r) => r.codice)
}
