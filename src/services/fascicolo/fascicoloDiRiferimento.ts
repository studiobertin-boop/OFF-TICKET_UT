/**
 * Dove sta il fascicolo di un'apparecchiatura soggetta a pratica INAIL.
 *
 * Il fascicolo si genera dalla riga su cui l'operatore ha caricato certificati e foto, e per
 * un'apparecchiatura collegata capita che lo faccia sulla principale: il fascicolo del serbatoio
 * disoleatore C1.1 generato su C1, quello dello scambiatore E1.1 su E1. Il documento è lo
 * stesso e la pratica ce l'ha: conta che esista, non su quale riga è nato.
 *
 * Il ripiego sulla principale vale solo quando la principale ha quella sola collegata. Un
 * essiccatore con due scambiatori (E1.1, E1.2) contiene due recipienti distinti, con due
 * fascicoli distinti: uno generato su E1 non si può attribuire a nessuno dei due.
 */
import { CHILD_ARRAYS } from './codiciScheda'

/** Gli array delle collegate, quanto basta a risalire alla principale. */
export type CollegateScheda = Partial<Record<(typeof CHILD_ARRAYS)[number]['array'], readonly object[]>>

/**
 * Codice sotto cui è archiviato il fascicolo dell'apparecchiatura `codice`: il suo, oppure
 * quello della principale quando questa ha lei sola come collegata. Null se non ce n'è.
 */
export function codiceDelFascicolo(
  codice: string,
  conFascicolo: ReadonlySet<string>,
  scheda: CollegateScheda
): string | null {
  if (conFascicolo.has(codice)) return codice

  for (const { array, ref } of CHILD_ARRAYS) {
    const collegate = (scheda[array] ?? []) as Record<string, unknown>[]
    const collegata = collegate.find((c) => c?.codice === codice)
    if (!collegata) continue
    const principale = collegata[ref]
    if (typeof principale !== 'string') return null
    const sorelle = collegate.filter((c) => c?.[ref] === principale)
    return sorelle.length === 1 && conFascicolo.has(principale) ? principale : null
  }
  return null
}
