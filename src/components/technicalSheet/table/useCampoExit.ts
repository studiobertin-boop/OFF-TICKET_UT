import { useCallback, useEffect, useRef } from 'react'

/**
 * Contenitori che MUI monta in `document.body` invece che dentro il componente che li apre:
 * tendine di Autocomplete, menu di Select, dialog.
 */
const LAYER_PORTALATI = '.MuiAutocomplete-popper, .MuiPopover-root, .MuiMenu-root, .MuiModal-root'

interface UseCampoExitResult {
  onFocusCapture: (e: React.FocusEvent<HTMLElement>) => void
  onBlurCapture: (e: React.FocusEvent<HTMLElement>) => void
  ref: (el: HTMLElement | null) => void
}

/**
 * Chiama `onExit` quando il fuoco lascia il campo in cui si stava scrivendo.
 *
 * Il campo, non la riga: passando dalla PS alla capacità della stessa apparecchiatura si è
 * finito di scrivere quel valore tanto quanto andando alla riga sotto, e chi ha appena
 * scostato un dato dal catalogo si aspetta la domanda lì, non tre celle dopo. `selettoreCampo`
 * dice dove sta il confine — le celle della tabella, i riquadri della finestra dei dettagli —
 * e gli handler si appoggiano al contenitore che li racchiude tutti, in fase di cattura.
 *
 * Tre casi non si leggono da `relatedTarget`:
 *
 * 1. **Popup portalati.** Aprendo una tendina il fuoco va al listbox, che vive in `document.body`
 *    e quindi risulta «fuori dal campo»: senza correttivo il dialog comparirebbe a ogni menu
 *    aperto. Si considera «dentro» qualunque layer portalato *sopra* il contenitore. Il «sopra»
 *    conta: la finestra dei dettagli è essa stessa un layer portalato, e senza quella
 *    condizione ogni suo campo risulterebbe per sempre dentro un popup.
 *    Si è scartato `disablePortal`, che pure risolverebbe: il contenitore della tabella ha
 *    `overflowX: auto` e i menu verrebbero tagliati.
 * 2. **`relatedTarget` nullo** — click su un'area non focusabile, chiusura con ESC. Si cede un
 *    turno prima di dichiarare l'uscita, e un `focusin` che risolve nello stesso campo la annulla.
 * 3. **Fuoco che rientra nello stesso campo** dopo essere passato dal popup: l'ultimo controllo
 *    prima di chiamare `onExit` guarda dov'è finito davvero il fuoco.
 */
export function useCampoExit(onExit: () => void, selettoreCampo: string): UseCampoExitResult {
  const contenitore = useRef<HTMLElement | null>(null)
  /** Campo di cui si sta valutando l'uscita, mentre la verifica è in sospeso. */
  const campoInAttesa = useRef<Element | null>(null)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const annulla = useCallback(() => {
    if (pendingRef.current === null) return
    clearTimeout(pendingRef.current)
    pendingRef.current = null
    campoInAttesa.current = null
  }, [])

  const campoDi = useCallback(
    (el: EventTarget | null) => (el instanceof Element ? el.closest(selettoreCampo) : null),
    [selettoreCampo],
  )

  const restaDentro = useCallback((el: EventTarget | null, campo: Element | null) => {
    if (!(el instanceof Element)) return false
    // Un layer che contiene il contenitore non è un popup aperto da qui: è la finestra
    // dentro cui si sta compilando.
    const layer = el.closest(LAYER_PORTALATI)
    if (layer && !layer.contains(contenitore.current)) return true
    return campo ? campo.contains(el) : Boolean(contenitore.current?.contains(el))
  }, [])

  // Il fuoco è tornato nello stesso campo: l'uscita in sospeso non era tale.
  const onFocusCapture = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (restaDentro(e.target, campoInAttesa.current)) annulla()
  }, [annulla, restaDentro])

  const onBlurCapture = useCallback((e: React.FocusEvent<HTMLElement>) => {
    const campo = campoDi(e.target)
    if (restaDentro(e.relatedTarget, campo)) return

    annulla()
    campoInAttesa.current = campo
    // `setTimeout` e non `requestAnimationFrame`: quest'ultimo non scatta finché la scheda del
    // browser non compone frame, quindi a finestra in secondo piano la verifica non partirebbe
    // mai. Qui serve solo cedere il turno perché il fuoco si assesti, e un macrotask basta.
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null
      campoInAttesa.current = null
      // Ultimo controllo: nel frattempo il fuoco può essere finito su un popup del campo.
      if (restaDentro(document.activeElement, campo)) return
      onExitRef.current()
    }, 0)
  }, [annulla, campoDi, restaDentro])

  useEffect(() => annulla, [annulla])

  return {
    onFocusCapture,
    onBlurCapture,
    ref: (el: HTMLElement | null) => { contenitore.current = el },
  }
}
