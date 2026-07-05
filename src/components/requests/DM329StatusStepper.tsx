import { useState } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Stack,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { DM329Status, UserRole } from '@/types'
import { getAllowedNextStatuses, getStatusLabel } from '@/utils/workflow'
import { getStatusHex } from '@/theme/statusColors'
import { useThemeMode } from '@/theme'
import { updateRequestStatus } from '@/services/requestService'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { REQUESTS_QUERY_KEY } from '@/hooks/useRequests'

interface DM329StatusStepperProps {
  requestId: string
  currentStatus: string
  requestTypeName: string
  isBlocked?: boolean
  onStatusChanged: () => void
}

// I 7 passi in sequenza (esclude "ARCHIVIATA NON FINITA", stato terminale a parte)
const STEPS: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
]
const SHORT: Record<string, string> = {
  '1-INCARICO_RICEVUTO': 'Incarico',
  '2-SCHEDA_DATI_PRONTA': 'Scheda dati',
  '3-MAIL_CLIENTE_INVIATA': 'Mail cliente',
  '4-DOCUMENTI_PRONTI': 'Documenti',
  '5-ATTESA_FIRMA': 'Attesa firma',
  '6-PRONTA_PER_CIVA': 'Pronta CIVA',
  '7-CHIUSA': 'Chiusa',
}

/**
 * Stepper DM329 con stati cliccabili per il cambio stato.
 * Rispetta le transizioni permesse dal workflow/ruolo (getAllowedNextStatuses):
 * gli stati non raggiungibili non sono cliccabili. Conferma con dialog + note opzionali.
 */
export function DM329StatusStepper({
  requestId,
  currentStatus,
  requestTypeName,
  isBlocked = false,
  onStatusChanged,
}: DM329StatusStepperProps) {
  const { user } = useAuth()
  const { mode } = useThemeMode()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<DM329Status | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null
  const role = user.role as UserRole
  const curIdx = STEPS.indexOf(currentStatus as DM329Status)
  const blockedForUser = isBlocked && role !== 'admin'
  const allowed = blockedForUser ? [] : getAllowedNextStatuses(currentStatus as DM329Status, requestTypeName, role)
  const canClick = (s: DM329Status) => s !== currentStatus && allowed.includes(s)

  const confirm = async () => {
    if (!target) return
    setLoading(true)
    setError(null)
    const res = await updateRequestStatus(requestId, target, user.id, role, notes || undefined)
    setLoading(false)
    if (res.success) {
      setTarget(null)
      setNotes('')
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['request-history', requestId] })
      onStatusChanged()
    } else {
      setError(res.message)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        {STEPS.map((s, i) => {
          const done = curIdx > -1 && i < curIdx
          const cur = i === curIdx
          const clickable = canClick(s)
          const hex = getStatusHex(s, mode)
          const filled = done || cur
          return (
            <Box
              key={s}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, position: 'relative', minWidth: 0 }}
            >
              {i > 0 && (
                <Box sx={{ position: 'absolute', top: 15, left: '-50%', width: '100%', height: 2, bgcolor: filled ? hex : 'divider', zIndex: 0 }} />
              )}
              <Tooltip
                title={clickable ? `Imposta stato: ${getStatusLabel(s)}` : cur ? `Stato attuale: ${getStatusLabel(s)}` : getStatusLabel(s)}
                arrow
              >
                <Box
                  onClick={clickable ? () => { setTarget(s); setNotes(''); setError(null) } : undefined}
                  sx={{
                    zIndex: 1,
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: clickable ? 'pointer' : 'default',
                    color: filled ? '#fff' : 'text.disabled',
                    bgcolor: filled ? hex : 'transparent',
                    border: '2px solid',
                    borderColor: filled ? hex : 'divider',
                    boxShadow: cur ? `0 0 0 4px ${hex}44` : 'none',
                    transition: 'box-shadow .15s, transform .15s',
                    '&:hover': clickable ? { transform: 'translateY(-1px)', boxShadow: `0 0 0 4px ${hex}66` } : {},
                  }}
                >
                  {done ? <CheckIcon sx={{ fontSize: 18 }} /> : i + 1}
                </Box>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{ textAlign: 'center', lineHeight: 1.2, fontSize: '0.68rem', color: cur ? 'text.primary' : 'text.secondary', fontWeight: cur ? 700 : 400 }}
              >
                {SHORT[s]}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {blockedForUser ? (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          Richiesta bloccata: risolvi il blocco per cambiare stato.
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          {currentStatus === 'ARCHIVIATA NON FINITA' ? 'Pratica archiviata (non finita)' : 'Clicca uno stato per cambiarlo'}
        </Typography>
      )}

      <Dialog open={target !== null} onClose={() => !loading && setTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Conferma cambio stato</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="info">
              Stai per cambiare lo stato da <strong>{getStatusLabel(currentStatus as DM329Status)}</strong> a{' '}
              <strong>{target && getStatusLabel(target)}</strong>
            </Alert>
            <TextField
              label="Note (opzionale)"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Aggiungi eventuali note sul cambio di stato…"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={loading}>Annulla</Button>
          <Button variant="contained" onClick={confirm} disabled={loading}>
            {loading ? 'Aggiornamento…' : 'Conferma'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
