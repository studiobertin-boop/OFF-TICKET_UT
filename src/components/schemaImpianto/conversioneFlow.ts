/**
 * Conversione fra il modello dello schema e la rappresentazione di react-flow.
 * Funzioni pure: l'editor le usa a ogni modifica, e alla conferma si torna a un
 * `SchemaLayout` che il render statico sa già disegnare.
 */
import type { Edge, Node } from '@xyflow/react'
import type { SchemaArcoStile, SchemaLayout, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import { ATTACCO, type SchemaNodeData } from './SchemaNodeSymbol'

export const TIPO_NODO_FLOW = 'simbolo'
export const TIPO_ARCO_FLOW = 'tubazione'

/**
 * Attacchi di partenza e arrivo per stile di tubazione, scelti perché l'editor mostri le
 * stesse rotte del disegno finale: la mandata di un compressore sale al collettore, la
 * linea condense scende alla corsia bassa, la linea di trattamento corre in orizzontale.
 */
export function attacchiPerStile(stile: SchemaArcoStile): { source: string; target: string } {
  if (stile === 'flessibile') return { source: ATTACCO.altoUscita, target: ATTACCO.sinistra }
  if (stile === 'condensa') return { source: ATTACCO.bassoUscita, target: ATTACCO.altoIngresso }
  return { source: ATTACCO.destra, target: ATTACCO.sinistra }
}

export function layoutAFlow(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = layout.nodi.map((nodo) => ({
    id: nodo.id,
    type: TIPO_NODO_FLOW,
    position: { x: nodo.x, y: nodo.y },
    data: { nodo } satisfies SchemaNodeData,
  }))

  const edges: Edge[] = layout.archi.map((arco) => {
    const attacchi = attacchiPerStile(arco.stile)
    return {
      id: arco.id,
      source: arco.da,
      target: arco.a,
      sourceHandle: attacchi.source,
      targetHandle: attacchi.target,
      type: TIPO_ARCO_FLOW,
      data: { stile: arco.stile } satisfies SchemaEdgeData,
    }
  })

  return { nodes, edges }
}

/**
 * Ricostruisce il modello dalle entità di react-flow. Il muro non è modificabile
 * nell'editor, quindi si riporta quello calcolato dall'auto-layout.
 */
export function flowALayout(nodes: Node[], edges: Edge[], muro: SchemaLayout['muro']): SchemaLayout {
  return {
    nodi: nodes.map((n) => ({
      ...((n.data as SchemaNodeData).nodo satisfies SchemaNodoPosizionato),
      x: n.position.x,
      y: n.position.y,
    })),
    archi: edges.map((e) => ({
      id: e.id,
      da: e.source,
      a: e.target,
      stile: ((e.data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile,
    })),
    muro,
  }
}
