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
  // è cumulativo da QUI, non incrementale evento-per-evento. `trascinaTratto` ora posa una
  // quota assoluta agganciata (`agganciaQuota`, griglia.ts) invece di sommare uno spostamento:
  // se si ripartisse ogni volta dai gomiti già aggiornati (già agganciati) sommando solo
  // l'ultimo incremento, un evento la cui quota agganciata restasse la stessa (perché la
  // griglia vince ancora) farebbe perdere quell'incremento per sempre — il tratto resterebbe
  // fermo sotto un cursore che si è mosso, o "scivolerebbe indietro" appena un evento
  // superasse mezzo passo di griglia. Congelando l'inizio del gesto e applicando sempre il
  // delta cumulativo da lì, l'aggancio diventa idempotente: lo stesso punto libero produce
  // sempre la stessa quota, qualunque sia la storia degli eventi intermedi.
  const puntoPresaRef = useRef<Punto | null>(null)
  // Gomiti e indice del tratto, congelati allo stesso istante: `SchemaEdgeTubazione` ricalcola
  // l'indice a ogni evento (`indiceTrattoPiuVicino` su `polilinea`), ma quell'indice numera la
  // polilinea CORRENTE — se i gomiti restassero quelli aggiornati mentre il delta diventa
  // cumulativo, l'indice del primo evento smetterebbe di corrispondere al tratto giusto man
  // mano che la polilinea si aggancia. Congelare entrambi allo stesso momento tiene indice e
  // gomiti coerenti fra loro per tutta la durata del gesto.
  const gomitiCongelatiRef = useRef<Punto[] | undefined>(undefined)
  const indiceCongelatoRef = useRef(0)

  const trascinaSegmento = useCallback(
    (arcoId: string, pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoAvviato.current
      if (primoEventoDelGesto) {
        // Il congelamento sta QUI, fuori dall'updater passato ad `applica`/
        // `aggiornaSenzaCronologia`: in StrictMode React invoca due volte l'updater per
        // scovare effetti impuri, e scrivere i ref lì dentro li farebbe scrivere due volte,
        // catturando lo stato sbagliato alla seconda chiamata. L'arco fresco è già in mano
        // tramite `stato.edges` (si ricrea a ogni cambio, vedi `edgesConTrascinamento` sotto),
        // quindi i gomiti di partenza si leggono da lì, non dall'`s` dentro l'updater.
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
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const data = e.data as SchemaEdgeData
          const nuovi = trascinaTratto(data.stile, pDa, pA, gomiti, quote, indice, delta)
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
