import { useState } from 'react'
import { supabase, SUPABASE_URL } from '@/services/supabase'
import type {
  EquipmentType,
  OCRAnalysisRequest,
  OCRAnalysisResponse
} from '@/types/ocr'

/**
 * Hook per analisi OCR
 *
 * Features:
 * - Converte immagine in base64
 * - Chiama Edge Function analyze-equipment-nameplate
 * - Gestisce stati loading/error
 *
 * Il riconoscimento contro il catalogo (marca/modello) non avviene più qui: è il matcher
 * lato client in `src/utils/equipmentMatcher/` a confrontare il dato letto dalla targhetta
 * con `equipment_catalog`, a valle di questo hook.
 *
 * @returns Oggetto con funzione analyzeImage e stati
 */
export function useOCRAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  /**
   * Converte File in base64 (senza il prefisso `data:...;base64,`)
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
   * Analizza immagine con OCR
   *
   * @param file - File immagine da analizzare
   * @param equipmentType - Tipo apparecchiatura
   * @param equipmentCode - Codice apparecchiatura (es: "S1", "C2")
   * @returns Response OCR con i dati letti dalla targhetta
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
      // STEP 1: Converte il file in base64
      setProgress(20)
      const file_base64 = await fileToBase64(file)

      // STEP 2: Chiama Edge Function
      setProgress(40)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Sessione non valida. Effettua il login.')
      }

      /**
       * Il PDF viaggia come PDF: è la funzione a darlo in pasto al modello nella forma
       * giusta. Convertirlo qui in immagine perdeva il testo del documento e limitava la
       * lettura alla prima pagina — la targhetta può stare sulla seconda.
       */
      const requestBody: OCRAnalysisRequest = {
        file_base64,
        media_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
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

      setProgress(100)

      return ocrResult
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
