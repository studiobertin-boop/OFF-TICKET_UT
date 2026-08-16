/**
 * Guide di allineamento durante il trascinamento: stato locale (non cronologia, è un
 * aiuto visivo) che segnala quando il nodo trascinato torna in riga con un altro. Isolato
 * dall'editor per lo stesso motivo di useGomiti.ts — SchemaEditor.tsx è già segnalato come
 * file da non far crescere senza motivo. La resa delle linee è in GuideAllineamento.tsx,
 * file a parte per non mescolare hook e componente nello stesso modulo.
 */
import { useCallback, useState } from 'react'
import type { Node } from '@xyflow/react'
import { guideDiAllineamento, type Guida } from '@/services/schemaImpianto/allineamento'
import type { SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import type { SchemaNodeData } from './SchemaNodeSymbol'

/** `data.nodo` non porta coordinate (vedi SchemaNodeData): `position`, aggiornata a ogni
 * evento di drag, è l'unica fonte da cui ricostruire il nodo posizionato. */
function posizionato(n: Node): SchemaNodoPosizionato {
  return { ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }
}

/**
 * `nodes` è l'intero elenco dei nodi dell'editor: serve a trovare, a ogni evento di drag,
 * le posizioni correnti di tutti gli altri nodi contro cui confrontare quello trascinato.
 */
export function useGuideAllineamento(nodes: Node[]) {
  const [guide, setGuide] = useState<Guida[]>([])

  const onNodeDrag = useCallback(
    (_evento: unknown, nodoTrascinato: Node, nodiTrascinati: Node[]) => {
      // In un trascinamento multiplo i nodi trascinati insieme non vanno confrontati fra
      // loro: si muovono in blocco e sarebbero sempre "in riga" l'uno con l'altro.
      const idTrascinati = new Set(nodiTrascinati.map((n) => n.id))
      const altri = nodes.filter((n) => !idTrascinati.has(n.id)).map(posizionato)
      // La libreria viaggia già dentro `data` (vedi `SchemaNodeData`, `layoutAFlow`): letta dal
      // nodo trascinato invece di ricevuta come parametro a parte, per non aggiungere un canale
      // in più a un hook che riceve solo `nodes`.
      const { libreria } = nodoTrascinato.data as SchemaNodeData
      setGuide(guideDiAllineamento(posizionato(nodoTrascinato), altri, libreria))
    },
    [nodes]
  )

  // Le guide sono un aiuto per il gesto in corso: a fine trascinamento non hanno più senso.
  const onNodeDragStop = useCallback(() => setGuide([]), [])

  return { guide, onNodeDrag, onNodeDragStop }
}
