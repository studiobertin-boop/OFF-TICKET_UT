/**
 * Le aree tratteggiate come si vedono e si maneggiano sulla tela. Il rettangolo lo disegna
 * `rettangoloArea` — la STESSA funzione del documento, come fa MuroSeparazione con `simboloMuro`.
 *
 * Si afferra SOLO dal bordo: quattro fasce trasparenti più larghe della linea. L'interno lascia
 * passare il puntatore, così dentro un'area si continuano a selezionare apparecchiature e tubi e a
 * tirare il riquadro. Il portale della viewport sta sopra i nodi, ma il tratteggio non ha
 * riempimento e non intercetta nulla: l'effetto pratico è quello di un'area disegnata sotto.
 *
 * Nessun test automatico: è un componente React (CLAUDE.md). La logica sta in aree.ts.
 */
import { useRef } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import { puntoScritta, type AngoloArea } from '@/services/schemaImpianto/aree'
import { FONT, INTERLINEA_TESTO, rettangoloArea, TESTO_LIBERO } from '@/services/schemaImpianto/symbols'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea } from '@/services/schemaImpianto/types'
import { useGestoPuntatore } from './useGestoPuntatore'

/** Larghezza della fascia di presa sul bordo, in unità del disegno. */
const PRESA = 14
/** Lato delle maniglie agli angoli, in pixel a schermo: si divide per lo zoom. */
const LATO_MANIGLIA_PX = 10
const MEZZA_RIGA = (TESTO_LIBERO.dimensione * INTERLINEA_TESTO) / 2
const ANGOLI: AngoloArea[] = ['no', 'ne', 'so', 'se']

export interface AreeImpiantoProps {
  aree: SchemaArea[]
  /** Id delle aree nella selezione dell'editor. */
  selezionate: string[]
  /** Pressione sul bordo o sulla scritta: `aggiungi` è Ctrl/Cmd. */
  onPremi: (id: string, aggiungi: boolean) => void
  /** Trascinamento dal bordo: posizione desiderata dell'angolo in alto a sinistra. */
  onSposta: (id: string, posizione: Punto, concluso: boolean) => void
  onRidimensiona: (id: string, angolo: AngoloArea, punto: Punto, concluso: boolean) => void
  /** Trascinamento della sola scritta: posizione assoluta desiderata del suo primo capo. */
  onSpostaScritta: (id: string, posizione: Punto, concluso: boolean) => void
  onModifica: (id: string) => void
  /** Modo taratura: le aree si vedono ma non si toccano (vedi `MuroSeparazioneProps.bloccato`). */
  bloccato?: boolean
}

interface AreaProps extends Omit<AreeImpiantoProps, 'aree' | 'selezionate'> {
  area: SchemaArea
  selezionata: boolean
}

function Area({ area, selezionata, onPremi, onSposta, onRidimensiona, onSpostaScritta, onModifica, bloccato }: AreaProps) {
  const { screenToFlowPosition } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const bordo = useGestoPuntatore<HTMLDivElement, Punto>()
  const scritta = useGestoPuntatore<HTMLDivElement, Punto>()
  const maniglia = useGestoPuntatore<HTMLDivElement, Punto>()
  // Scostamento fra puntatore e punto afferrato, congelato al pointerdown (stessa cautela di TestoLibero).
  const scostamento = useRef({ x: 0, y: 0 })

  const puntatore = (e: React.PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY })
  const menoScostamento = (e: React.PointerEvent) => {
    const p = puntatore(e)
    return { x: p.x - scostamento.current.x, y: p.y - scostamento.current.y }
  }
  const eventiAttivi = bloccato ? 'none' : 'all'

  const premiBordo = (e: React.PointerEvent<HTMLDivElement>) => {
    onPremi(area.id, e.ctrlKey || e.metaKey)
    const p = puntatore(e)
    scostamento.current = { x: p.x - area.x, y: p.y - area.y }
    bordo.suInizio(e)
  }
  const gestoriBordo = {
    className: 'nopan',
    onPointerDown: premiBordo,
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => bordo.suMovimento(e, menoScostamento(e), (p) => onSposta(area.id, p, false)),
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => bordo.suFine(e, menoScostamento(e), (p) => onSposta(area.id, p, true)),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => bordo.suAnnullamento(e, (p) => onSposta(area.id, p, true)),
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      onModifica(area.id)
    },
  }
  const fascia = (left: number, top: number, width: number, height: number, cursor: string) => (
    <div
      {...gestoriBordo}
      style={{ position: 'absolute', left, top, width, height, cursor: bloccato ? 'default' : cursor, pointerEvents: eventiAttivi }}
    />
  )

  const { x, y, larghezza: l, altezza: h } = area
  const lato = LATO_MANIGLIA_PX / zoom
  const posScritta = puntoScritta(area)
  const contorno = selezionata
    ? `<rect x="-4" y="-4" width="${l + 8}" height="${h + 8}" fill="none" stroke="#1976d2" stroke-width="1" stroke-dasharray="4 3" />`
    : ''

  return (
    <>
      <svg
        width={l}
        height={h}
        style={{ position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: rettangoloArea(0, 0, l, h) + contorno }}
      />
      {fascia(x - PRESA / 2, y - PRESA / 2, l + PRESA, PRESA, 'move')}
      {fascia(x - PRESA / 2, y + h - PRESA / 2, l + PRESA, PRESA, 'move')}
      {fascia(x - PRESA / 2, y - PRESA / 2, PRESA, h + PRESA, 'move')}
      {fascia(x + l - PRESA / 2, y - PRESA / 2, PRESA, h + PRESA, 'move')}

      {area.scritta.trim() && (
        <div
          className="nopan"
          title={bloccato ? undefined : 'Trascina per spostare la scritta, doppio clic per cambiarla'}
          onPointerDown={(e) => {
            onPremi(area.id, e.ctrlKey || e.metaKey)
            const p = puntatore(e)
            scostamento.current = { x: p.x - posScritta.x, y: p.y - posScritta.y }
            scritta.suInizio(e)
          }}
          onPointerMove={(e) => scritta.suMovimento(e, menoScostamento(e), (p) => onSpostaScritta(area.id, p, false))}
          onPointerUp={(e) => scritta.suFine(e, menoScostamento(e), (p) => onSpostaScritta(area.id, p, true))}
          onPointerCancel={(e) => scritta.suAnnullamento(e, (p) => onSpostaScritta(area.id, p, true))}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onModifica(area.id)
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${posScritta.x}px, ${posScritta.y - MEZZA_RIGA}px)`,
            fontFamily: FONT,
            fontSize: TESTO_LIBERO.dimensione,
            lineHeight: INTERLINEA_TESTO,
            whiteSpace: 'pre',
            color: '#000',
            cursor: bloccato ? 'default' : 'move',
            pointerEvents: eventiAttivi,
            userSelect: 'none',
          }}
        >
          {area.scritta}
        </div>
      )}

      {selezionata &&
        !bloccato &&
        ANGOLI.map((angolo) => {
          const cx = angolo === 'no' || angolo === 'so' ? x : x + l
          const cy = angolo === 'no' || angolo === 'ne' ? y : y + h
          const chiudi = (p: Punto) => onRidimensiona(area.id, angolo, p, true)
          return (
            <div
              key={angolo}
              className="nopan"
              onPointerDown={maniglia.suInizio}
              onPointerMove={(e) => maniglia.suMovimento(e, puntatore(e), (p) => onRidimensiona(area.id, angolo, p, false))}
              onPointerUp={(e) => maniglia.suFine(e, puntatore(e), chiudi)}
              onPointerCancel={(e) => maniglia.suAnnullamento(e, chiudi)}
              style={{
                position: 'absolute',
                left: cx - lato / 2,
                top: cy - lato / 2,
                width: lato,
                height: lato,
                background: '#fff',
                border: `${1 / zoom}px solid #1976d2`,
                boxSizing: 'border-box',
                cursor: angolo === 'no' || angolo === 'se' ? 'nwse-resize' : 'nesw-resize',
                pointerEvents: 'all',
              }}
            />
          )
        })}
    </>
  )
}

/** Dentro `<ViewportPortal>`, come TestiLiberi: coordinate del disegno, senza conversioni. */
export function AreeImpianto({ aree, selezionate, ...resto }: AreeImpiantoProps) {
  return (
    <>
      {aree.map((area) => (
        <Area key={area.id} area={area} selezionata={selezionate.includes(area.id)} {...resto} />
      ))}
    </>
  )
}
