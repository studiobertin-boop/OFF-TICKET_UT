import { useState, useRef } from 'react'
import { IconButton, Tooltip, CircularProgress } from '@mui/material'
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material'
import { useOCRAnalysis, requiresNormalizationConfirmation } from '@/hooks/useOCRAnalysis'
import { NormalizationSuggestionDialog } from './NormalizationSuggestionDialog'
import type { EquipmentCatalogType } from '@/types'
import type { EquipmentType, OCRExtractedData, NormalizedField } from '@/types/ocr'

interface SingleOCRButtonProps {
  equipmentType: EquipmentCatalogType
  equipmentIndex: number
  parentIndex?: number
  componentType?: 'valvola_sicurezza' | 'manometro' // Per componenti nested (S1.1)
  onOCRComplete: (data: OCRExtractedData) => void
  disabled?: boolean
}

/**
 * Mappa EquipmentCatalogType → EquipmentType (per OCR)
 * Solo tipi OCR-compatibili
 */
const CATALOG_TO_OCR_TYPE_MAP: Partial<Record<EquipmentCatalogType, EquipmentType>> = {
  'Serbatoi': 'serbatoio',
  'Compressori': 'compressore',
  'Disoleatori': 'disoleatore',
  'Essiccatori': 'essiccatore',
  'Scambiatori': 'scambiatore',
  'Filtri': 'filtro',
  'Separatori': 'separatore'
}

/**
 * Prefissi codice apparecchiatura
 */
const EQUIPMENT_CODE_PREFIX: Partial<Record<EquipmentCatalogType, string>> = {
  'Serbatoi': 'S',
  'Compressori': 'C',
  'Disoleatori': 'D',
  'Essiccatori': 'E',
  'Scambiatori': 'SC',
  'Filtri': 'F',
  'Separatori': 'SEP'
}

/**
 * Genera codice apparecchiatura da tipo e indice
 */
function generateEquipmentCode(
  type: EquipmentCatalogType,
  index: number,
  parentIndex?: number
): string {
  const prefix = EQUIPMENT_CODE_PREFIX[type]

  if (parentIndex !== undefined) {
    // Nested equipment (es: "C1.1")
    return `${EQUIPMENT_CODE_PREFIX['Compressori']}${parentIndex + 1}.${index + 1}`
  }

  return `${prefix}${index + 1}`
}

interface NormalizationDialogData {
  field: 'marca' | 'modello'
  normalizedField: NormalizedField
  extractedData: OCRExtractedData
}

export const SingleOCRButton = ({
  equipmentType,
  equipmentIndex,
  parentIndex,
  componentType,
  onOCRComplete,
  disabled = false
}: SingleOCRButtonProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { analyzeImage, loading } = useOCRAnalysis()

  const [showNormalizationDialog, setShowNormalizationDialog] = useState(false)
  const [normalizationData, setNormalizationData] = useState<NormalizationDialogData | null>(null)

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Se componentType è presente, usa tipo OCR specifico per il componente
    let ocrType: EquipmentType | undefined
    if (componentType === 'valvola_sicurezza') {
      ocrType = 'valvola'
    } else {
      // Mappa tipo catalogo → tipo OCR
      ocrType = CATALOG_TO_OCR_TYPE_MAP[equipmentType]
    }

    const code = generateEquipmentCode(equipmentType, equipmentIndex, parentIndex)

    console.log('📸 Upload foto singola:', { equipmentType, ocrType, code, componentType, file: file.name })

    const result = await analyzeImage(file, ocrType, code)

    if (result.success && result.data) {
      const { marca_normalized, modello_normalized } = result.data

      // Check se richiede conferma normalizzazione
      if (requiresNormalizationConfirmation(marca_normalized, modello_normalized)) {
        console.log('⚠️ Normalizzazione richiede conferma utente')

        // Mostra dialog per il campo con confidence più bassa
        const marcaConf = marca_normalized?.confidence || 100
        const modelloConf = modello_normalized?.confidence || 100

        const fieldToConfirm = marcaConf < modelloConf ? 'marca' : 'modello'
        const normalizedField = fieldToConfirm === 'marca' ? marca_normalized : modello_normalized

        if (normalizedField) {
          setNormalizationData({
            field: fieldToConfirm,
            normalizedField,
            extractedData: result.data
          })
          setShowNormalizationDialog(true)
        }
      } else {
        // Auto-apply: confidence >= 80% o no normalizzazione
        console.log('✅ Normalizzazione auto-applicata (confidence >= 80%)')
        onOCRComplete(result.data)
      }
    }

    // Reset input per permettere re-upload stesso file
    event.target.value = ''
  }

  const handleNormalizationConfirm = (useNormalized: boolean, selectedValue?: string) => {
    if (!normalizationData) return

    const { field, extractedData } = normalizationData

    let finalData = { ...extractedData }

    if (useNormalized && selectedValue) {
      // Usa valore selezionato dalle alternative
      finalData[field] = selectedValue
    } else if (!useNormalized) {
      // Mantieni valore OCR raw (rimuovi normalizzazione)
      const normalizedField = extractedData[`${field}_normalized`] as NormalizedField | undefined
      if (normalizedField) {
        finalData[field] = normalizedField.originalValue
      }
    }

    console.log('✅ Normalizzazione confermata:', { field, useNormalized, finalData })

    onOCRComplete(finalData)
    setShowNormalizationDialog(false)
    setNormalizationData(null)
  }

  const handleNormalizationCancel = () => {
    console.log('❌ Normalizzazione annullata')
    setShowNormalizationDialog(false)
    setNormalizationData(null)
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Camera button */}
      <Tooltip title="Compila da foto">
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled || loading}
            size="small"
            color="primary"
            aria-label="Compila da foto"
          >
            {loading ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Dialog normalizzazione */}
      {showNormalizationDialog && normalizationData && (
        <NormalizationSuggestionDialog
          open={showNormalizationDialog}
          fieldName={normalizationData.field === 'marca' ? 'Marca' : 'Modello'}
          ocrValue={normalizationData.normalizedField.originalValue}
          suggestedValue={normalizationData.normalizedField.normalizedValue}
          confidence={normalizationData.normalizedField.confidence}
          alternatives={normalizationData.normalizedField.alternatives}
          onConfirm={handleNormalizationConfirm}
          onCancel={handleNormalizationCancel}
        />
      )}
    </>
  )
}
