/**
 * Il muro di separazione come si vede e si maneggia sulla tela. Disegnato con `simboloMuro` — la
 * STESSA funzione del documento — e coi varchi di `varchiDelMuro`, per la stessa ragione per cui
 * TestiLiberi.tsx legge il carattere dai simboli invece di sceglierselo: la tela e il .docx
 * devono mostrare la stessa cosa, e una copia diverge al primo ritocco.
 *
 * Si trascina in orizzontale soltanto: l'altezza non e' un dato del muro, si ricava dal disegno
 * (`muroDaAscissa`, layout.ts), quindi non c'e' nulla da afferrare in verticale.
 *
 * Componente a parte, come GuideAllineamento e TestiLiberi. Nessun test automatico: e' un
 * componente React (CLAUDE.md, «no UI test»); la logica provata sta in useMuro.ts.
 */
import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { simboloMuro, SPESSORE_MURO } from '@/services/schemaImpianto/symbols'
import type { SchemaMuroSeparazione } from '@/services/schemaImpianto/types'
import { useGestoPuntatore } from './useGestoPuntatore'

export interface MuroSeparazioneProps {
  muro: SchemaMuroSeparazione
  /** Quote di attraversamento delle tubazioni (`varchiDelMuro`, renderSvg.ts): la STESSA funzione
   *  del documento, non una sua imitazione — i varchi si aprono sulla tela dove si aprono nel
   *  .docx. */
  varchi: number[]
  selezionato: boolean
  /** `spostaMuro` di useMuro: `concluso` distingue l'ultimo evento del gesto, quello che entra
   *  in cronologia una volta sola invece che a ogni pixel. */
  onSposta: (x: number, concluso: boolean) => void
  onSeleziona: () => void
}

/** Contorno di selezione: quanto sporge oltre l'ingombro vero disegnato da `simboloMuro`. */
const MARGINE_SELEZIONE = 6
/**
 * Area di presa: quanto si allarga oltre lo spessore vero del muro (14 unità, che a molti livelli
 * di zoom sono pochi pixel a schermo). Più larga della linea disegnata, sullo stesso principio
 * del tracciato invisibile di 16px che intercetta il trascinamento di un tratto
 * (SchemaEdgeTubazione.tsx): un bersaglio più generoso di quel che si vede, non un secondo disegno.
 */
const MARGINE_PRESA = 15

/**
 * Una sola maniglia rettangolare, larga quanto l'ingombro allargato dal margine di presa e alta
 * quanto il muro: sotto sta il disegno vero (`simboloMuro`), sopra — nell'ordine di pittura SVG,
 * quindi anche nell'ordine con cui il browser sceglie il bersaglio del puntatore — questa
 * maniglia trasparente, che intercetta il gesto ovunque sull'ingombro e non solo sui tratti
 * sottili del muro disegnato.
 */
export function MuroSeparazione({ muro, varchi, selezionato, onSposta, onSeleziona }: MuroSeparazioneProps) {
  const { screenToFlowPosition } = useReactFlow()
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<SVGRectElement, number>()
  // Scostamento fra il punto afferrato e l'ascissa del muro, congelato al pointerdown: senza,
  // la x del puntatore diventerebbe direttamente la nuova ascissa e il muro salterebbe col
  // bordo sotto il cursore al primo pixel di movimento (stessa cautela di `TestoLibero`,
  // TestiLiberi.tsx, dove lo scostamento è un punto perché lì viaggiano due assi; qui un solo
  // numero, perché viaggia solo la x).
  const scostamentoRef = useRef(0)

  const xDa = useCallback(
    (e: React.PointerEvent<SVGRectElement>) =>
      screenToFlowPosition({ x: e.clientX, y: e.clientY }).x - scostamentoRef.current,
    [screenToFlowPosition]
  )

  const suPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      onSeleziona()
      scostamentoRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY }).x - muro.x
      suInizio(e)
    },
    [muro.x, onSeleziona, screenToFlowPosition, suInizio]
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suMovimento(e, xDa(e), (x) => onSposta(x, false)),
    [onSposta, suMovimento, xDa]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suFine(e, xDa(e), (x) => onSposta(x, true)),
    [onSposta, suFine, xDa]
  )

  // Puntatore annullato a metà gesto: chiude sull'ultima x vista durante il movimento, non su
  // quella dell'evento di annullamento, che non è un movimento e può portare coordinate
  // qualsiasi (stessa cautela di `SchemaGomito`/`SchemaSegno`, SchemaEdgeTubazione.tsx).
  const suPointerCancel = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => suAnnullamento(e, (x) => onSposta(x, true)),
    [onSposta, suAnnullamento]
  )

  return (
    <svg
      // Nessun transform sul contenitore: `simboloMuro` disegna già in coordinate assolute del
      // disegno — le stesse che riceve nel documento (renderSvg.ts, dove il muro non è avvolto
      // in un `<g transform="translate(...)">` come i nodi) — quindi le coordinate scritte qui
      // sotto sono già quelle giuste. `overflow: visible` lascia uscire il disegno dal riquadro
      // 1×1: la sua estensione vera è nel markup di `simboloMuro`, non nelle dimensioni dell'svg.
      // `pointer-events: none` perché il portale della viewport (`.react-flow__viewport`) lo è
      // già: si riaccende sulla sola maniglia di presa qui sotto, stessa ragione per cui lo fa
      // `TestoLibero`.
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      width={1}
      height={1}
    >
      <g dangerouslySetInnerHTML={{ __html: simboloMuro(muro.x, muro.yMin, muro.yMax, varchi) }} />
      {selezionato && (
        <rect
          x={muro.x - MARGINE_SELEZIONE}
          y={muro.yMin - MARGINE_SELEZIONE}
          width={SPESSORE_MURO + MARGINE_SELEZIONE * 2}
          height={muro.yMax - muro.yMin + MARGINE_SELEZIONE * 2}
          fill="none"
          stroke="#1976d2"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}
      <rect
        className="nopan"
        x={muro.x - MARGINE_PRESA}
        y={muro.yMin}
        width={SPESSORE_MURO + MARGINE_PRESA * 2}
        height={muro.yMax - muro.yMin}
        fill="transparent"
        style={{ cursor: 'col-resize', pointerEvents: 'all' }}
        onPointerDown={suPointerDown}
        onPointerMove={suPointerMove}
        onPointerUp={suPointerUp}
        onPointerCancel={suPointerCancel}
      />
    </svg>
  )
}
