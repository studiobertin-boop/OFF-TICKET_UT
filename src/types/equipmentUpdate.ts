import type { EquipmentCatalogType, EquipmentCatalogItem } from '@/types'
import type { SpecsComparison } from '@/utils/equipmentSpecsComparison'

/**
 * Dati per un singolo aggiornamento del catalogo
 */
export interface UpdateData {
  // Identificazione apparecchiatura
  equipmentType: EquipmentCatalogType
  marca: string
  modello: string
  codice: string // Codice apparecchiatura nella scheda (es: "S1", "C2")

  // Specs da aggiornare
  newSpecs: Record<string, any>

  // Risultato confronto
  comparison: SpecsComparison

  // Dati catalogo correnti (se esistono)
  catalogData: EquipmentCatalogItem | null

  // Opzioni per compressori/valvole (pressione come chiave)
  pressione?: number
  ptar?: number
}

/**
 * Stato dell'aggiornamento
 */
export type UpdateStatus = 'pending' | 'success' | 'error'

/**
 * Risultato di un aggiornamento
 */
export interface UpdateResult {
  update: UpdateData
  status: UpdateStatus
  error?: string
}
