/**
 * Engine — §3 FLUIDI DI PROCESSO.
 *
 * La sezione mancava del tutto dal template pur essendo presente in tutte le relazioni
 * consegnate. Oltre a ripristinarla, questo modulo risolve un rischio concreto: la
 * frase «aria priva di sostanze nocive» era incondizionata, quindi restava nel
 * documento anche quando la scheda dichiarava aria con acidi o vapori.
 *
 * La frase non viene riscritta automaticamente — sarebbe una valutazione tecnica —
 * ma segnalata al redattore tramite `evidenziaNocive`.
 */
import type { SchedaDatiCompleta, AriaAspirataOption } from '@/types/technicalSheet'
import type { FluidiModel, FluidoRow } from '../types'

/**
 * Qualità dell'aria che contraddicono la dichiarazione di assenza di sostanze nocive.
 * Umidità e polveri non vi rientrano: sono trattate dalle sezioni di filtrazione ed
 * essiccazione e non rendono l'aria "nociva" nel senso della sezione.
 */
const QUALITA_NOCIVE: AriaAspirataOption[] = ['Acidi', 'Vapori']

const PROVENIENZA: Record<string, string> = {
  ARIA: "Aspirazione dall'ambiente",
  AZOTO: 'Generazione o stoccaggio in sito',
}

export function buildFluidi(scheda: SchedaDatiCompleta): FluidiModel {
  const ariaAspirata = scheda.dati_impianto?.aria_aspirata ?? []
  const evidenziaNocive = ariaAspirata.some((q) => QUALITA_NOCIVE.includes(q))

  // Qualità dichiarate, esclusa "Pulita" che è l'assenza di annotazioni.
  const qualitaAria = ariaAspirata.filter((q) => q !== 'Pulita').join(', ')

  const righe: FluidoRow[] = []

  // Il circuito aria compressa esiste sempre che ci siano compressori.
  if ((scheda.compressori?.length ?? 0) > 0) {
    righe.push({
      circuito: 'Aria compressa',
      fluido: 'Aria ambiente',
      gruppo: '2',
      provenienza: PROVENIENZA.ARIA,
      qualita: qualitaAria,
    })
  }

  // Circuiti aggiuntivi dedotti dai serbatoi con fluido diverso dall'aria.
  const altriFluidi = new Map<string, string>()
  for (const s of scheda.serbatoi ?? []) {
    if (s.fluido === 'AZOTO') {
      altriFluidi.set('AZOTO', 'Azoto')
    } else if (s.fluido === 'ALTRO') {
      const nome = s.fluido_altro?.trim()
      if (nome) altriFluidi.set(nome.toUpperCase(), nome)
    }
  }

  for (const [chiave, nome] of altriFluidi) {
    righe.push({
      circuito: nome,
      fluido: nome,
      // Per l'azoto il gruppo 2 è pacifico; per un fluido arbitrario no: meglio una
      // cella vuota che un'affermazione normativa non verificata.
      gruppo: chiave === 'AZOTO' ? '2' : '',
      provenienza: PROVENIENZA[chiave] ?? '',
      qualita: '',
    })
  }

  return { righe, evidenziaNocive }
}
