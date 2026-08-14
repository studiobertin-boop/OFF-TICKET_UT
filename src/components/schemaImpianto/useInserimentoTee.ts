/**
 * Inserire un TEE su un tubo esistente: si trascina la giunzione sopra una tubazione, che si
 * evidenzia mentre ci si passa sopra, e al rilascio si spezza in due tratti collegati alla
 * giunzione (osservazione 5 del committente). Logica isolata in un hook suo per lo stesso
 * motivo di `useGomiti.ts`: SchemaEditor.tsx è già segnalato come file da non far crescere.
 *
 * La geometria — quale arco è più vicino, come si spezza — sta in `inserimentoTee.ts`, fra i
 * servizi, dove si collauda senza DOM. Qui c'è solo il gesto.
 */
import { useCallback, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  arcoPiuVicino,
  idDelleMeta,
  spezzaArco,
} from '@/services/schemaImpianto/inserimentoTee'
import { posizioneAncora } from '@/services/schemaImpianto/renderSvg'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { Punto, QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import { polilineaDellArco, type CapiArco } from './conversioneFlow'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/**
 * Quale delle quattro ancore della giunzione usare per le due metà. È una scelta COSMETICA:
 * dal Blocco D3 stanno tutte al centro del pallino e danno lo stesso punto (`posizioneAncora`),
 * quindi non c'è nulla da decidere in base alla direzione del tubo.
 */
const ANCORA_IN_ARRIVO = 'sx'
const ANCORA_IN_PARTENZA = 'dx'

/** Il centro del pallino di una giunzione posizionata. Passa da `posizioneAncora` — la stessa
 *  funzione del documento — invece di sommare a mano metà riquadro: dal Blocco D3 le quattro
 *  ancore stanno al centro, quindi quel punto È il centro, e non ne esiste una seconda fonte. */
function centroDellaGiunzione(nodo: Node): Punto {
  const { nodo: schema } = nodo.data as SchemaNodeData
  return posizioneAncora({ ...schema, x: nodo.position.x, y: nodo.position.y }, ANCORA_IN_ARRIVO)
}

/**
 * Guardia distinta da quella sul numero di nodi trascinati (`arcoSotto`): protegge il gesto
 * quotidiano di trascinare un'apparecchiatura qualunque (un compressore, un serbatoio) sopra
 * un tubo a cui non è collegata — senza, quel tubo verrebbe spezzato e riagganciato al
 * simbolo sbagliato.
 */
function eUnaGiunzione(nodo: Node): boolean {
  return (nodo.data as SchemaNodeData | undefined)?.nodo?.tipo === 'giunzione'
}

export function useInserimentoTee<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>,
  quote: QuoteInstradamento,
  capi: Map<string, CapiArco>
) {
  const [arcoEvidenziato, setArcoEvidenziato] = useState<string | null>(null)
  // Vero se, durante QUESTO gesto, è già passato almeno un evento di posizione — decide, alla
  // conclusione, se il trascinamento ha già lasciato una voce di cronologia su cui appoggiarsi
  // (vedi `concludiTrascinamento`). Non è il confronto fra la posizione iniziale e quella
  // finale: un TEE spostato e riportato sulla stessa cella di griglia avrebbe posizioni
  // identiche agli estremi ma HA generato eventi di posizione nel mezzo (e quindi una voce di
  // `onNodesChange`, SchemaEditor.tsx) — confondere i due criteri farebbe scrivere qui una
  // seconda voce ridondante, lo stesso annullamento appiccicoso già corretto una volta.
  //
  // Esatto SOLO se `seguiTrascinamento` è agganciato a `onNodeDrag` di react-flow (Task 5): nel
  // sorgente (`node_modules/@xyflow/system/dist/esm/index.js`, funzione `update` del gestore di
  // trascinamento), `onNodeDrag` scatta se e solo se `hasChange` è vero — la stessa guardia che
  // decide se aggiornare le posizioni e quindi se `onNodesChange` riceve l'evento. Un cablaggio
  // che chiami `seguiTrascinamento` altrove (per esempio a ogni frame del gesto, non solo ai
  // cambi di posizione) romperebbe questo criterio in silenzio.
  const eventoDiPosizioneRef = useRef(false)

  /**
   * I tubi su cui questo TEE può innestarsi, con la polilinea che la tela DISEGNA
   * (`polilineaDellArco`, la stessa che passa da `instrada`): agganciarsi a una forma diversa
   * da quella vista significherebbe spezzare il tubo dove l'utente non l'ha puntato.
   *
   * Le quote vanno infilate a mano nei dati. `stato.edges` è lo stato GREZZO, non l'elenco
   * fuso da `fondiDatiArchi` che la tela riceve: qui `data.quote` non c'è, e senza,
   * `polilineaDellArco` ripiega sul raccordo a un angolo solo — una forma che il tubo non ha
   * mai avuto. È lo stesso ripiego che il suo docblock chiama «rete di sicurezza per il tipo,
   * non un caso previsto», e questo è precisamente un chiamante che non deve toccarlo.
   *
   * Un tubo che ha già questo TEE per capo è escluso: senza, trascinare una giunzione già
   * innestata lungo il suo stesso tubo lo rispezzerebbe a ogni rilascio.
   */
  const candidati = useCallback(
    (idTee: string) =>
      stato.edges
        .filter((e) => e.source !== idTee && e.target !== idTee)
        .flatMap((e) => {
          const capiArco = capi.get(e.id)
          if (!capiArco) return []
          const data = { ...(e.data as SchemaEdgeData), quote }
          return [{ id: e.id, polilinea: polilineaDellArco(capiArco, data) }]
        }),
    [stato.edges, capi, quote]
  )

  /** L'arco che il TEE sta sorvolando, o `null`. Unico punto che decide: lo consultano sia
   *  l'evidenziazione durante il gesto sia lo spezzamento al rilascio, e due risposte diverse
   *  farebbero spezzare un tubo diverso da quello evidenziato. */
  const arcoSotto = useCallback(
    (nodo: Node, nodiTrascinati: Node[]): string | null => {
      // Un trascinamento multiplo sposta un blocco di simboli, non innesta un TEE.
      if (nodiTrascinati.length !== 1 || !eUnaGiunzione(nodo)) return null
      return arcoPiuVicino(candidati(nodo.id), centroDellaGiunzione(nodo))
    },
    [candidati]
  )

  // Non legge né congela la posizione: azzera solo il ref sopra, all'inizio di un gesto nuovo.
  const iniziaTrascinamento = useCallback((_nodo: Node) => {
    eventoDiPosizioneRef.current = false
  }, [])

  const seguiTrascinamento = useCallback(
    (nodo: Node, nodiTrascinati: Node[]) => {
      eventoDiPosizioneRef.current = true
      setArcoEvidenziato(arcoSotto(nodo, nodiTrascinati))
    },
    [arcoSotto]
  )

  const concludiTrascinamento = useCallback(
    (nodo: Node, nodiTrascinati: Node[]) => {
      const ePassatoUnEventoDiPosizione = eventoDiPosizioneRef.current
      eventoDiPosizioneRef.current = false
      setArcoEvidenziato(null)

      const arcoId = arcoSotto(nodo, nodiTrascinati)
      if (!arcoId) return

      // Tutto ciò che serve si calcola QUI, fuori dall'updater: quello dev'essere puro, perché
      // React può invocarlo zero, una o più volte in momenti che questo gestore non controlla
      // (è la stessa ragione scritta in useTrascinamentoTratto.ts).
      const arco = stato.edges.find((e) => e.id === arcoId)
      const capiArco = capi.get(arcoId)
      if (!arco || !capiArco) return
      const data = arco.data as SchemaEdgeData
      // Le quote infilate qui come in `candidati`, e per la stessa ragione: la polilinea su cui
      // si taglia dev'essere la STESSA su cui si è deciso quale tubo evidenziare, o si
      // spezzerebbe un tubo in un punto diverso da quello mostrato.
      const { centro, primo, secondo } = spezzaArco(
        polilineaDellArco(capiArco, { ...data, quote }),
        data.segni ?? [],
        centroDellaGiunzione(nodo)
      )
      const [idPrimo, idSecondo] = idDelleMeta(arcoId, new Set(stato.edges.map((e) => e.id)))
      const ancora = ancoraDi((nodo.data as SchemaNodeData).nodo, ANCORA_IN_ARRIVO)
      const posizione = { x: centro.x - (ancora?.x ?? 0), y: centro.y - (ancora?.y ?? 0) }

      // L'arco sostituito in POSIZIONE (`flatMap` sull'elenco esistente), non filtrato e
      // riappeso in coda: l'ordine degli archi si propaga a `flowALayout` e all'ordine degli
      // elementi nel documento, e non deve cambiare solo perché uno di essi è stato spezzato.
      const costruisci = (s: T): T => ({
        ...s,
        nodes: s.nodes.map((n) => (n.id === nodo.id ? { ...n, position: posizione } : n)),
        edges: s.edges.flatMap((e) =>
          e.id !== arcoId
            ? [e]
            : [
                {
                  ...arco,
                  id: idPrimo,
                  target: nodo.id,
                  targetHandle: ANCORA_IN_ARRIVO,
                  // Non l'eredita da `arco`: l'id originale selezionato non esiste più, e uno
                  // dei due spezzoni disegnato come selezionato lascerebbe la barra strumenti a
                  // puntare a un arco fantasma.
                  selected: false,
                  data: { stile: data.stile, punti: primo.punti, segni: primo.segni } satisfies SchemaEdgeData,
                },
                {
                  ...arco,
                  id: idSecondo,
                  source: nodo.id,
                  sourceHandle: ANCORA_IN_PARTENZA,
                  selected: false,
                  data: { stile: data.stile, punti: secondo.punti, segni: secondo.segni } satisfies SchemaEdgeData,
                },
              ]
        ),
      })

      // Un solo passo di Ctrl+Z, e si ottiene NON scrivendo una seconda voce di cronologia.
      // `onNodesChange` (SchemaEditor.tsx) ne ha già scritta una con `applica` al primo evento di
      // posizione del trascinamento, quando lo stato era ancora quello di partenza: TEE dov'era e
      // tubo intero. Appoggiarsi a quella voce (con `aggiornaSenzaCronologia`) significa un solo
      // passo; scriverne un'altra con `applica` ne richiederebbe due — uno per il tubo, uno per
      // la posizione, perché a quel punto `stato` riflette già la posizione di rilascio, non
      // quella di partenza.
      //
      // L'eccezione è un gesto che non ha mai generato un evento di posizione: un trascinamento
      // che supera la soglia di clic ma resta dentro la stessa cella di griglia (la posizione
      // agganciata non cambia mai) parte comunque — `onNodeDragStop` scatta — ma non genera
      // alcun evento `onNodeDrag`/`onNodesChange`, quindi nessuna voce su cui appoggiarsi: lo
      // spezzamento sarebbe irreversibile. Lì la voce va scritta qui, con `applica`.
      const aggiorna = ePassatoUnEventoDiPosizione ? aggiornaSenzaCronologia : applica
      aggiorna(costruisci)
    },
    [arcoSotto, stato.edges, capi, quote, applica, aggiornaSenzaCronologia]
  )

  return { arcoEvidenziato, iniziaTrascinamento, seguiTrascinamento, concludiTrascinamento }
}
