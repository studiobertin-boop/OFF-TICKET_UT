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
 * quello stato È il vuoto, quindi il tubo torna all'instradamento automatico (la decisione del
 * committente); per un arco con una rotta disegnata a mano il gesto non la cancella. Decisione
 * del committente — vedi il commento su `trascinaSegmento` più sotto per il perché e per il
 * criterio.
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
  // Entra in cronologia il primo evento che sposta DAVVERO qualcosa (delta non nullo), non il
  // primo evento e basta: il primo evento di ogni gesto ha SEMPRE delta nullo per costruzione
  // (è quello che congela `puntoPresaRef` su se stesso, sotto), quindi lo stato è ancora pulito
  // quando arriva. È lo stesso principio di `useGomiti.ts:105-110` — il PRIMO evento entra, non
  // l'ultimo, perché registrare tardi leggerebbe uno stato già spostato — applicato al punto in
  // cui QUI lo stato inizia davvero a spostarsi, che non coincide col primo evento in assoluto.
  // Un gesto che non esce mai dalla cella di presa non scrive NESSUNA voce (zero, non una).
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
  // Vero se QUESTO gesto ha già scritto qualcosa: cioè se un evento con delta non nullo si è
  // già presentato. Usato in `trascinaSegmento` per due cose. (1) Decidere quando entrare in
  // cronologia: al primo evento con delta non nullo (`applica`, mentre lo stato è ancora
  // pulito), i successivi restano su `aggiornaSenzaCronologia` — così ne entra al più una per
  // gesto, mai una per un gesto che non si è mai mosso. (2) Decidere se un evento a delta nullo
  // debba anche solo TOCCARE lo stato: finché non è stata fatta alcuna scrittura, un evento a
  // delta nullo non ha nulla da ripristinare (lo stato è già quello di partenza) — lasciarlo
  // stare evita pure il cambiamento innocuo ma superfluo `undefined` → `[]`. Si azzera a ogni
  // nuovo gesto (dentro `if (primoEventoDelGesto)` sotto) e si alza alla prima scrittura.
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

      // Un evento a delta nullo (anche non conclusivo, una volta che il gesto ha già scritto
      // qualcosa — il ramo sopra copre il caso "non ancora") ripristina lo stato d'inizio
      // gesto — i gomiti congelati sopra — invece di lasciare la rotta materializzata
      // dall'ultimo spostamento: il tubo segue davvero il cursore, e non resta "appiccicato"
      // a dove l'evento precedente l'aveva messo quando il cursore ripassa dalla presa. Per un
      // arco che non aveva gomiti a mano quello stato È il vuoto (domanda aperta #1 del Blocco
      // C1, decisa dal committente): il tubo torna all'instradamento automatico. Non serve più
      // distinguere l'evento conclusivo dagli altri — la stessa regola vale a ogni evento, e il
      // «gesto a vuoto» è semplicemente il caso in cui l'ULTIMO evento capita ad avere delta
      // nullo. Per un arco con una rotta disegnata a mano il gesto la lascia intatta invece di
      // sostituirla con la rotta automatica — un `punti: []` incondizionato butterebbe via
      // lavoro dell'utente che il gesto, ai suoi occhi, non ha toccato (e sposterebbe anche i
      // segni piazzati per `t` sul tratto, ridistribuiti sulla polilinea nuova). Il confronto è
      // sul delta invece che sui punti per non duplicare l'aritmetica già fatta sopra; è esatto,
      // senza tolleranze da tarare, perché il delta fra due punti già agganciati alla griglia
      // (vedi il commento su `puntoPresaRef`) è 0 o un multiplo esatto di 10, mai una frazione
      // che renda incerto lo zero. Vale anche quando il gesto si chiude con `pointercancel`
      // invece che con il rilascio: `useGestoPuntatore.ts` lo tratta come un evento conclusivo a
      // tutti gli effetti, sull'ultima posizione vista, quindi un trascinamento annullato dal
      // sistema mentre il puntatore era già tornato sulla presa ripristina lo stato d'inizio
      // esattamente come un rilascio nello stesso punto.
      //
      // Resta aperto un caso che questo confronto non chiude: il punto di presa e il punto di
      // rilascio possono essere DIVERSI (delta non nullo) eppure la quota agganciata che ne
      // risulta — quando vince una quota preferita — può coincidere con quella di partenza: il
      // tratto finisce visivamente dov'era, ma il gesto non viene riconosciuto come a vuoto
      // perché il confronto è sul delta grezzo del puntatore, non sulla quota agganciata.
      // Chiuderlo richiederebbe confrontare la polilinea risultante invece del solo delta, in un
      // file senza test automatici. Registrato come coda, non implementato qui.
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const data = e.data as SchemaEdgeData
          const nuovi = deltaNullo ? (gomiti ?? []) : trascinaTratto(data.stile, pDa, pA, gomiti, quote, indice, delta)
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
