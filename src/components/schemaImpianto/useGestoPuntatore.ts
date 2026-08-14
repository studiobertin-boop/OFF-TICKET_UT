/**
 * Il pattern comune ai gesti di trascinamento con cattura del puntatore: `SchemaGomito`,
 * `SchemaSegno` e l'area di trascinamento del tratto (tutti in `SchemaEdgeTubazione.tsx`) lo
 * usano. Collaudato per primo su `TestoLibero` (`TestiLiberi.tsx`, non toccato da questo hook:
 * la sua implementazione era già corretta prima che questo file esistesse — resta una seconda
 * copia dello stesso pattern, non accorpata qui per restare nel perimetro di questo task, che
 * autorizzava a toccare solo `SchemaEdgeTubazione.tsx`) e sui due gesti nati nel Blocco D1
 * (`DivisorioAnteprima.tsx`, `ManigliaRidimensiona.tsx`, anch'essi non toccati: hanno già la
 * stessa cattura del puntatore, identica — vedi `DivisorioAnteprima.tsx:19-41` e
 * `ManigliaRidimensiona.tsx:35-64` — ma non la guardia «si è mosso» né il concetto di evento
 * conclusivo, perché il loro `onCambia` non distingue un evento intermedio da uno finale: non
 * scrivono mai in una cronologia, quindi non hanno nulla da attendere).
 *
 * Che cosa entra: la cattura del puntatore (invece di listener globali su `window`, così il
 * gesto regge anche se il cursore esce per un attimo dall'elemento), la guardia «si è mosso
 * davvero» (senza, un doppio clic — due cicli pointerdown/pointerup prima del dblclick —
 * scriverebbe in cronologia due spostamenti a vuoto) e la chiusura del gesto: rilascio e
 * annullamento trattati allo stesso modo, con l'ultima posizione vista consegnata
 * all'annullamento — mai le coordinate del proprio evento `pointercancel`, che non è un
 * movimento e può portarne di qualsiasi.
 *
 * Che cosa NON entra: il riferimento «primo evento del gesto» che decide chi entra in
 * cronologia (`trascinamentoGomitoAvviato` in useGomiti.ts, `trascinamentoSegnoAvviato` in
 * useSegniTubo.ts, `trascinamentoAvviato` in useTrascinamentoTratto.ts — e per le annotazioni,
 * `trascinamentoTestoAvviato` in useTestiLiberi.ts) e il congelamento di punto di presa, gomiti
 * e indice del tratto (`useTrascinamentoTratto.ts`). Quei riferimenti vivono un livello sopra
 * questo hook, in chi consuma il gesto: decidono la cronologia, non la meccanica del puntatore,
 * e ognuno lo fa con regole proprie del proprio dominio. Il contributo di questo hook è
 * assicurare che un evento conclusivo (`concluso: true`) arrivi SEMPRE a fine gesto, anche
 * quando il sistema annulla il puntatore — è quell'arrivo, non questo hook, a far riarmare il
 * riferimento «primo evento» di chi consuma il gesto: `trascinamentoAvviato.current = !concluso`
 * lo fa già da solo, gli mancava solo la chiamata sull'annullamento.
 *
 * Generico su `E` (il tipo di elemento che cattura: `HTMLDivElement` per le maniglie HTML,
 * `SVGPathElement` per l'area di trascinamento del tratto) e su `V` (il valore che il gesto
 * produce a ogni evento: un punto per il gomito, una `t` per il segno, punto+indice per il
 * tratto) perché i tre gesti scoperti non condividono né l'uno né l'altro — solo la meccanica.
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export function useGestoPuntatore<E extends Element, V>() {
  // «Si è mosso davvero»: vedi sopra, guardia contro le voci di cronologia a vuoto.
  const mossoRef = useRef(false)
  // Ultimo valore consegnato durante il gesto (a ogni pointermove): usato SOLO
  // dall'annullamento, che non ha un valore proprio su cui contare.
  const ultimoRef = useRef<V | undefined>(undefined)

  const suInizio = useCallback((e: ReactPointerEvent<E>) => {
    e.stopPropagation()
    mossoRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suMovimento = useCallback((e: ReactPointerEvent<E>, valore: V, aggiorna: (valore: V) => void) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.stopPropagation()
    mossoRef.current = true
    ultimoRef.current = valore
    aggiorna(valore)
  }, [])

  const suFine = useCallback((e: ReactPointerEvent<E>, valore: V, concludi: (valore: V) => void) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.stopPropagation()
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Nessun movimento: niente da consegnare e, soprattutto, niente da scrivere in cronologia
    // per un gesto che non ha cambiato nulla.
    if (mossoRef.current) concludi(valore)
    mossoRef.current = false
  }, [])

  /**
   * Puntatore annullato a metà gesto (una gesture del sistema operativo, un tocco che diventa
   * scorrimento): il rilascio non arriverà mai, e il gesto va chiuso qui, come un rilascio.
   * Consegna l'ULTIMA posizione vista (`ultimoRef`), non quella dell'evento di annullamento.
   */
  const suAnnullamento = useCallback((e: ReactPointerEvent<E>, concludi: (valore: V) => void) => {
    e.stopPropagation()
    // La cattura di norma è ancora attiva qui (il rilascio implicito segue `pointercancel`),
    // ma rilasciarla senza averla farebbe lanciare: si verifica prima.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!mossoRef.current) return
    mossoRef.current = false
    if (ultimoRef.current !== undefined) concludi(ultimoRef.current)
  }, [])

  return { suInizio, suMovimento, suFine, suAnnullamento }
}
