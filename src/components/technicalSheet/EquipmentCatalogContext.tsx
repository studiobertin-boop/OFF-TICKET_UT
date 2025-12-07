import { createContext, useContext, useState, ReactNode } from 'react'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Cache dei dati del catalogo apparecchiature
 * Key format: "tipo-marca-modello" oppure "tipo-marca-modello-pressione" per compressori/valvole
 */
interface CatalogCache {
  [key: string]: EquipmentCatalogItem | null
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
}

const EquipmentCatalogContext = createContext<EquipmentCatalogContextValue | undefined>(undefined)

/**
 * Provider per EquipmentCatalogContext
 * Deve wrappare il TechnicalSheetForm per condividere cache tra tutti i componenti
 */
export function EquipmentCatalogProvider({ children }: { children: ReactNode }) {
  const [cache, setCacheState] = useState<CatalogCache>({})

  const setCache = (key: string, data: EquipmentCatalogItem | null) => {
    setCacheState((prev) => ({
      ...prev,
      [key]: data,
    }))
    console.log('📦 Catalog cache updated:', { key, hasData: !!data })
  }

  const getCache = (key: string): EquipmentCatalogItem | null => {
    return cache[key] || null
  }

  const clearCache = () => {
    setCacheState({})
    console.log('🗑️ Catalog cache cleared')
  }

  return (
    <EquipmentCatalogContext.Provider
      value={{
        cache,
        setCache,
        getCache,
        clearCache,
      }}
    >
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
    pressione?: number
    ptar?: number
  }
): string {
  const base = `${tipo}-${marca}-${modello}`

  if (options?.pressione !== undefined) {
    return `${base}-${options.pressione}`
  }

  if (options?.ptar !== undefined) {
    return `${base}-${options.ptar}`
  }

  return base
}
