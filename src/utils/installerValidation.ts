/**
 * Installer Validation Utilities
 *
 * Validation schemas, normalization functions, and completeness checks
 * for installers (installatori)
 */

import { z } from 'zod'
import type { Installer, InstallerCompleteness, CreateInstallerInput } from '@/types/installer'

// ================================================
// ZOD VALIDATION SCHEMAS
// ================================================

// Partita IVA: 11 cifre numeriche
const partitaIvaSchema = z
  .string()
  .min(1, 'La Partita IVA è obbligatoria')
  .regex(/^[0-9]{10,11}$/, 'La Partita IVA deve contenere 10 o 11 cifre')

// CAP: 5 cifre
const capSchema = z
  .string()
  .min(1, 'Il CAP è obbligatorio')
  .regex(/^[0-9]{5}$/, 'Il CAP deve contenere 5 cifre')

// Provincia: 2 lettere maiuscole
const provinciaSchema = z
  .string()
  .min(1, 'La provincia è obbligatoria')
  .regex(/^[A-Z]{2}$/, 'La provincia deve essere di 2 lettere maiuscole (es. TV, RO)')

/**
 * Schema Zod per creazione installer
 * Tutti i campi obbligatori (solo installatori italiani)
 */
export const createInstallerSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  partita_iva: partitaIvaSchema,
  via: z.string().min(1, 'La via è obbligatoria'),
  numero_civico: z.string().min(1, 'Il numero civico è obbligatorio'),
  cap: capSchema,
  comune: z.string().min(1, 'Il comune è obbligatorio'),
  provincia: provinciaSchema,
})

/**
 * Schema per update installer (tutti i campi opzionali)
 */
export const updateInstallerSchema = createInstallerSchema.partial()

/**
 * Type inference dai Zod schemas
 */
export type CreateInstallerSchemaType = z.infer<typeof createInstallerSchema>
export type UpdateInstallerSchemaType = z.infer<typeof updateInstallerSchema>

// ================================================
// VALIDATION FUNCTIONS
// ================================================

/**
 * Valida input per creazione installer
 * @returns Array di messaggi di errore (vuoto se validazione OK)
 */
export function validateInstallerInput(input: CreateInstallerInput): string[] {
  const result = createInstallerSchema.safeParse(input)
  if (result.success) return []

  return result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`)
}

// ================================================
// NORMALIZATION FUNCTIONS
// ================================================

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
 * Normalizza CAP rimuovendo caratteri non numerici e facendo padding
 * @returns CAP normalizzato (5 cifre)
 */
export function normalizeCap(cap: string): string {
  const cleaned = cap.replace(/\D/g, '')
  return cleaned.padStart(5, '0')
}

/**
 * Normalizza provincia in maiuscolo
 * @returns Provincia normalizzata (2 lettere maiuscole)
 */
export function normalizeProvincia(provincia: string): string {
  return provincia.toUpperCase().trim().slice(0, 2)
}

// ================================================
// FORMATTING FUNCTIONS
// ================================================

/**
 * Formatta indirizzo completo installer
 * Formato: "Via Numero, CAP Comune (PR)"
 */
export function formatFullAddress(installer: Installer): string {
  const parts = [
    installer.via && installer.numero_civico
      ? `${installer.via} ${installer.numero_civico}`
      : installer.via || '',
    installer.cap && installer.comune
      ? `${installer.cap} ${installer.comune}`
      : installer.comune || '',
    installer.provincia ? `(${installer.provincia})` : '',
  ].filter(Boolean)

  return parts.join(', ')
}

/**
 * Formatta display installer per dropdown/autocomplete
 * Include P.IVA se disponibile
 */
export function formatInstallerDisplay(installer: Installer): string {
  if (installer.partita_iva) {
    return `${installer.nome} (P.IVA: ${installer.partita_iva})`
  }
  return installer.nome
}

// ================================================
// COMPLETENESS CHECKS
// ================================================

/**
 * Label user-friendly per i campi
 */
const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  partita_iva: 'Partita IVA',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia',
}

/**
 * Controlla se installer ha tutti i campi obbligatori compilati
 * @returns true se completo
 */
export function isInstallerComplete(installer: Installer): boolean {
  return (
    !!installer.nome &&
    installer.nome.trim().length > 0 &&
    !!installer.partita_iva &&
    installer.partita_iva.trim().length > 0 &&
    !!installer.via &&
    installer.via.trim().length > 0 &&
    !!installer.numero_civico &&
    installer.numero_civico.trim().length > 0 &&
    !!installer.cap &&
    installer.cap.trim().length > 0 &&
    !!installer.comune &&
    installer.comune.trim().length > 0 &&
    !!installer.provincia &&
    installer.provincia.trim().length > 0
  )
}

/**
 * Ritorna array di campi mancanti con label user-friendly
 */
export function getMissingInstallerFields(
  installer: Installer
): Array<{ field: keyof Installer; label: string }> {
  const missing: Array<{ field: keyof Installer; label: string }> = []

  const isEmpty = (value: any) => !value || (typeof value === 'string' && value.trim().length === 0)

  const requiredFields: Array<keyof Installer> = [
    'nome',
    'partita_iva',
    'via',
    'numero_civico',
    'cap',
    'comune',
    'provincia',
  ]

  requiredFields.forEach((field) => {
    if (isEmpty(installer[field])) {
      missing.push({
        field,
        label: FIELD_LABELS[field] || field,
      })
    }
  })

  return missing
}

/**
 * Controlla completezza e ritorna dettagli
 */
export function checkInstallerCompleteness(installer: Installer): InstallerCompleteness {
  const missingFields = getMissingInstallerFields(installer)
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}
