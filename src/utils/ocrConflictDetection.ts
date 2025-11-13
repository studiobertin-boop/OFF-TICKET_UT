import type { EquipmentCatalogType } from '@/types'

/**
 * Risultato verifica conflitto
 */
export interface ConflictResult {
  hasData: boolean
  filledFields: string[]
  fieldValues: Record<string, any>
}

/**
 * Campi da verificare per ciascun tipo di apparecchiatura
 */
const EQUIPMENT_FIELDS: Partial<Record<EquipmentCatalogType, string[]>> = {
  'Serbatoi': ['marca', 'modello', 'n_fabbrica', 'anno', 'volume'],
  'Compressori': ['marca', 'modello', 'n_fabbrica', 'materiale_n', 'anno', 'pressione_max'],
  'Disoleatori': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Essiccatori': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Scambiatori': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Filtri': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Separatori': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Valvole di sicurezza': ['marca', 'modello', 'n_fabbrica', 'anno'],
  'Altro': ['tipo_apparecchio', 'marca', 'modello', 'n_fabbrica', 'anno']
}

/**
 * Verifica se un campo è considerato "riempito"
 */
function isFieldFilled(value: any): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return !isNaN(value)
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.length > 0
  return false
}

/**
 * Verifica se ci sono campi già compilati per un'apparecchiatura
 *
 * @param formData - Dati completi del form (from useFormContext getValues())
 * @param equipmentType - Tipo di apparecchiatura
 * @param index - Indice dell'apparecchiatura (0-based)
 * @param parentIndex - Indice parent per disoleatori/scambiatori (opzionale)
 * @returns ConflictResult con flag hasData e lista campi compilati
 *
 * @example
 * // Form con serbatoio 1 già compilato
 * checkFieldsConflict(formData, 'Serbatoi', 0)
 * → { hasData: true, filledFields: ['marca', 'modello'], fieldValues: {...} }
 */
export function checkFieldsConflict(
  formData: any,
  equipmentType: EquipmentCatalogType,
  index: number,
  parentIndex?: number
): ConflictResult {
  // 1. Ottieni i campi da verificare per questo tipo
  const fieldsToCheck = EQUIPMENT_FIELDS[equipmentType] || []

  // 2. Naviga nel form data fino all'apparecchiatura specifica
  const equipmentData = getEquipmentData(formData, equipmentType, index, parentIndex)

  if (!equipmentData) {
    return {
      hasData: false,
      filledFields: [],
      fieldValues: {}
    }
  }

  // 3. Verifica quali campi sono compilati
  const filledFields: string[] = []
  const fieldValues: Record<string, any> = {}

  for (const field of fieldsToCheck) {
    const value = equipmentData[field]

    if (isFieldFilled(value)) {
      filledFields.push(field)
      fieldValues[field] = value
    }
  }

  return {
    hasData: filledFields.length > 0,
    filledFields,
    fieldValues
  }
}

/**
 * Ottiene i dati di un'apparecchiatura specifica dal form
 */
function getEquipmentData(
  formData: any,
  equipmentType: EquipmentCatalogType,
  index: number,
  parentIndex?: number
): any {
  if (!formData) return null

  const typeLowercase = equipmentType.toLowerCase()

  // Caso 1: Disoleatori (nested in compressori)
  if (equipmentType === 'Disoleatori' && parentIndex !== undefined) {
    const compressori = formData.compressori
    if (!compressori || !Array.isArray(compressori)) return null
    if (parentIndex >= compressori.length) return null

    const compressore = compressori[parentIndex]
    if (!compressore || !compressore.disoleatori) return null

    return compressore.disoleatori[index]
  }

  // Caso 2: Scambiatori (nested in essiccatori)
  if (equipmentType === 'Scambiatori' && parentIndex !== undefined) {
    const essiccatori = formData.essiccatori
    if (!essiccatori || !Array.isArray(essiccatori)) return null
    if (parentIndex >= essiccatori.length) return null

    const essiccatore = essiccatori[parentIndex]
    if (!essiccatore || !essiccatore.scambiatori) return null

    return essiccatore.scambiatori[index]
  }

  // Caso 3: Top-level equipment (serbatoi, compressori, etc.)
  const equipmentArray = formData[typeLowercase]
  if (!equipmentArray || !Array.isArray(equipmentArray)) return null

  return equipmentArray[index]
}

/**
 * Batch check: Verifica conflitti per più apparecchiature
 */
export function batchCheckConflicts(
  formData: any,
  items: Array<{
    equipmentType: EquipmentCatalogType
    index: number
    parentIndex?: number
  }>
): Map<string, ConflictResult> {
  const results = new Map<string, ConflictResult>()

  for (const item of items) {
    const key = getConflictKey(item.equipmentType, item.index, item.parentIndex)
    const conflict = checkFieldsConflict(
      formData,
      item.equipmentType,
      item.index,
      item.parentIndex
    )

    results.set(key, conflict)
  }

  return results
}

/**
 * Genera chiave unica per identificare un conflitto
 */
function getConflictKey(
  equipmentType: EquipmentCatalogType,
  index: number,
  parentIndex?: number
): string {
  if (parentIndex !== undefined) {
    return `${equipmentType}_${parentIndex}_${index}`
  }
  return `${equipmentType}_${index}`
}

/**
 * Formatta lista campi compilati in stringa leggibile
 *
 * @example
 * formatFilledFields(['marca', 'modello', 'anno'])
 * → "Marca, Modello, Anno"
 */
export function formatFilledFields(fields: string[]): string {
  const fieldLabels: Record<string, string> = {
    'marca': 'Marca',
    'modello': 'Modello',
    'n_fabbrica': 'N° Fabbrica',
    'materiale_n': 'Materiale N°',
    'anno': 'Anno',
    'pressione_max': 'Pressione Max',
    'volume': 'Volume',
    'tipo_apparecchio': 'Tipo Apparecchio'
  }

  return fields
    .map(f => fieldLabels[f] || f)
    .join(', ')
}

/**
 * Summary dei conflitti trovati in batch
 */
export function getConflictsSummary(
  conflicts: Map<string, ConflictResult>
): {
  total: number
  withConflicts: number
  conflictPercentage: number
} {
  const total = conflicts.size
  const withConflicts = Array.from(conflicts.values()).filter(c => c.hasData).length
  const conflictPercentage = total > 0 ? Math.round((withConflicts / total) * 100) : 0

  return {
    total,
    withConflicts,
    conflictPercentage
  }
}
