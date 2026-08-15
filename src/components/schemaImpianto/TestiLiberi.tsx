/**
 * Le annotazioni libere (`SchemaTestoLibero`) come si vedono e si maneggiano sulla tela:
 * scritte senza cornice, non legate ad alcuna apparecchiatura, che si trascinano dove serve e
 * si riaprono in scrittura col doppio clic.
 *
 * Carattere, corpo e interlinea NON sono scelti qui: si leggono dalle stesse costanti con cui
 * `renderTestiLiberi` (renderSvg.ts) le disegna nel documento — `FONT`, `TESTO_LIBERO.dimensione`
 * e `INTERLINEA_TESTO` — perché la tela e il .docx devono mostrare la stessa cosa. Un corpo
 * scritto a mano qui sarebbe la solita divergenza fra editor e documento, questa volta
 * tipografica: si sposta l'annotazione dove sta bene sulla tela e nel documento sborda.
 *
 * Componente a parte, come `GuideAllineamento`, per non mescolare altro JSX dentro l'editor.
 * Nessun test automatico: è un componente React, e questo modulo non ne monta nei test
 * (CLAUDE.md, «no UI test»). La logica pura sta in useTestiLiberi.ts, che è coperta.
 */
import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { FONT, INTERLINEA_TESTO, TESTO_LIBERO } from '@/services/schemaImpianto/symbols'
import type { SchemaTestoLibero } from '@/services/schemaImpianto/types'

/**
 * Nel documento `(x, y)` è l'inizio della prima riga con `dominant-baseline="central"`: la sua
 * ordinata cade a metà della riga, non in cima. Un `<div>` HTML invece parte dal bordo
 * superiore della prima riga, alta `dimensione * INTERLINEA_TESTO`: va quindi alzato di mezza
 * riga perché le due rese si sovrappongano. È un'approssimazione (il centro della riga CSS e il
 * `central` dell'SVG differiscono di poco, per come il font distribuisce ascendenti e
 * discendenti), sufficiente allo scopo: la tela serve a decidere dove va la scritta, il giudice
 * dell'aspetto finale resta l'anteprima qui accanto, che è lo stesso SVG del .docx.
 */
const MEZZA_RIGA = (TESTO_LIBERO.dimensione * INTERLINEA_TESTO) / 2

export interface TestiLiberiProps {
  testi: SchemaTestoLibero[]
  /** `spostaTesto` di useTestiLiberi: `concluso` distingue l'ultimo evento del gesto. */
  onSposta: (id: string, posizione: { x: number; y: number }, concluso: boolean) => void
  /** Riapre in scrittura l'annotazione: da lì si può anche eliminarla, come da sempre. */
  onModifica: (id: string) => void
  /** L'id dell'annotazione selezionata sulla tela (Canc la cancella, in SchemaEditor.tsx), o
   *  `null` se nessuna lo è. */
  selezionato: string | null
  /** Segnala a `SchemaEditor` che questa annotazione è quella appena scelta. */
  onSeleziona: (id: string) => void
}

interface TestoLiberoProps {
  testo: SchemaTestoLibero
  onSposta: TestiLiberiProps['onSposta']
  onModifica: TestiLiberiProps['onModifica']
  selezionato: boolean
  onSeleziona: TestiLiberiProps['onSeleziona']
}

/**
 * Una singola annotazione. Il trascinamento è lo stesso pattern di `SchemaGomito`
 * (SchemaEdgeTubazione.tsx): cattura del puntatore invece di listener globali, così il gesto
 * regge anche se il cursore esce per un attimo dal blocco di testo.
 */
function TestoLibero({ testo, onSposta, onModifica, selezionato, onSeleziona }: TestoLiberoProps) {
  const { screenToFlowPosition } = useReactFlow()
  // Un doppio clic è nativamente due cicli pointerdown/pointerup prima del dblclick: senza
  // questa guardia ognuno dei due varrebbe come uno spostamento (a vuoto) e riaprire in
  // scrittura un'annotazione scriverebbe voci di cronologia per un gesto che non ha mosso nulla.
  const mossoRef = useRef(false)
  // Scostamento fra puntatore e origine del testo al pointerdown. Senza, la posizione del
  // puntatore diventerebbe direttamente la nuova origine e il blocco di testo salterebbe con
  // l'angolo sotto il cursore al primo pixel di movimento: si afferra una scritta per il mezzo,
  // non per il suo angolo in alto a sinistra.
  const scostamentoRef = useRef({ x: 0, y: 0 })
  // Ultima posizione consegnata durante il gesto: serve a chiuderlo se il puntatore viene
  // annullato, dove le coordinate dell'evento non sono un dato su cui contare.
  const ultimaRef = useRef({ x: 0, y: 0 })

  const posizioneDa = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const puntatore = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      return { x: puntatore.x - scostamentoRef.current.x, y: puntatore.y - scostamentoRef.current.y }
    },
    [screenToFlowPosition]
  )

  const suPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      // Al pointerdown e non al click: il click lo mangia il trascinamento (stesso motivo per
      // cui MuroSeparazione.tsx seleziona da `suPointerDown`), e un clic che non seleziona MAI
      // renderebbe la selezione raggiungibile solo lasciando l'annotazione ferma per errore.
      onSeleziona(testo.id)
      mossoRef.current = false
      const puntatore = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      scostamentoRef.current = { x: puntatore.x - testo.x, y: puntatore.y - testo.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [onSeleziona, screenToFlowPosition, testo.x, testo.y]
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      mossoRef.current = true
      const posizione = posizioneDa(e)
      ultimaRef.current = posizione
      onSposta(testo.id, posizione, false)
    },
    [onSposta, posizioneDa, testo.id]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      e.currentTarget.releasePointerCapture(e.pointerId)
      // Nessun movimento: niente da spostare e, soprattutto, niente da scrivere in cronologia.
      if (mossoRef.current) onSposta(testo.id, posizioneDa(e), true)
      mossoRef.current = false
    },
    [onSposta, posizioneDa, testo.id]
  )

  /**
   * Puntatore annullato a metà gesto (il sistema lo revoca, il dito esce dalla superficie
   * touch): il rilascio non arriverà mai, e il gesto va chiuso qui. Senza, `spostaTesto`
   * resterebbe con il suo «trascinamento avviato» alzato, e il PRIMO evento del trascinamento
   * successivo — l'unico che entra in cronologia — passerebbe da `aggiornaSenzaCronologia`:
   * quello spostamento non sarebbe più annullabile con Ctrl+Z.
   *
   * Si chiude sull'ultima posizione consegnata, non su quelle dell'evento di annullamento, che
   * non è un movimento e può portare coordinate qualsiasi: l'annotazione resta dove il gesto
   * l'aveva portata, che è anche ciò che l'utente ha appena visto sulla tela.
   */
  const suPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      // La cattura di norma è ancora attiva qui (il rilascio implicito segue `pointercancel`),
      // ma rilasciarla senza averla farebbe lanciare: si verifica prima.
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      if (!mossoRef.current) return
      mossoRef.current = false
      onSposta(testo.id, ultimaRef.current, true)
    },
    [onSposta, testo.id]
  )

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Si ferma qui: senza, il doppio clic risalirebbe alla tela e, se l'annotazione è posata
      // su una tubazione, creerebbe un gomito invece di aprire la scrittura.
      e.stopPropagation()
      onModifica(testo.id)
    },
    [onModifica, testo.id]
  )

  return (
    <div
      // `nopan` è la convenzione di react-flow per escludere un elemento dal pan della tela:
      // senza, il pointerdown avvia *anche* il pan (listener nativo sulla pane, che parte prima
      // che lo stopPropagation di React possa fermarlo) e il pan sposta il riferimento che
      // screenToFlowPosition usa a metà trascinamento — l'annotazione rilasciata tornerebbe
      // dov'era. Stesso motivo per cui ce l'ha `SchemaGomito`.
      className="nopan"
      title="Trascina per spostare, si cancella col tasto Canc, doppio clic per riscrivere o eliminare"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onPointerCancel={suPointerCancel}
      onDoubleClick={suDoppioClic}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${testo.x}px, ${testo.y - MEZZA_RIGA}px)`,
        fontFamily: FONT,
        fontSize: TESTO_LIBERO.dimensione,
        lineHeight: INTERLINEA_TESTO,
        // Gli a-capo scritti nel dialog devono vedersi come li vedrà il documento, che di ogni
        // riga fa un `<tspan>` a sé (`testoMultiRiga`): senza `pre` il browser li ridurrebbe a
        // spazi e la tela mostrerebbe una riga sola.
        whiteSpace: 'pre',
        // Nero come nel disegno, non il colore del tema scuro dell'applicazione: la tela di
        // react-flow è chiara come il foglio.
        color: '#000',
        cursor: 'move',
        // `.react-flow__viewport` (e quindi il portale) ha `pointer-events: none`: senza
        // riaccenderli qui l'annotazione si vedrebbe ma non si potrebbe né afferrare né
        // riaprire. Stessa ragione per cui lo fa `SchemaGomito`.
        pointerEvents: 'all',
        userSelect: 'none',
        // `outline`, non `border`: non occupa spazio di layout, quindi non sposta il testo di un
        // pixel rispetto a quando non è selezionata — stesso principio del contorno tratteggiato
        // di MuroSeparazione.tsx, che sporge oltre l'ingombro vero invece di sostituirlo.
        outline: selezionato ? '1px dashed #1976d2' : 'none',
        outlineOffset: 3,
      }}
    >
      {testo.contenuto}
    </div>
  )
}

/**
 * Le annotazioni vanno dentro `<ViewportPortal>` di react-flow — lo stesso portale delle guide
 * di allineamento — che rende in coordinate del flow: `x` e `y` di `SchemaTestoLibero` sono già
 * in quel sistema, senza conversioni. Il portale è l'ultimo figlio della viewport, dopo i nodi:
 * una scritta posata su un simbolo resta leggibile, esattamente come nel documento, dove
 * `renderTestiLiberi` disegna dopo nodi e tubazioni.
 */
export function TestiLiberi({ testi, onSposta, onModifica, selezionato, onSeleziona }: TestiLiberiProps) {
  return (
    <>
      {testi.map((testo) => (
        <TestoLibero
          key={testo.id}
          testo={testo}
          onSposta={onSposta}
          onModifica={onModifica}
          selezionato={selezionato === testo.id}
          onSeleziona={onSeleziona}
        />
      ))}
    </>
  )
}
