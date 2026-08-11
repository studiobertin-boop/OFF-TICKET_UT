/**
 * Nodo dell'editor: disegna lo stesso simbolo SVG del render statico, così ciò che si
 * vede mentre si corregge è ciò che finirà in relazione.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import { simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaNodoPosizionato } from '@/services/schemaImpianto/types'

export interface SchemaNodeData extends Record<string, unknown> {
  nodo: SchemaNodoPosizionato
}

const ANCORA = { width: 10, height: 10, background: '#1976d2', border: 'none' }

/**
 * Identificativi degli attacchi. Servono espliciti perché il verso di partenza cambia il
 * senso del disegno: la mandata di un compressore sale al collettore, la linea condense
 * scende alla corsia bassa — le stesse rotte che poi traccia il render statico.
 */
export const ATTACCO = {
  sinistra: 'sx',
  destra: 'dx',
  altoIngresso: 'alto-in',
  altoUscita: 'alto-out',
  bassoUscita: 'basso-out',
} as const

export function SchemaNodeSymbol({ data, selected }: NodeProps) {
  const { nodo } = data as SchemaNodeData
  const dim = DIMENSIONI_NODO[nodo.tipo]

  return (
    <div style={{ position: 'relative', width: dim.larghezza, height: dim.altezza }}>
      <Handle type="target" position={Position.Left} id={ATTACCO.sinistra} style={ANCORA} />
      <Handle type="target" position={Position.Top} id={ATTACCO.altoIngresso} style={ANCORA} />
      <Handle type="source" position={Position.Top} id={ATTACCO.altoUscita} style={ANCORA} />
      <svg
        width={dim.larghezza}
        height={dim.altezza}
        viewBox={`0 0 ${dim.larghezza} ${dim.altezza}`}
        style={{
          display: 'block',
          background: '#fff',
          outline: selected ? '2px solid #1976d2' : 'none',
        }}
        // Il simbolo è generato dal nostro codice a partire da dati della scheda, non da
        // input esterni, e le etichette passano già da escapeXml in symbols/index.ts.
        dangerouslySetInnerHTML={{ __html: simboloDi(nodo) }}
      />
      <Handle type="source" position={Position.Right} id={ATTACCO.destra} style={ANCORA} />
      <Handle type="source" position={Position.Bottom} id={ATTACCO.bassoUscita} style={ANCORA} />
    </div>
  )
}
