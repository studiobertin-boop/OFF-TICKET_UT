import { useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SyncAltIcon from '@mui/icons-material/SyncAlt'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { RequestHistory, RequestBlock } from '@/types'
import { getRequestHistory } from '@/services/requestService'
import { useRequestBlocks } from '@/hooks/useRequestBlocks'
import { useQuery } from '@tanstack/react-query'
import { getStatusLabel } from '@/utils/workflow'

interface RequestHistoryPanelProps {
  requestId: string
}

type TimelineEvent =
  | {
      type: 'status_change'
      id: string
      timestamp: string
      data: RequestHistory
    }
  | {
      type: 'block'
      id: string
      timestamp: string
      data: RequestBlock
    }
  | {
      type: 'unblock'
      id: string
      timestamp: string
      data: RequestBlock
    }

/**
 * Unified history panel showing both status changes and blocks
 * Displayed on the right side of RequestDetail page
 */
export function RequestHistoryPanel({ requestId }: RequestHistoryPanelProps) {
  // Fetch status history
  const {
    data: statusHistory = [],
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery({
    queryKey: ['request-history', requestId],
    queryFn: () => getRequestHistory(requestId),
  })

  // Fetch blocks history
  const {
    data: blocks = [],
    isLoading: isLoadingBlocks,
    error: blocksError,
  } = useRequestBlocks(requestId)

  // Merge and sort all events chronologically
  const timeline = useMemo(() => {
    const events: TimelineEvent[] = []

    // Add status changes
    statusHistory.forEach((history) => {
      events.push({
        type: 'status_change',
        id: `status-${history.id}`,
        timestamp: history.created_at,
        data: history,
      })
    })

    // Add blocks (create event when blocked)
    blocks.forEach((block) => {
      events.push({
        type: 'block',
        id: `block-${block.id}`,
        timestamp: block.blocked_at,
        data: block,
      })

      // Add unblock event if resolved
      if (!block.is_active && block.unblocked_at) {
        events.push({
          type: 'unblock',
          id: `unblock-${block.id}`,
          timestamp: block.unblocked_at,
          data: block,
        })
      }
    })

    // Sort by timestamp (most recent first)
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [statusHistory, blocks])

  const isLoading = isLoadingHistory || isLoadingBlocks
  const error = historyError || blocksError

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    )
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <Alert severity="error">Errore nel caricamento dello storico</Alert>
      </Paper>
    )
  }

  if (timeline.length === 0) {
    return (
      <Paper sx={{ p: 3, height: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Storico Richiesta
        </Typography>
        <Alert severity="info">Nessun evento nello storico</Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Storico Richiesta
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cronologia completa di cambi stato e blocchi
      </Typography>

      <Timeline position="right">
        {timeline.map((event, index) => {
          const isLast = index === timeline.length - 1

          if (event.type === 'status_change') {
            const history = event.data as RequestHistory
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: 0.3, pt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="primary">
                    <SyncAltIcon fontSize="small" />
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3 }}>
                  <Typography variant="subtitle2">Cambio Stato</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', my: 1 }}>
                    {history.status_from && (
                      <>
                        <Chip
                          label={getStatusLabel(history.status_from as any)}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="body2">→</Typography>
                      </>
                    )}
                    <Chip label={getStatusLabel(history.status_to as any)} size="small" color="primary" />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Da: {history.changed_by_user?.full_name || history.changed_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  {history.notes && (
                    <Accordion sx={{ mt: 1 }} elevation={0}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="caption">Note</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2">{history.notes}</Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </TimelineContent>
              </TimelineItem>
            )
          }

          if (event.type === 'block') {
            const block = event.data as RequestBlock
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: 0.3, pt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="warning">
                    <WarningIcon fontSize="small" />
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3 }}>
                  <Typography variant="subtitle2" color="warning.main">
                    Richiesta Bloccata
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Da: {block.blocked_by_user?.full_name || block.blocked_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  <Paper sx={{ p: 1.5, bgcolor: 'warning.light', mt: 1 }} elevation={0}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                      Motivo:
                    </Typography>
                    <Typography variant="body2">{block.reason}</Typography>
                  </Paper>
                  {block.is_active && (
                    <Chip label="Blocco Attivo" size="small" color="warning" sx={{ mt: 1 }} />
                  )}
                </TimelineContent>
              </TimelineItem>
            )
          }

          if (event.type === 'unblock') {
            const block = event.data as RequestBlock
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: 0.3, pt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color="success">
                    <CheckCircleIcon fontSize="small" />
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3 }}>
                  <Typography variant="subtitle2" color="success.main">
                    Blocco Risolto
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Da: {block.unblocked_by_user?.full_name || block.unblocked_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  {block.resolution_notes && (
                    <Paper sx={{ p: 1.5, bgcolor: 'success.light', mt: 1 }} elevation={0}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                        Note di risoluzione:
                      </Typography>
                      <Typography variant="body2">{block.resolution_notes}</Typography>
                    </Paper>
                  )}
                </TimelineContent>
              </TimelineItem>
            )
          }

          return null
        })}
      </Timeline>
    </Paper>
  )
}
