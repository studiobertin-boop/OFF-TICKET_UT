import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'

type Apri = (codice: string) => void

interface Apertura {
  /** La tabella si dichiara capace di aprire la finestra di un'apparecchiatura. */
  registra: (apri: Apri | null) => void
  /** Apre la finestra dell'apparecchiatura con questo codice, se la tabella è montata. */
  apri: Apri
}

const Contesto = createContext<Apertura | null>(null)

/**
 * Ponte fra la barra titolo e la tabella delle apparecchiature.
 *
 * I pulsanti dei fascicoli stanno in barra titolo, ma la finestra che aprono — dove il
 * fascicolo si compone davvero — vive dentro `UnifiedEquipmentTable`, che sa quali righe
 * ci sono e in che ordine. Invece di sollevare quello stato fin quassù, e con lui l'intero
 * elenco delle righe, la tabella deposita qui la propria funzione di apertura e la barra la
 * chiama per codice.
 *
 * Passa da un `ref` e non da uno stato: la tabella si riregistra a ogni render (l'elenco
 * delle righe cambia mentre si compila), e farlo attraverso uno stato rimetterebbe in coda
 * un altro render a ogni giro.
 */
export const AperturaApparecchiaturaProvider = ({ children }: { children: ReactNode }) => {
  const apri = useRef<Apri | null>(null)
  const valore = useMemo<Apertura>(
    () => ({
      registra: (fn) => {
        apri.current = fn
      },
      apri: (codice) => apri.current?.(codice),
    }),
    []
  )
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}

/** `null` fuori dal form della scheda: i chiamanti si limitano a non offrire l'azione. */
export const useAperturaApparecchiatura = () => useContext(Contesto)
