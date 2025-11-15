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
} from '@mui/icons-material'
import type { UploadedPhoto, EquipmentType, OCRExtractedData, FuzzyMatch } from '@/types'

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
   * Handle file selection
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    const newPhotos: UploadedPhoto[] = []

    Array.from(files).forEach((file, index) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`File ${file.name} non è un'immagine valida`)
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} è troppo grande (max 10MB)`)
        return
      }

      // Create preview URL
      const preview_url = URL.createObjectURL(file)

      // Create photo object
      const photo: UploadedPhoto = {
        id: `${Date.now()}-${index}`,
        file,
        preview_url,
        equipment_type: 'serbatoio', // Default
        uploaded_at: new Date(),
        ocr_status: 'pending'
      }

      newPhotos.push(photo)
    })

    setPhotos(prev => [...prev, ...newPhotos])
    setUploading(false)

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
      // Convert file to base64
      const base64 = await fileToBase64(photo.file)

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
            image_base64: base64.split(',')[1], // Remove data:image/...;base64, prefix
            equipment_type: photo.equipment_type,
            equipment_code: photo.equipment_code
          })
        }
      )

      if (!response.ok) {
        throw new Error('OCR analysis failed')
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
          startIcon={<UploadIcon />}
          component="label"
          disabled={disabled || uploading}
        >
          Carica Foto
          <input
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={handleFileSelect}
          />
        </Button>
      </Box>

      {photos.length === 0 ? (
        <Alert severity="info">
          Carica foto delle targhette per compilare automaticamente i campi tramite OCR.
          <br />
          Supporta: JPG, PNG, max 10MB per foto.
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
