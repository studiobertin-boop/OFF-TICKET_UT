/**
 * Le istruzioni di sola andata che il modello manda al layout, tradotte in geometria: gli
 * ANCORAGGI dei segni in `t` numeriche (`risolviSegniAncorati`) e la FORMA degli archi in gomiti
 * assoluti (`risolviPonti`). Ultimo passo del layout, in quest'ordine — il secondo scrive i
 * `punti` su cui il primo poi conta.
 *
 * Le due risoluzioni stanno insieme perché sono la stessa cosa: il modello dichiara l'intento
 * quando le posizioni non esistono ancora, e qui, che è l'unico punto in cui esistono, diventa un
 * numero. Il file porta il nome della prima delle due perché la seconda è arrivata dopo, col
 * by-pass del Blocco 3.
 *
 * Le convenzioni dello studio parlano di vertici — «la valvola sta due passi di griglia sotto la
 * dorsale» — e di forme — «il ponte sale, corre e ridiscende» — non di frazioni di lunghezza né di
 * coordinate assolute: quelle si sanno solo qui.
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
import { eTeeBypass } from './bypass'
import type { Tarature } from './libreria'
import { posizioneAncora } from './renderSvg'
import { latoImposto } from './symbols'
import { instrada, tDaAncoraggio } from './tratti'
import type { QuoteInstradamento } from './tratti'
import type { SchemaArco, SchemaLatoAncora, SchemaLayout } from './types'

/**
 * I gomiti del ponte di ogni by-pass, e la `forma` tolta dagli archi.
 *
 * **Vanno risolti PRIMA degli ancoraggi**: i tre segni del ponte sono ancorati ai suoi vertici
 * (gomito sinistro, corsa orizzontale, gomito destro), che esistono solo dopo che i gomiti sono
 * scritti. `layoutSchema` chiama le due in quest'ordine, e non è negoziabile.
 *
 * **Il gomito non è un'ottimizzazione.** Fino al Blocco 4 i due capi stavano alla stessa quota, e
 * senza gomiti `rottaImboccata` piegava a `yMedia` — che con due capi complanari è la loro stessa
 * quota — e `dedup` collassava tutto in una retta sovrapposta alla linea di processo: il by-pass
 * spariva alla vista pur esistendo nel modello. Dal Blocco 5 i due capi stanno a quote DIVERSE, e
 * la ragione è un'altra: senza il gomito la piega la sceglie `rottaImboccata` dai lati imposti ai
 * capi, e prendendo il capo di monte dall'alto la corsa cadrebbe a metà fra le due quote invece
 * che sulla quota del capo. Prendendolo di FIANCO — che è ciò che `buildSchemaModel` fa — le due
 * risposte coincidono, e un test lo fissa (`layout.test.ts`): è la sentinella del giorno in cui
 * divergessero.
 *
 * Le corsie non si calcolano più qui: dal Blocco 5 la quota del ponte è quella del suo capo di
 * monte, che il layout ha già posato sulla corsia giusta (`corsieDeiCapiDiMonte`, layout.ts). Su
 * un layout riaperto vale lo stesso, e per la stessa ragione per cui prima le si ricalcolava: la
 * quota che conta è quella che il nodo ha ADESSO, spostato a mano o no.
 */
export function risolviPonti(layout: SchemaLayout, libreria: Tarature = {}): SchemaLayout {
  const perId = new Map(layout.nodi.map((n) => [n.id, n]))
  const capi = (arco: SchemaArco) => {
    const da = perId.get(arco.da.nodo)
    const a = perId.get(arco.a.nodo)
    if (!da || !a) return null
    return {
      da: posizioneAncora(da, arco.da.ancora, libreria),
      a: posizioneAncora(a, arco.a.ancora, libreria),
    }
  }

  // I lati che i capi impongono: la giunzione e' l'unico simbolo che ne dichiari uno
  // (`latoImposto`), ed e' da li' che si sa se un tubo imbocca il TEE di fianco o dall'alto.
  const lati = (arco: SchemaArco) => {
    const da = perId.get(arco.da.nodo)
    const a = perId.get(arco.a.nodo)
    return {
      da: da ? latoImposto(da, arco.da.ancora, libreria) : undefined,
      a: a ? latoImposto(a, arco.a.ancora, libreria) : undefined,
    }
  }

  const ponti = layout.archi
    .map((arco, i) => ({ arco, i, punti: arco.forma === 'ponte' ? capi(arco) : null }))
    .filter((v) => v.punti !== null)
  if (ponti.length === 0) return layout

  const archi = layout.archi.map((arco) => {
    if (arco.forma !== 'ponte') return gradinoVersoIlTee(arco, capi(arco), lati(arco))
    const risolto = { ...arco }
    // La chiave si TOGLIE, non si mette a `undefined`: un layout che la portasse, anche vuota, non
    // sarebbe più identico a uno salvato prima che le forme esistessero. Copia più `delete` e non
    // destrutturazione con scarto, che lascerebbe un warning eslint su un percorso che deve stare
    // a zero e perderebbe i campi che qualcuno aggiungerà all'arco.
    delete risolto.forma
    const punti = capi(arco)
    // Un capo mancante non è un disegno da riparare qui: l'arco resta senza gomiti, e almeno la
    // `forma` non gli sopravvive — è la stessa degradazione scelta per gli ancoraggi.
    if (!punti) return risolto
    // Un gomito SOLO: il ponte parte dal capo di monte, che dal Blocco 5 è già alla sua quota,
    // corre orizzontale e scende sul capo di valle. Tre vertici, due tratti — ed è su quel conto
    // che si appoggiano i due ancoraggi delle valvole del ponte.
    return { ...risolto, punti: [{ x: punti.a.x, y: punti.da.y }] }
  })

  return { ...layout, archi }
}

/**
 * Il gradino a mezza strada sul tubo che entra (o esce da) una giunzione di by-pass venendo da
 * un'altra quota — in pratica quello che va dall'uscita del serbatoio al TEE di monte, dopo che la
 * linea di processo è scesa di una corsia.
 *
 * **Difetto trovato guardando il disegno, non dai test.** La giunzione impone il lato `sx`, e
 * `rottaImboccata` (tratti.ts) con un capo solo imposto piega SUBITO, sul capo libero: il tratto
 * verticale correva rasente il fianco del serbatoio, sovrapposto al suo contorno e quindi
 * invisibile, e il tubo sembrava uscire dalla pancia invece che dal bocchello. Sbagliato ma
 * plausibile: il peggior tipo di errore per questo modulo.
 *
 * Due gomiti a mezza strada, che è la stessa forma che `rottaLinea` dà a un tubo di linea fra due
 * quote diverse: il gradino si vede, e l'ultimo tratto arriva comunque orizzontale, come la
 * giunzione richiede.
 *
 * Non si tocca `rottaImboccata`: è la rotta di OGNI arco che tocca un TEE, compresi quelli inseriti
 * a mano nell'editor, e cambiarla la' muoverebbe disegni che con i by-pass non c'entrano.
 *
 * Nulla da fare quando i due capi sono già alla stessa quota (dentro la catena lo sono tutti): un
 * gomito lì sarebbe markup in più su ogni documento consegnato, e un tratto di lunghezza nulla è
 * un tranello per gli ancoraggi, che contano vertici e tratti.
 */
/** Vero per i lati lungo cui il tubo imbocca in verticale. Un duplicato di due parole di
 *  `tratti.ts` (`verticale`, privata): esportarla di la' per usarla qui toglierebbe a quel modulo
 *  il diritto di cambiarla senza guardare altrove. */
const imboccaInVerticale = (lato: SchemaLatoAncora | undefined) => lato === 'alto' || lato === 'basso'

function gradinoVersoIlTee(
  arco: SchemaArco,
  punti: { da: { x: number; y: number }; a: { x: number; y: number } } | null,
  lati: { da: SchemaLatoAncora | undefined; a: SchemaLatoAncora | undefined }
): SchemaArco {
  // I gomiti tracciati a mano vincono su tutto: da quel momento il percorso è una scelta
  // dell'utente e nessuna euristica deve sovrascriverla.
  if (!punti || (arco.punti ?? []).length > 0) return arco
  // Il gradino serve solo dove il TEE impone un lato ORIZZONTALE: e' li' che `rottaImboccata`
  // piega sul capo LIBERO — sul fianco del serbatoio — e il tratto verticale sparisce dentro il
  // contorno. Con un lato verticale la piega cade gia' sull'ascissa del TEE, che e' dove il
  // riferimento la vuole: e' il montante che scende dal capo di monte di un by-pass (Blocco 5),
  // e un gradino li' sarebbe uno scalino in piu' su un tubo che deve solo scendere.
  if (imboccaInVerticale(lati.da) || imboccaInVerticale(lati.a)) return arco
  // Un TEE per capo e uno solo: fra due giunzioni c'è già il ponte, che ha la sua forma.
  if (eTeeBypass(arco.da.nodo) === eTeeBypass(arco.a.nodo)) return arco
  if (punti.da.y === punti.a.y) return arco
  const xMedia = (punti.da.x + punti.a.x) / 2
  return { ...arco, punti: [{ x: xMedia, y: punti.da.y }, { x: xMedia, y: punti.a.y }] }
}

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
