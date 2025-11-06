import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Stack,
} from '@mui/material'
import {
  FiberNew as FiberNewIcon,
  AssignmentInd as AssignmentIndIcon,
  Construction as ConstructionIcon,
  CheckCircle as CheckCircleIcon,
  PauseCircle as PauseCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material'
import { RequestStatus, DM329Status, UserRole } from '@/types'
import { getAllowedNextStatuses, getStatusLabel } from '@/utils/workflow'
import { updateRequestStatus } from '@/services/requestService'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { REQUESTS_QUERY_KEY } from '@/hooks/useRequests'

interface StatusTransitionButtonsProps {
  requestId: string
  currentStatus: RequestStatus | DM329Status
  requestTypeName: string
  assignedTo?: string | null
  isBlocked?: boolean
  onStatusChanged: () => void
}

export const StatusTransitionButtons = ({
  requestId,
  currentStatus,
  requestTypeName,
  assignedTo,
  isBlocked = false,
  onStatusChanged,
}: StatusTransitionButtonsProps) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user || !currentStatus || !requestTypeName) {
    return null
  }

  // Non-admin users cannot change status when request is blocked
  const isDisabledDueToBlock = isBlocked && user.role !== 'admin'

  const allowedStatuses = getAllowedNextStatuses(
    currentStatus,
    requestTypeName,
    user.role as UserRole
  ).filter((status) => {
    // Filtra ASSEGNATA se non c'è un tecnico assegnato
    if (status === 'ASSEGNATA' && !assignedTo) {
      return false
    }
    return true
  })

  if (isDisabledDueToBlock) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Impossibile cambiare stato: la richiesta è bloccata. Risolvi il blocco prima di procedere.
      </Alert>
    )
  }

  if (allowedStatuses.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Nessuna transizione disponibile per lo stato corrente
      </Alert>
    )
  }

  const handleOpenDialog = (status: string) => {
    setSelectedStatus(status)
    setNotes('')
    setError(null)
  }

  const handleCloseDialog = () => {
    setSelectedStatus(null)
    setNotes('')
    setError(null)
  }

  const handleConfirm = async () => {
    if (!selectedStatus) return

    setLoading(true)
    setError(null)

    const result = await updateRequestStatus(
      requestId,
      selectedStatus,
      user.id,
      user.role as UserRole,
      notes || undefined
    )

    setLoading(false)

    if (result.success) {
      handleCloseDialog()
      // Invalida tutte le query delle richieste per aggiornare sia la lista che il dettaglio
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
      // Invalida anche lo storico della richiesta
      queryClient.invalidateQueries({ queryKey: ['request-history', requestId] })
      onStatusChanged()
    } else {
      setError(result.message)
    }
  }

  const getButtonIcon = (status: string) => {
    // DM329 statuses - keep play arrow for progression
    if (status.startsWith('1-') || status.startsWith('2-') ||
        status.startsWith('3-') || status.startsWith('4-') ||
        status.startsWith('5-') || status.startsWith('6-')) {
      return <PlayArrowIcon />
    }
    if (status === '7-CHIUSA') {
      return <CheckCircleIcon />
    }

    // Standard workflow statuses
    switch (status) {
      case 'APERTA':
        return <FiberNewIcon />
      case 'ASSEGNATA':
        return <AssignmentIndIcon />
      case 'IN_LAVORAZIONE':
        return <ConstructionIcon />
      case 'COMPLETATA':
        return <CheckCircleIcon />
      case 'SOSPESA':
        return <PauseCircleIcon />
      case 'ABORTITA':
        return <CancelIcon />
      default:
        return <PlayArrowIcon />
    }
  }

  return (
    <>
      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {allowedStatuses.map((status) => (
            <Button
              key={status}
              variant="contained"
              startIcon={getButtonIcon(status)}
              onClick={() => handleOpenDialog(status)}
              size="medium"
            >
              {getStatusLabel(status as any)}
            </Button>
          ))}
        </Stack>
      </Box>

      <Dialog open={selectedStatus !== null} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Conferma Cambio Stato</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info">
              Stai per cambiare lo stato da <strong>{getStatusLabel(currentStatus)}</strong> a{' '}
              <strong>{getStatusLabel(selectedStatus as any)}</strong>
            </Alert>

            <TextField
              label="Note (opzionale)"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi eventuali note sul cambio di stato..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} variant="contained" disabled={loading}>
            {loading ? 'Aggiornamento...' : 'Conferma'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
