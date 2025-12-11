/**
 * CIVA Validation Logic
 *
 * Valida completezza dati necessari per caricamento CIVA
 */

import type { Customer, Installer, Manufacturer } from '@/types'
import type { CIVACompletenessCheck, MissingField, IncompleteManufacturer, CIVAApparecchio } from '@/types/civa'

/**
 * Field labels per messaggi utente
 */
const CUSTOMER_FIELD_LABELS: Record<string, string> = {
  ragione_sociale: 'Ragione Sociale',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia',
  telefono: 'Telefono',
  pec: 'PEC'
}

const INSTALLER_FIELD_LABELS: Record<string, string> = {
  nome: 'Nome/Ragione Sociale',
  partita_iva: 'Partita IVA',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia'
}

const MANUFACTURER_FIELD_LABELS: Record<string, string> = {
  nome: 'Nome',
  partita_iva: 'Partita IVA',
  telefono: 'Telefono',
  via: 'Via',
  numero_civico: 'Numero Civico',
  cap: 'CAP',
  comune: 'Comune',
  provincia: 'Provincia',
  paese: 'Paese'
}

/**
 * Valida customer per CIVA
 *
 * Required: ragione_sociale, via, numero_civico, cap, comune, provincia
 * Optional: telefono, pec
 */
export function validateCustomerForCIVA(customer: Customer | null): {
  isComplete: boolean
  missingFields: MissingField[]
} {
  const missingFields: MissingField[] = []

  if (!customer) {
    return {
      isComplete: false,
      missingFields: [{ field: 'customer', label: 'Cliente non trovato' }]
    }
  }

  // Required fields
  const requiredFields: Array<keyof Customer> = [
    'ragione_sociale',
    'via',
    'numero_civico',
    'cap',
    'comune',
    'provincia'
  ]

  for (const field of requiredFields) {
    const value = customer[field]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push({
        field,
        label: CUSTOMER_FIELD_LABELS[field] || field
      })
    }
  }

  // Optional fields (telefono, pec) - non causano incompletezza
  // ma potrebbero essere mostrati come warning

  return {
    isComplete: missingFields.length === 0,
    missingFields
  }
}

/**
 * Valida installer per CIVA
 *
 * All fields required (Italian only, no foreign option)
 */
export function validateInstallerForCIVA(installer: Installer | null): {
  isComplete: boolean
  missingFields: MissingField[]
} {
  const missingFields: MissingField[] = []

  if (!installer) {
    return {
      isComplete: false,
      missingFields: [{ field: 'installer', label: 'Installatore non trovato' }]
    }
  }

  // All fields required
  const requiredFields: Array<keyof Installer> = [
    'nome',
    'partita_iva',
    'via',
    'numero_civico',
    'cap',
    'comune',
    'provincia'
  ]

  for (const field of requiredFields) {
    const value = installer[field]
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push({
        field,
        label: INSTALLER_FIELD_LABELS[field] || field
      })
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields
  }
}

/**
 * Valida manufacturer per CIVA
 *
 * Italian: partita_iva, nome, via, numero_civico, cap, comune, provincia, telefono required
 * Foreign: nome, paese required
 */
export function validateManufacturerForCIVA(manufacturer: Manufacturer): {
  isComplete: boolean
  missingFields: MissingField[]
} {
  const missingFields: MissingField[] = []

  // Foreign manufacturer
  if (manufacturer.is_estero) {
    // Required: nome, paese
    if (!manufacturer.nome || manufacturer.nome.trim() === '') {
      missingFields.push({
        field: 'nome',
        label: MANUFACTURER_FIELD_LABELS['nome']
      })
    }
    if (!manufacturer.paese || manufacturer.paese.trim() === '') {
      missingFields.push({
        field: 'paese',
        label: MANUFACTURER_FIELD_LABELS['paese']
      })
    }
  } else {
    // Italian manufacturer - all fields required
    const requiredFields: Array<keyof Manufacturer> = [
      'nome',
      'partita_iva',
      'telefono',
      'via',
      'numero_civico',
      'cap',
      'comune',
      'provincia'
    ]

    for (const field of requiredFields) {
      const value = manufacturer[field]
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push({
          field,
          label: MANUFACTURER_FIELD_LABELS[field] || field
        })
      }
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields
  }
}

/**
 * Check completezza completa per visualizzazione CIVA
 *
 * Valida customer, installer, e tutti i manufacturers delle apparecchiature CIVA-eligible
 */
export function checkCIVACompleteness(
  customer: Customer | null,
  installer: Installer | null,
  apparecchiCIVA: CIVAApparecchio[]
): CIVACompletenessCheck {
  // Valida customer
  const customerValidation = validateCustomerForCIVA(customer)

  // Valida installer
  const installerValidation = validateInstallerForCIVA(installer)

  // Valida manufacturers per ogni apparecchiatura CIVA
  const incompleteManufacturers: IncompleteManufacturer[] = []
  const checkedManufacturers = new Set<string>()

  for (const apparecchio of apparecchiCIVA) {
    const manufacturerKey = apparecchio.manufacturer.id

    // Skip se già controllato questo manufacturer
    if (checkedManufacturers.has(manufacturerKey)) {
      continue
    }
    checkedManufacturers.add(manufacturerKey)

    const manufacturerValidation = validateManufacturerForCIVA(apparecchio.manufacturer)

    if (!manufacturerValidation.isComplete) {
      incompleteManufacturers.push({
        codice: apparecchio.codice,
        marca: apparecchio.marca,
        missingFields: manufacturerValidation.missingFields
      })
    }
  }

  const manufacturersComplete = incompleteManufacturers.length === 0
  const isComplete = customerValidation.isComplete && installerValidation.isComplete && manufacturersComplete

  return {
    isComplete,
    customerComplete: customerValidation.isComplete,
    installerComplete: installerValidation.isComplete,
    manufacturersComplete,
    missingCustomerFields: customerValidation.missingFields,
    missingInstallerFields: installerValidation.missingFields,
    incompleteManufacturers
  }
}

/**
 * Formatta messaggio di errore per dati incompleti
 * Utile per alert/dialog
 */
export function formatMissingFieldsMessage(check: CIVACompletenessCheck): string {
  const lines: string[] = []

  if (!check.customerComplete) {
    lines.push('CLIENTE:')
    check.missingCustomerFields.forEach(f => lines.push(`  - ${f.label}`))
  }

  if (!check.installerComplete) {
    lines.push('')
    lines.push('INSTALLATORE:')
    check.missingInstallerFields.forEach(f => lines.push(`  - ${f.label}`))
  }

  if (!check.manufacturersComplete) {
    lines.push('')
    lines.push('COSTRUTTORI:')
    check.incompleteManufacturers.forEach(m => {
      lines.push(`  ${m.marca} (${m.codice}):`)
      m.missingFields.forEach(f => lines.push(`    - ${f.label}`))
    })
  }

  return lines.join('\n')
}
