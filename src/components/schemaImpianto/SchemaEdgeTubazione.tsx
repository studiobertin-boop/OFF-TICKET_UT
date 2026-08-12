/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD:
 * rigida continua, flessibile ondulata, condense tratteggiata.
 */
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import type { SchemaArcoStile } from '@/services/schemaImpianto/types'

export interface SchemaEdgeData extends Record<string, unknown> {
  stile: SchemaArcoStile
  /**
   * Gomiti imposti a mano, in coordinate assolute: solo trasportati fra modello e
   * react-flow qui, non ancora disegnati (arriva con l'editing del percorso).
   */
  punti?: { x: number; y: number }[]
}

/**
 * Solo il tratto flessibile porta un'etichetta: le linee condense si riconoscono già dal
 * tratteggio, e ripeterlo su ognuna riempirebbe il disegno di scritte.
 */
const ETICHETTA: Record<SchemaArcoStile, string> = {
  standard: '',
  flessibile: 'flessibile',
  condensa: '',
}

export function SchemaEdgeTubazione({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const stile = ((data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#1976d2' : '#000',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: stile === 'condensa' ? '8 6' : undefined,
        }}
      />
      {ETICHETTA[stile] && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 11,
              padding: '1px 4px',
              borderRadius: 3,
              background: '#fff',
              border: '1px solid #bbb',
              pointerEvents: 'none',
            }}
          >
            {ETICHETTA[stile]}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
