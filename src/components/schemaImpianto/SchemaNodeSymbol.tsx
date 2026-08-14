/**
 * Nodo dell'editor: disegna lo stesso simbolo SVG del render statico, così ciò che si
 * vede mentre si corregge è ciò che finirà in relazione.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ancoreDi, dimensioniDi, simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora, SchemaNodo } from '@/services/schemaImpianto/types'

export interface SchemaNodeData extends Record<string, unknown> {
  /**
   * Il nodo SENZA posizione: nell'editor l'unica coordinata viva è `Node.position`, che
   * `applyNodeChanges` aggiorna a ogni trascinamento e che `flowALayout` legge alla conferma.
   * Una seconda copia qui dentro divergerebbe al primo gesto — è la causa dei difetti di
   * frecce, allineamento e distribuzione del blocco «fondamenta».
   */
  nodo: SchemaNodo
}

/**
 * L'handle è un quadrato centrato sull'ancora (`translate(-50%, -50%)`), di lato `LATO_HANDLE`
 * salvo che `latoHandle` lo riduca sui nodi piccoli (vedi sotto). Il lato conta: react-flow non
 * passa all'arco il centro dell'handle ma il suo bordo esterno dal lato dichiarato in
 * `position` — cioè il centro dell'ancora spostato di metà lato. È il motivo per cui i capi
 * degli archi NON si prendono da `sourceX`/`sourceY` (vedi `capiDegliArchi` in
 * conversioneFlow.ts): il documento userebbe il centro e i due disegni uscirebbero sfalsati.
 */
export const LATO_HANDLE = 10

/**
 * Lato dell'handle per un nodo di dimensioni date: `LATO_HANDLE`, ma non oltre un terzo del
 * lato minore del riquadro. Sulla giunzione (24×24, quattro ancore agli angoli del riquadro)
 * un handle di 10px si sovrapponeva al vicino e copriva quasi tutta la superficie, lasciando
 * solo qualche pixel al centro da cui trascinare il nodo invece di avviare una connessione —
 * inutilizzabile allo zoom con cui l'editor si apre. Sugli altri simboli, il più piccolo dei
 * quali è la tanica (80×70), il limite non scatta mai: resta `LATO_HANDLE`.
 */
function latoHandle(dim: { larghezza: number; altezza: number }): number {
  return Math.min(LATO_HANDLE, Math.min(dim.larghezza, dim.altezza) / 3)
}

/**
 * Lato react-flow a cui appoggiare l'handle: quello del riquadro d'ingombro più vicino
 * all'ancora. È solo resa grafica — l'aggancio vero, cioè cosa può collegarsi dove, lo
 * decide `capoValido` dal registro simboli, non questa posizione.
 *
 * Esportata perché è anche il dato da cui dipendono le coordinate che react-flow passa
 * all'arco: il test dell'accordo (`__tests__/instradamentoCondiviso.test.ts`) la usa per
 * ricostruire quei capi — la fonte sbagliata — e provare che la tela non li segue più.
 */
export function latoDi(ancora: SchemaAncora, dim: { larghezza: number; altezza: number }): Position {
  const distanze = [
    { lato: Position.Left, d: ancora.x },
    { lato: Position.Right, d: dim.larghezza - ancora.x },
    { lato: Position.Top, d: ancora.y },
    { lato: Position.Bottom, d: dim.altezza - ancora.y },
  ]
  return distanze.reduce((a, b) => (a.d <= b.d ? a : b)).lato
}

export function SchemaNodeSymbol({ data, selected }: NodeProps) {
  const { nodo } = data as SchemaNodeData
  // Ingombro effettivo, non quello del registro: la scritta del terminale utenze è libera, e con
  // la larghezza fissa il `<svg>` qui sotto la taglierebbe appena supera i 17-18 caratteri.
  const dimensioni = dimensioniDi(nodo)
  const { larghezza, altezza } = dimensioni
  const latoHandlePx = latoHandle(dimensioni)
  const stileAncora = { width: latoHandlePx, height: latoHandlePx, background: '#1976d2', border: 'none' }

  return (
    <div style={{ position: 'relative', width: larghezza, height: altezza }}>
      {ancoreDi(nodo).flatMap((ancora) => {
        // Ogni ancora ospita sia source sia target, sovrapposti: una tubazione può
        // partire o arrivare dallo stesso punto. Chi decide se il collegamento è legale
        // non è l'handle ma `isValidConnection` in SchemaEditor, via `capoValido`.
        const stile = { ...stileAncora, left: ancora.x, top: ancora.y, transform: 'translate(-50%, -50%)' }
        const lato = latoDi(ancora, dimensioni)
        // L'ordine qui non è indifferente: due handle sovrapposti senza z-index si
        // contendono il mousedown, e vince l'ultimo nel DOM. In connectionMode Strict
        // (il default, non sovrascritto) il trascinamento parte quindi dall'handle
        // dichiarato per secondo e atterra sull'altro tipo sul nodo di arrivo — se
        // `source` fosse primo, ogni tubazione tracciata a mano nascerebbe con `da`/`a`
        // scambiati rispetto al gesto reale. `target` va dichiarato per primo apposta.
        return [
          <Handle key={`t-${ancora.id}`} type="target" id={ancora.id} position={lato} style={stile} />,
          <Handle key={`s-${ancora.id}`} type="source" id={ancora.id} position={lato} style={stile} />,
        ]
      })}
      <svg
        width={larghezza}
        height={altezza}
        viewBox={`0 0 ${larghezza} ${altezza}`}
        style={{
          display: 'block',
          // Niente fondo qui: il fondo bianco che c'era prima copriva tutto l'ingombro del
          // nodo, e siccome react-flow disegna il layer dei nodi sopra quello degli archi
          // nascondeva le tubazioni che passano dietro. Serviva solo quando la tela era scura
          // — senza, il tratto nero dei simboli si sarebbe visto a stento; ora che la tela è
          // bianca (vedi il commento sulla tela in SchemaEditor.tsx) è un rettangolo opaco che
          // non serve più a nulla, ed è stato tolto. L'anteprima (renderSvg.ts) non ha mai
          // avuto questo problema non perché le forme dei simboli siano tutte vuote — non lo
          // sono: la giunzione è un cerchio pieno, la punta del terminale utenze è un
          // triangolo pieno, i testi sono pieni — ma perché renderSvg non disegna un
          // rettangolo di fondo per ogni nodo: il solo fondo bianco del documento è un unico
          // `<rect>` grande quanto l'intera pagina, disegnato una volta sola dietro a tutto
          // (archi compresi), non un riquadro per apparecchiatura.
          //
          // `pointerEvents: 'all'` non compensa una perdita: il valore calcolato su questo
          // `<svg>` era già `all` prima di questa modifica, per due strade indipendenti dal
          // fondo appena tolto — `pointer-events` è una proprietà ereditata e il foglio di
          // stile di react-flow dichiara `.react-flow__node { pointer-events: all }` sul `div`
          // che avvolge questo componente; e comunque il `<div>` qui sopra, con `width`/
          // `height` espliciti, è già bersaglio su tutta la sua area indipendentemente da cosa
          // vi sia dipinto. La dichiarazione qui la rende esplicita e locale invece di lasciarla
          // arrivare per sola eredità da una classe della libreria — una cautela, non la
          // correzione di una regressione: misurato in pagina, 256 punti sondati dentro il
          // riquadro di un'apparecchiatura sono stati intercettati dal nodo, nessuno sfuggito
          // alla tela.
          pointerEvents: 'all',
          outline: selected ? '2px solid #1976d2' : 'none',
        }}
        // Il simbolo è generato dal nostro codice a partire da dati della scheda, non da
        // input esterni, e le etichette passano già da escapeXml in symbols/index.ts.
        dangerouslySetInnerHTML={{ __html: simboloDi(nodo) }}
      />
    </div>
  )
}
