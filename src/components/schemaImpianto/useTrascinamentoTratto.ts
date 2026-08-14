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
 * Un trascinamento che finisce dov'è cominciato (delta cumulativo nullo all'evento conclusivo)
 * ripristina `punti` allo stato di prima del gesto — i gomiti congelati, non un vuoto
 * incondizionato: per un arco senza gomiti a mano quello stato È il vuoto, quindi il tubo torna
 * all'instradamento automatico (la decisione del committente); per un arco con una rotta
 * disegnata a mano il gesto non la cancella. Decisione del committente — vedi il commento su
 * `trascinaSegmento` più sotto per il perché e per il criterio.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { trascinaTratto, type Punto, type QuoteInstradamento } from '@/services/schemaImpianto/tratti'
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
  // Stesso principio di useGomiti.ts: un gesto entra in cronologia una volta sola. Qui non è
  // il primo evento in assoluto a scriverla (vedi `cronologiaScrittaRef` sotto, e il perché).
  const trascinamentoAvviato = useRef(false)
  // Punto di presa del gesto (congelato al primo evento): il delta passato a `trascinaTratto`
  // è cumulativo da QUI, non incrementale evento-per-evento. Il puntatore arriva ai gesti già
  // agganciato alla griglia (`screenToFlowPosition` di `@xyflow/react` legge `snapToGrid`/
  // `snapGrid` dal negozio quando il chiamante non passa opzioni, e la tela monta `snapToGrid
  // snapGrid={[10, 10]}` in `SchemaEditor.tsx`; `SchemaEdgeTubazione.tsx` la chiama senza
  // opzioni): gli incrementi fra un evento e il successivo sono quindi 0 o multipli esatti di
  // 10, mai una frazione del passo. Questo da solo NON basta a escludere uno scivolamento:
  // `agganciaQuota` (griglia.ts), a differenza del solo arrotondamento alla griglia, NON
  // commuta con lo spostamento — una quota preferita vince per uno scarto piccolo e lo perde
  // per uno più grande, quindi `agganciaQuota(q + 10k, prefs)` non è in generale
  // `agganciaQuota(q, prefs) + 10k` (verificato eseguendo il codice: `agganciaQuota(234,
  // [260, 234])` vale 234, `agganciaQuota(244, [260, 234])` vale 240, non 244). La ragione per
  // cui il tratto non scivola è un'altra: `a` (sotto, la coordinata di riferimento letta dalla
  // polilinea ricostruita) è COSTANTE per tutto il gesto, perché ricostruita da `pDa`/`pA`
  // (stabili: le ancore non si spostano mentre si trascina un tratto) e da gomiti/indice
  // congelati qui — quindi `quotaGrezza = a + delta` dipende solo dalla posizione CORRENTE del
  // puntatore, mai dal risultato agganciato di un evento precedente: a parità di puntatore
  // `agganciaQuota` restituisce sempre lo stesso risultato,
  // qualunque sia stato il percorso in mezzo. In particolare un gesto che torna esattamente al
  // punto di presa (delta nullo) produce sempre la stessa `quotaNuova` — è l'idempotenza su cui
  // si basa il gesto a vuoto qui sotto (`trascinaSegmento`): senza questo ref non ci sarebbe
  // modo di sapere dove il gesto è cominciato, per confrontarlo con dove finisce.
  const puntoPresaRef = useRef<Punto | null>(null)
  // Gomiti e indice del tratto, congelati allo stesso istante del punto di presa. Ragione
  // dominante: `trascinaTratto` posa la quota ASSOLUTA agganciata a partire dai gomiti che
  // riceve — se questi fossero quelli GIÀ aggiornati dall'evento precedente mentre il delta
  // resta cumulativo dal punto di presa, lo spostamento verrebbe sommato due volte (una nei
  // gomiti di partenza, una nel delta) e il tratto correrebbe al doppio della velocità del
  // cursore. In più, `SchemaEdgeTubazione` ricalcola l'indice a ogni evento
  // (`indiceTrattoPiuVicino` su `polilinea`), ma quell'indice numera la polilinea CORRENTE — se
  // i gomiti restassero quelli aggiornati mentre il delta è cumulativo, l'indice del primo
  // evento smetterebbe di corrispondere al tratto giusto man mano che la polilinea si aggancia.
  // Congelare entrambi allo stesso momento tiene indice, gomiti e delta coerenti fra loro per
  // tutta la durata del gesto.
  const gomitiCongelatiRef = useRef<Punto[] | undefined>(undefined)
  const indiceCongelatoRef = useRef(0)
  // Vero se QUESTO gesto ha già scritto la propria (unica) voce di cronologia. Il primo evento
  // di ogni gesto ha SEMPRE delta nullo per costruzione (è l'evento che congela `puntoPresaRef`
  // su se stesso, sopra): entrare in cronologia lì, come faceva questo hook prima del gesto a
  // vuoto, significa scrivere una voce anche per un gesto che finirà a vuoto — dove lo stato
  // ripristinato coincide con quello da cui si era partiti, un Ctrl+Z che non mostra nulla e uno
  // dei `PROFONDITA_CRONOLOGIA` posti (`useSchemaHistory.ts`) sprecato. Usato in
  // `trascinaSegmento` per spostare l'ingresso in cronologia al primo evento con delta NON
  // nullo, tenendo comunque a una sola voce per gesto: si azzera a ogni nuovo gesto (dentro
  // `if (primoEventoDelGesto)` sotto) e si alza alla prima scrittura, cosicché gli eventi
  // successivi — compreso quello conclusivo — restino su `aggiornaSenzaCronologia`.
  const cronologiaScrittaRef = useRef(false)

  const trascinaSegmento = useCallback(
    (arcoId: string, pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => {
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

      // In cronologia entra il primo evento con delta NON nullo, non il primo evento e basta
      // (che ha delta nullo per costruzione, vedi sopra): altrimenti un gesto che finirà a
      // vuoto scriverebbe comunque una voce, che il ripristino sotto rende indistinguibile
      // dallo stato di partenza — vedi `cronologiaScrittaRef`. Una sola voce per gesto: una
      // volta scritta, gli eventi successivi (compreso quello conclusivo) restano su
      // `aggiornaSenzaCronologia`.
      const primaScritturaConSpostamento = !deltaNullo && !cronologiaScrittaRef.current
      if (primaScritturaConSpostamento) cronologiaScrittaRef.current = true
      const aggiorna = primaScritturaConSpostamento ? applica : aggiornaSenzaCronologia

      // Gesto a vuoto (domanda aperta #1 del Blocco C1, decisa dal committente): un
      // trascinamento che finisce dov'è cominciato ripristina lo stato d'inizio gesto — i
      // gomiti congelati sopra — invece di lasciare la rotta materializzata in gomiti a mano
      // dal primo evento. Per un arco che non aveva gomiti a mano quello stato È il vuoto,
      // quindi il tubo torna all'instradamento automatico, seguendo di nuovo il riassestamento
      // delle quote quando si spostano le apparecchiature; per un arco con una rotta disegnata
      // a mano il gesto la lascia intatta invece di sostituirla con la rotta automatica — un
      // `punti: []` incondizionato butterebbe via lavoro dell'utente che il gesto, ai suoi
      // occhi, non ha toccato (e sposterebbe anche i segni piazzati per `t` sul tratto,
      // ridistribuiti sulla polilinea nuova). «Dov'è cominciato» è il punto di presa congelato
      // sopra, non «il puntatore non si è mosso»: un gesto che si sposta e torna indietro conta
      // comunque come a vuoto, perché è il delta CUMULATIVO da lì — non lo spostamento
      // dell'ultimo evento — a decidere. Il confronto è sul delta invece che sui punti per non
      // duplicare l'aritmetica già fatta sopra; è esatto, senza tolleranze da tarare, perché il
      // delta fra due punti già agganciati alla griglia (vedi il commento su `puntoPresaRef`) è
      // 0 o un multiplo esatto di 10, mai una frazione che renda incerto lo zero. Vale solo per
      // l'evento CONCLUSIVO: un gesto ancora in corso che transita per il punto di presa non
      // deve ripristinare `punti` a metà, o l'arco cambierebbe forma avanti e indietro mentre
      // l'utente lo tiene ancora premuto — non sparirebbe: `polilineaDellArco`
      // (`conversioneFlow.ts`) ricade su `instrada` anche con `punti` vuoto, quindi l'arco resta
      // sempre visibile, cambia solo la forma della polilinea. Vale anche quando il gesto si
      // chiude con `pointercancel` invece che con il rilascio: `useGestoPuntatore.ts` lo tratta
      // come un evento conclusivo a tutti gli effetti, sull'ultima posizione vista, quindi un
      // trascinamento annullato dal sistema mentre il puntatore era già tornato sulla presa
      // ripristina lo stato d'inizio esattamente come un rilascio nello stesso punto.
      //
      // Resta aperto un caso che questo confronto non chiude: il punto di presa e il punto di
      // rilascio possono essere DIVERSI (delta non nullo) eppure la quota agganciata che ne
      // risulta — quando vince una quota preferita — può coincidere con quella di partenza: il
      // tratto finisce visivamente dov'era, ma il gesto non viene riconosciuto come a vuoto
      // perché il confronto è sul delta grezzo del puntatore, non sulla quota agganciata.
      // Chiuderlo richiederebbe confrontare la polilinea risultante invece del solo delta, in un
      // file senza test automatici. Registrato come coda, non implementato qui.
      const gestoAVuoto = concluso && deltaNullo
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const data = e.data as SchemaEdgeData
          const nuovi = gestoAVuoto ? (gomiti ?? []) : trascinaTratto(data.stile, pDa, pA, gomiti, quote, indice, delta)
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
          onTrascinaTratto: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) =>
            trascinaSegmento(e.id, pDa, pA, indiceTratto, puntoLibero, concluso),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, trascinaSegmento]
  )

  return { edgesConTrascinamento }
}
