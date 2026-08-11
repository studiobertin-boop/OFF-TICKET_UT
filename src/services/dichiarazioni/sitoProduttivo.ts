/**
 * Indirizzo del sito produttivo per la dichiarazione installatore: uguale alla sede legale del
 * cliente salvo indirizzo diverso dichiarato sul codice pratica. Stessa regola di
 * `src/services/relazione/engine/premessa.ts` (`sitoProduttivo`), ma qui il risultato va in una
 * dichiarazione legale con la grafia dell'indirizzo così com'è — non in maiuscolo come nella
 * copertina della relazione — quindi non si riusa quella funzione (accoppiata ad `AdditionalInfo`
 * e alla resa tipografica della relazione) e si tiene questa versione minima a sé.
 */
export interface DatiSitoProduttivo {
  impiantoUgualeSedeLegale?: boolean | null
  indirizzoImpianto?: string | null
  customer: {
    via?: string | null
    numero_civico?: string | null
    cap?: string | null
    comune?: string | null
    provincia?: string | null
  } | null
}

export function risolviSitoProduttivo(dati: DatiSitoProduttivo): string {
  const libero = dati.indirizzoImpianto?.trim()
  const uguale = dati.impiantoUgualeSedeLegale === true || !libero
  if (!uguale) return libero!

  const c = dati.customer
  if (!c) return ''
  const via = [c.via, c.numero_civico ? `n.${c.numero_civico}` : ''].filter(Boolean).join(' ')
  const localita = [c.cap, c.comune].filter(Boolean).join(' ')
  const localitaConProvincia = localita ? `${localita}${c.provincia ? ` (${c.provincia})` : ''}` : ''
  return [via, localitaConProvincia].filter(Boolean).join(' - ')
}
