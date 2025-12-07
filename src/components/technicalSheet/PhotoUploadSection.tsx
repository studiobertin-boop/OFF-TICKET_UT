import { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AutoFixHigh as AnalyzeIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'
import type { UploadedPhoto, EquipmentType, OCRExtractedData, FuzzyMatch } from '@/types'
import { convertPDFToImages, isPDFFile, convertImageToPNG } from '@/utils/pdfToImage'

interface PhotoUploadSectionProps {
  onPhotoAnalyzed: (
    photo: UploadedPhoto,
    extractedData: OCRExtractedData,
    fuzzyMatches: FuzzyMatch[]
  ) => void
  disabled?: boolean
}

/**
 * Componente per upload foto targhette e analisi OCR
 * PASSO 3: Integrazione GPT-4o Vision
 */
export const PhotoUploadSection = ({
  onPhotoAnalyzed,
  disabled = false
}: PhotoUploadSectionProps) => {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')

  // Equipment type options
  const equipmentTypes: { value: EquipmentType; label: string }[] = [
    { value: 'serbatoio', label: 'Serbatoio' },
    { value: 'compressore', label: 'Compressore' },
    { value: 'disoleatore', label: 'Disoleatore' },
    { value: 'essiccatore', label: 'Essiccatore' },
    { value: 'scambiatore', label: 'Scambiatore' },
    { value: 'filtro', label: 'Filtro' },
    { value: 'separatore', label: 'Separatore' },
  ]

  /**
   * Handle file selection (supporta immagini e PDF)
   */
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    console.log('🚀🚀🚀 INIZIO handleFileSelect - FILES:', files.length)

    setUploading(true)
    setUploadStatus('Elaborazione file in corso...')

    const newPhotos: UploadedPhoto[] = []

    for (let index = 0; index < files.length; index++) {
      const file = files[index]

      try {
        // DEBUG: Log file info BEFORE any check
        console.log(`🔍 DEBUG File caricato:`, {
          name: file.name,
          type: file.type,
          size: file.size,
          endsWithPdf: file.name.toLowerCase().endsWith('.pdf'),
          isPDF: isPDFFile(file)
        })

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} è troppo grande (max 10MB)`)
          continue
        }

        // Se è un PDF, convertilo in immagini
        if (isPDFFile(file)) {
          console.log(`📄 Rilevato PDF: ${file.name}, size: ${file.size} bytes`)
          setUploadStatus(`Conversione PDF ${file.name} in corso...`)

          try {
            // Usa scale 1.5 invece di 2.0 per ridurre dimensioni PNG (fix errore 500)
            const result = await convertPDFToImages(file, 1.5, 10)

            console.log(`✅ PDF convertito: ${result.pages.length} pagine`)

            // Crea un UploadedPhoto per ogni pagina
            result.pages.forEach((page, pageIndex) => {
              // Crea un File dall'immagine blob per compatibilità con OCR
              const imageFile = new File(
                [page.blob],
                `${file.name.replace('.pdf', '')}_page${page.pageNumber}.png`,
                { type: 'image/png' }
              )

              console.log(`📸 Pagina ${page.pageNumber}: ${imageFile.size} bytes (${(imageFile.size / 1024 / 1024).toFixed(2)} MB), type: ${imageFile.type}`)
              console.log(`📸 DataURL già disponibile (base64): ${page.dataUrl.substring(0, 50)}...`)

              // Validazione dimensione file PNG generato
              if (imageFile.size > 10 * 1024 * 1024) {
                console.warn(`⚠️ ATTENZIONE: Pagina ${page.pageNumber} è troppo grande (${(imageFile.size / 1024 / 1024).toFixed(2)} MB > 10 MB)`)
                alert(`Pagina ${page.pageNumber} del PDF è troppo grande (${(imageFile.size / 1024 / 1024).toFixed(2)} MB). Usa un PDF con risoluzione inferiore.`)
                return // Skip questa pagina
              }

              const photo: UploadedPhoto = {
                id: `${Date.now()}-${index}-${pageIndex}`,
                file: imageFile,
                preview_url: page.dataUrl,
                // IMPORTANTE: Salva il dataUrl base64 per usarlo direttamente nell'OCR
                base64Data: page.dataUrl,
                equipment_type: 'serbatoio', // Default
                uploaded_at: new Date(),
                ocr_status: 'pending',
                is_pdf_page: true,
                pdf_page_number: page.pageNumber,
                pdf_total_pages: result.totalPages,
                pdf_original_name: result.fileName
              }

              newPhotos.push(photo)
            })

            console.log(`✅ Totale foto create da PDF: ${result.pages.length}`)
          } catch (pdfError) {
            console.error(`❌ Errore conversione PDF ${file.name}:`, pdfError)
            throw pdfError
          }
        } else {
          // Validate file type (deve essere immagine)
          if (!file.type.startsWith('image/')) {
            alert(`File ${file.name} non è un'immagine o PDF valido`)
            continue
          }

          console.log(`🖼️ Rilevata immagine: ${file.name}, type: ${file.type}, size: ${file.size} bytes`)

          // Converti SEMPRE in PNG per compatibilità OpenAI
          setUploadStatus(`Conversione ${file.name} in PNG...`)
          const pngFile = await convertImageToPNG(file)

          console.log(`✅ Immagine convertita in PNG: ${pngFile.name}, type: ${pngFile.type}, size: ${pngFile.size} bytes`)

          // Create preview URL (usa file originale per preview più veloce)
          const preview_url = URL.createObjectURL(pngFile)

          // Create photo object con file PNG
          const photo: UploadedPhoto = {
            id: `${Date.now()}-${index}`,
            file: pngFile,  // Usa il file PNG convertito
            preview_url,
            equipment_type: 'serbatoio', // Default
            uploaded_at: new Date(),
            ocr_status: 'pending'
          }

          newPhotos.push(photo)
        }
      } catch (error) {
        console.error(`Errore elaborazione file ${file.name}:`, error)
        alert(`Errore elaborazione file ${file.name}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
      }
    }

    setPhotos(prev => [...prev, ...newPhotos])
    setUploading(false)
    setUploadStatus('')

    // Reset input
    event.target.value = ''
  }, [])

  /**
   * Remove photo
   */
  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId)
      if (photo) {
        URL.revokeObjectURL(photo.preview_url)
      }
      return prev.filter(p => p.id !== photoId)
    })
  }, [])

  /**
   * Update equipment type for photo
   */
  const handleEquipmentTypeChange = useCallback((photoId: string, type: EquipmentType) => {
    setPhotos(prev =>
      prev.map(p =>
        p.id === photoId ? { ...p, equipment_type: type } : p
      )
    )
  }, [])

  /**
   * Analyze photo with OCR
   */
  const handleAnalyzePhoto = useCallback(async (photo: UploadedPhoto) => {
    if (!photo.file) return

    setAnalyzingId(photo.id)

    // Update status to processing
    setPhotos(prev =>
      prev.map(p =>
        p.id === photo.id ? { ...p, ocr_status: 'processing' } : p
      )
    )

    try {
      // Se il photo ha già base64Data (da PDF), usalo direttamente
      let base64Data: string
      if (photo.base64Data) {
        console.log(`✅ Uso base64 già disponibile da PDF (evita riconversione)`)
        // Rimuovi prefisso data:image/png;base64, se presente
        base64Data = photo.base64Data.includes(',') ? photo.base64Data.split(',')[1] : photo.base64Data
      } else {
        // Convert file to base64
        console.log(`🔄 Conversione file in base64: ${photo.file.name}, type: ${photo.file.type}, size: ${photo.file.size} bytes (${(photo.file.size / 1024 / 1024).toFixed(2)} MB)`)
        const base64 = await fileToBase64(photo.file)
        base64Data = base64.split(',')[1]
      }

      // Verifica formato PNG base64
      const isPNG = base64Data.startsWith('iVBOR')
      const isJPEG = base64Data.startsWith('/9j/')
      console.log(`🔍 Formato base64 rilevato: ${isPNG ? 'PNG ✅' : isJPEG ? 'JPEG ⚠️' : 'SCONOSCIUTO ❌'} (primi caratteri: ${base64Data.substring(0, 10)})`)

      console.log(`📤 Invio a Edge Function: ${base64Data.substring(0, 50)}... (${base64Data.length} chars, ~${(base64Data.length * 0.75 / 1024 / 1024).toFixed(2)} MB)`)
      console.log(`📝 Parametri: equipment_type=${photo.equipment_type}, equipment_code=${photo.equipment_code}`)

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-equipment-nameplate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            image_base64: base64Data,
            equipment_type: photo.equipment_type,
            equipment_code: photo.equipment_code
          })
        }
      )

      console.log(`📥 Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Edge Function error response:`, errorText)
        throw new Error(`OCR analysis failed: ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'OCR analysis failed')
      }

      // Update photo with OCR result
      const updatedPhoto: UploadedPhoto = {
        ...photo,
        ocr_status: 'completed',
        ocr_result: result.data
      }

      setPhotos(prev =>
        prev.map(p =>
          p.id === photo.id ? updatedPhoto : p
        )
      )

      // Call parent callback
      onPhotoAnalyzed(updatedPhoto, result.data, result.fuzzy_matches || [])

    } catch (error) {
      console.error('Error analyzing photo:', error)

      // Update status to error
      setPhotos(prev =>
        prev.map(p =>
          p.id === photo.id
            ? {
              ...p,
              ocr_status: 'error',
              error_message: error instanceof Error ? error.message : 'Errore sconosciuto'
            }
            : p
        )
      )

      alert('Errore nell\'analisi OCR. Riprova.')
    } finally {
      setAnalyzingId(null)
    }
  }, [onPhotoAnalyzed])

  /**
   * Convert file to base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Foto Targhette Apparecchiature
        </Typography>
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
          component="label"
          disabled={disabled || uploading}
        >
          {uploading ? 'Elaborazione...' : 'Carica Foto'}
          <input
            type="file"
            hidden
            multiple
            accept="image/*,.pdf,application/pdf"
            onChange={handleFileSelect}
          />
        </Button>
      </Box>

      {/* Upload Status */}
      {uploadStatus && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>{uploadStatus}</Typography>
          </Box>
        </Alert>
      )}

      {photos.length === 0 ? (
        <Alert severity="info">
          Carica foto delle targhette o PDF di schede tecniche per compilare automaticamente i campi tramite OCR.
          <br />
          Supporta: JPG, PNG, PDF, max 10MB per file. I PDF multi-pagina verranno convertiti automaticamente.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {photos.map((photo) => (
            <Grid item xs={12} sm={6} md={4} key={photo.id}>
              <Card>
                <CardMedia
                  component="img"
                  height="200"
                  image={photo.preview_url}
                  alt="Targhetta apparecchiatura"
                  sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                />
                <CardContent>
                  {/* PDF Page Badge */}
                  {photo.is_pdf_page && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip
                        icon={<PdfIcon />}
                        label={`PDF - Pagina ${photo.pdf_page_number}/${photo.pdf_total_pages}`}
                        color="info"
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {photo.pdf_original_name}
                      </Typography>
                    </Box>
                  )}

                  <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                    <InputLabel>Tipo Apparecchiatura</InputLabel>
                    <Select
                      value={photo.equipment_type}
                      label="Tipo Apparecchiatura"
                      onChange={(e) => handleEquipmentTypeChange(photo.id, e.target.value as EquipmentType)}
                      disabled={photo.ocr_status === 'processing' || photo.ocr_status === 'completed'}
                    >
                      {equipmentTypes.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Status Chip */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                    {photo.ocr_status === 'pending' && (
                      <Chip label="Da analizzare" color="default" size="small" />
                    )}
                    {photo.ocr_status === 'processing' && (
                      <Chip
                        label="Analisi in corso..."
                        color="primary"
                        size="small"
                        icon={<CircularProgress size={16} />}
                      />
                    )}
                    {photo.ocr_status === 'completed' && (
                      <Chip label="Completato" color="success" size="small" />
                    )}
                    {photo.ocr_status === 'error' && (
                      <Chip label="Errore" color="error" size="small" />
                    )}
                  </Box>

                  {photo.error_message && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', textAlign: 'center' }}>
                      {photo.error_message}
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <IconButton
                    size="small"
                    onClick={() => window.open(photo.preview_url, '_blank')}
                    title="Visualizza foto"
                  >
                    <ViewIcon />
                  </IconButton>

                  <Button
                    size="small"
                    startIcon={analyzingId === photo.id ? <CircularProgress size={16} /> : <AnalyzeIcon />}
                    onClick={() => handleAnalyzePhoto(photo)}
                    disabled={
                      photo.ocr_status === 'processing' ||
                      photo.ocr_status === 'completed' ||
                      analyzingId !== null
                    }
                  >
                    {photo.ocr_status === 'completed' ? 'Analizzato' : 'Analizza'}
                  </Button>

                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemovePhoto(photo.id)}
                    disabled={photo.ocr_status === 'processing'}
                    title="Elimina foto"
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

