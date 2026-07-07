import { useRef } from 'react'

let counter = 0

/**
 * Restituisce un valore `autoComplete` univoco per istanza del campo.
 *
 * Perché non basta `autoComplete="off"`: Chrome lo ignora spesso e riempie
 * comunque i campi appena montati (es. una nuova riga apparecchiatura) con i
 * valori digitati in precedenza. Un token *sconosciuto* al browser disattiva
 * l'autofill euristico e, essendo univoco per istanza, impedisce il riempimento
 * cross-riga. A differenza di `new-password` non attiva l'icona/gestore password.
 */
export const useNoAutofillToken = (): string => {
  const ref = useRef<string>('')
  if (!ref.current) {
    counter += 1
    ref.current = `nofill-${counter}`
  }
  return ref.current
}
