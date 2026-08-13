/**
 * Conversione fra il modello dello schema e la rappresentazione di react-flow.
 * Funzioni pure: l'editor le usa a ogni modifica, e alla conferma si torna a un
 * `SchemaLayout` che il render statico sa già disegnare.
 */
import type { Edge, Node } from '@xyflow/react'
import { calcolaMuro } from '@/services/schemaImpianto/layout'
import { posizioneAncora } from '@/services/schemaImpianto/renderSvg'
import { instrada, polilineaConGomiti, type Punto, type QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import type {
  SchemaArcoStile,
  SchemaLayout,
  SchemaNodoPosizionato,
  SchemaTestoLibero,
} from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

export const TIPO_NODO_FLOW = 'simbolo'
export const TIPO_ARCO_FLOW = 'tubazione'

export function layoutAFlow(
  layout: SchemaLayout
): { nodes: Node[]; edges: Edge[]; testi: SchemaTestoLibero[] } {
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

  // I testi non sono nodi di react-flow (nessuna ancora, nessuna tubazione può attaccarcisi):
  // attraversano il ponte come lista a sé, senza nulla da convertire.
  return { nodes, edges, testi: layout.testi ?? [] }
}

/**
 * Ricostruisce il modello dalle entità di react-flow. Il muro non è modificabile
 * nell'editor, ma la sua posizione sì: si ricalcola dalle posizioni correnti dei nodi,
 * altrimenti resterebbe ancorato a dov'era prima che l'utente spostasse le apparecchiature.
 */
export function flowALayout(
  nodes: Node[],
  edges: Edge[],
  testi: SchemaTestoLibero[]
): SchemaLayout {
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
    // I testi non sono nodi di react-flow: non stanno in `nodes`/`edges`, quindi viaggiano come
    // terzo parametro esplicito, per copia di riferimento e senza trasformazioni — il ponte
    // esiste solo perché lo stato dell'editor e il layout hanno forme diverse, non perché le
    // annotazioni vadano convertite. Il parametro è obbligatorio apposta: un default `[]`
    // lascerebbe perdere in silenzio le annotazioni a chi dimentica di passarle, esattamente
    // il difetto per cui esiste `SchemaLayout.testi` obbligatorio. Il solo chiamante di
    // produzione è `SchemaEditor` (`layoutCorrente`, dallo stato `testi` che sopravvive a
    // cronologia e undo), dove ora si creano dal pulsante «Testo» della palette e si trascinano
    // sulla tela (TestiLiberi.tsx).
    testi,
  }
}

/** I due capi di un arco, in coordinate del disegno: dove il tubo parte e dove arriva. */
export interface CapiArco {
  da: Punto
  a: Punto
}

/**
 * I capi di ogni arco del disegno, calcolati con `posizioneAncora` — la STESSA funzione che
 * usa il documento (renderSvg.ts), sullo stesso layout. È il motivo per cui esiste: react-flow
 * passa all'arco (`sourceX`/`sourceY`) il bordo esterno dell'handle secondo il suo lato, non il
 * centro dell'ancora, e i due disegni ne uscivano sfalsati di metà handle (5 unità) a ogni capo
 * — scarto che non resta ai capi, perché `rottaLinea` ricava `xMedia` da loro e lo propaga ai
 * vertici intermedi.
 *
 * Un arco i cui capi non si trovano (arco orfano: il nodo è stato eliminato ma la tubazione no)
 * resta fuori dalla mappa. Non è un caso da coprire disegnando qualcosa: react-flow non rende
 * affatto un arco con un capo su un nodo che non esiste.
 */
export function capiDegliArchi(layout: SchemaLayout): Map<string, CapiArco> {
  const nodi = new Map(layout.nodi.map((n) => [n.id, n]))
  const capi = new Map<string, CapiArco>()
  for (const arco of layout.archi) {
    const nodoDa = nodi.get(arco.da.nodo)
    const nodoA = nodi.get(arco.a.nodo)
    if (!nodoDa || !nodoA) continue
    capi.set(arco.id, {
      da: posizioneAncora(nodoDa, arco.da.ancora),
      a: posizioneAncora(nodoA, arco.a.ancora),
    })
  }
  return capi
}

/**
 * L'unico posto che decide da dove a dove va un arco sulla tela. `SchemaEdgeTubazione` la
 * chiama una volta sola e usa il risultato per TUTTO — la polilinea disegnata, l'area di
 * presa, i capi che consegna a `trascinaTratto` — perché due fonti diverse per i capi dello
 * stesso arco rimetterebbero in piedi la divergenza che questo blocco ha chiuso.
 *
 * Il `ripiego` sono i capi di react-flow (`sourceX`/`sourceY`), sbagliati di metà handle: è la
 * rete di sicurezza per il tipo, non un caso previsto sulla tela — stesso trattamento di
 * `quote`. L'invariante «ogni arco della tela porta `capi`» è provata in
 * `__tests__/fondiDatiArchi.test.ts`.
 */
export function capiDellArco(data: SchemaEdgeData | undefined, ripiego: CapiArco): CapiArco {
  return data?.capi ?? ripiego
}

/**
 * Polilinea di un arco dell'editor: la stessa che il documento disegnerà per quell'arco,
 * perché passa dalla stessa `instrada` (tratti.ts) sugli stessi capi. Vive qui e non dentro
 * `SchemaEdgeTubazione` per poter essere provata senza montare react-flow. Il cablaggio è
 * fatto: `SchemaEditor` calcola quote e capi, e ogni arco della tela arriva qui con
 * `data.quote` e `data.capi` già valorizzati da `fondiDatiArchi` qui sotto — i capi risolti
 * da `capiDellArco`, non le coordinate degli handle.
 *
 * Senza `quote` non c'è modo di ricostruire le rotte native, e si ripiega sul raccordo
 * semplice: è una rete di sicurezza per il tipo, non un caso previsto nella tela reale — se
 * scattasse lì, il difetto originale (rotte diverse fra editor e documento) tornerebbe in
 * silenzio. Nessun chiamante del repo, di produzione o di test, ci passa oggi: è deliberato,
 * non un buco di copertura — il ramo resta per intercettare in silenzio, non per rimanere,
 * un futuro chiamante che dimentichi `fondiDatiArchi`.
 */
export function polilineaDellArco(capi: CapiArco, data: SchemaEdgeData | undefined): Punto[] {
  const stile = (data?.stile ?? 'standard') as SchemaArcoStile
  if (!data?.quote) return polilineaConGomiti(capi.da, data?.punti ?? [], capi.a)
  return instrada(stile, capi.da, capi.a, data.punti, data.quote)
}

/**
 * Fonde i tre elenchi di archi che `useGomiti`, `useSegniTubo` e `useTrascinamentoTratto`
 * derivano ognuno da `stato.edges` con dati aggiuntivi diversi (rispettivamente
 * `onSpostaGomito`/`onRimuoviGomito`, `onSpostaSegno`/`onRimuoviSegno`, `onTrascinaTratto`),
 * e vi infila le due cose che un arco non può ricavarsi da solo: le quote di instradamento del
 * disegno intero (`quoteInstradamento`, layout.ts) e i propri capi presi dalle ancore
 * (`capiDegliArchi` qui sopra). Estratta come funzione pura — invece di restare dentro
 * l'`useMemo` di `SchemaEditor` — perché è l'unico punto dove si possono provare le due
 * invarianti che proteggono dai ripieghi: ogni arco che esce da qui porta `quote` (senza,
 * la tela tornerebbe a disegnare l'angolo singolo) e `capi` (senza, tornerebbe alle
 * coordinate degli handle, sfalsate di 5 unità rispetto al documento).
 */
export function fondiDatiArchi(
  edgesConGomitiBase: Edge[],
  edgesConSegni: Edge[],
  edgesConTrascinamento: Edge[],
  quote: QuoteInstradamento,
  capiPerArco: Map<string, CapiArco>
): Edge[] {
  return edgesConGomitiBase.map((e, i) => ({
    ...e,
    data: {
      ...e.data,
      ...edgesConSegni[i]?.data,
      ...edgesConTrascinamento[i]?.data,
      quote,
      capi: capiPerArco.get(e.id),
    } as SchemaEdgeData,
  }))
}
