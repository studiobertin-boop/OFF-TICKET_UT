/**
 * Dove va scritto il tipo di tubazione scelto dal menu di un segno.
 *
 * In un file suo e non dentro `SchemaEdgeTubazione.tsx` per la stessa ragione degli hook accanto:
 * `react-refresh` non lascia esportare altro che componenti da un file di componenti, e questa
 * logica va provata.
 */
import type { SchemaArcoStile, SchemaSegnoTubo } from '@/services/schemaImpianto/types'

/**
 * Il tipo scelto dal menu, messo dove serve.
 *
 * «Verso il capo di arrivo» (`lato: 'a'`) è sempre lo `stileAValle` del segno stesso. «Verso il
 * capo di partenza» (`lato: 'da'`) è quello del segno che lo precede **lungo il tubo** — non
 * nell'array, che è in ordine di creazione — e se prima non ce n'è nessuno che dichiari un tipo,
 * è lo stile dell'arco. Guardare l'indice invece della posizione scriverebbe sul segno sbagliato,
 * e il cambio comparirebbe dall'altra parte del disegno.
 *
 * Non muta nulla: restituisce lo stile dell'arco e la lista dei segni come devono diventare.
 */
export function cambioTipoTratto(
  stileArco: SchemaArcoStile,
  segni: SchemaSegnoTubo[],
  indice: number,
  lato: 'da' | 'a',
  stile: SchemaArcoStile
): { stileArco: SchemaArcoStile; segni: SchemaSegnoTubo[] } {
  const scelto = segni[indice]
  if (!scelto) return { stileArco, segni }

  if (lato === 'a') {
    return { stileArco, segni: segni.map((s, i) => (i === indice ? { ...s, stileAValle: stile } : s)) }
  }

  // Il confine che apre il tratto «prima»: il segno con `t` più grande fra quelli che dichiarano
  // un tipo e stanno più indietro di questo.
  const precedente = segni
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.stileAValle && s.t < scelto.t)
    .sort((primo, secondo) => secondo.s.t - primo.s.t)[0]

  if (!precedente) return { stileArco: stile, segni }
  return {
    stileArco,
    segni: segni.map((s, i) => (i === precedente.i ? { ...s, stileAValle: stile } : s)),
  }
}
