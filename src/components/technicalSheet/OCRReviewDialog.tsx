import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Typography,
  Box,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  ThumbUp as ThumbUpIcon,
} from '@mui/icons-material'
import type { OCRReviewData, OCRExtractedData, FuzzyMatch } from '@/types'

interface OCRReviewDialogProps {
  open: boolean
  data: OCRReviewData | null
  onConfirm: (editedData: OCRExtractedData, selectedMatch?: FuzzyMatch) => void
  onCancel: () => void
}

/**
 * Dialog per revisione dati estratti da OCR
 * Permette di modificare i dati prima dell'inserimento
 * Mostra fuzzy matches dal catalogo
 */
export const OCRReviewDialog = ({
  open,
  data,
  onConfirm,
  onCancel
}: OCRReviewDialogProps) => {
  const [editedData, setEditedData] = useState<OCRExtractedData | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<FuzzyMatch | null>(null)

  // Initialize edited data when dialog opens
  if (open && data && !editedData) {
    setEditedData({ ...data.extracted_data })
  }

  if (!data || !editedData) return null

  const { photo, extracted_data, fuzzy_matches, equipment_type } = data
  const confidenceScore = calculateOverallConfidence(extracted_data)

  /**
   * Calculate overall confidence
   */
  function calculateOverallConfidence(data: OCRExtractedData): number {
    const fields = ['marca', 'modello', 'n_fabbrica', 'anno']
    const filledCount = fields.filter(f => data[f as keyof OCRExtractedData]).length
    return Math.round((filledCount / fields.length) * 100)
  }

  /**
   * Handle field change
   */
  const handleFieldChange = (field: string, value: any) => {
    setEditedData(prev => prev ? { ...prev, [field]: value } : null)
  }

  /**
   * Apply fuzzy match
   */
  const handleApplyMatch = (match: FuzzyMatch) => {
    setSelectedMatch(match)
    setEditedData(prev => prev ? {
      ...prev,
      marca: match.marca,
      modello: match.modello
    } : null)
  }

  /**
   * Confirm and insert data
   */
  const handleConfirm = () => {
    if (editedData) {
      onConfirm(editedData, selectedMatch || undefined)
      setEditedData(null)
      setSelectedMatch(null)
    }
  }

  /**
   * Cancel
   */
  const handleCancel = () => {
    setEditedData(null)
    setSelectedMatch(null)
    onCancel()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Revisione Dati OCR - {equipment_type.toUpperCase()}
          </Typography>
          <Chip
            label={`Affidabilità: ${confidenceScore}%`}
            color={confidenceScore >= 75 ? 'success' : confidenceScore >= 50 ? 'warning' : 'error'}
            icon={confidenceScore >= 75 ? <CheckIcon /> : <WarningIcon />}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Foto preview */}
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Foto Targhetta
              </Typography>
              <Box
                component="img"
                src={photo.preview_url}
                alt="Targhetta"
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 300,
                  objectFit: 'contain',
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1
                }}
              />
            </Box>
          </Grid>

          {/* Extracted Data */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" gutterBottom>
              Dati Estratti (modificabili)
            </Typography>

            <Grid container spacing={2}>
              {/* Marca */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Marca"
                  fullWidth
                  size="small"
                  value={editedData.marca || ''}
                  onChange={(e) => handleFieldChange('marca', e.target.value)}
                />
              </Grid>

              {/* Modello */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Modello"
                  fullWidth
                  size="small"
                  value={editedData.modello || ''}
                  onChange={(e) => handleFieldChange('modello', e.target.value)}
                />
              </Grid>

              {/* N° Fabbrica */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="N° Fabbrica"
                  fullWidth
                  size="small"
                  value={editedData.n_fabbrica || ''}
                  onChange={(e) => handleFieldChange('n_fabbrica', e.target.value)}
                />
              </Grid>

              {/* Anno */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Anno"
                  type="number"
                  fullWidth
                  size="small"
                  value={editedData.anno || ''}
                  onChange={(e) => handleFieldChange('anno', e.target.value ? parseInt(e.target.value) : null)}
                />
              </Grid>

              {/* Pressione Max (se presente) */}
              {editedData.pressione_max !== undefined && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Pressione Max (BAR)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editedData.pressione_max || ''}
                    onChange={(e) => handleFieldChange('pressione_max', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </Grid>
              )}

              {/* Volume (se presente) */}
              {editedData.volume !== undefined && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Volume (litri)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editedData.volume || ''}
                    onChange={(e) => handleFieldChange('volume', e.target.value ? parseInt(e.target.value) : null)}
                  />
                </Grid>
              )}
            </Grid>

            {/* Raw Text */}
            {editedData.raw_text && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Testo grezzo estratto:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    p: 1,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    maxHeight: 100,
                    overflow: 'auto'
                  }}
                >
                  {editedData.raw_text}
                </Typography>
              </Box>
            )}
          </Grid>

          {/* Fuzzy Matches */}
          {fuzzy_matches && fuzzy_matches.length > 0 && (
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ThumbUpIcon fontSize="small" />
                Suggerimenti dal Catalogo
              </Typography>
              <Alert severity="info" sx={{ mb: 1 }}>
                Trovati {fuzzy_matches.length} risultati simili nel database. Clicca per applicare.
              </Alert>
              <List dense>
                {fuzzy_matches.map((match, idx) => (
                  <ListItem
                    key={idx}
                    disablePadding
                    secondaryAction={
                      <Chip
                        label={`${Math.round(match.similarity_score * 100)}%`}
                        size="small"
                        color={match.similarity_score > 0.8 ? 'success' : 'default'}
                      />
                    }
                  >
                    <ListItemButton
                      onClick={() => handleApplyMatch(match)}
                      selected={selectedMatch === match}
                    >
                      <ListItemText
                        primary={`${match.marca} ${match.modello}`}
                        secondary={`Usato ${match.usage_count} volte`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          startIcon={<CheckIcon />}
        >
          Conferma e Inserisci
        </Button>
      </DialogActions>
    </Dialog>
  )
}
