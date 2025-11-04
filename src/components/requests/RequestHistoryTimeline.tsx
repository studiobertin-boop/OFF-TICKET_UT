import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Divider,
} from '@mui/material'
import {
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Circle as CircleIcon,
} from '@mui/icons-material'
import { RequestHistory } from '@/types'
import { getRequestHistory } from '@/services/requestService'
import { getStatusLabel } from '@/utils/workflow'

interface RequestHistoryTimelineProps {
  requestId: string
}

export const RequestHistoryTimeline = ({ requestId }: RequestHistoryTimelineProps) => {
  const [history, setHistory] = useState<RequestHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [requestId])

  const loadHistory = async () => {
    setLoading(true)
    const data = await getRequestHistory(requestId)
    setHistory(data)
    setLoading(false)
  }

  const getIcon = (statusTo: string) => {
    if (statusTo === 'COMPLETATA' || statusTo === '7-CHIUSA') {
      return <CheckCircleIcon color="success" />
    }
    return <CircleIcon color="action" />
  }

  if (loading) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Storico
          </Typography>
          <Alert severity="info">Nessuno storico disponibile</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Storico Cambi Stato
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          {history.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ mt: 0.5 }}>{getIcon(item.status_to)}</Box>

                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {item.status_from ? (
                      <>
                        <Typography variant="body1" component="span" fontWeight="medium">
                          {getStatusLabel(item.status_from as any)}
                        </Typography>
                        <ArrowForwardIcon fontSize="small" color="action" />
                        <Typography variant="body1" component="span" fontWeight="medium">
                          {getStatusLabel(item.status_to as any)}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body1" fontWeight="medium">
                        Richiesta creata: {getStatusLabel(item.status_to as any)}
                      </Typography>
                    )}
                  </Stack>

                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {new Date(item.created_at).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {item.changed_by_user?.full_name || 'Utente sconosciuto'}
                  </Typography>

                  {item.notes && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {item.notes}
                      </Typography>
                    </>
                  )}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
