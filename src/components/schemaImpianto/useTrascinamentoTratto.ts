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
 * lascia `punti` vuoto invece di materializzare la rotta in gomiti a mano: il tubo torna
 * all'instradamento automatico. Decisione del committente — vedi il commento su `trascinaSegmento`
 * più sotto per il perché e per il criterio.
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
  // Stesso principio di useGomiti.ts: il PRIMO evento del gesto entra in cronologia.
  const trascinamentoAvviato = useRef(false)
  // Punto di presa del gesto (congelato al primo evento): il delta passato a `trascinaTratto`
  // è cumulativo da QUI, non incrementale evento-per-evento. Il puntatore arriva ai gesti già
  // agganciato alla griglia (`screenToFlowPosition` di `@xyflow/react` legge `snapToGrid`/
  // `snapGrid` dal negozio quando il chiamante non passa opzioni, e la tela monta `snapToGrid
  // snapGrid={[10, 10]}` in `SchemaEditor.tsx`; `SchemaEdgeTubazione.tsx` la chiama senza
  // opzioni): gli incrementi fra un evento e il successivo sono quindi 0 o multipli esatti di
  // 10, mai una frazione del passo, e su quei valori l'aggancio COMMUTA con lo spostamento
  // (`allinea(q + 10k) = allinea(q) + 10k`) — nessun delta blocca il tratto né lo fa scivolare.
  // La ragione del congelamento è un'altra: l'idempotenza rispetto alla storia degli eventi.
  // Applicando sempre il delta cumulativo dal punto di presa, un gesto avanti 30 e indietro 30
  // torna ESATTAMENTE al punto di partenza anche se questo è fuori griglia (una quota
  // preferita, non un nodo della griglia) — con la somma incrementale a stato già agganciato
  // valeva solo per spostamenti multipli del passo. Ed è l'infrastruttura di cui ha bisogno il
  // gesto a vuoto qui sotto (`trascinaSegmento`): senza questo ref non ci sarebbe modo di
  // sapere dove il gesto è cominciato, per confrontarlo con dove finisce.
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
      }
      trascinamentoAvviato.current = !concluso
      const presa = puntoPresaRef.current ?? puntoLibero
      const delta = { x: puntoLibero.x - presa.x, y: puntoLibero.y - presa.y }
      const gomiti = gomitiCongelatiRef.current
      const indice = indiceCongelatoRef.current

      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      // Gesto a vuoto (domanda aperta #1 del Blocco C1, decisa dal committente): un
      // trascinamento che finisce dov'è cominciato restituisce il tubo all'instradamento
      // automatico invece di materializzare la rotta in gomiti a mano — altrimenti l'arco
      // smetterebbe di seguire il riassestamento delle quote quando si spostano le
      // apparecchiature, pur non avendo l'utente spostato nulla. «Dov'è cominciato» è il punto
      // di presa congelato sopra, non «il puntatore non si è mosso»: un gesto che si sposta e
      // torna indietro conta comunque come a vuoto, perché è il delta CUMULATIVO da lì — non lo
      // spostamento dell'ultimo evento — a decidere. Il confronto è sul delta invece che sui
      // punti per non duplicare l'aritmetica già fatta sopra; è esatto, senza tolleranze da
      // tarare, perché il delta fra due punti già agganciati alla griglia (vedi il commento su
      // `puntoPresaRef`) è 0 o un multiplo esatto di 10, mai una frazione che renda incerto lo
      // zero. Vale solo per l'evento CONCLUSIVO: un gesto ancora in corso che transita per il
      // punto di presa non deve svuotare `punti` a metà, o l'arco sparirebbe e riapparirebbe
      // mentre l'utente lo tiene ancora premuto.
      //
      // Resta aperto un caso che questo confronto non chiude: due punti di presa DIVERSI
      // possono agganciarsi alla stessa quota preferita, cosicché un tratto finisce dov'era pur
      // avendo il gesto un delta diverso da zero — chiuderlo richiederebbe confrontare
      // polilinee, non punti, in un file senza test automatici. Registrato come coda, non
      // implementato qui.
      const gestoAVuoto = concluso && delta.x === 0 && delta.y === 0
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const data = e.data as SchemaEdgeData
          const nuovi = gestoAVuoto ? [] : trascinaTratto(data.stile, pDa, pA, gomiti, quote, indice, delta)
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
