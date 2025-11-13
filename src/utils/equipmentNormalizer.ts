import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { EquipmentCatalogType, FuzzyMatch } from '@/types'

/**
 * Risultato normalizzazione marca/modello
 */
export interface NormalizedField {
  originalValue: string
  normalizedValue: string
  wasNormalized: boolean
  confidence: number
  source: 'exact_match' | 'fuzzy_match' | 'no_match'
  alternatives?: FuzzyMatch[]
}

/**
 * Risultato completo normalizzazione apparecchiatura
 */
export interface NormalizedEquipment {
  marca: NormalizedField
  modello: NormalizedField
  overallConfidence: number
}

/**
 * Normalizza marca e modello contro il catalogo apparecchiature
 *
 * Logica:
 * 1. Cerca match esatto nel catalogo
 * 2. Se non trovato, usa fuzzy matching
 * 3. Calcola confidence score basato su similarity
 * 4. Ritorna valore normalizzato e metadati
 *
 * @param equipmentType - Tipo apparecchiatura
 * @param rawMarca - Marca estratta da OCR (raw)
 * @param rawModello - Modello estratto da OCR (raw)
 * @returns Oggetto con marca e modello normalizzati
 */
export async function normalizeEquipment(
  equipmentType: EquipmentCatalogType,
  rawMarca: string,
  rawModello: string
): Promise<NormalizedEquipment> {
  console.log('🔍 Normalizzazione apparecchiatura:', {
    type: equipmentType,
    rawMarca,
    rawModello
  })

  // 1. Normalizza marca
  const marcaResult = await normalizeMarca(equipmentType, rawMarca)

  // 2. Normalizza modello (usa marca normalizzata per filtro)
  const modelloResult = await normalizeModello(
    equipmentType,
    marcaResult.normalizedValue,
    rawModello
  )

  // 3. Calcola confidence globale
  const overallConfidence = Math.min(
    marcaResult.confidence,
    modelloResult.confidence
  )

  console.log('✅ Normalizzazione completata:', {
    marca: `"${rawMarca}" → "${marcaResult.normalizedValue}"`,
    modello: `"${rawModello}" → "${modelloResult.normalizedValue}"`,
    confidence: overallConfidence
  })

  return {
    marca: marcaResult,
    modello: modelloResult,
    overallConfidence
  }
}

/**
 * Normalizza solo la marca
 */
async function normalizeMarca(
  equipmentType: EquipmentCatalogType,
  rawMarca: string
): Promise<NormalizedField> {
  // Cleanup valore raw
  const cleanedMarca = cleanString(rawMarca)

  if (!cleanedMarca) {
    return {
      originalValue: rawMarca,
      normalizedValue: rawMarca,
      wasNormalized: false,
      confidence: 0,
      source: 'no_match'
    }
  }

  // 1. Ottieni tutte le marche per questo tipo
  const marcheOptions = await equipmentCatalogApi.getMarcheByTipo(equipmentType)

  // 2. Cerca match esatto (case-insensitive)
  const exactMatch = marcheOptions.find(
    m => m.toLowerCase() === cleanedMarca.toLowerCase()
  )

  if (exactMatch) {
    return {
      originalValue: rawMarca,
      normalizedValue: exactMatch,
      wasNormalized: rawMarca !== exactMatch,
      confidence: 100,
      source: 'exact_match'
    }
  }

  // 3. Fuzzy matching
  const fuzzyResults = await equipmentCatalogApi.searchFuzzy(
    cleanedMarca,
    equipmentType,
    5
  )

  if (fuzzyResults.length > 0 && fuzzyResults[0].similarity >= 0.5) {
    const bestMatch = fuzzyResults[0]

    return {
      originalValue: rawMarca,
      normalizedValue: bestMatch.marca,
      wasNormalized: true,
      confidence: Math.round(bestMatch.similarity * 100),
      source: 'fuzzy_match',
      alternatives: fuzzyResults.slice(0, 3) // Top 3 alternative
    }
  }

  // 4. Nessun match trovato
  return {
    originalValue: rawMarca,
    normalizedValue: cleanedMarca,
    wasNormalized: rawMarca !== cleanedMarca,
    confidence: 0,
    source: 'no_match'
  }
}

/**
 * Normalizza solo il modello (richiede marca già normalizzata)
 */
async function normalizeModello(
  equipmentType: EquipmentCatalogType,
  normalizedMarca: string,
  rawModello: string
): Promise<NormalizedField> {
  // Cleanup valore raw
  const cleanedModello = cleanString(rawModello)

  if (!cleanedModello) {
    return {
      originalValue: rawModello,
      normalizedValue: rawModello,
      wasNormalized: false,
      confidence: 0,
      source: 'no_match'
    }
  }

  // 1. Ottieni modelli per tipo+marca
  const modelliOptions = await equipmentCatalogApi.getModelliByTipoMarca(
    equipmentType,
    normalizedMarca
  )

  // 2. Cerca match esatto (case-insensitive)
  const exactMatch = modelliOptions.find(
    m => m.toLowerCase() === cleanedModello.toLowerCase()
  )

  if (exactMatch) {
    return {
      originalValue: rawModello,
      normalizedValue: exactMatch,
      wasNormalized: rawModello !== exactMatch,
      confidence: 100,
      source: 'exact_match'
    }
  }

  // 3. Fuzzy matching con filtro tipo+marca
  const searchTerm = `${normalizedMarca} ${cleanedModello}`
  const fuzzyResults = await equipmentCatalogApi.searchFuzzy(
    searchTerm,
    equipmentType,
    5
  )

  // Filtra solo risultati con marca corretta
  const matchingMarca = fuzzyResults.filter(
    r => r.marca.toLowerCase() === normalizedMarca.toLowerCase()
  )

  if (matchingMarca.length > 0 && matchingMarca[0].similarity >= 0.5) {
    const bestMatch = matchingMarca[0]

    return {
      originalValue: rawModello,
      normalizedValue: bestMatch.modello,
      wasNormalized: true,
      confidence: Math.round(bestMatch.similarity * 100),
      source: 'fuzzy_match',
      alternatives: matchingMarca.slice(0, 3).map(m => ({
        ...m,
        // Highlight del modello nelle alternative
        description: m.modello
      }))
    }
  }

  // 4. Nessun match trovato
  return {
    originalValue: rawModello,
    normalizedValue: cleanedModello,
    wasNormalized: rawModello !== cleanedModello,
    confidence: 0,
    source: 'no_match'
  }
}

/**
 * Pulizia stringa OCR:
 * - Trim whitespace
 * - Normalizza spazi multipli
 * - Fix encoding comuni
 */
function cleanString(value: string): string {
  if (!value) return ''

  return value
    .trim()
    .replace(/\s+/g, ' ') // Spazi multipli → singolo
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Rimuovi zero-width chars
}

/**
 * Determina se la normalizzazione richiede conferma utente
 *
 * @param confidence - Score di confidenza (0-100)
 * @returns true se richiede conferma manuale
 */
export function requiresUserConfirmation(confidence: number): boolean {
  // Auto-apply se confidence > 80%
  // Chiedi conferma se 50-80%
  // Ignora se < 50%
  return confidence >= 50 && confidence < 80
}

/**
 * Determina se applicare automaticamente la normalizzazione
 */
export function shouldAutoNormalize(confidence: number): boolean {
  return confidence >= 80
}
