/**
 * Manufacturer Validation Utilities
 *
 * Validazione Zod per costruttori con discriminated union:
 * - Costruttori italiani: richiedono P.IVA, telefono, indirizzo completo
 * - Costruttori esteri: richiedono solo nome + paese
 *
 * Pattern identico a customerValidation.ts
 */

import { z } from 'zod'
import { Manufacturer, ManufacturerCompleteness } from '@/types/manufacturer'

/**
 * Schema Zod per Partita IVA italiana
 * Deve essere esattamente 11 cifre numeriche
 */
export const partitaIvaSchema = z
  .string()
  .min(1, 'La Partita IVA è obbligatoria')
  .regex(/^[0-9]{11}$/, 'La Partita IVA deve essere di 11 cifre numeriche')

/**
 * Schema Zod per telefono italiano
 * Accetta formati: +39, 0039, o diretto con spazi/trattini
 */
export const telefonoItalianoSchema = z
  .string()
  .min(1, 'Il numero di telefono è obbligatorio')
  .refine(
    (val) => {
      // Rimuovi spazi, trattini, parentesi
      const cleaned = val.replace(/[\s\-\(\)]/g, '')
      // Accetta +39..., 0039..., o numero diretto (6-11 cifre)
      return /^(\+39|0039)?[0-9]{6,11}$/.test(cleaned)
    },
    { message: 'Formato telefono non valido (es: +39 02 1234567 o 02 1234567)' }
  )

/**
 * Schema Zod per CAP italiano
 * Deve essere esattamente 5 cifre
 */
export const capSchema = z
  .string()
  .min(1, 'Il CAP è obbligatorio')
  .regex(/^[0-9]{5}$/, 'Il CAP deve essere di 5 cifre')

/**
 * Schema Zod per provincia italiana
 * Deve essere esattamente 2 lettere maiuscole
 */
export const provinciaSchema = z
  .string()
  .length(2, 'La provincia deve essere di 2 caratteri')
  .regex(/^[A-Z]{2}$/, 'La provincia deve essere in maiuscolo (es: MI, RM, TO)')

/**
 * Schema Zod per costruttore ITALIANO
 * Tutti i campi italiani sono obbligatori
 */
const createManufacturerItalianoSchema = z.object({
  nome: z.string().min(1, 'Il nome del costruttore è obbligatorio'),
  is_estero: z.literal(false),
  partita_iva: partitaIvaSchema,
  telefono: telefonoItalianoSchema,
  via: z.string().min(1, "L'indirizzo è obbligatorio"),
  numero_civico: z.string().min(1, 'Il numero civico è obbligatorio'),
  cap: capSchema,
  comune: z.string().min(1, 'Il comune è obbligatorio'),
  provincia: provinciaSchema,
})

/**
 * Schema Zod per costruttore ESTERO
 * Solo nome e paese sono obbligatori
 */
const createManufacturerEsteroSchema = z.object({
  nome: z.string().min(1, 'Il nome del costruttore è obbligatorio'),
  is_estero: z.literal(true),
  paese: z.string().min(1, 'Il paese è obbligatorio per costruttori esteri'),
})

/**
 * Schema Zod principale con discriminated union
 * Valida automaticamente i campi corretti in base a is_estero
 */
export const createManufacturerSchema = z.discriminatedUnion('is_estero', [
  createManufacturerItalianoSchema,
  createManufacturerEsteroSchema,
])

/**
 * Schema per update manufacturer (tutti i campi opzionali)
 * Per discriminated union, accettiamo partial di entrambi i tipi
 */
export const updateManufacturerSchema = z.union([
  createManufacturerItalianoSchema.partial(),
  createManufacturerEsteroSchema.partial(),
  z.object({}) // Allow empty updates
])

/**
 * Type inference dai Zod schemas
 */
export type CreateManufacturerSchemaType = z.infer<typeof createManufacturerSchema>
export type UpdateManufacturerSchemaType = z.infer<typeof updateManufacturerSchema>

/**
 * Valida input per creazione manufacturer
 * @returns Array di messaggi di errore (vuoto se validazione OK)
 */
export function validateManufacturerInput(input: any): string[] {
  const result = createManufacturerSchema.safeParse(input)
  if (result.success) return []

  return result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`)
}

/**
 * Labels per i campi (usati nell'UI per mostrare campi mancanti)
 */
const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome Costruttore',
  partita_iva: 'Partita IVA',
  telefono: 'Telefono',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia',
  paese: 'Paese',
}

/**
 * Controlla se un valore è vuoto
 */
function isEmpty(value: any): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/**
 * Identifica campi mancanti in un manufacturer
 * Logica discriminata: controlla campi italiani O paese
 */
export function getMissingManufacturerFields(
  manufacturer: Manufacturer
): Array<{ field: keyof Manufacturer; label: string }> {
  const missing: Array<{ field: keyof Manufacturer; label: string }> = []

  // Nome sempre obbligatorio
  if (isEmpty(manufacturer.nome)) {
    missing.push({ field: 'nome', label: FIELD_LABELS.nome })
  }

  if (manufacturer.is_estero === false) {
    // ================================================
    // COSTRUTTORE ITALIANO
    // ================================================
    const requiredFieldsItaliano: Array<keyof Manufacturer> = [
      'partita_iva',
      'telefono',
      'via',
      'numero_civico',
      'cap',
      'comune',
      'provincia',
    ]

    requiredFieldsItaliano.forEach((field) => {
      if (isEmpty(manufacturer[field])) {
        missing.push({
          field,
          label: FIELD_LABELS[field] || field,
        })
      }
    })
  } else {
    // ================================================
    // COSTRUTTORE ESTERO
    // ================================================
    if (isEmpty(manufacturer.paese)) {
      missing.push({ field: 'paese', label: FIELD_LABELS.paese })
    }
  }

  return missing
}

/**
 * Controlla se un manufacturer ha tutti i campi obbligatori popolati
 */
export function isManufacturerComplete(manufacturer: Manufacturer): boolean {
  return getMissingManufacturerFields(manufacturer).length === 0
}

/**
 * Controlla completezza e ritorna dettagli
 */
export function checkManufacturerCompleteness(manufacturer: Manufacturer): ManufacturerCompleteness {
  const missingFields = getMissingManufacturerFields(manufacturer)
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Normalizza Partita IVA rimuovendo spazi ed eventuali caratteri non numerici
 * Fa padding a 11 cifre se necessario (aggiunge zeri iniziali)
 * @returns P.IVA normalizzata (solo cifre, 11 caratteri)
 */
export function normalizePartitaIva(piva: string): string {
  // Rimuovi tutto tranne numeri
  const cleaned = piva.replace(/\D/g, '')
  // Padding a 11 cifre con zeri iniziali
  return cleaned.padStart(11, '0')
}

/**
 * Normalizza telefono italiano
 * Rimuove spazi, trattini, parentesi e assicura prefisso +39
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
 * Normalizza provincia a maiuscolo
 */
export function normalizeProvincia(provincia: string): string {
  return provincia.toUpperCase().trim()
}

/**
 * Normalizza CAP con padding se necessario
 */
export function normalizeCap(cap: string): string {
  const cleaned = cap.replace(/\D/g, '')
  return cleaned.padStart(5, '0')
}

/**
 * Formatta indirizzo completo per display
 * @returns Stringa formattata "Via Numero, CAP Comune (PR)"
 */
export function formatFullAddress(manufacturer: Manufacturer): string | null {
  if (manufacturer.is_estero) {
    return manufacturer.paese || null
  }

  // Costruttore italiano - formatta indirizzo
  const parts: string[] = []

  if (manufacturer.via && manufacturer.numero_civico) {
    parts.push(`${manufacturer.via} ${manufacturer.numero_civico}`)
  } else if (manufacturer.via) {
    parts.push(manufacturer.via)
  }

  const cityParts: string[] = []
  if (manufacturer.cap) cityParts.push(manufacturer.cap)
  if (manufacturer.comune) cityParts.push(manufacturer.comune)
  if (manufacturer.provincia) cityParts.push(`(${manufacturer.provincia})`)

  if (cityParts.length > 0) {
    parts.push(cityParts.join(' '))
  }

  return parts.length > 0 ? parts.join(', ') : null
}

/**
 * Formatta nome per display con indicazione paese se estero
 * @returns "Nome Costruttore" o "Nome Costruttore (Paese)"
 */
export function formatManufacturerDisplay(manufacturer: Manufacturer): string {
  if (manufacturer.is_estero && manufacturer.paese) {
    return `${manufacturer.nome} (${manufacturer.paese})`
  }
  return manufacturer.nome
}
