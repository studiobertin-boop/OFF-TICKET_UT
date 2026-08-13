/**
 * Conversione fra il modello dello schema e la rappresentazione di react-flow.
 * Funzioni pure: l'editor le usa a ogni modifica, e alla conferma si torna a un
 * `SchemaLayout` che il render statico sa già disegnare.
 */
import type { Edge, Node } from '@xyflow/react'
import { calcolaMuro } from '@/services/schemaImpianto/layout'
import { instrada, polilineaConGomiti, type Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArcoStile, SchemaLayout, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

export const TIPO_NODO_FLOW = 'simbolo'
export const TIPO_ARCO_FLOW = 'tubazione'

export function layoutAFlow(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = layout.nodi.map(({ x, y, ...nodo }) => ({
    id: nodo.id,
    type: TIPO_NODO_FLOW,
    position: { x, y },
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
    data: { stile: arco.stile, punti: arco.punti, segni: arco.segni } satisfies SchemaEdgeData,
  }))

  return { nodes, edges }
}

/**
 * Ricostruisce il modello dalle entità di react-flow. Il muro non è modificabile
 * nell'editor, ma la sua posizione sì: si ricalcola dalle posizioni correnti dei nodi,
 * altrimenti resterebbe ancorato a dov'era prima che l'utente spostasse le apparecchiature.
 */
export function flowALayout(nodes: Node[], edges: Edge[]): SchemaLayout {
  const nodi: SchemaNodoPosizionato[] = nodes.map((n) => ({
    ...(n.data as SchemaNodeData).nodo,
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
      segni: (e.data as SchemaEdgeData | undefined)?.segni,
    })),
    muro: calcolaMuro(nodi),
  }
}

/**
 * Polilinea di un arco dell'editor: la stessa che il documento disegnerà per quell'arco,
 * perché passa dalla stessa `instrada` (tratti.ts). Vive qui e non dentro
 * `SchemaEdgeTubazione` per poter essere provata senza montare react-flow — il componente
 * si limita a chiamarla con i capi che react-flow gli passa.
 *
 * Senza `quote` (che `SchemaEditor` calcola a ogni aggiornamento e infila nei dati di ogni
 * arco) non c'è modo di ricostruire le rotte native, e si ripiega sul raccordo semplice: è
 * una rete di sicurezza per il tipo, non un caso previsto: se compare sulla tela, il
 * cablaggio delle quote si è rotto.
 *
 * NOTA sullo stato attuale del repo: quel cablaggio non c'è ancora. `SchemaEditor` non
 * calcola le quote, nessuno valorizza `SchemaEdgeData.quote` e `SchemaEdgeTubazione` non
 * chiama questa funzione — disegna ancora da sé con `polilineaConGomiti`. Finché il task
 * successivo non collega le due cose, l'unico chiamante è il test dell'accordo fra tela e
 * documento (`__tests__/instradamentoCondiviso.test.ts`).
 */
export function polilineaDellArco(pDa: Punto, pA: Punto, data: SchemaEdgeData | undefined): Punto[] {
  const stile = (data?.stile ?? 'standard') as SchemaArcoStile
  if (!data?.quote) return polilineaConGomiti(pDa, data?.punti ?? [], pA)
  return instrada(stile, pDa, pA, data.punti, data.quote)
}
