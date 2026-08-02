import { useCallback, useEffect, useRef } from 'react'

/**
 * Contenitori che MUI monta in `document.body` invece che dentro il componente che li apre:
 * tendine di Autocomplete, menu di Select, dialog.
 */
const LAYER_PORTALATI = '.MuiAutocomplete-popper, .MuiPopover-root, .MuiMenu-root, .MuiModal-root'

interface UseRowExitResult {
  onFocusCapture: () => void
  onBlurCapture: (e: React.FocusEvent<HTMLElement>) => void
  ref: (el: HTMLElement | null) => void
}

/**
 * Chiama `onExit` quando il fuoco lascia davvero la riga.
 *
 * Il caso semplice — Tab verso la riga sotto — si legge da `relatedTarget`. I due difficili:
 *
 * 1. **Popup portalati.** Aprendo una tendina il fuoco va al listbox, che vive in `document.body`
 *    e quindi risulta «fuori dalla riga»: senza correttivo il dialog comparirebbe a ogni menu
 *    aperto. Si considera «dentro» qualunque layer portalato di MUI. Non serve sapere di quale
 *    riga sia: per arrivare al popup di un'altra riga bisogna prima entrare in quella riga, e
 *    quello è già un `relatedTarget` fuori che fa scattare l'uscita per la via normale.
 *    Si è scartato `disablePortal`, che pure risolverebbe: il contenitore della tabella ha
 *    `overflowX: auto` e i menu verrebbero tagliati.
 * 2. **`relatedTarget` nullo** — click su un'area non focusabile, chiusura con ESC. Si cede un
 *    turno prima di dichiarare l'uscita, e un `focusin` che risolve sulla stessa riga la annulla.
 */
export function useRowExit(onExit: () => void): UseRowExitResult {
  const rowRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  const annulla = useCallback(() => {
    if (pendingRef.current === null) return
    clearTimeout(pendingRef.current)
    pendingRef.current = null
  }, [])

  const restaDentro = useCallback((el: EventTarget | null) => {
    if (!(el instanceof Element)) return false
    if (rowRef.current?.contains(el)) return true
    return Boolean(el.closest(LAYER_PORTALATI))
  }, [])

  // Il fuoco è tornato dentro: l'uscita in sospeso non era tale.
  const onFocusCapture = useCallback(() => annulla(), [annulla])

  const onBlurCapture = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (restaDentro(e.relatedTarget)) return

    annulla()
    // `setTimeout` e non `requestAnimationFrame`: quest'ultimo non scatta finché la scheda del
    // browser non compone frame, quindi a finestra in secondo piano la verifica non partirebbe
    // mai. Qui serve solo cedere il turno perché il fuoco si assesti, e un macrotask basta.
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null
      // Ultimo controllo: nel frattempo il fuoco può essere finito su un popup della riga.
      if (restaDentro(document.activeElement)) return
      onExitRef.current()
    }, 0)
  }, [annulla, restaDentro])

  useEffect(() => annulla, [annulla])

  return {
    onFocusCapture,
    onBlurCapture,
    ref: (el: HTMLElement | null) => { rowRef.current = el },
  }
}
