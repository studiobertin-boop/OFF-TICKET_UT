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
import { useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
import { riduttorePressione, valvolaIntercettazione, TRATTEGGIO_CONDENSE } from '@/services/schemaImpianto/symbols'
import {
  ondula,
  percorso,
  puntoSuTratto,
  tSuTratto,
  type LatiImposti,
  type Punto,
  type QuoteInstradamento,
} from '@/services/schemaImpianto/tratti'
import type { SchemaArcoStile, SchemaSegnoTubo, SchemaSegnoTuboTipo } from '@/services/schemaImpianto/types'
import { capiDellArco, polilineaDellArco, type CapiArco } from './conversioneFlow'
import { useGestoPuntatore } from './useGestoPuntatore'
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
   * Vero mentre un TEE trascinato sta sorvolando QUESTO tubo: al rilascio si spezzerà qui
   * (`useInserimentoTee.ts`). Lo infila `fondiDatiArchi` (conversioneFlow.ts) insieme a quote
   * e capi. È un aiuto visivo per il gesto in corso, non un dato del disegno: non entra nel
   * layout e il documento non lo vede.
   */
  evidenziato?: boolean
  /**
   * Vero mentre l'editor è in modo taratura: la tubazione si vede ma non si tocca — niente
   * trascinamento del tratto, niente gomiti da spostare o togliere, niente segni da muovere,
   * niente doppio clic che crei un gomito. Lo infila `fondiDatiArchi` (conversioneFlow.ts)
   * insieme a quote e capi, per la stessa ragione: un arco non ha una vista sull'editor.
   *
   * Non basta `elementsSelectable`/`nodesDraggable={false}` su `<ReactFlow>`: quelli spengono
   * i gesti che react-flow gestisce di suo, non i gestori che questo componente monta da sé
   * (`pointerEvents: 'all'` qui sotto). Senza questa guardia, in modo taratura si può ancora
   * deformare l'impianto — e quelle modifiche entrano nella cronologia dell'IMPIANTO, che in
   * quel momento non ha via di ritorno: «Annulla» è disabilitato e Ctrl+Z è dirottato sulla
   * cronologia della taratura.
   */
  bloccato?: boolean
  /**
   * Legate a questo arco specifico da `useGomiti` (vedi `edgesConGomiti` lì dentro): il
   * componente dell'arco non conosce la cronologia, sa solo chiedere di aggiornarla.
   * `pDa`/`pA` sono gli stessi capi risolti da `capiDellArco` che disegnano la polilinea —
   * `useGomiti` li usa per il secondo magnete (`agganciaPosizioneGomito`, useGomiti.ts), che ha
   * bisogno della posizione GREZZA del puntatore, non agganciata alla griglia della tela: vedi
   * il commento su `agganciaPosizioneGomito` per il perché.
   */
  onSpostaGomito?: (pDa: Punto, pA: Punto, indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
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
   * polilinea disegnata — e non le coordinate degli handle; e per lo stesso motivo `lati` è
   * `capi.lati`, non ricalcolato qui.
   */
  onTrascinaTratto?: (
    pDa: Punto,
    pA: Punto,
    indiceTratto: number,
    puntoLibero: Punto,
    concluso: boolean,
    lati?: LatiImposti
  ) => void
}

export interface SchemaGomitoProps {
  indice: number
  punto: { x: number; y: number }
  /** Capi dell'arco (`capiDellArco`), inoltrati a `onSposta` per il secondo magnete
   *  (`agganciaPosizioneGomito`, useGomiti.ts): vedi lì per il perché la posizione va chiesta
   *  grezza, non agganciata alla griglia della tela. */
  pDa: Punto
  pA: Punto
  onSposta?: (pDa: Punto, pA: Punto, indice: number, posizione: { x: number; y: number }, concluso: boolean) => void
  onRimuovi?: (indice: number) => void
  /** Modo taratura acceso: la maniglia si vede ma non risponde al puntatore (vedi
   *  `SchemaEdgeData.bloccato`). */
  bloccato?: boolean
}

/**
 * Maniglia di un gomito. Usa la cattura del puntatore invece di ascoltare mousemove sulla
 * finestra: il trascinamento resta valido anche se il cursore esce per un attimo dal
 * riquadro della maniglia, senza dover montare e smontare listener globali. Cattura, guardia
 * «si è mosso» e chiusura (rilascio/annullamento) sono `useGestoPuntatore.ts`, lo stesso
 * pattern di `SchemaSegno` e dell'area di trascinamento del tratto qui sotto.
 */
export function SchemaGomito({ indice, punto, pDa, pA, onSposta, onRimuovi, bloccato }: SchemaGomitoProps) {
  const { screenToFlowPosition } = useReactFlow()
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<HTMLDivElement, { x: number; y: number }>()

  // `{ snapToGrid: false }`: senza, `screenToFlowPosition` legge lo `snapToGrid`/`snapGrid`
  // della tela dal negozio e restituisce sempre un multiplo di 10, su cui il secondo magnete di
  // `agganciaPosizioneGomito` (useGomiti.ts) non può mai vincere — vedi lì per il perché. Non
  // toglierla per "semplificare": spegnerebbe il magnete in silenzio.
  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suMovimento(e, screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false }), (posizione) =>
        onSposta?.(pDa, pA, indice, posizione, false)
      )
    },
    [indice, onSposta, pA, pDa, screenToFlowPosition, suMovimento]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suFine(e, screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false }), (posizione) =>
        onSposta?.(pDa, pA, indice, posizione, true)
      )
    },
    [indice, onSposta, pA, pDa, screenToFlowPosition, suFine]
  )

  // Puntatore annullato a metà gesto (una gesture del sistema operativo, un tocco che diventa
  // scorrimento): senza questo ramo la cattura resterebbe alzata e il PRIMO evento del
  // trascinamento successivo del gomito — l'unico che `useGomiti.ts` scrive in cronologia —
  // passerebbe da `aggiornaSenzaCronologia`, perché `trascinamentoGomitoAvviato` non si
  // riarmerebbe mai. `suAnnullamento` chiude sull'ultima posizione vista durante il gesto, non
  // su quella dell'evento di annullamento, che non è un movimento.
  const suPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suAnnullamento(e, (posizione) => onSposta?.(pDa, pA, indice, posizione, true))
    },
    [indice, onSposta, pA, pDa, suAnnullamento]
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
      // `suInizio` ferma qui il gesto lato React: la maniglia vive nel portale di
      // EdgeLabelRenderer ma resta figlia nell'albero React — stessa ragione di `suDoppioClic`
      // qui sopra. Sul pointerdown lo stopPropagation è cautelativo: nessun antenato (Pane
      // compreso) monta oggi un onPointerDown in bubbling da fermare — l'unico onPointerDown*
      // di Pane è `onPointerDownCapture`, fase di cattura, già passata quando React arriva qui.
      // I gestori della tela davvero raggiungibili in bubbling — `onPointerUp`
      // del Pane, `react-flow__pane` — sono fermati da `suMovimento`/`suFine`/`suAnnullamento`
      // (sotto), non da `suInizio`. Non risalirebbe invece al gestore del tratto qui sotto: quel
      // `<path>` è un fratello di EdgeLabelRenderer nell'albero React, non un antenato, e un
      // pointerdown sulla maniglia non lo raggiungerebbe comunque.
      onPointerDown={suInizio}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onPointerCancel={suPointerCancel}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#fff',
        border: '2px solid #1976d2',
        // Inerte in modo taratura: i gestori sopra restano montati (togliere e rimettere
        // listener a ogni ingresso nel modo non aggiunge nulla) ma il puntatore non li
        // raggiunge più — è la stessa scelta fatta per gli handle del nodo tarato in
        // SchemaNodeSymbol.tsx, dove smontarli rompeva l'arco collegato.
        pointerEvents: bloccato ? 'none' : 'all',
        cursor: bloccato ? 'default' : 'move',
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
  /** Modo taratura acceso: vedi `SchemaGomitoProps.bloccato`. */
  bloccato?: boolean
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
function SchemaSegno({ indice, punto, tipo, polilinea, orientamento, onSposta, onRimuovi, bloccato }: SchemaSegnoProps) {
  const { screenToFlowPosition } = useReactFlow()
  // Cattura, guardia «si è mosso» e chiusura (rilascio/annullamento) sono `useGestoPuntatore.ts`,
  // lo stesso pattern di `SchemaGomito` qui sopra e dell'area di trascinamento del tratto sotto.
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<HTMLDivElement, number>()

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      suMovimento(e, tSuTratto(polilinea, libero), (t) => onSposta?.(indice, t, false))
    },
    [indice, onSposta, polilinea, screenToFlowPosition, suMovimento]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      suFine(e, tSuTratto(polilinea, libero), (t) => onSposta?.(indice, t, true))
    },
    [indice, onSposta, polilinea, screenToFlowPosition, suFine]
  )

  // Puntatore annullato a metà gesto: senza questo ramo il PRIMO evento del trascinamento
  // successivo del segno smetterebbe di entrare in cronologia (`trascinamentoSegnoAvviato` in
  // useSegniTubo.ts non si riarmerebbe mai). Consegna la `t` dell'ultima posizione vista, non
  // quella dell'evento di annullamento.
  const suPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suAnnullamento(e, (t) => onSposta?.(indice, t, true))
    },
    [indice, onSposta, suAnnullamento]
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
      onPointerDown={suInizio}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onPointerCancel={suPointerCancel}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${punto.x}px, ${punto.y}px)`,
        width: 40,
        height: 40,
        // Inerte in modo taratura, stessa scelta di `SchemaGomito` qui sopra.
        cursor: bloccato ? 'default' : 'move',
        pointerEvents: bloccato ? 'none' : 'all',
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
  // Cattura, guardia «si è mosso» e chiusura (rilascio/annullamento) sono `useGestoPuntatore.ts`,
  // lo stesso pattern di `SchemaGomito`/`SchemaSegno` sopra. Il valore per evento è
  // {indice, libero}: l'indice del tratto più vicino nella polilinea RESA e il punto libero del
  // puntatore, gli stessi due argomenti che `onTrascinaTratto` inoltra a `useTrascinamentoTratto`.
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<SVGPathElement, { indice: number; libero: Punto }>()
  const edgeData = data as SchemaEdgeData | undefined
  const stile = (edgeData?.stile ?? 'standard') as SchemaArcoStile
  const bloccato = edgeData?.bloccato ?? false
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
          // L'evidenziazione vince sulla selezione: durante un gesto conta vedere DOVE il TEE
          // si innesterà, e un tubo può benissimo essere insieme selezionato e sorvolato.
          stroke: edgeData?.evidenziato ? '#ed6c02' : selected ? '#1976d2' : '#000',
          strokeWidth: edgeData?.evidenziato ? 4 : selected ? 3 : 2,
          strokeDasharray: stile === 'condensa' ? TRATTEGGIO_CONDENSE : undefined,
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
        // In modo taratura l'area di presa si spegne: senza, un trascinamento su una tubazione
        // scriverebbe nella cronologia dell'IMPIANTO mentre il committente crede di star
        // tarando un simbolo — e da lì non si torna indietro, perché in quel modo «Annulla» è
        // disabilitato e Ctrl+Z appartiene alla taratura (vedi `SchemaEdgeData.bloccato`).
        style={{ cursor: bloccato ? 'default' : 'move', pointerEvents: bloccato ? 'none' : 'all' }}
        onPointerDown={suInizio}
        onPointerMove={(e) => {
          const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const valore = { indice: indiceTrattoPiuVicino(polilinea, libero), libero }
          suMovimento(e, valore, (v) =>
            edgeData?.onTrascinaTratto?.(capi.da, capi.a, v.indice, v.libero, false, capi.lati)
          )
        }}
        onPointerUp={(e) => {
          const libero = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          const valore = { indice: indiceTrattoPiuVicino(polilinea, libero), libero }
          suFine(e, valore, (v) => edgeData?.onTrascinaTratto?.(capi.da, capi.a, v.indice, v.libero, true, capi.lati))
        }}
        // Puntatore annullato a metà gesto: senza questo ramo la cattura resterebbe alzata e,
        // più grave qui che altrove, `trascinamentoAvviato` (useTrascinamentoTratto.ts) non si
        // riarmerebbe mai — quei ref sono a livello di hook, condivisi da TUTTI gli archi, quindi
        // il prossimo trascinamento (anche su un arco diverso) verrebbe letto come proseguimento
        // di questo e userebbe i suoi gomiti e il suo indice CONGELATI. `suAnnullamento` chiude
        // sull'ultima coppia {indice, libero} vista durante il gesto, e proprio quella chiamata
        // con `concluso: true` fa scattare il riarmo che `useTrascinamentoTratto` già applica da
        // solo (`trascinamentoAvviato.current = !concluso`): gli mancava solo l'occasione di
        // essere chiamato.
        onPointerCancel={(e) => {
          suAnnullamento(e, (v) => edgeData?.onTrascinaTratto?.(capi.da, capi.a, v.indice, v.libero, true, capi.lati))
        }}
      />
      <EdgeLabelRenderer>
        {punti.map((punto, indice) => (
          <SchemaGomito
            key={`${id}-gomito-${indice}`}
            indice={indice}
            punto={punto}
            pDa={capi.da}
            pA={capi.a}
            onSposta={edgeData?.onSpostaGomito}
            onRimuovi={edgeData?.onRimuoviGomito}
            bloccato={bloccato}
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
              bloccato={bloccato}
            />
          )
        })}
      </EdgeLabelRenderer>
    </>
  )
}
