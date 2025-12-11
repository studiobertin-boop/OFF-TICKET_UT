/**
 * Types for Manufacturer Management
 *
 * Definizioni TypeScript per la gestione costruttori/marche apparecchiature.
 * Pattern identico a customer.ts con discriminated union per italiani/esteri.
 */

/**
 * Interfaccia principale Manufacturer
 * Campi italiani (P.IVA, indirizzo) sono opzionali/nullable
 * Campi esteri (paese) sono opzionali/nullable
 * La logica di validazione discriminata è gestita da Zod
 */
export interface Manufacturer {
  id: string
  nome: string
  is_estero: boolean

  // Campi per costruttori italiani (nullable)
  partita_iva?: string | null
  telefono?: string | null
  via?: string | null
  numero_civico?: string | null
  cap?: string | null
  comune?: string | null
  provincia?: string | null

  // Campo per costruttori esteri (nullable)
  paese?: string | null

  // Metadata
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
  created_by?: string | null
}

/**
 * Informazioni sulla completezza dei dati di un costruttore
 * Ritornato dalla funzione check_manufacturer_completeness()
 */
export interface ManufacturerCompleteness {
  isComplete: boolean
  missingFields: Array<{
    field: keyof Manufacturer
    label: string
  }>
}

/**
 * Filtri per la query di manufacturers
 */
export interface ManufacturerFilters {
  search?: string
  is_estero?: boolean
  is_active?: boolean
  page?: number
  pageSize?: number
}

/**
 * Response API paginata per manufacturers
 */
export interface ManufacturersResponse {
  data: Manufacturer[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Input per la creazione di un manufacturer italiano
 * Tutti i campi italiani sono obbligatori
 */
export interface CreateManufacturerItalianoInput {
  nome: string
  is_estero: false
  partita_iva: string
  telefono: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}

/**
 * Input per la creazione di un manufacturer estero
 * Solo nome e paese sono obbligatori
 */
export interface CreateManufacturerEsteroInput {
  nome: string
  is_estero: true
  paese: string
}

/**
 * Union type per input creazione manufacturer
 * Discriminated union basata su is_estero
 */
export type CreateManufacturerInput =
  | CreateManufacturerItalianoInput
  | CreateManufacturerEsteroInput

/**
 * Input per update manufacturer (tutti i campi opzionali)
 */
export type UpdateManufacturerInput = Partial<CreateManufacturerInput>

/**
 * Tipo per form data (include potenziali undefined per campi non ancora compilati)
 */
export interface ManufacturerFormData {
  nome: string
  is_estero: boolean

  // Italian fields
  partita_iva?: string
  telefono?: string
  via?: string
  numero_civico?: string
  cap?: string
  comune?: string
  provincia?: string

  // Foreign field
  paese?: string
}
