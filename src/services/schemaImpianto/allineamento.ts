/**
 * Allineamento e distribuzione della selezione. Funzioni pure su nodi posizionati: l'editor
 * le chiama e basta, e restano verificabili senza DOM.
 *
 * L'allineamento ragiona sul riquadro d'ingombro, non sul corpo disegnato: è quello che
 * l'utente vede muoversi quando trascina.
 */
import { dimensioniDi } from './symbols'
import type { SchemaNodoPosizionato } from './types'

export type Bordo = 'sinistra' | 'destra' | 'alto' | 'basso' | 'centroX' | 'centroY'
export type Asse = 'orizzontale' | 'verticale'

export function allinea(nodi: SchemaNodoPosizionato[], bordo: Bordo): SchemaNodoPosizionato[] {
  if (nodi.length < 2) return nodi
  // Ingombro effettivo: la scritta del terminale utenze ne allarga il riquadro, ed è quel
  // riquadro che l'utente vede muoversi quando allinea.
  const dim = (n: SchemaNodoPosizionato) => dimensioniDi(n)

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

/** Tolleranza entro cui due bordi si considerano in riga: mezzo passo di griglia. */
const TOLLERANZA = 5

export interface Guida {
  orientamento: 'verticale' | 'orizzontale'
  /** x se verticale, y se orizzontale. */
  quota: number
}

/**
 * Quote su cui il nodo trascinato si trova in riga con almeno un altro. Si confrontano i
 * tre riferimenti che l'occhio usa — bordo iniziale, centro, bordo finale — su entrambi gli assi.
 */
export function guideDiAllineamento(
  trascinato: SchemaNodoPosizionato,
  altri: SchemaNodoPosizionato[]
): Guida[] {
  const rif = (n: SchemaNodoPosizionato) => {
    const d = dimensioniDi(n)
    return {
      x: [n.x, n.x + d.larghezza / 2, n.x + d.larghezza],
      y: [n.y, n.y + d.altezza / 2, n.y + d.altezza],
    }
  }
  const mio = rif(trascinato)
  const guide: Guida[] = []

  for (const altro of altri) {
    const suo = rif(altro)
    for (const q of mio.x) {
      for (const s of suo.x) {
        if (Math.abs(q - s) <= TOLLERANZA) guide.push({ orientamento: 'verticale', quota: s })
      }
    }
    for (const q of mio.y) {
      for (const s of suo.y) {
        if (Math.abs(q - s) <= TOLLERANZA) guide.push({ orientamento: 'orizzontale', quota: s })
      }
    }
  }

  // Più coppie possono concordare sulla stessa quota: una riga sola basta a dirlo.
  return guide.filter(
    (g, i) => guide.findIndex((h) => h.orientamento === g.orientamento && h.quota === g.quota) === i
  )
}
