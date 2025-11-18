import { useMemo } from 'react'
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
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
import { RequestHistory, RequestBlock } from '@/types'
import { getRequestHistory } from '@/services/requestService'
import { useRequestBlocks } from '@/hooks/useRequestBlocks'
import { useQuery } from '@tanstack/react-query'
import { getStatusLabel } from '@/utils/workflow'
import { getEventIconConfig, getEventTypeFromStatus } from '@/utils/eventIcons'

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
    <Paper sx={{ p: 3, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <Typography variant="h6" gutterBottom>
        Storico Richiesta
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Cronologia completa di cambi stato e blocchi
      </Typography>

      <Timeline position="right" sx={{ p: 0, m: 0 }}>
        {timeline.map((event, index) => {
          const isLast = index === timeline.length - 1

          if (event.type === 'status_change') {
            const history = event.data as RequestHistory
            const eventType = getEventTypeFromStatus(history.status_from, history.status_to)
            const iconConfig = getEventIconConfig(eventType)
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: '0 0 auto', maxWidth: '80px', pt: 1.5, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
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
                  <TimelineDot color={iconConfig.color} sx={{ my: 0.5 }}>
                    {iconConfig.icon}
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3, pr: 0, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{iconConfig.label}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', my: 1, flexWrap: 'wrap' }}>
                    {history.status_from && (
                      <>
                        <Chip
                          label={getStatusLabel(history.status_from as any)}
                          size="small"
                          variant="outlined"
                          sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                        />
                        <Typography variant="body2" sx={{ mx: 0.5 }}>→</Typography>
                      </>
                    )}
                    <Chip
                      label={getStatusLabel(history.status_to as any)}
                      size="small"
                      color="primary"
                      sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-word' }}>
                    Da: {history.changed_by_user?.full_name || history.changed_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  {history.notes && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', display: 'block', mb: 0.5 }}>
                        Note
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{history.notes}</Typography>
                    </Box>
                  )}
                </TimelineContent>
              </TimelineItem>
            )
          }

          if (event.type === 'block') {
            const block = event.data as RequestBlock
            const iconConfig = getEventIconConfig('block')
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: '0 0 auto', maxWidth: '80px', pt: 1.5, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
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
                  <TimelineDot color={iconConfig.color} sx={{ my: 0.5 }}>
                    {iconConfig.icon}
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3, pr: 0, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="warning.main" sx={{ mb: 1 }}>
                    {iconConfig.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-word' }}>
                    Da: {block.blocked_by_user?.full_name || block.blocked_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  <Paper sx={{ p: 1.5, bgcolor: 'warning.light', mt: 1 }} elevation={0}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                      Motivo:
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{block.reason}</Typography>
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
            const iconConfig = getEventIconConfig('unblock')
            return (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ flex: '0 0 auto', maxWidth: '80px', pt: 1.5, pr: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
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
                  <TimelineDot color={iconConfig.color} sx={{ my: 0.5 }}>
                    {iconConfig.icon}
                  </TimelineDot>
                  {!isLast && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ pb: 3, pr: 0, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
                    {iconConfig.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-word' }}>
                    Da: {block.unblocked_by_user?.full_name || block.unblocked_by_user?.email || 'Sconosciuto'}
                  </Typography>
                  {block.resolution_notes && (
                    <Paper sx={{ p: 1.5, bgcolor: 'success.light', mt: 1 }} elevation={0}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                        Note di risoluzione:
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{block.resolution_notes}</Typography>
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
