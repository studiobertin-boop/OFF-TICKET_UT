import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material'
import { Warning as WarningIcon, DeleteForever as DeleteIcon } from '@mui/icons-material'
import { Request } from '@/types'

interface BulkDeleteConfirmDialogProps {
  open: boolean
  requests: Request[]
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export const BulkDeleteConfirmDialog = ({
  open,
  requests,
  onConfirm,
  onCancel,
  isLoading = false,
}: BulkDeleteConfirmDialogProps) => {
  const count = requests.length

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" fontSize="large" />
          <Typography variant="h6" component="span">
            ATTENZIONE: Eliminazione Massiva
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight="bold" gutterBottom>
            Stai per eliminare DEFINITIVAMENTE le richieste selezionate.
            Questa azione NON PUÒ essere annullata.
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Verrà generato un PDF con lo storico completo delle pratiche eliminate
            e salvato nella sezione Admin per riferimento futuro.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Tutti i dati, allegati e storico verranno eliminati permanentemente dal database.
          </Typography>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Richieste da eliminare ({count}):
          </Typography>
          <List
            dense
            sx={{
              maxHeight: 300,
              overflow: 'auto',
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              p: 1
            }}
          >
            {requests.map((request) => (
              <ListItem key={request.id} sx={{ py: 0.5 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight="medium">
                      {request.title}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      ID: {request.id.substring(0, 8)} | Tipo: {request.request_type?.name || 'N/A'} |
                      Stato: {request.status}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onCancel}
          disabled={isLoading}
          size="large"
        >
          Annulla
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          size="large"
        >
          {isLoading
            ? 'Eliminando e generando PDF...'
            : `ELIMINA ${count} ${count === 1 ? 'RICHIESTA' : 'RICHIESTE'}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
