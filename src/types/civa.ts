/**
 * CIVA Types
 *
 * Type definitions for CIVA summary and filtering
 */

import type {
  Customer,
  Installer,
  Manufacturer,
  CategoriaPED,
  DatiImpianto
} from './index'

/**
 * Tipo di pratica CIVA richiesta per un'apparecchiatura
 */
export type TipoPraticaCIVA = 'DICHIARAZIONE' | 'VERIFICA' | 'NESSUNA'

/**
 * Tipo di apparecchiatura eligibile per CIVA
 */
export type TipoApparecchiaturaCIVA =
  | 'Serbatoio'
  | 'Scambiatore'
  | 'Disoleatore'
  | 'Recipiente Filtro'

/**
 * Apparecchiatura eligibile per caricamento CIVA
 */
export interface CIVAApparecchio {
  // Identity
  codice: string // S1, E1.1, C1.1, F1.1, etc.
  tipo: TipoApparecchiaturaCIVA

  // Equipment data (from technical sheet)
  marca: string
  modello: string
  n_fabbrica: string
  anno?: number
  volume: number // liters
  ps_pressione_max: number // bar
  ts_temperatura?: number // °C
  categoria_ped?: CategoriaPED

  // CIVA classification
  tipoPratica: TipoPraticaCIVA

  // Related entities
  manufacturer: Manufacturer

  // Parent reference (for dependent equipment like E1.1)
  parentCodice?: string
}

/**
 * Complete CIVA summary data
 */
export interface CIVASummaryData {
  dichiarazioni: CIVAApparecchio[]
  verifiche: CIVAApparecchio[]
}

/**
 * Missing field information for validation
 */
export interface MissingField {
  field: string
  label: string
}

/**
 * Incomplete manufacturer information
 */
export interface IncompleteManufacturer {
  codice: string // Equipment code
  marca: string // Manufacturer name
  missingFields: MissingField[]
}

/**
 * CIVA completeness validation result
 */
export interface CIVACompletenessCheck {
  isComplete: boolean
  customerComplete: boolean
  installerComplete: boolean
  manufacturersComplete: boolean

  missingCustomerFields: MissingField[]
  missingInstallerFields: MissingField[]
  incompleteManufacturers: IncompleteManufacturer[]
}

/**
 * Data needed for CIVA display
 */
export interface CIVADisplayData {
  customer: Customer
  installer: Installer
  impianto: DatiImpianto
  apparecchi: CIVAApparecchio[]
}

/**
 * Parsed address components for CIVA display
 */
export interface CIVAParsedAddress {
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}
