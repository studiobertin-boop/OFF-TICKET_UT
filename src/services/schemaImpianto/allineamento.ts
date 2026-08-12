/**
 * Allineamento e distribuzione della selezione. Funzioni pure su nodi posizionati: l'editor
 * le chiama e basta, e restano verificabili senza DOM.
 *
 * L'allineamento ragiona sul riquadro d'ingombro, non sul corpo disegnato: è quello che
 * l'utente vede muoversi quando trascina.
 */
import { DIMENSIONI_NODO } from './symbols'
import type { SchemaNodoPosizionato } from './types'

export type Bordo = 'sinistra' | 'destra' | 'alto' | 'basso' | 'centroX' | 'centroY'
export type Asse = 'orizzontale' | 'verticale'

export function allinea(nodi: SchemaNodoPosizionato[], bordo: Bordo): SchemaNodoPosizionato[] {
  if (nodi.length < 2) return nodi
  const dim = (n: SchemaNodoPosizionato) => DIMENSIONI_NODO[n.tipo]

  switch (bordo) {
    case 'sinistra': {
      const x = Math.min(...nodi.map((n) => n.x))
      return nodi.map((n) => ({ ...n, x }))
    }
    case 'destra': {
      const bordoDestro = Math.max(...nodi.map((n) => n.x + dim(n).larghezza))
      return nodi.map((n) => ({ ...n, x: bordoDestro - dim(n).larghezza }))
    }
    case 'alto': {
      const y = Math.min(...nodi.map((n) => n.y))
      return nodi.map((n) => ({ ...n, y }))
    }
    case 'basso': {
      const bordoBasso = Math.max(...nodi.map((n) => n.y + dim(n).altezza))
      return nodi.map((n) => ({ ...n, y: bordoBasso - dim(n).altezza }))
    }
    case 'centroX': {
      const centro = nodi.reduce((s, n) => s + n.x + dim(n).larghezza / 2, 0) / nodi.length
      return nodi.map((n) => ({ ...n, x: Math.round(centro - dim(n).larghezza / 2) }))
    }
    case 'centroY': {
      const centro = nodi.reduce((s, n) => s + n.y + dim(n).altezza / 2, 0) / nodi.length
      return nodi.map((n) => ({ ...n, y: Math.round(centro - dim(n).altezza / 2) }))
    }
  }
}

/** Spaziatura uguale fra gli estremi, che restano dove sono: sono il riferimento scelto. */
export function distribuisci(nodi: SchemaNodoPosizionato[], asse: Asse): SchemaNodoPosizionato[] {
  if (nodi.length < 3) return nodi
  const chiave = asse === 'orizzontale' ? 'x' : 'y'
  const ordinati = [...nodi].sort((a, b) => a[chiave] - b[chiave])
  const primo = ordinati[0][chiave]
  const ultimo = ordinati[ordinati.length - 1][chiave]
  const passo = (ultimo - primo) / (ordinati.length - 1)

  const nuova = new Map(ordinati.map((n, i) => [n.id, Math.round(primo + passo * i)]))
  return nodi.map((n) => ({ ...n, [chiave]: nuova.get(n.id)! }))
}
