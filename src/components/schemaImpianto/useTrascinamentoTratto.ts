/**
 * Trascinamento in blocco di un tratto dritto di tubazione: si afferra un tratto e lo si fa
 * scorrere, i gomiti ai capi si aggiustano da soli (`trascinaTratto`, in tratti.ts). Gesto
 * distinto da quello dei gomiti (useGomiti.ts): lì si crea/sposta/toglie un punto, qui si
 * sposta un intero tratto già esistente fra due punti (ancore o gomiti che siano).
 */
import { useCallback, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { trascinaTratto, type Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/** Distanza fra un punto e il segmento (proiezione bloccata agli estremi). Stessa formula di
 *  `distanzaDaSegmento` in useGomiti.ts: duplicata qui per non introdurre un accoppiamento
 *  fra due hook che restano concettualmente indipendenti. */
function distanzaDaSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lunghezzaQuadra = dx * dx + dy * dy
  const t = lunghezzaQuadra === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lunghezzaQuadra))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Indice del tratto (fra `full[i]` e `full[i+1]`) più vicino a un punto. */
export function indiceTrattoPiuVicino(full: Punto[], p: Punto): number {
  let indiceMigliore = 0
  let distanzaMinima = Infinity
  for (let i = 0; i < full.length - 1; i++) {
    const d = distanzaDaSegmento(p, full[i], full[i + 1])
    if (d < distanzaMinima) {
      distanzaMinima = d
      indiceMigliore = i
    }
  }
  return indiceMigliore
}

export function useTrascinamentoTratto<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  // Stesso principio di useGomiti.ts: il PRIMO evento del gesto entra in cronologia.
  const trascinamentoAvviato = useRef(false)
  // Punto di riferimento dell'ultimo evento, per calcolare il delta incrementale del prossimo.
  const ultimoPuntoRef = useRef<Punto | null>(null)

  const trascinaSegmento = useCallback(
    (arcoId: string, pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoAvviato.current
      if (primoEventoDelGesto) ultimoPuntoRef.current = puntoLibero
      trascinamentoAvviato.current = !concluso
      const riferimento = ultimoPuntoRef.current ?? puntoLibero
      const delta = { x: puntoLibero.x - riferimento.x, y: puntoLibero.y - riferimento.y }
      ultimoPuntoRef.current = puntoLibero

      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const gomiti = (e.data as SchemaEdgeData).punti ?? []
          const nuovi = trascinaTratto(pDa, gomiti, pA, indiceTratto, delta)
          return { ...e, data: { ...(e.data as SchemaEdgeData), punti: nuovi } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const edgesConTrascinamento = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onTrascinaTratto: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) =>
            trascinaSegmento(e.id, pDa, pA, indiceTratto, puntoLibero, concluso),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, trascinaSegmento]
  )

  return { edgesConTrascinamento }
}
