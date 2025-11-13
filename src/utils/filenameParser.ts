import type { EquipmentCatalogType } from '@/types'

/**
 * Risultato parsing filename
 */
export interface ParsedFilename {
  equipmentType: EquipmentCatalogType | null
  index: number // Index 0-based dell'apparecchiatura
  parentIndex?: number // Per disoleatori/scambiatori (opzionale)
  isValid: boolean
  error?: string
  rawPrefix: string // Es: "S1", "C2.1", "E1.1"
}

/**
 * Mappatura prefissi filename → tipo apparecchiatura
 *
 * Naming Convention:
 * - S1, S2, S3 → Serbatoi
 * - C1, C2 → Compressori
 * - C1.1, C2.1 → Disoleatori (del compressore N)
 * - E1, E2 → Essiccatori
 * - E1.1, E2.1 → Scambiatori (dell'essiccatore N)
 * - F1, F2 → Filtri
 * - SEP1, SEP2 → Separatori
 */
const FILENAME_PREFIX_MAP: Record<string, EquipmentCatalogType> = {
  'S': 'Serbatoi',
  'C': 'Compressori',
  'E': 'Essiccatori',
  'F': 'Filtri',
  'SEP': 'Separatori'
}

/**
 * Parse filename per estrarre tipo apparecchiatura e indice
 *
 * Supporta:
 * - Formato base: S1, C2, E3, F1, SEP1
 * - Formato annidato: C1.1, E2.1 (disoleatori/scambiatori)
 *
 * @param filename - Nome file (con o senza estensione)
 * @returns Oggetto ParsedFilename con tipo, indice e validità
 *
 * @example
 * parseEquipmentFilename("S1.jpg") → { equipmentType: 'Serbatoi', index: 0, isValid: true }
 * parseEquipmentFilename("C2.1.png") → { equipmentType: 'Disoleatori', index: 0, parentIndex: 1, isValid: true }
 * parseEquipmentFilename("E1.1") → { equipmentType: 'Scambiatori', index: 0, parentIndex: 0, isValid: true }
 * parseEquipmentFilename("SEP3.jpg") → { equipmentType: 'Separatori', index: 2, isValid: true }
 */
export function parseEquipmentFilename(filename: string): ParsedFilename {
  // Rimuovi estensione
  const baseName = filename.replace(/\.[^.]+$/, '').trim().toUpperCase()

  if (!baseName) {
    return {
      equipmentType: null,
      index: -1,
      isValid: false,
      error: 'Filename vuoto',
      rawPrefix: ''
    }
  }

  // Pattern regex per matching
  // Cattura: PREFIX, NUMERO, (opzionale .NUMERO_SECONDARIO)
  const match = baseName.match(/^([A-Z]+)(\d+)(?:\.(\d+))?$/)

  if (!match) {
    return {
      equipmentType: null,
      index: -1,
      isValid: false,
      error: `Formato non valido: "${baseName}". Usa formato S1, C2, C1.1, E2, E1.1, F1, SEP1, etc.`,
      rawPrefix: baseName
    }
  }

  const [, prefix, primaryNum, secondaryNum] = match
  const primaryIndex = parseInt(primaryNum, 10) - 1 // Convert to 0-based
  const secondaryIndex = secondaryNum ? parseInt(secondaryNum, 10) - 1 : undefined

  // Caso 1: Formato annidato (C1.1, E2.1)
  if (secondaryIndex !== undefined) {
    return parseNestedFormat(prefix, primaryIndex, secondaryIndex, baseName)
  }

  // Caso 2: Formato base (S1, C2, E3, F1, SEP1)
  const equipmentType = FILENAME_PREFIX_MAP[prefix]

  if (!equipmentType) {
    return {
      equipmentType: null,
      index: -1,
      isValid: false,
      error: `Prefisso sconosciuto: "${prefix}". Prefissi validi: S, C, E, F, SEP`,
      rawPrefix: baseName
    }
  }

  return {
    equipmentType,
    index: primaryIndex,
    isValid: true,
    rawPrefix: baseName
  }
}

/**
 * Parse formato annidato (C1.1 = Disoleatore compressore 1, E2.1 = Scambiatore essiccatore 2)
 */
function parseNestedFormat(
  prefix: string,
  parentIndex: number,
  childIndex: number,
  rawPrefix: string
): ParsedFilename {
  // C1.1 → Disoleatore del compressore 1
  if (prefix === 'C') {
    return {
      equipmentType: 'Disoleatori',
      index: childIndex,
      parentIndex: parentIndex,
      isValid: true,
      rawPrefix
    }
  }

  // E1.1 → Scambiatore dell'essiccatore 1
  if (prefix === 'E') {
    return {
      equipmentType: 'Scambiatori',
      index: childIndex,
      parentIndex: parentIndex,
      isValid: true,
      rawPrefix
    }
  }

  // Altri prefissi non supportano formato annidato
  return {
    equipmentType: null,
    index: -1,
    isValid: false,
    error: `Il prefisso "${prefix}" non supporta formato annidato (es: ${prefix}${parentIndex + 1}.${childIndex + 1})`,
    rawPrefix
  }
}

/**
 * Valida batch di filename e ritorna summary
 */
export function validateFilenames(filenames: string[]): {
  valid: ParsedFilename[]
  invalid: ParsedFilename[]
  summary: string
} {
  const results = filenames.map(parseEquipmentFilename)
  const valid = results.filter(r => r.isValid)
  const invalid = results.filter(r => !r.isValid)

  const summary = `${valid.length}/${filenames.length} file validi, ${invalid.length} invalidi`

  return { valid, invalid, summary }
}

/**
 * Genera path del form basato su tipo e indice
 *
 * @example
 * getFormPath('Serbatoi', 0) → 'serbatoi[0]'
 * getFormPath('Disoleatori', 1, 0) → 'compressori[0].disoleatori[1]'
 */
export function getFormPath(
  equipmentType: EquipmentCatalogType,
  index: number,
  parentIndex?: number
): string {
  // Lowercase tipo per form path
  const basePath = equipmentType.toLowerCase()

  // Disoleatori e Scambiatori sono nested
  if (equipmentType === 'Disoleatori' && parentIndex !== undefined) {
    return `compressori[${parentIndex}].disoleatori[${index}]`
  }

  if (equipmentType === 'Scambiatori' && parentIndex !== undefined) {
    return `essiccatori[${parentIndex}].scambiatori[${index}]`
  }

  // Altri tipi sono top-level
  return `${basePath}[${index}]`
}

/**
 * Formatta ParsedFilename in stringa leggibile
 *
 * @example
 * formatParsedFilename({ equipmentType: 'Serbatoi', index: 0 }) → "Serbatoio #1"
 * formatParsedFilename({ equipmentType: 'Disoleatori', index: 1, parentIndex: 0 }) → "Disoleatore #2 (Compressore #1)"
 */
export function formatParsedFilename(parsed: ParsedFilename): string {
  if (!parsed.isValid || !parsed.equipmentType) {
    return 'Tipo sconosciuto'
  }

  const singularType = parsed.equipmentType.slice(0, -1) // Rimuovi 's' finale
  const displayIndex = parsed.index + 1 // Convert to 1-based

  if (parsed.parentIndex !== undefined) {
    const parentType = parsed.equipmentType === 'Disoleatori' ? 'Compressore' : 'Essiccatore'
    const parentDisplayIndex = parsed.parentIndex + 1

    return `${singularType} #${displayIndex} (${parentType} #${parentDisplayIndex})`
  }

  return `${singularType} #${displayIndex}`
}
