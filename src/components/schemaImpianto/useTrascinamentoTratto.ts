/**
 * Trascinamento in blocco di un tratto dritto di tubazione: si afferra un tratto e lo si fa
 * scorrere, i gomiti ai capi si aggiustano da soli (`trascinaTratto`, in tratti.ts). Gesto
 * distinto da quello dei gomiti (useGomiti.ts): lì si crea/sposta/toglie un punto, qui si
 * sposta un intero tratto già esistente fra due punti (ancore o gomiti che siano).
 *
 * `trascinaTratto` posa una quota ASSOLUTA agganciata alla griglia, non somma uno spostamento:
 * per questo il gesto congela lo stato di partenza (punto di presa, gomiti, indice del tratto)
 * al primo evento e passa sempre il delta CUMULATIVO da lì, mai l'incremento evento-per-evento
 * — vedi il commento sui ref sotto per il perché.
 *
 * Un trascinamento che finisce dov'è cominciato (delta cumulativo nullo) ripristina `punti`
 * allo stato di prima del gesto — i gomiti congelati, non un vuoto incondizionato — e lo fa a
 * OGNI evento a delta nullo, non solo a quello conclusivo: per un arco senza gomiti a mano
 * quello stato È il vuoto, quindi il tubo torna all'instradamento automatico (decisione del
 * committente); per un arco con una rotta disegnata a mano il gesto non la cancella. Dettagli
 * in `trascinaSegmento` più sotto.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { trascinaTratto, type LatiImposti, type Punto, type QuoteInstradamento } from '@/services/schemaImpianto/tratti'
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
  aggiornaSenzaCronologia: Aggiorna<T>,
  // Quote di instradamento del disegno intero (`quoteInstradamento`, layout.ts), calcolate una
  // volta da `SchemaEditor`: servono per ricostruire la polilinea con `instrada`, la STESSA che
  // il componente disegna, così l'indice del tratto afferrato (`indiceTrattoPiuVicino`, sotto)
  // numera gli stessi segmenti che `trascinaTratto` numera qui dentro. Ricostruire con
  // `polilineaConGomiti` direttamente — il bug del giro di riparazione 1 — sposta il tratto
  // sbagliato per ogni arco senza gomiti a mano, perché quella polilinea ha una forma diversa
  // dalla rotta nativa che l'utente vede.
  quote: QuoteInstradamento
) {
  // Vero mentre un gesto è in corso (dal primo evento a quello conclusivo): decide
  // `primoEventoDelGesto` sotto, che congela punto di presa, gomiti e indice al vero inizio del
  // gesto e azzera `cronologiaScrittaRef` (sotto) per il nuovo gesto. Il momento in cui il
  // gesto ENTRA in cronologia non lo decide questo ref, ma `cronologiaScrittaRef`: vedi il suo
  // commento per il perché.
  const trascinamentoAvviato = useRef(false)
  // Punto di presa del gesto (congelato al primo evento): il delta passato a `trascinaTratto`
  // è cumulativo da QUI, non incrementale evento-per-evento. Il puntatore arriva già agganciato
  // alla griglia (`snapGrid={[10, 10]}` in `SchemaEditor.tsx`, letto da `screenToFlowPosition`),
  // ma questo da solo non basta a escludere uno scivolamento: `agganciaQuota` (griglia.ts) non
  // commuta con lo spostamento — verificato eseguendo il codice, `agganciaQuota(234, [260,
  // 234])` vale 234 ma `agganciaQuota(244, [260, 234])` vale 240, non 244. La ragione per cui il
  // tratto non scivola è un'altra: `a` (sotto, la coordinata letta dalla polilinea ricostruita)
  // è COSTANTE per tutto il gesto — ricostruita da `pDa`/`pA` stabili e da gomiti/indice
  // congelati qui — quindi `quotaGrezza = a + delta` dipende solo dalla posizione CORRENTE del
  // puntatore, mai dal risultato agganciato di un evento precedente. Un gesto che torna
  // esattamente al punto di presa (delta nullo) produce quindi sempre la stessa `quotaNuova` —
  // l'idempotenza su cui si basa il gesto a vuoto qui sotto (`trascinaSegmento`).
  const puntoPresaRef = useRef<Punto | null>(null)
  // Gomiti e indice del tratto, congelati allo stesso istante del punto di presa. Ragione
  // dominante: `trascinaTratto` posa la quota ASSOLUTA agganciata a partire dai gomiti che
  // riceve — se questi fossero quelli GIÀ aggiornati dall'evento precedente mentre il delta
  // resta cumulativo dal punto di presa, lo spostamento verrebbe sommato due volte (una nei
  // gomiti di partenza, una nel delta). In più, `SchemaEdgeTubazione` ricalcola l'indice a ogni evento
  // (`indiceTrattoPiuVicino` su `polilinea`), ma quell'indice numera la polilinea CORRENTE — se
  // i gomiti restassero quelli aggiornati mentre il delta è cumulativo, l'indice del primo
  // evento smetterebbe di corrispondere al tratto giusto man mano che la polilinea si aggancia.
  // Congelare entrambi allo stesso momento tiene indice, gomiti e delta coerenti fra loro per
  // tutta la durata del gesto.
  const gomitiCongelatiRef = useRef<Punto[] | undefined>(undefined)
  const indiceCongelatoRef = useRef(0)
  // Vero se QUESTO gesto ha già scritto qualcosa: un evento a delta non nullo si è già
  // presentato. Il primo evento di ogni gesto ha SEMPRE delta nullo per costruzione (è quello
  // che congela `puntoPresaRef` su se stesso, sopra) — stesso principio di
  // `useGomiti.ts:105-110`, applicato al punto in cui QUI lo stato inizia davvero a spostarsi.
  // Decide, in `trascinaSegmento`, quando entrare in cronologia e se un evento a delta nullo
  // debba anche solo toccare lo stato — vedi i due commenti inline più sotto per il perché. Si
  // azzera a ogni nuovo gesto e si alza alla prima scrittura.
  const cronologiaScrittaRef = useRef(false)

  const trascinaSegmento = useCallback(
    (
      arcoId: string,
      pDa: Punto,
      pA: Punto,
      indiceTratto: number,
      puntoLibero: Punto,
      concluso: boolean,
      lati?: LatiImposti
    ) => {
      const primoEventoDelGesto = !trascinamentoAvviato.current
      if (primoEventoDelGesto) {
        // Il congelamento sta QUI, fuori dall'updater passato ad `applica`/
        // `aggiornaSenzaCronologia`. Non per la doppia invocazione di StrictMode in sé — React
        // reinvoca l'updater con gli STESSI argomenti e scarta il primo risultato, quindi
        // scriverebbe due volte lo STESSO valore, non uno sbagliato. Il pericolo vero è che
        // l'updater deve restare puro perché può essere invocato zero, una o più volte, in
        // momenti che questo handler non controlla: un effetto collaterale come la scrittura di
        // un ref non ha posto lì dentro, a prescindere da quante volte scatti. L'arco fresco è
        // già in mano tramite `stato.edges` (si ricrea a ogni cambio, vedi
        // `edgesConTrascinamento` sotto), quindi i gomiti di partenza si leggono da lì, non
        // dall'`s` dentro l'updater.
        puntoPresaRef.current = puntoLibero
        indiceCongelatoRef.current = indiceTratto
        gomitiCongelatiRef.current = (stato.edges.find((e) => e.id === arcoId)?.data as SchemaEdgeData | undefined)
          ?.punti
        // Nessuna voce di cronologia scritta ancora per QUESTO gesto: vedi il commento su
        // `cronologiaScrittaRef` sopra.
        cronologiaScrittaRef.current = false
      }
      trascinamentoAvviato.current = !concluso
      const presa = puntoPresaRef.current ?? puntoLibero
      const delta = { x: puntoLibero.x - presa.x, y: puntoLibero.y - presa.y }
      const gomiti = gomitiCongelatiRef.current
      const indice = indiceCongelatoRef.current
      const deltaNullo = delta.x === 0 && delta.y === 0

      // Un evento a delta nullo prima che il gesto abbia scritto qualcosa non tocca lo stato
      // affatto: è il primo evento di ogni gesto (sempre a delta nullo, sopra), e resta tale
      // finché il puntatore non esce dalla cella di presa — non c'è nulla da ripristinare, lo
      // stato è già quello di partenza. Uscire qui non è solo un'ottimizzazione: prima che
      // questo ramo esistesse, quell'evento chiamava comunque `trascinaTratto` con delta zero
      // (via `aggiornaSenzaCronologia`, fuori da ogni cronologia) — che MATERIALIZZA la rotta
      // automatica in gomiti a mano anche a delta zero — e l'evento successivo, quello che apre
      // `applica`, catturava come stato "di partenza" quello già materializzato invece di
      // quello pulito: un Ctrl+Z dopo un trascinamento vero restituiva la rotta automatica
      // cotta in gomiti a mano, non la rotta automatica pulita — il rovescio esatto della
      // decisione del committente che questo gesto doveva implementare, e su OGNI trascinamento
      // (non solo quelli a vuoto), perché `applica` (`useSchemaHistory.ts:48-52`) spinge in
      // cronologia lo stato al momento del dispatch, e quel dispatch arriva sempre dopo il
      // primo evento, mai insieme a esso.
      if (deltaNullo && !cronologiaScrittaRef.current) return

      // In cronologia entra il primo evento con delta NON nullo: una sola voce per gesto,
      // scritta mentre lo stato è ancora quello di partenza (vedi `cronologiaScrittaRef` e il
      // commento sopra). I successivi — compreso quello conclusivo — restano su
      // `aggiornaSenzaCronologia`.
      const primaScritturaConSpostamento = !deltaNullo && !cronologiaScrittaRef.current
      if (primaScritturaConSpostamento) cronologiaScrittaRef.current = true
      const aggiorna = primaScritturaConSpostamento ? applica : aggiornaSenzaCronologia

      // Un evento a delta nullo (dopo che il gesto ha già scritto qualcosa — il ramo sopra copre
      // il caso "non ancora") ripristina i gomiti congelati invece di chiamare `trascinaTratto`
      // con delta zero: quest'ultimo materializzerebbe comunque la rotta in punti espliciti, e
      // un arco con gomiti non vuoti si stacca dal riassestamento automatico delle quote —
      // `instrada` li ignora quando ce ne sono (`tratti.ts:341`). Vale a ogni evento, non solo al
      // conclusivo: il «gesto a vuoto» è semplicemente il caso in cui l'ULTIMO evento capita ad
      // avere delta nullo. Il confronto è sul delta invece che sui punti risultanti perché è
      // esatto senza tolleranze da tarare: il delta fra due punti già agganciati alla griglia
      // (vedi `puntoPresaRef`) è 0 o un multiplo esatto di 10, mai una frazione che renda incerto
      // lo zero. Vale anche per `pointercancel`: `useGestoPuntatore.ts` lo tratta come un evento
      // conclusivo sull'ultima posizione vista, non su quella dell'annullamento.
      //
      // Coda aperta: punto di presa e di rilascio possono essere DIVERSI (delta non nullo) e
      // dare comunque la stessa quota agganciata — il tratto torna visivamente dov'era ma il
      // gesto non viene riconosciuto come a vuoto, perché il confronto è sul delta grezzo, non
      // sulla quota. Servirebbe confrontare la polilinea risultante; non implementato qui.
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const data = e.data as SchemaEdgeData
          const nuovi = deltaNullo
            ? (gomiti ?? [])
            : trascinaTratto(data.stile, pDa, pA, gomiti, quote, indice, delta, lati)
          return { ...e, data: { ...data, punti: nuovi } satisfies SchemaEdgeData }
        }),
      }))
    },
    [stato.edges, applica, aggiornaSenzaCronologia, quote]
  )

  const edgesConTrascinamento = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onTrascinaTratto: (
            pDa: Punto,
            pA: Punto,
            indiceTratto: number,
            puntoLibero: Punto,
            concluso: boolean,
            lati?: LatiImposti
          ) => trascinaSegmento(e.id, pDa, pA, indiceTratto, puntoLibero, concluso, lati),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, trascinaSegmento]
  )

  return { edgesConTrascinamento }
}
