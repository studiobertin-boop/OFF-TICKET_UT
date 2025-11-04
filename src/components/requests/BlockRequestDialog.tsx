import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useBlockRequest } from '@/hooks/useRequestBlocks'

interface BlockRequestDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  requestTitle: string
}

/**
 * Dialog for blocking a request with a reason
 * Visible to: admin, tecnico assigned to request, userdm329 (for DM329 requests)
 */
export function BlockRequestDialog({
  open,
  onClose,
  requestId,
  requestTitle,
}: BlockRequestDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const blockMutation = useBlockRequest()

  const handleBlock = async () => {
    if (!reason.trim()) {
      setError('Il motivo del blocco è obbligatorio')
      return
    }

    try {
      const result = await blockMutation.mutateAsync({
        requestId,
        reason: reason.trim(),
      })

      if (result.success) {
        handleClose()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('Errore durante il blocco della richiesta')
      console.error('Block error:', err)
    }
  }

  const handleClose = () => {
    setReason('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Blocca Richiesta</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Stai per bloccare la richiesta &quot;{requestTitle}&quot;. L&apos;autore della richiesta
          riceverà una notifica.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TextField
          autoFocus
          margin="dense"
          label="Motivo del blocco"
          placeholder="Es: Manca il file allegato X, Necessarie informazioni aggiuntive sul cliente..."
          fullWidth
          multiline
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={!!error && !reason.trim()}
          helperText="Spiega chiaramente cosa serve per procedere con la richiesta"
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={blockMutation.isPending}>
          Annulla
        </Button>
        <Button
          onClick={handleBlock}
          variant="contained"
          color="warning"
          disabled={blockMutation.isPending || !reason.trim()}
          startIcon={blockMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {blockMutation.isPending ? 'Blocco...' : 'Blocca Richiesta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
