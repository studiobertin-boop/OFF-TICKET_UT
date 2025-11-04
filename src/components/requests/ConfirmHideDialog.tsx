import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material'
import { VisibilityOff as VisibilityOffIcon } from '@mui/icons-material'

interface ConfirmHideDialogProps {
  open: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export const ConfirmHideDialog = ({
  open,
  count,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmHideDialogProps) => {
  const title = count === 1 ? 'Nascondere questa richiesta?' : `Nascondere ${count} richieste?`
  const message =
    count === 1
      ? 'La richiesta sarà nascosta dalla vista principale ma rimarrà accessibile nel tab "Nascoste" (solo admin).'
      : `Le ${count} richieste saranno nascoste dalla vista principale ma rimarranno accessibili nel tab "Nascoste" (solo admin).`

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VisibilityOffIcon color="warning" />
          {title}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isLoading}>
          Annulla
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={isLoading}
          startIcon={<VisibilityOffIcon />}
        >
          {isLoading ? 'Nascondendo...' : count === 1 ? 'Nascondi richiesta' : `Nascondi ${count} richieste`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
