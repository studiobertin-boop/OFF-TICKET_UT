import { createContext, useCallback, useContext, useMemo, useRef, ReactNode } from 'react'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Provenienza dei dati di una riga della scheda.
 *
 * `catalogItem` è la voce di catalogo scelta, per intero: il suo `id` è l'unica cosa che
 * individua la riga da riaggiornare senza ambiguità. Ci si è arrivati per sottrazione — prima
 * la voce si ripescava da una cache indicizzata per `tipo-marca-modello-pressione`, e da quando
 * due varianti dello stesso modello possono dichiarare la stessa pressione (KAESER SK 19 ne ha
 * due, entrambe a 11 bar di massima, con portate diverse) quella chiave non distingue più: due
 * righe della stessa scheda si sovrascrivevano a vicenda e l'ultima vinceva.
 *
 * `appliedSpecs` è la fotografia dei dati tecnici così come sono arrivati dal catalogo: è il
 * termine di paragone per capire se un valore è stato modificato rispetto al default, che è
 * cosa diversa dal confronto con il catalogo di adesso.
 */
export interface RigaOrigine {
  catalogItem: EquipmentCatalogItem
  appliedSpecs: Record<string, unknown>
}

/**
 * Context che tiene, riga per riga, da quale voce di catalogo vengono i dati precompilati.
 *
 * Serve al confronto fra le specs di partenza e quelle presenti al salvataggio, e a sapere su
 * quale riga di catalogo scrivere quando l'utente decide di riportarci una modifica.
 */
interface EquipmentCatalogContextValue {
  /** Registra da quale voce di catalogo è stata precompilata una riga della scheda. */
  setOrigine: (rowKey: string, origine: RigaOrigine) => void
  getOrigine: (rowKey: string) => RigaOrigine | null
  /** Dimentica tutte le provenienze, es. dopo un `reset` del form. */
  clearOrigini: () => void
}

const EquipmentCatalogContext = createContext<EquipmentCatalogContextValue | undefined>(undefined)

/**
 * Chiave di una riga della scheda dentro la mappa delle provenienze.
 *
 * Si indicizza per codice e non per percorso: il percorso è posizionale (`compressori.1`) e
 * l'eliminazione di una riga fa scalare gli indici, mentre il codice segue l'apparecchiatura.
 */
export function rowKeyOf(arrayName: string, codice: string | undefined): string {
  return `${arrayName}:${codice ?? ''}`
}

/**
 * Provider per EquipmentCatalogContext
 * Deve wrappare il TechnicalSheetForm per condividere le provenienze fra tutti i componenti
 */
export function EquipmentCatalogProvider({ children }: { children: ReactNode }) {
  /**
   * Le provenienze stanno in un ref e non nello stato: nessuna resa dipende da loro, si leggono
   * solo al momento del confronto. Tenerle nello stato rimonterebbe l'intera tabella a ogni
   * autocompilazione.
   */
  const origini = useRef<Record<string, RigaOrigine>>({})

  const setOrigine = useCallback((rowKey: string, origine: RigaOrigine) => {
    origini.current[rowKey] = origine
  }, [])

  const getOrigine = useCallback((rowKey: string): RigaOrigine | null => origini.current[rowKey] ?? null, [])

  const clearOrigini = useCallback(() => {
    origini.current = {}
  }, [])

  const value = useMemo(
    () => ({ setOrigine, getOrigine, clearOrigini }),
    [setOrigine, getOrigine, clearOrigini]
  )

  return (
    <EquipmentCatalogContext.Provider value={value}>
      {children}
    </EquipmentCatalogContext.Provider>
  )
}

/**
 * Hook per accedere al context del catalogo
 * Deve essere usato all'interno di un EquipmentCatalogProvider
 */
export function useEquipmentCatalogContext() {
  const context = useContext(EquipmentCatalogContext)

  if (context === undefined) {
    throw new Error('useEquipmentCatalogContext must be used within EquipmentCatalogProvider')
  }

  return context
}
