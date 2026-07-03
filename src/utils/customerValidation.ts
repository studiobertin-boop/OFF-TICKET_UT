import { z } from 'zod'
import { Customer, CustomerCompleteness } from '@/types'

/**
 * Zod schema for phone number (optional, no format constraint)
 * Any value is accepted.
 */
export const telefonoSchema = z.string().optional()

/**
 * Zod schema for PEC validation
 * Optional field - when provided, must be a valid email
 * (contains @ and a domain with a dot). No certified-domain restriction.
 */
export const pecSchema = z.string()
  .optional()
  .refine(
    (val) => {
      // Allow empty/undefined
      if (!val || val.trim() === '') return true
      // Must be a valid email: something@domain.tld
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
    },
    { message: 'Formato PEC non valido (inserire un indirizzo email valido, es: nome@dominio.it)' }
  )

/**
 * Zod schema for Italian CAP (postal code) validation
 * Must be exactly 5 digits when provided (optional field)
 */
export const capSchema = z.string()
  .optional()
  .refine(
    (val) => {
      // Allow empty/undefined
      if (!val || val.trim() === '') return true
      // Must be exactly 5 digits when provided
      return /^[0-9]{5}$/.test(val)
    },
    { message: 'Il CAP deve essere di 5 cifre' }
  )

/**
 * Zod schema for Italian provincia (province) validation
 * Must be exactly 2 uppercase letters when provided (optional field)
 */
export const provinciaSchema = z.string()
  .optional()
  .refine(
    (val) => {
      // Allow empty/undefined
      if (!val || val.trim() === '') return true
      // Must be exactly 2 uppercase letters when provided
      return /^[A-Z]{2}$/.test(val) && val.length === 2
    },
    { message: 'La provincia deve essere di 2 caratteri in maiuscolo (es: MI, RM, TO)' }
  )

/**
 * Complete Zod schema for creating a customer with all required fields
 * Note: telefono and address fields (via, numero_civico, cap, comune, provincia) are optional
 */
export const createCustomerSchema = z.object({
  ragione_sociale: z.string().min(1, 'La ragione sociale è obbligatoria'),
  identificativo: z.union([
    z.string().regex(/^CLI-[0-9]{4}$/, 'Formato identificativo non valido (CLI-XXXX)'),
    z.literal(''), // Allow empty string for auto-generation
  ]).optional(),
  telefono: telefonoSchema,
  pec: pecSchema,
  descrizione_attivita: z.string().optional(),
  via: z.string().optional(),
  numero_civico: z.string().optional(),
  cap: capSchema,
  comune: z.string().optional(),
  provincia: provinciaSchema,
})

/**
 * Partial schema for updating a customer (all fields optional)
 */
export const updateCustomerSchema = createCustomerSchema.partial()

/**
 * Type inference from Zod schemas
 */
export type CreateCustomerSchemaType = z.infer<typeof createCustomerSchema>
export type UpdateCustomerSchemaType = z.infer<typeof updateCustomerSchema>

/**
 * Validates customer input data and returns array of error messages
 * Returns empty array if validation succeeds
 */
export function validateCustomerInput(input: any): string[] {
  const result = createCustomerSchema.safeParse(input)
  if (result.success) return []

  return result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
}

/**
 * Field labels for displaying missing fields to users
 */
const FIELD_LABELS: Record<string, string> = {
  ragione_sociale: 'Ragione Sociale',
  identificativo: 'Identificativo',
  telefono: 'Telefono',
  pec: 'PEC',
  descrizione_attivita: 'Descrizione Attività',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia',
}

/**
 * Checks if a field value is considered empty
 */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/**
 * Identifies which required fields are missing from a customer record
 * Returns array of missing field identifiers with their labels
 * Note: telefono and address fields are no longer required
 */
export function getMissingCustomerFields(customer: Customer): Array<{ field: keyof Customer; label: string }> {
  // Solo la ragione sociale è obbligatoria; tutti gli altri campi sono facoltativi
  const requiredFields: Array<keyof Customer> = [
    'ragione_sociale',
  ]

  return requiredFields
    .filter(field => isEmpty(customer[field]))
    .map(field => ({
      field,
      label: FIELD_LABELS[field] || field,
    }))
}

/**
 * Checks if a customer has all required fields populated
 * Returns true if customer is complete, false otherwise
 */
export function isCustomerComplete(customer: Customer): boolean {
  return getMissingCustomerFields(customer).length === 0
}

/**
 * Campi facoltativi che l'utente può "integrare" tramite il dialog di completamento.
 * NON sono obbligatori per il salvataggio (per quelli vedi getMissingCustomerFields),
 * ma se vuoti offrono l'opportunità di completare il profilo del cliente.
 * Nota: `identificativo` è escluso perché viene auto-generato quando lasciato vuoto.
 */
const COMPLETABLE_CUSTOMER_FIELDS: Array<keyof Customer> = [
  'telefono',
  'pec',
  'descrizione_attivita',
  'via',
  'numero_civico',
  'cap',
  'comune',
  'provincia',
]

/**
 * Restituisce i campi facoltativi attualmente vuoti che l'utente può integrare.
 * Usato dal dialog "Completa Dati Cliente" e per decidere se proporlo.
 */
export function getIncompleteCustomerFields(
  customer: Customer
): Array<{ field: keyof Customer; label: string }> {
  return COMPLETABLE_CUSTOMER_FIELDS
    .filter(field => isEmpty(customer[field]))
    .map(field => ({
      field,
      label: FIELD_LABELS[field] || field,
    }))
}

/**
 * True se il cliente ha almeno un campo facoltativo che può essere integrato.
 * Non implica che il cliente sia "non valido": serve solo a proporre il completamento.
 */
export function hasIncompleteCustomerData(customer: Customer): boolean {
  return getIncompleteCustomerFields(customer).length > 0
}

/**
 * Checks customer completeness and returns detailed result
 */
export function checkCustomerCompleteness(customer: Customer): CustomerCompleteness {
  const missingFields = getMissingCustomerFields(customer)
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Normalizes Italian phone number to standard format (+39...)
 * Removes spaces, dashes, parentheses and ensures +39 prefix
 */
export function normalizeTelefono(tel: string): string {
  const cleaned = tel.replace(/[\s\-\(\)]/g, '')

  if (cleaned.startsWith('+39')) {
    return cleaned
  }

  if (cleaned.startsWith('0039')) {
    return '+39' + cleaned.slice(4)
  }

  return '+39' + cleaned
}

/**
 * Normalizes PEC email to lowercase
 */
export function normalizePec(pec: string): string {
  return pec.toLowerCase().trim()
}

/**
 * Normalizes provincia to uppercase
 */
export function normalizeProvincia(provincia: string): string {
  return provincia.toUpperCase().trim()
}
