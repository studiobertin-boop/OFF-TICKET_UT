/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD:
 * rigida continua, flessibile ondulata, condense tratteggiata.
 */
import { useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import type { SchemaArcoStile } from '@/services/schemaImpianto/types'

export interface SchemaEdgeData extends Record<string, unknown> {
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute: disegnano la polilinea imposta. */
  punti?: { x: number; y: number }[]
  /**
   * Legate a questo arco specifico da `useGomiti` (vedi `edgesConGomiti` lì dentro): il
   * componente dell'arco non conosce la cronologia, sa solo chiedere di aggiornarla.
   */
  onSpostaGomito?: (indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
  onRimuoviGomito?: (indice: number) => void
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

interface SchemaGomitoProps {
  indice: number
  punto: { x: number; y: number }
  onSposta?: (indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
  onRimuovi?: (indice: number) => void
}

/**
 * Maniglia di un gomito. Usa la cattura del puntatore invece di ascoltare mousemove sulla
 * finestra: il trascinamento resta valido anche se il cursore esce per un attimo dal
 * riquadro della maniglia, senza dover montare e smontare listener globali.
 */
function SchemaGomito({ indice, punto, onSposta, onRimuovi }: SchemaGomitoProps) {
  const { screenToFlowPosition } = useReactFlow()

  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ferma qui il gesto: senza, il pointerdown sulla maniglia arriverebbe anche alla
    // tubazione sottostante e diventerebbe un trascinamento dell'arco o un pan della tela.
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      onSposta?.(indice, screenToFlowPosition({ x: e.clientX, y: e.clientY }), false)
    },
    [indice, onSposta, screenToFlowPosition]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      onSposta?.(indice, screenToFlowPosition({ x: e.clientX, y: e.clientY }), true)
    },
    [indice, onSposta, screenToFlowPosition]
  )

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Deve fermarsi qui: EdgeLabelRenderer porta questo div altrove nel DOM, ma resta
      // figlio nell'albero React, e senza stopPropagation il doppio clic risalirebbe fino
      // al gestore della tubazione e creerebbe un secondo gomito invece di togliere questo.
      e.stopPropagation()
      onRimuovi?.(indice)
    },
    [indice, onRimuovi]
  )

  return (
    <div
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#fff',
        border: '2px solid #1976d2',
        pointerEvents: 'all',
        cursor: 'move',
      }}
    />
  )
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
  const edgeData = data as SchemaEdgeData | undefined
  const stile = (edgeData?.stile ?? 'standard') as SchemaArcoStile
  const [pathAutomatico, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  // Quando ci sono gomiti imposti a mano, il percorso è la polilinea che passa per loro:
  // getSmoothStepPath serve solo a piazzare l'etichetta, non più a disegnare la linea.
  const punti = edgeData?.punti ?? []
  const path = punti.length
    ? [`M ${sourceX} ${sourceY}`, ...punti.map((p) => `L ${p.x} ${p.y}`), `L ${targetX} ${targetY}`].join(' ')
    : pathAutomatico

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
      <EdgeLabelRenderer>
        {ETICHETTA[stile] && (
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
        )}
        {punti.map((punto, indice) => (
          <SchemaGomito
            key={`${id}-gomito-${indice}`}
            indice={indice}
            punto={punto}
            onSposta={edgeData?.onSpostaGomito}
            onRimuovi={edgeData?.onRimuoviGomito}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  )
}
