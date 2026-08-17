/**
 * Nodo dell'editor: disegna lo stesso simbolo SVG del render statico, così ciò che si
 * vede mentre si corregge è ciò che finirà in relazione.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import { ancoreDi, presaDi, riquadroDi, simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora, SchemaLatoAncora, SchemaNodo } from '@/services/schemaImpianto/types'

export interface SchemaNodeData extends Record<string, unknown> {
  /**
   * Il nodo SENZA posizione: nell'editor l'unica coordinata viva è `Node.position`, che
   * `applyNodeChanges` aggiorna a ogni trascinamento e che `flowALayout` legge alla conferma.
   * Una seconda copia qui dentro divergerebbe al primo gesto — è la causa dei difetti di
   * frecce, allineamento e distribuzione del blocco «fondamenta».
   */
  nodo: SchemaNodo
  /**
   * La libreria risolta dall'editor (`SchemaEditor.tsx`, il punto unico per questa catena),
   * portata qui dentro `data` perché è la sola strada per passare qualcosa a un componente che
   * react-flow istanzia da `nodeTypes` — una mappa dichiarata una volta, non per ogni nodo
   * (`layoutAFlow`, conversioneFlow.ts).
   */
  libreria: Tarature
  /**
   * Vero per il solo nodo che il modo taratura sta modificando (`BarraTaratura.tsx`, Task 12).
   * Spegne le sue maniglie di connessione: in quel modo i tubi non si tracciano
   * (`nodesConnectable={false}` su `<ReactFlow>`, SchemaEditor.tsx) e le maniglie della
   * taratura, disegnate sopra sugli stessi punti (`ManiglieTaratura`), ne prendono il posto —
   * due coppie di pallini sovrapposti sullo stesso punto sarebbero solo confusione. Assente o
   * `false` per ogni altro nodo, tarato o no.
   */
  taraturaAttiva?: boolean
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
 * lato minore del riquadro. Sulla giunzione (20×20, quattro punti di presa sulle mezzerie dei
 * lati del riquadro) un handle di 10px si sovrapponeva al vicino e copriva quasi tutta la
 * superficie, lasciando solo qualche pixel al centro da cui trascinare il nodo invece di
 * avviare una connessione — inutilizzabile allo zoom con cui l'editor si apre. La tanica, il
 * simbolo più piccolo dopo di lei, è 80×40: un terzo di 40 fa 13,3, sopra `LATO_HANDLE`, quindi
 * su di lei e su tutti gli altri il limite non scatta mai.
 */
function latoHandle(dim: { larghezza: number; altezza: number }): number {
  return Math.min(LATO_HANDLE, Math.min(dim.larghezza, dim.altezza) / 3)
}

/** Traduzione fra il vocabolario del registro (un servizio, che non conosce react-flow) e
 *  quello della tela. È l'unico punto che ha diritto di conoscerli entrambi. */
const LATO_REACT_FLOW: Record<SchemaLatoAncora, Position> = {
  sx: Position.Left,
  dx: Position.Right,
  alto: Position.Top,
  basso: Position.Bottom,
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
export function latoDi(
  ancora: SchemaAncora,
  // `x`/`y` opzionali: sono l'angolo del riquadro (`riquadroDi`), zero per ogni simbolo non tarato
  // — chi passa qui delle sole misure sta implicitamente dicendo «riquadro all'origine», che è il
  // caso di sempre. Senza tenerne conto, un riquadro che comincia a coordinate negative farebbe
  // misurare le quattro distanze da bordi che non sono i suoi.
  riquadro: { x?: number; y?: number; larghezza: number; altezza: number }
): Position {
  // Il lato dichiarato vince: la deduzione qui sotto guarda l'ancora, ed è degenere quando più
  // ancore coincidono.
  if (ancora.lato) return LATO_REACT_FLOW[ancora.lato]
  const x0 = riquadro.x ?? 0
  const y0 = riquadro.y ?? 0
  const distanze = [
    { lato: Position.Left, d: ancora.x - x0 },
    { lato: Position.Right, d: x0 + riquadro.larghezza - ancora.x },
    { lato: Position.Top, d: ancora.y - y0 },
    { lato: Position.Bottom, d: y0 + riquadro.altezza - ancora.y },
  ]
  return distanze.reduce((a, b) => (a.d <= b.d ? a : b)).lato
}

/**
 * `isConnectable` va INOLTRATO agli Handle, non solo destrutturato: react-flow lo consegna al
 * componente del nodo e si aspetta che sia lui a passarlo: `nodesConnectable={false}` sulla tela
 * (SchemaEditor.tsx) da solo NON arriva agli Handle. Misurato: senza questo inoltro gli handle
 * escono comunque con `connectable`/`connectablestart`/`connectableend`/`connectionindicator`, e
 * `.react-flow__handle.connectionindicator` porta `pointer-events: all` — in modo taratura si
 * poteva quindi ancora tracciare una tubazione nuova, che finiva in `onConnect` e da lì in una
 * voce della cronologia dell'IMPIANTO senza via di ritorno («Annulla» spento, Ctrl+Z alla
 * taratura). È la stessa famiglia dei gesti propri della tela chiusi altrove: una prop della tela
 * che non raggiunge da sé chi disegna davvero il bersaglio del puntatore.
 */
export function SchemaNodeSymbol({ data, selected, isConnectable }: NodeProps) {
  const { nodo, libreria, taraturaAttiva } = data as SchemaNodeData
  // Riquadro effettivo, non quello del registro: la scritta del terminale utenze è libera, e con
  // la larghezza fissa il `<svg>` qui sotto la taglierebbe appena supera i 17-18 caratteri.
  //
  // `riquadroDi` e non `dimensioniDi`: serve anche l'ANGOLO. Con una taratura che porta la sagoma
  // a sinistra o in alto dei pallini, il riquadro comincia a coordinate locali negative
  // (`inviluppo`, symbols/index.ts), e con `viewBox="0 0 …"` la parte a sinistra dell'origine
  // finiva tagliata QUI e disegnata nel documento (`<g transform="translate(x y)">`, renderSvg.ts)
  // — tela e documento che dicono due cose diverse, la classe di difetto che il Blocco 3 esiste
  // per chiudere (revisione finale, rilievo Importante).
  const riquadro = riquadroDi(nodo, libreria)
  const { x: scostoX, y: scostoY, larghezza, altezza } = riquadro
  const latoHandlePx = latoHandle(riquadro)
  const stileAncora = { width: latoHandlePx, height: latoHandlePx, background: '#1976d2', border: 'none' }

  // Il `<div>` si sposta dell'angolo e la `viewBox` parte dallo stesso angolo: le due traslazioni
  // si annullano, e una coordinata locale finisce sullo schermo esattamente dove il documento la
  // disegna (`node.position` + la coordinata). Con un riquadro che parte da (0,0) — cioè ovunque
  // salvo una taratura che sposta la sagoma all'indietro — è un `left: 0`/`top: 0`, e nulla si
  // muove rispetto a prima. `position: relative`, quindi lo scostamento non tocca la dimensione
  // che react-flow misura sul nodo.
  return (
    <div style={{ position: 'relative', left: scostoX, top: scostoY, width: larghezza, height: altezza }}>
      {ancoreDi(nodo, libreria).flatMap((ancora) => {
        // Ogni ancora ospita sia source sia target, sovrapposti: una tubazione può
        // partire o arrivare dallo stesso punto. Chi decide se il collegamento è legale
        // non è l'handle ma `isValidConnection` in SchemaEditor, via `capoValido`.
        // Sulla PRESA, non sull'ancora: quando un simbolo dichiara una presa, il tubo arriva
        // all'ancora ma il simbolo si afferra altrove (`presaDi`, symbols/index.ts).
        const presa = presaDi(ancora)
        // In modo taratura sul nodo attivo gli handle restano MONTATI ma invisibili e inerti:
        // react-flow risolve la posizione di un capo dal proprio Handle nel DOM, e un
        // trascinamento passato senza di lui (provato togliendolo del tutto, `!taraturaAttiva &&`
        // qui davanti) faceva sparire dalla tela la tubazione collegata, non solo la sua
        // maniglia — errore #008 di react-flow. Le maniglie della taratura, disegnate sopra
        // nello stesso punto (`ManiglieTaratura`), coprono comunque il pallino sottostante: gli
        // resta solo il compito che il connettore non deve più fare da sé, con
        // `nodesConnectable={false}` acceso (SchemaEditor.tsx).
        // Meno l'angolo del riquadro: la presa è in coordinate locali al NODO, il `<div>` che la
        // ospita è traslato di quell'angolo (vedi sopra), e senza compensare l'handle finirebbe
        // spostato dell'angolo rispetto al punto in cui il documento attacca il tubo.
        const stile = {
          ...stileAncora,
          left: presa.x - scostoX,
          top: presa.y - scostoY,
          transform: 'translate(-50%, -50%)',
          ...(taraturaAttiva ? { opacity: 0, pointerEvents: 'none' as const } : {}),
        }
        const lato = latoDi(ancora, riquadro)
        // L'ordine qui non è indifferente: due handle sovrapposti senza z-index si
        // contendono il mousedown, e vince l'ultimo nel DOM. In connectionMode Strict
        // (il default, non sovrascritto) il trascinamento parte quindi dall'handle
        // dichiarato per secondo e atterra sull'altro tipo sul nodo di arrivo — se
        // `source` fosse primo, ogni tubazione tracciata a mano nascerebbe con `da`/`a`
        // scambiati rispetto al gesto reale. `target` va dichiarato per primo apposta.
        return [
          <Handle
            key={`t-${ancora.id}`}
            type="target"
            id={ancora.id}
            position={lato}
            style={stile}
            isConnectable={isConnectable}
          />,
          <Handle
            key={`s-${ancora.id}`}
            type="source"
            id={ancora.id}
            position={lato}
            style={stile}
            isConnectable={isConnectable}
          />,
        ]
      })}
      <svg
        width={larghezza}
        height={altezza}
        viewBox={`${scostoX} ${scostoY} ${larghezza} ${altezza}`}
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
          // Tratteggio viola, distinto dal blu della sola selezione react-flow: mentre il nodo è
          // in taratura la sua "selezione" ha un significato diverso (sta per essere tarato, non
          // solo evidenziato), e le due cose non devono leggersi uguali sulla tela.
          outline: taraturaAttiva ? '2px dashed #9c27b0' : selected ? '2px solid #1976d2' : 'none',
        }}
        // Il simbolo è generato dal nostro codice a partire da dati della scheda, non da
        // input esterni, e le etichette passano già da escapeXml in symbols/index.ts.
        dangerouslySetInnerHTML={{ __html: simboloDi(nodo, libreria) }}
      />
    </div>
  )
}
