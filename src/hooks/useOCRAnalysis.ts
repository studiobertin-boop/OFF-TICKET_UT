import { useState } from 'react'
import { supabase, SUPABASE_URL } from '@/services/supabase'
import { normalizeEquipment } from '@/utils/equipmentNormalizer'
import type {
  EquipmentType,
  OCRAnalysisRequest,
  OCRAnalysisResponse,
  OCRExtractedData,
  NormalizedField
} from '@/types/ocr'
import type { EquipmentCatalogType } from '@/types'

/**
 * Mappa EquipmentType (OCR) → EquipmentCatalogType (Catalogo)
 * 'valvola' non ha un tipo catalogo (è un componente nested)
 */
const EQUIPMENT_TYPE_MAP: Partial<Record<EquipmentType, EquipmentCatalogType>> = {
  'serbatoio': 'Serbatoi',
  'compressore': 'Compressori',
  'disoleatore': 'Disoleatori',
  'essiccatore': 'Essiccatori',
  'scambiatore': 'Scambiatori',
  'filtro': 'Filtri',
  'separatore': 'Separatori'
  // 'valvola' non mappato - è un componente, non un'apparecchiatura
}

/**
 * Hook per analisi OCR con normalizzazione automatica
 *
 * Features:
 * - Converte immagine in base64
 * - Chiama Edge Function analyze-equipment-nameplate
 * - Normalizza marca/modello contro catalogo
 * - Gestisce stati loading/error
 *
 * @returns Oggetto con funzione analyzeImage e stati
 */
export function useOCRAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  /**
   * Converte File in base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onloadend = () => {
        const result = reader.result as string
        // Rimuovi prefisso "data:image/...;base64,"
        const base64 = result.split(',')[1]
        resolve(base64)
      }

      reader.onerror = () => {
        reject(new Error('Errore lettura file'))
      }

      reader.readAsDataURL(file)
    })
  }

  /**
   * Analizza immagine con OCR + Normalizzazione
   *
   * @param file - File immagine da analizzare
   * @param equipmentType - Tipo apparecchiatura
   * @param equipmentCode - Codice apparecchiatura (es: "S1", "C2")
   * @returns Response OCR con dati normalizzati
   */
  const analyzeImage = async (
    file: File,
    equipmentType: EquipmentType,
    equipmentCode?: string
  ): Promise<OCRAnalysisResponse> => {
    console.log('🔍 Avvio analisi OCR:', { file: file.name, equipmentType, equipmentCode })

    setLoading(true)
    setError(null)
    setProgress(0)

    try {
      // STEP 1: Converte immagine in base64
      setProgress(20)
      const image_base64 = await fileToBase64(file)

      // STEP 2: Chiama Edge Function
      setProgress(40)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Sessione non valida. Effettua il login.')
      }

      const requestBody: OCRAnalysisRequest = {
        image_base64,
        equipment_type: equipmentType,
        equipment_code: equipmentCode
      }

      console.log('📡 Chiamata Edge Function analyze-equipment-nameplate...')

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/analyze-equipment-nameplate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody)
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Edge Function error (${response.status}): ${errorText}`)
      }

      setProgress(70)

      const ocrResult: OCRAnalysisResponse = await response.json()

      if (!ocrResult.success || !ocrResult.data) {
        throw new Error(ocrResult.error || 'OCR fallito senza dati')
      }

      console.log('✅ OCR completato:', ocrResult)

      // STEP 3: Normalizzazione marca/modello
      setProgress(85)
      const normalizedData = await normalizeOCRData(
        ocrResult.data,
        equipmentType
      )

      setProgress(100)

      console.log('✅ Normalizzazione completata')

      return {
        ...ocrResult,
        data: normalizedData
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto'
      console.error('❌ Errore analisi OCR:', errorMessage)
      setError(errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  /**
   * Normalizza marca e modello nei dati OCR
   */
  const normalizeOCRData = async (
    data: OCRExtractedData,
    equipmentType: EquipmentType
  ): Promise<OCRExtractedData> => {
    const catalogType = EQUIPMENT_TYPE_MAP[equipmentType]

    if (!catalogType) {
      console.warn(`Tipo apparecchiatura non mappato: ${equipmentType}`)
      return data
    }

    // Se mancano marca o modello, skippa normalizzazione
    if (!data.marca || !data.modello) {
      console.log('⚠️ Marca o modello mancanti, skip normalizzazione')
      return data
    }

    try {
      console.log('🔄 Normalizzazione marca/modello in corso...')

      const normalized = await normalizeEquipment(
        catalogType,
        data.marca,
        data.modello
      )

      return {
        ...data,
        // Usa valori normalizzati se disponibili
        marca: normalized.marca.normalizedValue,
        modello: normalized.modello.normalizedValue,
        // Aggiungi metadati normalizzazione
        marca_normalized: normalized.marca,
        modello_normalized: normalized.modello
      }
    } catch (err) {
      console.error('⚠️ Errore normalizzazione (non bloccante):', err)
      // In caso di errore, ritorna dati OCR raw
      return data
    }
  }

  /**
   * Batch analysis: analizza più immagini in sequenza
   */
  const analyzeBatch = async (
    items: Array<{
      file: File
      equipmentType: EquipmentType
      equipmentCode?: string
    }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<OCRAnalysisResponse[]> => {
    const results: OCRAnalysisResponse[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      console.log(`📷 Analisi ${i + 1}/${items.length}: ${item.file.name}`)

      if (onProgress) {
        onProgress(i + 1, items.length)
      }

      const result = await analyzeImage(
        item.file,
        item.equipmentType,
        item.equipmentCode
      )

      results.push(result)

      // Piccolo delay tra richieste per evitare rate limiting
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return results
  }

  return {
    analyzeImage,
    analyzeBatch,
    loading,
    error,
    progress
  }
}

/**
 * Helper: Determina se è richiesta conferma utente per normalizzazione
 */
export function requiresNormalizationConfirmation(
  marcaNormalized?: NormalizedField,
  modelloNormalized?: NormalizedField
): boolean {
  if (!marcaNormalized && !modelloNormalized) return false

  const marcaConfidence = marcaNormalized?.confidence || 100
  const modelloConfidence = modelloNormalized?.confidence || 100

  // Richiede conferma se confidence tra 50-80%
  return (
    (marcaConfidence >= 50 && marcaConfidence < 80) ||
    (modelloConfidence >= 50 && modelloConfidence < 80)
  )
}

/**
 * Helper: Formatta messaggio normalizzazione per utente
 */
export function formatNormalizationMessage(
  field: 'marca' | 'modello',
  normalized: NormalizedField
): string {
  if (!normalized.wasNormalized) {
    return `${field}: "${normalized.normalizedValue}"`
  }

  return `${field}: "${normalized.originalValue}" → "${normalized.normalizedValue}" (${normalized.confidence}% match)`
}
