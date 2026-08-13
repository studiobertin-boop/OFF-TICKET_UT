/**
 * Collegamento dell'editor. I tre stili corrispondono alle convenzioni del CAD: rigida
 * continua, flessibile ondulata, condense tratteggiata.
 *
 * La forma della linea è la STESSA del render statico (`renderSvg.ts`) per ogni arco, con o
 * senza gomiti imposti a mano: entrambi passano da `instrada` (tratti.ts) sugli stessi capi —
 * le ancore dei nodi via `posizioneAncora`, non le coordinate degli handle — l'editor tramite
 * `capiDellArco` e `polilineaDellArco`. È questa condivisione a rendere sensato trascinare un
 * tratto sulla tela: quello che si sposta è lo stesso tratto che il .docx disegnerà.
 * L'anteprima resta comunque il giudice dell'aspetto finale, perché disegna anche ciò che la
 * tela non mostra affatto (tabella, legenda, nota sui diametri).
 */
import { useCallback, useRef } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import { riduttorePressione, valvolaIntercettazione } from '@/services/schemaImpianto/symbols'
import { ondula, percorso, puntoSuTratto, tSuTratto, type Punto, type QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import type { SchemaArcoStile, SchemaSegnoTubo, SchemaSegnoTuboTipo } from '@/services/schemaImpianto/types'
import { capiDellArco, polilineaDellArco, type CapiArco } from './conversioneFlow'
import { indiceTrattoPiuVicino } from './useTrascinamentoTratto'

export interface SchemaEdgeData extends Record<string, unknown> {
  stile: SchemaArcoStile
  /** Gomiti imposti a mano, in coordinate assolute: disegnano la polilinea imposta. */
  punti?: { x: number; y: number }[]
  /** Valvole di intercettazione e riduttori di pressione posati sul tratto. */
  segni?: SchemaSegnoTubo[]
  /**
   * Quote di instradamento del disegno intero (`quoteInstradamento`, layout.ts): dipendono da
   * dove stanno TUTTI i nodi, non dai due capi dell'arco, quindi un arco le riceve invece di
   * ricavarsele — non ha, né deve avere, una vista sul layout globale.
   *
   * `SchemaEditor` le calcola una volta per aggiornamento e le infila nei dati di ogni arco
   * tramite `fondiDatiArchi` (conversioneFlow.ts); questo componente le inoltra a
   * `polilineaDellArco` senza toccarle. `undefined` qui non è un caso previsto sulla tela: è
   * la rete di sicurezza per il tipo di `polilineaDellArco`, che senza quote ripiega
   * sull'angolo singolo.
   */
  quote?: QuoteInstradamento
  /**
   * I due capi dell'arco in coordinate del disegno, calcolati da `SchemaEditor` con
   * `posizioneAncora` (renderSvg.ts) — la STESSA funzione che usa il documento — e infilati qui
   * da `fondiDatiArchi` (conversioneFlow.ts) insieme alle quote.
   *
   * Non si usano `sourceX`/`sourceY` di react-flow: quelli sono il BORDO ESTERNO dell'handle
   * (10×10 px in `SchemaNodeSymbol`) secondo il lato su cui è appoggiato, cioè il centro
   * dell'ancora spostato di 5 unità. Lo scarto non resta ai capi — `rottaLinea` ricava `xMedia`
   * da loro — e sfalsava ogni vertice della tela rispetto al documento: sulla pratica di prova,
   * zero archi su nove combaciavano.
   *
   * `undefined` qui non è un caso previsto sulla tela: è la rete di sicurezza per il tipo di
   * `capiDellArco`, che senza capi ripiega proprio sulle coordinate degli handle.
   */
  capi?: CapiArco
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
   * aggiornarla. `indiceTratto` è quello nella polilinea RESA — la stessa che disegna
   * `polilineaDellArco`/`instrada`, rotta nativa compresa quando l'arco non ha gomiti a mano —
   * non nell'elenco dei soli gomiti a mano. `useTrascinamentoTratto` la ricostruisce con
   * `instrada` proprio per restare sugli stessi indici: numerarla diversamente sposterebbe un
   * tratto diverso da quello afferrato (era il difetto del giro di riparazione 1). Per lo stesso
   * motivo `pDa`/`pA` sono i capi risolti da `capiDellArco` — gli stessi da cui nasce la
   * polilinea disegnata — e non le coordinate degli handle.
   */
  onTrascinaTratto?: (pDa: Punto, pA: Punto, indiceTratto: number, puntoLibero: Punto, concluso: boolean) => void
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
  // I capi vengono dalle ancore dei nodi (`data.capi`, vedi sopra), non da `sourceX`/`sourceY`:
  // quelli sono il bordo dell'handle, 5 unità fuori dal centro dell'ancora, e restano solo come
  // ripiego per il tipo. Risolti UNA volta e usati per tutto ciò che segue — polilinea, area di
  // presa, capi consegnati a `trascinaTratto` — perché una seconda fonte per i capi dello stesso
  // arco rimetterebbe in piedi la divergenza fra tela e documento.
  const capi = capiDellArco(edgeData, {
    da: { x: sourceX, y: sourceY },
    a: { x: targetX, y: targetY },
  })
  const punti = edgeData?.punti ?? []
  // Stessa geometria del render statico (renderSvg.ts) per OGNI arco, con o senza gomiti:
  // editor e documento concordano sulla forma della linea — non più un'approssimazione.
  const polilinea = polilineaDellArco(capi, edgeData)
  const path = stile === 'flessibile' ? ondula(polilinea) : percorso(polilinea)

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
       * Attiva anche sul flessibile (fino al Blocco C1 era spenta lì): la sua polilinea dritta
       * ora coincide sempre con quella che il documento disegnerà, e l'onda non è altro che la
       * decorazione di quella stessa linea. Finché le due divergevano, un'area di presa
       * sagomata sulla dritta avrebbe spostato il tubo altrove da dove l'utente lo vede; ora è
       * lo stesso tubo, e il committente lo ha chiesto esplicitamente.
       */}
      <path
        d={percorso(polilinea)}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'move', pointerEvents: 'all' }}
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
          edgeData?.onTrascinaTratto?.(capi.da, capi.a, indice, libero, false)
        }}
        onPointerUp={(e) => {
          if (!(e.currentTarget as SVGPathElement).hasPointerCapture(e.pointerId)) return
          e.stopPropagation()
          ;(e.currentTarget as SVGPathElement).releasePointerCapture(e.pointerId)
          if (mossoTrattoRef.current) {
            const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
            const indice = indiceTrattoPiuVicino(polilinea, libero)
            edgeData?.onTrascinaTratto?.(capi.da, capi.a, indice, libero, true)
          }
        }}
      />
      <EdgeLabelRenderer>
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
