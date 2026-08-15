/**
 * Il muro di separazione sulla tela: aggiungerlo, spostarlo in orizzontale, toglierlo. Isolato
 * dall'editor per lo stesso motivo di useTestiLiberi.ts — e perché questo file non monta
 * componenti React nei test (CLAUDE.md, «no UI test»): tutto quel che va provato sta nelle due
 * funzioni pure qui sotto, non nell'hook.
 *
 * Dello stato dell'editor il muro occupa un solo numero, `muroX`: l'altezza si ricava al disegno
 * (`muroDaAscissa`, layout.ts) e non va tenuta da nessuna parte.
 */
import { useCallback, useRef } from 'react'
import { calcolaMuro, DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import type { SchemaNodoPosizionato } from '@/services/schemaImpianto/types'

export interface StatoConMuro {
  muroX: number | null
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/**
 * Ascissa proposta per un muro nuovo: dove il muro stava da solo prima del Blocco D4, quando c'è
 * un bordo fra sala compressori e linea distribuzione da cui dedurlo (`calcolaMuro`, layout.ts) —
 * allineata alla griglia, perché `calcolaMuro` lavora in coordinate del disegno e non la conosce.
 * Senza un bordo (un solo gruppo popolato, o disegno vuoto) il muro nasce comunque, perché il
 * committente l'ha chiesto: in spazio libero, a destra di tutto il disegno — un muro che
 * nascesse sopra le apparecchiature sembrerebbe un difetto invece di una proposta.
 */
export function ascissaProposta(nodi: SchemaNodoPosizionato[]): number {
  const automatico = calcolaMuro(nodi)
  if (automatico) return allineaAllaGriglia(automatico.x)
  const bordo = nodi.length > 0 ? Math.max(...nodi.map((n) => n.x + DIMENSIONI_NODO[n.tipo].larghezza)) : 0
  return allineaAllaGriglia(bordo + 60)
}

/**
 * Il muro si posa sui punti della griglia, come tutto ciò che si piazza a mano (decisione 3 del
 * 14-08-2026). Si allinea qui, dove i test lo raggiungono, non nel componente.
 */
export function ascissaSpostata(x: number): number {
  return allineaAllaGriglia(x)
}

/**
 * Tre gesti sul muro, sulla falsariga di useTestiLiberi.ts:
 *
 * - `aggiungiMuro` accetta la proposta come funzione dello stato, non come numero già calcolato:
 *   chi la produce (`ascissaProposta`, applicata ai nodi correnti) deve leggere lo stato che il
 *   reducer sta per aggiornare, non quello catturato nella chiusura del render — stessa cautela
 *   di `aggiungiTesto` in useTestiLiberi.ts.
 * - `spostaMuro` manda in cronologia solo il PRIMO evento del gesto di trascinamento
 *   (`trascinamentoMuroAvviato`, come `trascinamentoTestoAvviato`): durante un trascinamento
 *   arrivano molti eventi al secondo, e la cronologia è profonda 10 — se ognuno vi entrasse si
 *   riempirebbe di stati intermedi e Ctrl+Z diventerebbe inutile; se entrasse solo l'ultimo, lo
 *   stato "precedente" sarebbe già quello finale e Ctrl+Z non riporterebbe da nessuna parte.
 * - `aggiungiMuro` e `rimuoviMuro` sono gesti singoli: sempre in cronologia.
 */
export function useMuro<T extends StatoConMuro>(applica: Aggiorna<T>, aggiornaSenzaCronologia: Aggiorna<T>) {
  const aggiungiMuro = useCallback(
    (proposta: (corrente: T) => number) => {
      applica((s) => ({ ...s, muroX: proposta(s) }))
    },
    [applica]
  )

  const trascinamentoMuroAvviato = useRef(false)

  const spostaMuro = useCallback(
    (x: number, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoMuroAvviato.current
      trascinamentoMuroAvviato.current = !concluso
      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({ ...s, muroX: ascissaSpostata(x) }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const rimuoviMuro = useCallback(() => {
    applica((s) => ({ ...s, muroX: null }))
  }, [applica])

  return { aggiungiMuro, spostaMuro, rimuoviMuro }
}
