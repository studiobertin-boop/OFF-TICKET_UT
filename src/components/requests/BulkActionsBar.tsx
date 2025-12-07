import { Box, Button, Paper, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import {
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  DeleteForever as DeleteForeverIcon,
} from '@mui/icons-material'
import { StatoFattura, STATO_FATTURA_OPTIONS, STATO_FATTURA_LABELS } from '@/types'

interface BulkActionsBarProps {
  selectedCount: number
  onHide?: () => void
  onDelete?: () => void
  onBulkDelete?: () => void
  onUnhide?: () => void
  onClearSelection: () => void
  onBulkUpdateStatoFattura?: (value: StatoFattura) => void
  showStatoFatturaUpdate?: boolean
  isHiddenView?: boolean
  hasCompletedRequests?: boolean
}

export const BulkActionsBar = ({
  selectedCount,
  onHide,
  onDelete,
  onBulkDelete,
  onUnhide,
  onClearSelection,
  onBulkUpdateStatoFattura,
  showStatoFatturaUpdate = false,
  isHiddenView = false,
  hasCompletedRequests = false,
}: BulkActionsBarProps) => {
  if (selectedCount === 0) return null

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'primary.dark',
        color: 'primary.contrastText',
      }}
    >
      <Typography variant="body1" fontWeight="bold">
        {selectedCount} {selectedCount === 1 ? 'richiesta selezionata' : 'richieste selezionate'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
        {showStatoFatturaUpdate && onBulkUpdateStatoFattura && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: 'primary.contrastText' }}>Aggiorna Stato Fattura</InputLabel>
            <Select
              label="Aggiorna Stato Fattura"
              onChange={(e) => onBulkUpdateStatoFattura(e.target.value as StatoFattura)}
              value=""
              displayEmpty
              sx={{
                backgroundColor: 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.contrastText',
                },
              }}
            >
              <MenuItem value="" disabled>
                Seleziona nuovo stato...
              </MenuItem>
              {STATO_FATTURA_OPTIONS.map(option => (
                <MenuItem key={option} value={option}>
                  {STATO_FATTURA_LABELS[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {isHiddenView ? (
          <>
            {onUnhide && (
              <Button
                variant="contained"
                color="success"
                startIcon={<VisibilityIcon />}
                onClick={onUnhide}
                size="small"
              >
                Ripristina
              </Button>
            )}
          </>
        ) : (
          <>
            {onHide && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<VisibilityOffIcon />}
                onClick={onHide}
                size="small"
              >
                Nascondi
              </Button>
            )}
          </>
        )}

        {onDelete && (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            size="small"
          >
            Elimina
          </Button>
        )}

        {onBulkDelete && hasCompletedRequests && (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={onBulkDelete}
            size="small"
            sx={{
              backgroundColor: 'error.dark',
              '&:hover': {
                backgroundColor: 'error.main',
              },
            }}
          >
            ELIMINAZIONE MASSIVA
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onClearSelection}
          size="small"
          sx={{
            color: 'primary.contrastText',
            borderColor: 'primary.contrastText',
            '&:hover': {
              borderColor: 'primary.light',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          Annulla
        </Button>
      </Box>
    </Paper>
  )
}
