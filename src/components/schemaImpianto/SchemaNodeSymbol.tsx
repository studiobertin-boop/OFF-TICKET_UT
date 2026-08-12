/**
 * Nodo dell'editor: disegna lo stesso simbolo SVG del render statico, così ciò che si
 * vede mentre si corregge è ciò che finirà in relazione.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { definizioneDi, simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'

export interface SchemaNodeData extends Record<string, unknown> {
  nodo: SchemaNodoPosizionato
}

const ANCORA = { width: 10, height: 10, background: '#1976d2', border: 'none' }

/**
 * Lato react-flow a cui appoggiare l'handle: quello del riquadro d'ingombro più vicino
 * all'ancora. È solo resa grafica — l'aggancio vero, cioè cosa può collegarsi dove, lo
 * decide `capoValido` dal registro simboli, non questa posizione.
 */
function latoDi(ancora: SchemaAncora, dim: { larghezza: number; altezza: number }): Position {
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
  const def = definizioneDi(nodo)
  const { larghezza, altezza } = def.dimensioni

  return (
    <div style={{ position: 'relative', width: larghezza, height: altezza }}>
      {def.ancore.flatMap((ancora) => {
        // Ogni ancora ospita sia source sia target, sovrapposti: una tubazione può
        // partire o arrivare dallo stesso punto. Chi decide se il collegamento è legale
        // non è l'handle ma `isValidConnection` in SchemaEditor, via `capoValido`.
        const stile = { ...ANCORA, left: ancora.x, top: ancora.y, transform: 'translate(-50%, -50%)' }
        const lato = latoDi(ancora, def.dimensioni)
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
          background: '#fff',
          outline: selected ? '2px solid #1976d2' : 'none',
        }}
        // Il simbolo è generato dal nostro codice a partire da dati della scheda, non da
        // input esterni, e le etichette passano già da escapeXml in symbols/index.ts.
        dangerouslySetInnerHTML={{ __html: simboloDi(nodo) }}
      />
    </div>
  )
}
