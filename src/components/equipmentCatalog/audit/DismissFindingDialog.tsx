import { useEffect, useState } from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material'
import type { Finding } from '@/services/equipmentAudit'

interface DismissFindingDialogProps {
  open: boolean
  finding: Finding | null
  onClose: () => void
  onConfirm: (motivazione: string) => void
  isSaving: boolean
}

const MIN_MOTIVAZIONE = 5

/**
 * Archiviazione di una segnalazione.
 *
 * La motivazione è obbligatoria perché l'archiviazione è una decisione tecnica
 * che qualcun altro — o tu stesso fra sei mesi — dovrà poter capire: «ASK 34 e
 * ASK 35 sono generazioni diverse» vale, «ok» no.
 */
export const DismissFindingDialog = ({
  open,
  finding,
  onClose,
  onConfirm,
  isSaving,
}: DismissFindingDialogProps) => {
  const [motivazione, setMotivazione] = useState('')

  useEffect(() => {
    if (open) setMotivazione('')
  }, [open, finding?.key])

  const troppoCorta = motivazione.trim().length < MIN_MOTIVAZIONE

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Archivia segnalazione</DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          <strong>{finding?.title}</strong>
          <br />
          {finding?.detail}
        </DialogContentText>

        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label="Perché non è un errore"
          value={motivazione}
          onChange={e => setMotivazione(e.target.value)}
          error={motivazione.length > 0 && troppoCorta}
          helperText="Resta agli atti e riemerge se i dati coinvolti cambiano."
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button
          variant="contained"
          disabled={troppoCorta || isSaving}
          onClick={() => onConfirm(motivazione.trim())}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {isSaving ? 'Archiviazione…' : 'Archivia'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
