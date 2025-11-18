import { useState, useEffect, Dispatch, SetStateAction } from 'react'

/**
 * Hook personalizzato per persistere lo stato nel sessionStorage
 * Mantiene lo stato durante la sessione del browser
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // Leggi il valore iniziale dal sessionStorage
  const [state, setState] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Error reading ${key} from sessionStorage:`, error)
      return defaultValue
    }
  })

  // Salva nel sessionStorage ogni volta che lo stato cambia
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.error(`Error saving ${key} to sessionStorage:`, error)
    }
  }, [key, state])

  return [state, setState]
}
