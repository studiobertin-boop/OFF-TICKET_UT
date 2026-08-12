/**
 * Gomiti trascinabili sulle tubazioni: creare un punto di passaggio con un doppio clic,
 * spostarlo trascinandolo, toglierlo con un doppio clic sulla maniglia. Isolato dall'editor
 * perché la geometria (su quale tratto della polilinea è caduto un clic) non ha niente a
 * che fare con lo stato del disegno, e tenerla qui evita di far crescere ulteriormente
 * SchemaEditor.tsx — già segnalato come file da non gonfiare senza motivo.
 */
import { useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useReactFlow, type Edge, type Node } from '@xyflow/react'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { SchemaNodoTipo } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/**
 * Posizione assoluta di un'ancora: stesso calcolo che `SchemaNodeSymbol` usa per piazzare
 * l'Handle di react-flow, serve qui per sapere dove parte e arriva davvero una tubazione
 * quando si deve decidere in che punto della polilinea cade un doppio clic.
 */
function posizioneAncora(
  nodo: { tipo: SchemaNodoTipo; orientamento?: 'VERTICALE' | 'ORIZZONTALE'; x: number; y: number },
  ancoraId: string
): { x: number; y: number } | null {
  const ancora = ancoraDi(nodo, ancoraId)
  return ancora ? { x: nodo.x + ancora.x, y: nodo.y + ancora.y } : null
}

/** Distanza fra un punto e il segmento (proiezione bloccata agli estremi, non la retta). */
function distanzaDaSegmento(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lunghezzaQuadra = dx * dx + dy * dy
  const t = lunghezzaQuadra === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lunghezzaQuadra))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Indice di `punti` in cui inserire un gomito nuovo: quello del segmento più vicino al
 * clic, non sempre in coda. Un gomito aggiunto in mezzo a una polilinea già piegata deve
 * finire fra i due punti del tratto su cui si è cliccato, o il percorso si annoda.
 */
function indiceInserimento(
  partenza: { x: number; y: number },
  arrivo: { x: number; y: number },
  puntiEsistenti: { x: number; y: number }[],
  clic: { x: number; y: number }
): number {
  const sequenza = [partenza, ...puntiEsistenti, arrivo]
  let indiceMigliore = 0
  let distanzaMinima = Infinity
  for (let i = 0; i < sequenza.length - 1; i++) {
    const d = distanzaDaSegmento(clic, sequenza[i], sequenza[i + 1])
    if (d < distanzaMinima) {
      distanzaMinima = d
      indiceMigliore = i
    }
  }
  return indiceMigliore
}

/**
 * `stato`/`applica`/`aggiornaSenzaCronologia` sono la stessa tripletta di `useSchemaHistory`:
 * i gomiti sono un'altra modifica al disegno, con le stesse regole di cronologia dei nodi.
 */
export function useGomiti<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  // Serve a tradurre un clic sulla tela (coordinate schermo) nelle coordinate del flow in
  // cui vivono nodi, archi e gomiti: la stessa funzione che react-flow usa internamente.
  const { screenToFlowPosition } = useReactFlow()

  // Doppio clic sulla tubazione: aggiunge un gomito nel punto cliccato. Le ancore vere
  // (non le sourceX/targetX approssimate dal solo layout dei nodi) servono a capire su
  // quale tratto della polilinea è caduto il clic, altrimenti l'indice d'inserimento
  // sbaglierebbe proprio sui percorsi già piegati che questo gesto deve rispettare.
  const creaGomito = useCallback(
    (evento: ReactMouseEvent, arco: Edge) => {
      const nodoPartenza = stato.nodes.find((n) => n.id === arco.source)
      const nodoArrivo = stato.nodes.find((n) => n.id === arco.target)
      if (!nodoPartenza || !nodoArrivo) return
      // La posizione conta più di quella salvata in data.nodo.x/y: un nodo appena
      // trascinato aggiorna solo `position`, non la copia nel modello.
      const datiPartenza = { ...(nodoPartenza.data as SchemaNodeData).nodo, ...nodoPartenza.position }
      const datiArrivo = { ...(nodoArrivo.data as SchemaNodeData).nodo, ...nodoArrivo.position }
      const partenza = posizioneAncora(datiPartenza, arco.sourceHandle ?? '')
      const arrivo = posizioneAncora(datiArrivo, arco.targetHandle ?? '')
      if (!partenza || !arrivo) return

      const clic = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
      const puntiEsistenti = (arco.data as SchemaEdgeData | undefined)?.punti ?? []
      const indice = indiceInserimento(partenza, arrivo, puntiEsistenti, clic)

      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arco.id) return e
          const punti = [...(((e.data as SchemaEdgeData).punti) ?? [])]
          punti.splice(indice, 0, clic)
          return { ...e, data: { ...(e.data as SchemaEdgeData), punti } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, screenToFlowPosition, stato.nodes]
  )

  // Trascinamento della maniglia: il PRIMO evento del gesto entra in cronologia, non
  // l'ultimo — come per lo spostamento di un nodo (vedi `onNodesChange` in
  // SchemaEditor.tsx, stesso difetto misurato e corretto nel giro di riparazione 1, causa
  // B/C). Registrare l'ultimo (il rilascio) leggerebbe uno stato ormai già spostato dagli
  // eventi intermedi (`concluso:false`, uno per ogni movimento del mouse durante il
  // trascinamento): Ctrl+Z non tornerebbe mai al punto di partenza.
  const trascinamentoGomitoAvviato = useRef(false)

  const spostaGomito = useCallback(
    (arcoId: string, indice: number, posizione: { x: number; y: number }, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoGomitoAvviato.current
      trascinamentoGomitoAvviato.current = !concluso
      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const punti = [...(((e.data as SchemaEdgeData).punti) ?? [])]
          punti[indice] = posizione
          return { ...e, data: { ...(e.data as SchemaEdgeData), punti } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  // Doppio clic sulla maniglia: la toglie. Un gesto solo, come creare il gomito, quindi
  // sempre in cronologia.
  const rimuoviGomito = useCallback(
    (arcoId: string, indice: number) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const punti = (((e.data as SchemaEdgeData).punti) ?? []).filter((_, i) => i !== indice)
          return { ...e, data: { ...(e.data as SchemaEdgeData), punti } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica]
  )

  // Gli archi passati alla tela portano anche le callback dei gomiti, legate al proprio id:
  // `SchemaEdgeTubazione` non conosce la cronologia, sa solo chiamare "sposta questo punto"
  // o "togli questo". Lo stato pulito (`stato.edges`, senza funzioni) resta quello che
  // arriva a `flowALayout` alla conferma.
  const edgesConGomiti = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onSpostaGomito: (indice: number, posizione: { x: number; y: number }, concluso: boolean) =>
            spostaGomito(e.id, indice, posizione, concluso),
          onRimuoviGomito: (indice: number) => rimuoviGomito(e.id, indice),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, spostaGomito, rimuoviGomito]
  )

  return { creaGomito, edgesConGomiti }
}
