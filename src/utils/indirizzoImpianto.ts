/**
 * L'indirizzo dell'impianto e' storicamente finito in tre posti diversi. La sorgente
 * unica e' `requests.indirizzo_impianto`; le altre due restano solo come ripiego in
 * lettura per le pratiche non ancora migrate, e spariranno con il DROP delle colonne.
 */
export interface FontiIndirizzoImpianto {
  /** `requests.indirizzo_impianto` — sorgente unica. */
  indirizzoRichiesta?: string | null
  /** `dm329_technical_data.indirizzo_impianto` — legacy. */
  indirizzoSchedaLegacy?: string | null
  /** `equipment_data.dati_impianto.sede_impianto` — legacy. */
  sedeImpiantoLegacy?: string | null
}

export const risolviIndirizzoImpianto = (fonti: FontiIndirizzoImpianto): string =>
  [fonti.indirizzoRichiesta, fonti.indirizzoSchedaLegacy, fonti.sedeImpiantoLegacy]
    .map((v) => (v ?? '').trim())
    .find((v) => v.length > 0) ?? ''
