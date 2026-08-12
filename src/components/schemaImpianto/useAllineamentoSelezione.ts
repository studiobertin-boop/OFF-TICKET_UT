/**
 * Applica allineamento e distribuzione alla selezione corrente. Isolato dall'editor per lo
 * stesso motivo di useGomiti.ts: la trasformazione (passare i nodi selezionati per
 * allinea/distribuisci e rimetterli nell'elenco di react-flow) non ha bisogno di altro
 * dell'editor oltre alla selezione e ad `applica`, e tenerla qui evita di far crescere
 * ulteriormente SchemaEditor.tsx — già segnalato come file da non gonfiare senza motivo.
 */
import { useCallback } from 'react'
import type { Node } from '@xyflow/react'
import { allinea, distribuisci, type Asse, type Bordo } from '@/services/schemaImpianto/allineamento'
import type { SchemaNodeData } from './SchemaNodeSymbol'

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

interface StatoConNodi {
  nodes: Node[]
}

/**
 * `selezione` è lo stato di `onSelectionChange` di react-flow: gli stessi nodi dell'editor,
 * non una copia, quindi basta il loro `id` per sapere chi è selezionato in `stato.nodes`.
 */
export function useAllineamentoSelezione<T extends StatoConNodi>(
  selezione: { nodes: Node[] },
  applica: Aggiorna<T>
) {
  const applicaAllineamento = useCallback(
    (bordo: Bordo) => {
      const selezionati = new Set(selezione.nodes.map((n) => n.id))
      if (selezionati.size < 2) return
      applica((s) => {
        // `data.nodo` non porta più le coordinate: `position` è l'unica fonte, e resta l'unica
        // cosa da riscrivere quando l'allineamento sposta un nodo.
        const nodi = s.nodes
          .filter((n) => selezionati.has(n.id))
          .map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }))
        const spostati = new Map(allinea(nodi, bordo).map((n) => [n.id, n]))
        return {
          ...s,
          nodes: s.nodes.map((n) => {
            const nuovo = spostati.get(n.id)
            return nuovo ? { ...n, position: { x: nuovo.x, y: nuovo.y } } : n
          }),
        }
      })
    },
    [applica, selezione.nodes]
  )

  // Stessa forma di applicaAllineamento, per la spaziatura uguale fra estremi fermi — e
  // stesso motivo per leggere `position`: vedi il commento lì sopra.
  const applicaDistribuzione = useCallback(
    (asse: Asse) => {
      const selezionati = new Set(selezione.nodes.map((n) => n.id))
      if (selezionati.size < 3) return
      applica((s) => {
        const nodi = s.nodes
          .filter((n) => selezionati.has(n.id))
          .map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }))
        const spostati = new Map(distribuisci(nodi, asse).map((n) => [n.id, n]))
        return {
          ...s,
          nodes: s.nodes.map((n) => {
            const nuovo = spostati.get(n.id)
            return nuovo ? { ...n, position: { x: nuovo.x, y: nuovo.y } } : n
          }),
        }
      })
    },
    [applica, selezione.nodes]
  )

  return { applicaAllineamento, applicaDistribuzione }
}
