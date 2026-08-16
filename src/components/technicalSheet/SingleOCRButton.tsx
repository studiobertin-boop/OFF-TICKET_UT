import { useState, useRef } from 'react'
import { Alert, IconButton, Snackbar, Tooltip, CircularProgress } from '@mui/material'
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material'
import { useOCRAnalysis } from '@/hooks/useOCRAnalysis'
import type { EquipmentCatalogType } from '@/types'
import type { EquipmentType, OCRExtractedData } from '@/types/ocr'

/**
 * Tetto di dimensione del file da leggere. Il limite vero è quello dell'API del modello (32 MB
 * per documento); qui si sta ampiamente sotto, perché un certificato scansionato che superi i
 * 20 MB è quasi sempre una scansione a risoluzione inutilmente alta.
 */
const MAX_BYTES = 20 * 1024 * 1024

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
  'Separatori': 'separatore',
  'Recipienti filtro': 'serbatoio' // Usa tipo serbatoio per similitudine (recipiente pressurizzato)
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

/**
 * Pulsante di lettura targhetta: prende un file, lo dà all'analisi e restituisce i dati letti.
 *
 * Non decide più che farsene. Chi lo monta — la riga della tabella — è l'unico a sapere di
 * quale apparecchiatura si tratta e a poter ricondurre la lettura a una voce di catalogo:
 * qui si ferma alla lettura.
 */
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

  const [errore, setErrore] = useState<string | null>(null)

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('📸 File selezionato:', file.name, file.type, file.size, 'bytes')

    /**
     * Il file va all'analisi così com'è, PDF compresi: è la funzione a darlo al modello nella
     * forma giusta. Resta solo il limite di dimensione, che qui si intercetta con un messaggio
     * invece di lasciarlo tornare come errore di rete.
     */
    if (file.size > MAX_BYTES) {
      setErrore(`Il file pesa ${(file.size / 1024 / 1024).toFixed(1)} MB: il limite è ${MAX_BYTES / 1024 / 1024} MB.`)
      event.target.value = ''
      return
    }

    const fileToAnalyze = file

    // Se componentType è presente, usa tipo OCR specifico per il componente
    let ocrType: EquipmentType | undefined
    if (componentType === 'valvola_sicurezza') {
      ocrType = 'valvola'
    } else {
      // Mappa tipo catalogo → tipo OCR
      ocrType = CATALOG_TO_OCR_TYPE_MAP[equipmentType]
    }

    const code = generateEquipmentCode(equipmentType, equipmentIndex, parentIndex)

    console.log('📸 Upload foto singola:', { equipmentType, ocrType, code, componentType, file: fileToAnalyze.name })

    const result = await analyzeImage(fileToAnalyze, ocrType, code)

    // Il fallimento va detto: prima restava nella console del browser e la scheda non
    // cambiava, così la rotellina girava e sembrava non fosse successo niente.
    if (!result.success) {
      setErrore(result.error ?? 'Lettura non riuscita')
    }

    // I dati letti escono così come sono: ricondurli a una voce di catalogo — e quindi
    // decidere quale grafia della marca e del modello scrivere in scheda — è compito di chi
    // ha montato il pulsante, che sa di quale apparecchiatura si tratta.
    if (result.success && result.data) {
      onOCRComplete(result.data)
    }

    // Reset input per permettere re-upload stesso file
    event.target.value = ''
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Esito negativo della lettura: senza, la rotellina finisce e non compare nulla. */}
      <Snackbar
        open={errore !== null}
        autoHideDuration={8000}
        onClose={() => setErrore(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrore(null)} sx={{ maxWidth: 520 }}>
          {errore}
        </Alert>
      </Snackbar>

      {/* Camera button */}
      <Tooltip title="Compila da foto o da PDF">
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
    </>
  )
}
