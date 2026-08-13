/**
 * Conversione fra il modello dello schema e la rappresentazione di react-flow.
 * Funzioni pure: l'editor le usa a ogni modifica, e alla conferma si torna a un
 * `SchemaLayout` che il render statico sa già disegnare.
 */
import type { Edge, Node } from '@xyflow/react'
import { calcolaMuro } from '@/services/schemaImpianto/layout'
import { instrada, polilineaConGomiti, type Punto, type QuoteInstradamento } from '@/services/schemaImpianto/tratti'
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
 * si limita a chiamarla con i capi che react-flow gli passa. Il cablaggio è fatto:
 * `SchemaEditor` calcola le quote e ogni arco della tela arriva qui con `data.quote` già
 * valorizzato da `fondiDatiArchi` qui sotto.
 *
 * Senza `quote` non c'è modo di ricostruire le rotte native, e si ripiega sul raccordo
 * semplice: è una rete di sicurezza per il tipo, non un caso previsto nella tela reale — se
 * scattasse lì, il difetto originale (rotte diverse fra editor e documento) tornerebbe in
 * silenzio. Copre solo la produzione difensiva verso chiamanti che non passano da
 * `fondiDatiArchi` (il test dell'accordo, per esempio, costruisce `data` a mano in alcuni
 * casi). L'invariante «ogni arco della tela porta `quote`» è provata in
 * `__tests__/fondiDatiArchi.test.ts`.
 */
export function polilineaDellArco(pDa: Punto, pA: Punto, data: SchemaEdgeData | undefined): Punto[] {
  const stile = (data?.stile ?? 'standard') as SchemaArcoStile
  if (!data?.quote) return polilineaConGomiti(pDa, data?.punti ?? [], pA)
  return instrada(stile, pDa, pA, data.punti, data.quote)
}

/**
 * Fonde i tre elenchi di archi che `useGomiti`, `useSegniTubo` e `useTrascinamentoTratto`
 * derivano ognuno da `stato.edges` con dati aggiuntivi diversi (rispettivamente
 * `onSpostaGomito`/`onRimuoviGomito`, `onSpostaSegno`/`onRimuoviSegno`, `onTrascinaTratto`),
 * e vi infila le quote di instradamento del disegno intero (`quoteInstradamento`,
 * layout.ts). Estratta come funzione pura — invece di restare dentro l'`useMemo` di
 * `SchemaEditor` — perché è l'unico punto dove si può provare l'invariante che protegge dal
 * ripiego di `polilineaDellArco`: ogni arco che esce da qui porta `quote` valorizzato,
 * altrimenti la tela tornerebbe silenziosamente a disegnare l'angolo singolo.
 */
export function fondiDatiArchi(
  edgesConGomitiBase: Edge[],
  edgesConSegni: Edge[],
  edgesConTrascinamento: Edge[],
  quote: QuoteInstradamento
): Edge[] {
  return edgesConGomitiBase.map((e, i) => ({
    ...e,
    data: {
      ...e.data,
      ...edgesConSegni[i]?.data,
      ...edgesConTrascinamento[i]?.data,
      quote,
    } as SchemaEdgeData,
  }))
}
