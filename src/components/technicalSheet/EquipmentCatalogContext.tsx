import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Cache dei dati del catalogo apparecchiature
 * Key format: "tipo-marca-modello" oppure "tipo-marca-modello-variante" per compressori/valvole
 */
interface CatalogCache {
  [key: string]: EquipmentCatalogItem | null
}

/**
 * Provenienza dei dati di una riga della scheda.
 *
 * `appliedSpecs` è la fotografia dei dati tecnici così come sono arrivati dal catalogo: è il
 * termine di paragone per capire se un valore è stato modificato rispetto al default, che è
 * cosa diversa dal confronto con il catalogo di adesso.
 */
export interface RigaOrigine {
  cacheKey: string
  appliedSpecs: Record<string, unknown>
}

/**
 * Context per conservare i dati del catalogo selezionati durante la compilazione
 * Serve per confrontare specs esistenti con nuovi valori al momento del save
 */
interface EquipmentCatalogContextValue {
  cache: CatalogCache
  setCache: (key: string, data: EquipmentCatalogItem | null) => void
  getCache: (key: string) => EquipmentCatalogItem | null
  clearCache: () => void
  /** Registra da quale voce di catalogo è stata precompilata una riga della scheda. */
  setOrigine: (rowKey: string, origine: RigaOrigine) => void
  getOrigine: (rowKey: string) => RigaOrigine | null
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
 * Deve wrappare il TechnicalSheetForm per condividere cache tra tutti i componenti
 */
export function EquipmentCatalogProvider({ children }: { children: ReactNode }) {
  const [cache, setCacheState] = useState<CatalogCache>({})

  /**
   * Le provenienze stanno in un ref e non nello stato: nessuna resa dipende da loro, si leggono
   * solo al momento del confronto. Tenerle nello stato rimonterebbe l'intera tabella a ogni
   * autocompilazione.
   */
  const origini = useRef<Record<string, RigaOrigine>>({})

  const setCache = useCallback((key: string, data: EquipmentCatalogItem | null) => {
    setCacheState((prev) => (prev[key] === data ? prev : { ...prev, [key]: data }))
  }, [])

  const getCache = useCallback((key: string): EquipmentCatalogItem | null => cache[key] || null, [cache])

  const clearCache = useCallback(() => {
    setCacheState({})
    origini.current = {}
  }, [])

  const setOrigine = useCallback((rowKey: string, origine: RigaOrigine) => {
    origini.current[rowKey] = origine
  }, [])

  const getOrigine = useCallback((rowKey: string): RigaOrigine | null => origini.current[rowKey] ?? null, [])

  const value = useMemo(
    () => ({ cache, setCache, getCache, clearCache, setOrigine, getOrigine }),
    [cache, setCache, getCache, clearCache, setOrigine, getOrigine]
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

/**
 * Helper per generare chiave cache
 */
export function generateCacheKey(
  tipo: string,
  marca: string,
  modello: string,
  options?: {
    /** Valore che identifica la variante (pressione per i compressori, Ptar per le valvole). */
    variante?: number
    pressione?: number
    ptar?: number
  }
): string {
  const base = `${tipo}-${marca}-${modello}`
  const variante = options?.variante ?? options?.pressione ?? options?.ptar

  return variante !== undefined ? `${base}-${variante}` : base
}
