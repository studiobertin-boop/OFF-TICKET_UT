import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip
} from '@mui/material'

interface NormalizationSuggestion {
  marca?: string
  modello?: string
  similarity_score?: number
}

interface NormalizationSuggestionDialogProps {
  open: boolean
  fieldName: string
  ocrValue: string
  suggestedValue: string
  confidence: number
  alternatives?: NormalizationSuggestion[]
  onConfirm: (useNormalized: boolean, selectedValue?: string) => void
  onCancel: () => void
}

export const NormalizationSuggestionDialog = ({
  open,
  fieldName,
  ocrValue,
  suggestedValue,
  confidence,
  alternatives = [],
  onConfirm,
  onCancel
}: NormalizationSuggestionDialogProps) => {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Suggerimento Normalizzazione - {fieldName}
      </DialogTitle>

      <DialogContent>
        {/* Comparazione valori */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            OCR ha estratto:
          </Typography>
          <Typography variant="h6">{ocrValue}</Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Suggerimento dal catalogo:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" color="primary">{suggestedValue}</Typography>
            <Chip
              label={`${confidence}% match`}
              color={confidence >= 75 ? 'success' : 'warning'}
              size="small"
            />
          </Box>
        </Box>

        {/* Barra confidence */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">Confidence Score</Typography>
            <Typography variant="caption">{confidence}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={confidence}
            color={confidence >= 75 ? 'success' : confidence >= 50 ? 'warning' : 'error'}
          />
        </Box>

        {/* Alternative (se disponibili) */}
        {alternatives && alternatives.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Alternative trovate:
            </Typography>
            <List dense>
              {alternatives.map((alt, idx) => (
                <ListItem key={idx} disablePadding>
                  <ListItemButton
                    onClick={() => onConfirm(true, `${alt.marca} ${alt.modello}`)}
                  >
                    <ListItemText
                      primary={`${alt.marca} ${alt.modello}`}
                      secondary={`${Math.round((alt.similarity_score || 0) * 100)}% match`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onConfirm(false)}>
          Mantieni OCR
        </Button>
        <Button onClick={() => onConfirm(true)} variant="contained">
          Usa Normalizzato
        </Button>
      </DialogActions>
    </Dialog>
  )
}
