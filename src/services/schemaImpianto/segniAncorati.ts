/**
 * Traduzione degli ancoraggi in `t` numeriche, ultimo passo del layout.
 *
 * Le convenzioni dello studio parlano di vertici — «la valvola sta un passo di griglia sotto la
 * dorsale» — e al momento in cui `buildSchemaModel` semina il segno le posizioni non esistono
 * ancora: il modello dichiara l'intento, qui diventa un numero.
 *
 * **Contratto di sola andata.** `ancoraggio` entra e non esce: si legge, si scrive `t`, si toglie.
 * E' la ragione per cui il formato salvato non cambia di un byte, e `renderSvg`, `conversioneFlow`,
 * `SchemaEdgeTubazione`, `useSegniTubo` e la serializzazione non si toccano. La stessa divisione
 * gia' in vigore fra `stileAValle` (dato) e `tronconi` (resa).
 *
 * *Alternativa scartata: ancoraggio vivo, ririsolto a ogni disegno. Rimetterebbe la valvola al suo
 * posto ogni volta che l'operatore la trascina.*
 *
 * Le quote di instradamento arrivano dal chiamante e non si calcolano qui: `quoteInstradamento`
 * vive in `layout.ts`, che importa QUESTO modulo, e chiamarla accorcerebbe il cerchio fino a
 * renderlo diretto.
 *
 * Un anello piu' largo resta, e va conosciuto: `layout` → `segniAncorati` → `renderSvg` (per
 * `posizioneAncora`) → `layout`. Regge perche' tutto cio' che le tre parti si scambiano sono
 * DICHIARAZIONI di funzione, che l'hoisting rende disponibili prima che il modulo finisca di
 * valutarsi — provato dal file di test qui accanto, che importa questo modulo per primo, cioe' nel
 * caso peggiore. Convertire `corpoNodo` o `posizioneAncora` in una `const` lo romperebbe, con un
 * `undefined is not a function` a runtime che `tsc` non segnala: se capita, la cura e' spostare
 * quelle due in `symbols/index.ts` — sono geometria dei simboli, non resa — e riesportarle da qui
 * per non toccare gli importatori.
 */
import type { Tarature } from './libreria'
import { posizioneAncora } from './renderSvg'
import { latoImposto } from './symbols'
import { instrada, tDaAncoraggio } from './tratti'
import type { QuoteInstradamento } from './tratti'
import type { SchemaLayout } from './types'

export function risolviSegniAncorati(
  layout: SchemaLayout,
  quote: QuoteInstradamento,
  libreria: Tarature = {}
): SchemaLayout {
  const perId = new Map(layout.nodi.map((n) => [n.id, n]))

  const archi = layout.archi.map((arco) => {
    if (!arco.segni?.some((s) => s.ancoraggio)) return arco

    const da = perId.get(arco.da.nodo)
    const a = perId.get(arco.a.nodo)
    // La stessa polilinea che disegnera' `renderSvg` — vedi `renderArco` — e non
    // un'approssimazione: una formula diversa metterebbe la valvola dove il tubo non passa.
    // Un capo mancante non e' un disegno da riparare qui: i segni tengono la `t` di ripiego.
    const punti =
      da && a
        ? instrada(
            arco.stile,
            posizioneAncora(da, arco.da.ancora, libreria),
            posizioneAncora(a, arco.a.ancora, libreria),
            arco.punti,
            quote,
            { da: latoImposto(da, arco.da.ancora, libreria), a: latoImposto(a, arco.a.ancora, libreria) }
          )
        : null

    return {
      ...arco,
      segni: arco.segni.map((segno) => {
        if (!segno.ancoraggio) return segno
        const t = punti ? tDaAncoraggio(punti, segno.ancoraggio) : null
        // La chiave si TOGLIE, non si mette a `undefined`: un layout che la portasse, anche vuota,
        // non sarebbe piu' identico a uno salvato prima che gli ancoraggi esistessero. Copia piu'
        // `delete` e non destrutturazione con scarto: quella lascerebbe indietro ogni campo che
        // qualcuno aggiungera' al segno, e qui si deve togliere UNA chiave, non tenerne quattro.
        const risolto = { ...segno, t: t ?? segno.t }
        delete risolto.ancoraggio
        return risolto
      }),
    }
  })

  return { ...layout, archi }
}
