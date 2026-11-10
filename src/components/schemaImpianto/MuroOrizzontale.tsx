/**
 * Il muro orizzontale sulla tela dell'editor: il gemello di `MuroSeparazione`, coricato. Stesso
 * disegno del documento (`simboloMuroOrizzontale`, symbols/index.ts), stessi varchi, stesso
 * portale — cambia solo l'asse: si trascina in VERTICALE, e ciò che si salva è la sua ordinata.
 *
 * Un componente a sé e non `MuroSeparazione` con una prop in più: ogni coordinata dei due è
 * scambiata, e un solo componente sarebbe una diramazione a ogni riga.
 */
import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { simboloMuroOrizzontale, SPESSORE_MURO } from '@/services/schemaImpianto/symbols'
import type { SchemaMuroOrizzontale } from '@/services/schemaImpianto/types'
import { useGestoPuntatore } from './useGestoPuntatore'

export interface MuroOrizzontaleProps {
  muro: SchemaMuroOrizzontale
  /** Le ascisse a cui le tubazioni lo attraversano (`varchiDelMuroOrizzontale`, renderSvg.ts). */
  varchi: number[]
  selezionato: boolean
  onSposta: (y: number, concluso: boolean) => void
  onSeleziona: (aggiungi: boolean) => void
  /** Modo taratura: il muro si vede ma non si tocca, come ogni altro oggetto dell'impianto. */
  bloccato?: boolean
}

/** Aria fra il muro e il contorno di selezione. */
const MARGINE_SELEZIONE = 6
/** Quanto l'area di presa sporge sopra e sotto il muro: 14 unità di spessore sono poche da afferrare. */
const MARGINE_PRESA = 15

export function MuroOrizzontale({ muro, varchi, selezionato, onSposta, onSeleziona, bloccato }: MuroOrizzontaleProps) {
  const { screenToFlowPosition } = useReactFlow()
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<SVGRectElement, number>()
  // Dove, dentro lo spessore del muro, lo si è afferrato: senza, al primo movimento il bordo
  // superiore salterebbe sotto il puntatore.
  const scostamentoRef = useRef(0)

  const yDa = useCallback(
    (e: React.PointerEvent<SVGRectElement>) =>
      screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false }).y - scostamentoRef.current,
    [screenToFlowPosition]
  )

  const suPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      onSeleziona(e.ctrlKey || e.metaKey)
      scostamentoRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false }).y - muro.y
      suInizio(e)
    },
    [muro.y, onSeleziona, screenToFlowPosition, suInizio]
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suMovimento(e, yDa(e), (y) => onSposta(y, false)),
    [onSposta, suMovimento, yDa]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suFine(e, yDa(e), (y) => onSposta(y, true)),
    [onSposta, suFine, yDa]
  )

  const suPointerCancel = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suAnnullamento(e, (y) => onSposta(y, true)),
    [onSposta, suAnnullamento]
  )

  return (
    <svg
      // `pointer-events: none` sul contenitore, riacceso sulla sola area di presa: il portale
      // della viewport lo è per default, e un `<svg>` attivo a tutta tela ruberebbe ogni clic.
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      width={1}
      height={1}
    >
      {/* Generato dal nostro codice a partire da numeri, non da input esterni. */}
      <g dangerouslySetInnerHTML={{ __html: simboloMuroOrizzontale(muro.y, muro.xMin, muro.xMax, varchi) }} />
      {selezionato && (
        <rect
          x={muro.xMin - MARGINE_SELEZIONE}
          y={muro.y - MARGINE_SELEZIONE}
          width={muro.xMax - muro.xMin + MARGINE_SELEZIONE * 2}
          height={SPESSORE_MURO + MARGINE_SELEZIONE * 2}
          fill="none"
          stroke="#1976d2"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}
      <rect
        className="nopan"
        x={muro.xMin}
        y={muro.y - MARGINE_PRESA}
        width={muro.xMax - muro.xMin}
        height={SPESSORE_MURO + MARGINE_PRESA * 2}
        fill="transparent"
        style={{ cursor: bloccato ? 'default' : 'row-resize', pointerEvents: bloccato ? 'none' : 'all' }}
        onPointerDown={suPointerDown}
        onPointerMove={suPointerMove}
        onPointerUp={suPointerUp}
        onPointerCancel={suPointerCancel}
      />
    </svg>
  )
}
