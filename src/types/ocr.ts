/**
 * Types per OCR e Photo Upload - PASSO 3
 * Integrazione GPT-4o Vision per riconoscimento targhette
 */

// ============================================================================
// EQUIPMENT TYPES
// ============================================================================

export type EquipmentType =
  | 'serbatoio'
  | 'compressore'
  | 'disoleatore'
  | 'essiccatore'
  | 'scambiatore'
  | 'filtro'
  | 'separatore'
  | 'valvola' // Solo valvola di sicurezza

// ============================================================================
// OCR REQUEST/RESPONSE
// ============================================================================

export interface OCRAnalysisRequest {
  image_base64: string
  equipment_type: EquipmentType
  equipment_code?: string // Es: "S1", "C2", etc.
}

export interface OCRAnalysisResponse {
  success: boolean
  data?: OCRExtractedData
  error?: string
  confidence_score?: number // 0-100
  fuzzy_matches?: FuzzyMatch[]
}

// ============================================================================
// NORMALIZED FIELDS
// ============================================================================

export interface NormalizedField {
  originalValue: string
  normalizedValue: string
  wasNormalized: boolean
  confidence: number
  source: 'exact_match' | 'fuzzy_match' | 'no_match'
  alternatives?: FuzzyMatch[]
}

// ============================================================================
// EXTRACTED DATA
// ============================================================================

export interface OCRExtractedData {
  // Campi comuni
  marca?: string
  modello?: string
  n_fabbrica?: string
  anno?: number

  // Campi specifici per tipo
  pressione_max?: number // bar
  volume?: number // litri
  materiale_n?: string // Solo compressori
  diametro_pressione?: string // Solo valvole (quando tipo OCR = 'valvola')

  // Valvola di sicurezza (per serbatoi e disoleatori)
  valvola_sicurezza?: {
    marca?: string
    modello?: string
    n_fabbrica?: string
    diametro_pressione?: string // Es: "1/2\" 13bar"
  }

  // Manometro (per serbatoi)
  manometro?: {
    fondo_scala?: number
    segno_rosso?: number
  }

  // Raw text estratto (per debugging)
  raw_text?: string

  // Confidence per campo
  field_confidence?: Record<string, number>

  // Normalizzazione marca/modello
  marca_normalized?: NormalizedField
  modello_normalized?: NormalizedField
}

// ============================================================================
// FUZZY MATCHING
// ============================================================================

export interface FuzzyMatch {
  equipment_type: string
  marca: string
  modello: string
  similarity_score: number // 0-1
  usage_count: number
  last_used?: string
}

// ============================================================================
// PHOTO UPLOAD
// ============================================================================

export interface UploadedPhoto {
  id: string
  file: File
  preview_url: string
  equipment_type: EquipmentType
  equipment_code?: string
  uploaded_at: Date
  ocr_status: 'pending' | 'processing' | 'completed' | 'error'
  ocr_result?: OCRExtractedData
  error_message?: string
  // PDF support
  is_pdf_page?: boolean
  pdf_page_number?: number
  pdf_total_pages?: number
  pdf_original_name?: string
  // Base64 data (per PDF già convertiti, evita riconversione)
  base64Data?: string
}

export interface PhotoUploadState {
  photos: UploadedPhoto[]
  uploading: boolean
  analyzing: boolean
  current_analyzing?: string // photo id
}

// ============================================================================
// OCR REVIEW DIALOG
// ============================================================================

export interface OCRReviewData {
  photo: UploadedPhoto
  extracted_data: OCRExtractedData
  fuzzy_matches: FuzzyMatch[]
  equipment_type: EquipmentType
  equipment_code?: string
}

// ============================================================================
// BATCH OCR
// ============================================================================

export interface BatchOCRItem {
  id: string
  file: File
  filename: string
  preview: string
  parsedType: string | null // EquipmentCatalogType
  parsedIndex: number
  parsedParentIndex?: number
  parsedComponentType?: 'valvola_sicurezza' | 'manometro' // Per componenti nested (S1.1)
  status: 'pending' | 'processing' | 'completed' | 'error' | 'conflict'
  error?: string
  result?: OCRAnalysisResponse
  normalizedMarca?: NormalizedField
  normalizedModello?: NormalizedField
  hasConflict?: boolean
  conflictFields?: string[]
  // PDF support
  isPdfPage?: boolean
  pdfPageNumber?: number
  pdfTotalPages?: number
  pdfOriginalName?: string
}

export interface BatchOCRResult {
  total: number
  completed: number
  errors: number
  skipped: number
  conflicts: number
  normalized: number // Quanti marca/modello sono stati normalizzati
}
