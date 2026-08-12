/**
 * Conversione fra il modello dello schema e la rappresentazione di react-flow.
 * Funzioni pure: l'editor le usa a ogni modifica, e alla conferma si torna a un
 * `SchemaLayout` che il render statico sa già disegnare.
 */
import type { Edge, Node } from '@xyflow/react'
import { calcolaMuro } from '@/services/schemaImpianto/layout'
import type { SchemaArcoStile, SchemaLayout, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

export const TIPO_NODO_FLOW = 'simbolo'
export const TIPO_ARCO_FLOW = 'tubazione'

export function layoutAFlow(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = layout.nodi.map((nodo) => ({
    id: nodo.id,
    type: TIPO_NODO_FLOW,
    position: { x: nodo.x, y: nodo.y },
    data: { nodo } satisfies SchemaNodeData,
  }))

  // Da e a sono ora ancore vere del registro simboli, non attacchi dedotti dallo stile: gli
  // identificativi degli handle di SchemaNodeSymbol coincidono con quelli delle ancore.
  const edges: Edge[] = layout.archi.map((arco) => ({
    id: arco.id,
    source: arco.da.nodo,
    target: arco.a.nodo,
    sourceHandle: arco.da.ancora,
    targetHandle: arco.a.ancora,
    type: TIPO_ARCO_FLOW,
    data: { stile: arco.stile, punti: arco.punti } satisfies SchemaEdgeData,
  }))

  return { nodes, edges }
}

/**
 * Ricostruisce il modello dalle entità di react-flow. Il muro non è modificabile
 * nell'editor, ma la sua posizione sì: si ricalcola dalle posizioni correnti dei nodi,
 * altrimenti resterebbe ancorato a dov'era prima che l'utente spostasse le apparecchiature.
 */
export function flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout {
  const nodi = nodes.map((n) => ({
    ...((n.data as SchemaNodeData).nodo satisfies SchemaNodoPosizionato),
    x: n.position.x,
    y: n.position.y,
  }))
  return {
    nodi,
    archi: edges.map((e) => ({
      id: e.id,
      da: { nodo: e.source, ancora: e.sourceHandle ?? '' },
      a: { nodo: e.target, ancora: e.targetHandle ?? '' },
      stile: ((e.data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile,
      punti: (e.data as SchemaEdgeData | undefined)?.punti,
    })),
    muro: calcolaMuro(nodi),
  }
}
