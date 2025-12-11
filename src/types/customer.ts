import { Customer } from './index'

/**
 * Result of checking customer data completeness
 */
export interface CustomerCompleteness {
  isComplete: boolean
  missingFields: Array<{
    field: keyof Customer
    label: string
  }>
}

/**
 * Complete customer data required for DM329 requests
 */
export interface CompleteCustomerData {
  telefono: string
  pec: string
  descrizione_attivita: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}

/**
 * Input for creating a new customer with all required fields
 */
export interface CreateCompleteCustomerInput {
  ragione_sociale: string
  identificativo?: string  // Optional, auto-generated if omitted
  telefono: string
  pec: string
  descrizione_attivita: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}
