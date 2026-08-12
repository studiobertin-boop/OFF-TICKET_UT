/**
 * Cronologia delle modifiche dell'editor, limitata agli ultimi stati: annullare è utile
 * per rimediare a un errore appena fatto, non per ripercorrere l'intera sessione, e uno
 * stack illimitato terrebbe in memoria una copia del disegno per ogni trascinamento.
 *
 * Redo volutamente assente: chi annulla di troppo rifà il gesto, che è un'azione sola.
 */
import { useCallback, useReducer } from 'react'

export const PROFONDITA_CRONOLOGIA = 10

export interface SchemaHistory<T> {
  stato: T
  /** Sostituisce lo stato salvando il precedente nella cronologia. */
  applica: (prossimo: T | ((corrente: T) => T)) => void
  /** Sostituisce lo stato senza toccare la cronologia (usato durante un trascinamento in corso). */
  aggiornaSenzaCronologia: (prossimo: T | ((corrente: T) => T)) => void
  annulla: () => void
  puoAnnullare: boolean
  /** Riparte da uno stato nuovo, azzerando la cronologia (es. rigenerazione automatica). */
  reimposta: (nuovo: T) => void
}

function risolvi<T>(prossimo: T | ((corrente: T) => T), corrente: T): T {
  return typeof prossimo === 'function' ? (prossimo as (c: T) => T)(corrente) : prossimo
}

interface Stato<T> {
  stato: T
  passato: T[]
}

type Azione<T> =
  | { tipo: 'applica'; prossimo: T | ((corrente: T) => T) }
  | { tipo: 'aggiornaSenzaCronologia'; prossimo: T | ((corrente: T) => T) }
  | { tipo: 'annulla' }
  | { tipo: 'reimposta'; nuovo: T }

// Un reducer, non due `useState` separati: React processa più `dispatch` dello stesso lotto
// applicando ognuno al risultato del precedente (è la natura di un reducer). Con due stati
// indipendenti, invece, `applica` leggeva "il precedente" da un ref aggiornato solo al
// render — due chiamate nello stesso lotto (es. `deleteElements` di @xyflow, che scatena
// `onEdgesChange` e poi `onNodesChange` in sequenza sincrona) leggevano la stessa istantanea
// di partenza, e la seconda `setStato` sovrascriveva il risultato della prima invece di
// comporsi con esso: un nodo cancellato con le sue tubazioni le rimetteva in cronologia.
function reducer<T>(s: Stato<T>, azione: Azione<T>): Stato<T> {
  switch (azione.tipo) {
    case 'applica':
      return {
        stato: risolvi(azione.prossimo, s.stato),
        passato: [...s.passato, s.stato].slice(-PROFONDITA_CRONOLOGIA),
      }
    case 'aggiornaSenzaCronologia':
      return { ...s, stato: risolvi(azione.prossimo, s.stato) }
    case 'annulla':
      if (s.passato.length === 0) return s
      return { stato: s.passato[s.passato.length - 1], passato: s.passato.slice(0, -1) }
    case 'reimposta':
      return { stato: azione.nuovo, passato: [] }
  }
}

export function useSchemaHistory<T>(iniziale: T): SchemaHistory<T> {
  const [{ stato, passato }, dispatch] = useReducer(reducer<T>, { stato: iniziale, passato: [] })

  const applica = useCallback((prossimo: T | ((corrente: T) => T)) => {
    dispatch({ tipo: 'applica', prossimo })
  }, [])

  const aggiornaSenzaCronologia = useCallback((prossimo: T | ((corrente: T) => T)) => {
    dispatch({ tipo: 'aggiornaSenzaCronologia', prossimo })
  }, [])

  const annulla = useCallback(() => {
    dispatch({ tipo: 'annulla' })
  }, [])

  const reimposta = useCallback((nuovo: T) => {
    dispatch({ tipo: 'reimposta', nuovo })
  }, [])

  return {
    stato,
    applica,
    aggiornaSenzaCronologia,
    annulla,
    puoAnnullare: passato.length > 0,
    reimposta,
  }
}
