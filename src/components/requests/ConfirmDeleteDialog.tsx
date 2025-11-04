import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'

interface ConfirmDeleteDialogProps {
  open: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export const ConfirmDeleteDialog = ({
  open,
  count,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDeleteDialogProps) => {
  const title = count === 1 ? 'ATTENZIONE: Eliminazione definitiva' : `ATTENZIONE: Eliminare ${count} richieste?`
  const message =
    count === 1
      ? 'Stai per eliminare DEFINITIVAMENTE questa richiesta. Questa azione NON PUÒ essere annullata. Per preservare lo storico della pratica usa la funzione di eliminazione massiva nella tabella principale.'
      : 'Stai per eliminare DEFINITIVAMENTE le richieste selezionate. Questa azione NON PUÒ essere annullata.'

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          {title}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            {message}
          </Typography>
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Tutti i dati, allegati e storico verranno eliminati permanentemente.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          Annulla
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isLoading}
          startIcon={<WarningIcon />}
        >
          {isLoading
            ? 'Eliminando...'
            : count === 1
              ? 'ELIMINA DEFINITIVAMENTE'
              : `ELIMINA ${count} RICHIESTE`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
