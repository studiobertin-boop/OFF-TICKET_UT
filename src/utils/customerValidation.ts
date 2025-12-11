import { z } from 'zod'
import { Customer, CustomerCompleteness } from '@/types'

/**
 * Zod schema for Italian phone number validation
 * Accepts: +39, 0039, or direct format with flexible spacing/dashes
 */
export const telefonoSchema = z.string()
  .min(1, 'Il numero di telefono è obbligatorio')
  .refine(
    (val) => {
      // Remove all spaces, dashes, and parentheses for validation
      const cleaned = val.replace(/[\s\-\(\)]/g, '')
      // Accept +39..., 0039..., or direct number (6-11 digits after prefix)
      return /^(\+39|0039)?[0-9]{6,11}$/.test(cleaned)
    },
    { message: 'Formato telefono non valido (es: +39 02 1234567 o 02 1234567)' }
  )

/**
 * Zod schema for PEC (Certified Email) validation
 * Must be a valid email ending with common Italian certified email domains
 */
export const pecSchema = z.string()
  .min(1, 'La PEC è obbligatoria')
  .email('Formato email non valido')
  .refine(
    (val) => {
      const lower = val.toLowerCase()
      return (
        lower.endsWith('.pec.it') ||
        lower.endsWith('.legalmail.it') ||
        lower.endsWith('.arubapec.it') ||
        lower.endsWith('.postacert.it') ||
        lower.endsWith('.sicurezzapostale.it') ||
        lower.endsWith('.cert.agenziaentrate.it')
      )
    },
    { message: 'La PEC deve terminare con un dominio certificato valido (es: .pec.it, .legalmail.it, .arubapec.it)' }
  )

/**
 * Zod schema for Italian CAP (postal code) validation
 * Must be exactly 5 digits
 */
export const capSchema = z.string()
  .regex(/^[0-9]{5}$/, 'Il CAP deve essere di 5 cifre')

/**
 * Zod schema for Italian provincia (province) validation
 * Must be exactly 2 uppercase letters
 */
export const provinciaSchema = z.string()
  .length(2, 'La provincia deve essere di 2 caratteri')
  .regex(/^[A-Z]{2}$/, 'La provincia deve essere in maiuscolo (es: MI, RM, TO)')

/**
 * Complete Zod schema for creating a customer with all required fields
 */
export const createCustomerSchema = z.object({
  ragione_sociale: z.string().min(1, 'La ragione sociale è obbligatoria'),
  identificativo: z.string().regex(/^CLI-[0-9]{4}$/, 'Formato identificativo non valido (CLI-XXXX)').optional(),
  telefono: telefonoSchema,
  pec: pecSchema,
  descrizione_attivita: z.string().min(1, 'La descrizione attività è obbligatoria'),
  via: z.string().min(1, 'L\'indirizzo è obbligatorio'),
  numero_civico: z.string().min(1, 'Il numero civico è obbligatorio'),
  cap: capSchema,
  comune: z.string().min(1, 'Il comune è obbligatorio'),
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
 */
export function getMissingCustomerFields(customer: Customer): Array<{ field: keyof Customer; label: string }> {
  const requiredFields: Array<keyof Customer> = [
    'ragione_sociale',
    'identificativo',
    'telefono',
    'pec',
    'descrizione_attivita',
    'via',
    'numero_civico',
    'cap',
    'comune',
    'provincia',
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
