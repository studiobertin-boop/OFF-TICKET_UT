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

  // Dati catalogo correnti: la voce da cui la riga è stata precompilata. `UpdateData` nasce in
  // un solo punto (`useRowCatalogDivergence`), da `RigaOrigine.catalogItem`, che non è opzionale
  // — una riga senza provenienza non arriva mai a diventare un `UpdateData`.
  catalogData: EquipmentCatalogItem

  /** Valore che identifica la variante (pressione per i compressori, Ptar per le valvole). */
  variante?: number

  /** Percorso della riga nel form, per riportare indietro un valore rifiutato. */
  basePath?: string

  /** Chiave della riga nella mappa delle provenienze, per annotarci le scelte fatte. */
  rowKey: string
}

/**
 * Cosa fare di un valore che si è scostato dal dato di catalogo.
 *
 * `solo_qui` è la scelta di riserva: tiene la modifica nella scheda senza toccare il catalogo,
 * ed è l'unica che non ha conseguenze fuori dalla pratica in corso.
 */
export type SceltaCampo = 'default' | 'solo_qui' | 'catalogo'

/** Scelte dell'utente, indicizzate per `${indice update}:${chiave canonica}`. */
export type ScelteCampi = Record<string, SceltaCampo>

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
