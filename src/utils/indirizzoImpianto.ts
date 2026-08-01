/**
 * Indirizzo dell'impianto di una pratica DM329.
 *
 * La sorgente e' una sola, `requests.indirizzo_impianto`. Fino ad agosto 2026 lo stesso
 * dato viveva anche su `dm329_technical_data.indirizzo_impianto` e sulla chiave JSONB
 * `equipment_data.dati_impianto.sede_impianto`: entrambe sono state travasate qui dalla
 * migration `20260801000000` e non vanno piu' consultate.
 */
export const risolviIndirizzoImpianto = (indirizzo?: string | null): string =>
  (indirizzo ?? '').trim()
