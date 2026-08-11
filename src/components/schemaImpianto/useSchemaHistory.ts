/**
 * Cronologia delle modifiche dell'editor, limitata agli ultimi stati: annullare è utile
 * per rimediare a un errore appena fatto, non per ripercorrere l'intera sessione, e uno
 * stack illimitato terrebbe in memoria una copia del disegno per ogni trascinamento.
 *
 * Redo volutamente assente: chi annulla di troppo rifà il gesto, che è un'azione sola.
 */
import { useCallback, useRef, useState } from 'react'

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

export function useSchemaHistory<T>(iniziale: T): SchemaHistory<T> {
  const [stato, setStato] = useState<T>(iniziale)
  const [passato, setPassato] = useState<T[]>([])
  // Lo stato corrente serve dentro `applica` senza rimetterlo fra le dipendenze: così
  // l'identità delle callback resta stabile e non fa ridisegnare l'editor a ogni modifica.
  const statoRef = useRef(stato)
  statoRef.current = stato

  const applica = useCallback((prossimo: T | ((corrente: T) => T)) => {
    const precedente = statoRef.current
    setPassato((p) => [...p, precedente].slice(-PROFONDITA_CRONOLOGIA))
    setStato(risolvi(prossimo, precedente))
  }, [])

  const aggiornaSenzaCronologia = useCallback((prossimo: T | ((corrente: T) => T)) => {
    setStato((corrente) => risolvi(prossimo, corrente))
  }, [])

  const annulla = useCallback(() => {
    setPassato((p) => {
      if (p.length === 0) return p
      setStato(p[p.length - 1])
      return p.slice(0, -1)
    })
  }, [])

  const reimposta = useCallback((nuovo: T) => {
    setPassato([])
    setStato(nuovo)
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
