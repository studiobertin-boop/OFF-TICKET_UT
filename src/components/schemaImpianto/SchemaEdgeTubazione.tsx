/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD: rigida
 * continua, flessibile ondulata, condense tratteggiata.
 *
 * Tutti gli stili condividono `polilineaConGomiti` (tratti.ts) con il render statico
 * (`renderSvg.ts`) SOLO quando l'arco porta gomiti imposti a mano (`punti.length > 0`): in
 * quel caso non c'è più una rotta `smoothstep` di react-flow disegnata sulla tela e un'altra,
 * vera, disegnata solo nell'anteprima, ed è questa condivisione a rendere possibile trascinare
 * un tratto con la certezza che sia lo stesso tratto che il .docx disegnerà. Senza gomiti — il
 * caso di default, ogni arco appena generato da `buildSchemaModel` — la tela disegna un
 * semplice angolo singolo con `raccordoOrtogonale`, mentre il render statico continua a usare
 * le proprie rotte native (collettore per il flessibile, spezzata a metà per la linea, corsia
 * condense): quelle non sono state portate in `tratti.ts` e la tela resta un'approssimazione
 * per quegli archi. L'anteprima (che chiama `renderSvg` vero) resta l'unico giudice affidabile
 * dell'aspetto finale.
 */
import { useCallback, useRef } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import { riduttorePressione, valvolaIntercettazione } from '@/services/schemaImpianto/symbols'
import { ondula, percorso, polilineaConGomiti, puntoSuTratto, tSuTratto, type Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArcoStile, SchemaSegnoTubo, SchemaSegnoTuboTipo } from '@/services/schemaImpianto/types'
import { indiceTrattoPiuVicino } from './useTrascinamentoTratto'

export interface SchemaEdgeData extends Record<string, unknown> {
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute: disegnano la polilinea imposta. */
  punti?: { x: number; y: number }[]
  /** Valvole di intercettazione e riduttori di pressione posati sul tratto. */
  segni?: SchemaSegnoTubo[]
  /**
   * Legate a questo arco specifico da `useGomiti` (vedi `edgesConGomiti` lì dentro): il
   * componente dell'arco non conosce la cronologia, sa solo chiedere di aggiornarla.
   */
  onSpostaGomito?: (indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
  onRimuoviGomito?: (indice: number) => void
  /**
   * Legate a questo arco specifico da `useSegniTubo` (vedi `edgesConSegni` lì dentro): il
   * componente dell'arco non conosce la cronologia, sa solo chiedere di aggiornarla.
   */
  onSpostaSegno?: (indice: number, t: number, concluso: boolean) => void
  onRimuoviSegno?: (indice: number) => void
  /**
   * Legata a questo arco specifico da `useTrascinamentoTratto` (vedi `edgesConTrascinamento`
   * lì dentro): il componente dell'arco non conosce la cronologia, sa solo chiedere di
   * aggiornarla. `indiceTratto` è quello nella polilinea RESA (`polilineaConGomiti`), non
   * nell'elenco dei soli gomiti a mano.
   */
  onTrascinaTratto?: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => void
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
  // Un doppio clic è nativamente due cicli pointerdown/pointerup prima del dblclick: senza
  // questo, ognuno dei due varrebbe come uno spostamento (anche a vuoto) e togliere un
  // gomito scriverebbe tre voci di cronologia invece di una sola.
  const mossoRef = useRef(false)

  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ferma qui il gesto lato React: senza, il pointerdown sulla maniglia arriverebbe
    // anche alla tubazione sottostante e diventerebbe un trascinamento dell'arco.
    e.stopPropagation()
    mossoRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      mossoRef.current = true
      onSposta?.(indice, screenToFlowPosition({ x: e.clientX, y: e.clientY }), false)
    },
    [indice, onSposta, screenToFlowPosition]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      // Nessun movimento (es. i due click di un doppio clic sulla maniglia): niente da
      // spostare, e soprattutto niente da scrivere in cronologia per un gesto che non ha
      // cambiato nulla.
      if (mossoRef.current) {
        onSposta?.(indice, screenToFlowPosition({ x: e.clientX, y: e.clientY }), true)
      }
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
      // La classe `nopan` è la convenzione di react-flow per escludere un elemento dal pan
      // della tela: senza, il pointerdown sulla maniglia avvia *anche* il pan della tela
      // (il suo listener è nativo, sulla pane, e parte prima che il nostro stopPropagation
      // di React possa fermarlo). Il pan sposta il riferimento che screenToFlowPosition usa
      // mentre siamo a metà trascinamento, e il gomito rilasciato torna dov'era.
      className="nopan"
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

interface SchemaSegnoProps {
  indice: number
  punto: { x: number; y: number }
  tipo: SchemaSegnoTuboTipo
  polilinea: Punto[]
  orientamento: 'orizzontale' | 'verticale'
  onSposta?: (indice: number, t: number, concluso: boolean) => void
  onRimuovi?: (indice: number) => void
}

/**
 * Maniglia di un segno (valvola o riduttore): trascinarla cambia `t`, non la posizione
 * assoluta — proietta il punto del puntatore sulla polilinea con `tSuTratto`, così il segno
 * resta sempre SUL tubo anche se lo si trascina un po' fuori.
 *
 * `EdgeLabelRenderer` monta i suoi figli in un layer HTML separato, non dentro il `<svg>`
 * della tela: un `<g>` con `dangerouslySetInnerHTML` di un frammento SVG non funzionerebbe
 * qui dentro. Il contenitore è quindi un `<div>` posizionato con `transform` (come
 * `SchemaGomito`), con dentro un `<svg>` piccolo che ospita il simbolo: il simbolo è
 * parametrico su `x`/`y`, quindi si chiama con `(0, 0)` e si trasla il contenitore, non il
 * simbolo.
 */
function SchemaSegno({ indice, punto, tipo, polilinea, orientamento, onSposta, onRimuovi }: SchemaSegnoProps) {
  const { screenToFlowPosition } = useReactFlow()
  const mossoRef = useRef(false)

  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    mossoRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      mossoRef.current = true
      const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onSposta?.(indice, tSuTratto(polilinea, libero), false)
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      if (mossoRef.current) {
        const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        onSposta?.(indice, tSuTratto(polilinea, libero), true)
      }
    },
    [indice, onSposta, polilinea, screenToFlowPosition]
  )

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      onRimuovi?.(indice)
    },
    [indice, onRimuovi]
  )

  const disegna = tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione

  return (
    <div
      className="nopan"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`,
        width: 40,
        height: 40,
        cursor: 'move',
        pointerEvents: 'all',
      }}
    >
      <svg
        width={40}
        height={40}
        viewBox="-20 -20 40 40"
        style={{ overflow: 'visible' }}
        dangerouslySetInnerHTML={{ __html: disegna(0, 0, orientamento) }}
      />
    </div>
  )
}

export function SchemaEdgeTubazione({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow()
  const mossoTrattoRef = useRef(false)
  const edgeData = data as SchemaEdgeData | undefined
  const stile = (edgeData?.stile ?? 'standard') as SchemaArcoStile
  const pDa: Punto = { x: sourceX, y: sourceY }
  const pA: Punto = { x: targetX, y: targetY }
  const punti = edgeData?.punti ?? []
  // Stessa geometria del render statico (renderSvg.ts): editor e disegno finale concordano
  // sulla forma della linea, angoli netti compresi — non più un'approssimazione a parte.
  const polilinea = polilineaConGomiti(pDa, punti, pA)
  const path = stile === 'flessibile' ? ondula(polilinea) : percorso(polilinea)
  const { punto: puntoEtichetta } = puntoSuTratto(polilinea, 0.5)
  const labelX = puntoEtichetta.x
  const labelY = puntoEtichetta.y

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
      {/*
       * Area di trascinamento del tratto: un tracciato invisibile ma largo (16px), sovrapposto
       * alla polilinea vera, che intercetta il gesto di afferrare-e-scorrere un tratto dritto
       * (`trascinaTratto`, tratti.ts). Un gomito o un segno sopra vincono comunque il gesto
       * anche senza `stopPropagation`: vivono nel layer HTML portale di `EdgeLabelRenderer`,
       * dipinto SOPRA il layer SVG di questo tratto, e il browser sceglie l'elemento in cima
       * allo stack per posizione, prima ancora che React entri in gioco — `stopPropagation`
       * agisce solo dopo che il target è già stato scelto, qui non è la ragione.
       *
       * Disattivata sul flessibile (`pointerEvents: 'none'`): la sua linea VISIBILE è l'onda
       * (`ondula(polilinea)`), non la polilinea dritta — un'area di hit-test sagomata sulla
       * dritta, sovrapposta a un disegno ondulato, sposterebbe il tubo in un punto diverso da
       * dove l'utente lo vede, ed è peggio di non offrire il gesto lì. Il flessibile resta
       * trascinabile nei suoi gomiti (il gesto già esistente), non nel tratto: la spec del
       * blocco parla di «tratto dritto», e l'onda non lo è.
       */}
      <path
        d={percorso(polilinea)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'move', pointerEvents: stile === 'flessibile' ? 'none' : 'all' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          mossoTrattoRef.current = false
          ;(e.currentTarget as SVGPathElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!(e.currentTarget as SVGPathElement).hasPointerCapture(e.pointerId)) return
          e.stopPropagation()
          mossoTrattoRef.current = true
          const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const indice = indiceTrattoPiuVicino(polilinea, libero)
          edgeData?.onTrascinaTratto?.(pDa, pA, indice, libero, false)
        }}
        onPointerUp={(e) => {
          if (!(e.currentTarget as SVGPathElement).hasPointerCapture(e.pointerId)) return
          e.stopPropagation()
          ;(e.currentTarget as SVGPathElement).releasePointerCapture(e.pointerId)
          if (mossoTrattoRef.current) {
            const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
            const indice = indiceTrattoPiuVicino(polilinea, libero)
            edgeData?.onTrascinaTratto?.(pDa, pA, indice, libero, true)
          }
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
        {(edgeData?.segni ?? []).map((segno, indice) => {
          const { punto, orizzontale } = puntoSuTratto(polilinea, segno.t)
          return (
            <SchemaSegno
              key={`${id}-segno-${indice}`}
              indice={indice}
              punto={punto}
              tipo={segno.tipo}
              polilinea={polilinea}
              orientamento={orizzontale ? 'orizzontale' : 'verticale'}
              onSposta={edgeData?.onSpostaSegno}
              onRimuovi={edgeData?.onRimuoviSegno}
            />
          )
        })}
      </EdgeLabelRenderer>
    </>
  )
}
