import {
  SyncAlt as SyncAltIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  FiberNew as FiberNewIcon,
  Cancel as CancelIcon,
  TaskAlt as TaskAltIcon,
  HighlightOff as HighlightOffIcon,
} from '@mui/icons-material'
import { ReactElement } from 'react'
import type { NotificationEventType } from '@/types'

export type EventType = 'status_change' | 'block' | 'unblock' | 'created' | 'completed' | 'aborted' | 'archived_unfinished'
export type EventColor = 'primary' | 'warning' | 'success' | 'info' | 'grey' | 'error'

interface EventIconConfig {
  icon: ReactElement
  color: EventColor
  label: string
}

/**
 * Restituisce l'icona, il colore e la label per un tipo di evento
 * Usato sia per RequestHistoryPanel che per NotificationDrawer
 */
export function getEventIconConfig(eventType: EventType): EventIconConfig {
  switch (eventType) {
    case 'created':
      return {
        icon: <FiberNewIcon fontSize="small" />,
        color: 'info',
        label: 'Nuova Richiesta',
      }
    case 'block':
      return {
        icon: <WarningIcon fontSize="small" />,
        color: 'warning',
        label: 'Richiesta Bloccata',
      }
    case 'unblock':
      return {
        icon: <CheckCircleIcon fontSize="small" />,
        color: 'success',
        label: 'Blocco Risolto',
      }
    case 'completed':
      return {
        icon: <TaskAltIcon fontSize="small" />,
        color: 'grey',
        label: 'Richiesta Completata',
      }
    case 'aborted':
      return {
        icon: <CancelIcon fontSize="small" />,
        color: 'error',
        label: 'Richiesta Abortita',
      }
    case 'archived_unfinished':
      return {
        icon: <HighlightOffIcon fontSize="small" />,
        color: 'grey',
        label: 'Archiviata Non Finita',
      }
    case 'status_change':
    default:
      return {
        icon: <SyncAltIcon fontSize="small" />,
        color: 'primary',
        label: 'Cambio Stato',
      }
  }
}

/**
 * Mappa un NotificationEventType a un EventType per l'icona
 * Accetta anche lo stato finale per determinare se è completed/aborted
 */
export function mapNotificationEventType(
  eventType: NotificationEventType,
  statusTo?: string | null
): EventType {
  // Prima controlla il tipo di evento
  switch (eventType) {
    case 'request_created':
      return 'created'
    case 'request_blocked':
      return 'block'
    case 'request_suspended':
      // request_suspended usa il sistema di blocco (SOSPESA stato)
      return 'block'
    case 'request_unsuspended':
      return 'unblock'
    case 'status_change':
      // Per i cambi stato, controlla lo stato finale
      if (statusTo === 'COMPLETATA' || statusTo === '7-CHIUSA') {
        return 'completed'
      }
      if (statusTo === 'ABORTITA') {
        return 'aborted'
      }
      if (statusTo === 'ARCHIVIATA NON FINITA') {
        return 'archived_unfinished'
      }
      return 'status_change'
    default:
      return 'status_change'
  }
}

/**
 * Determina l'EventType basandosi sullo stato (per RequestHistory)
 */
export function getEventTypeFromStatus(
  statusFrom: string | null,
  statusTo: string
): EventType {
  // Nuova richiesta (prima transizione)
  if (!statusFrom) {
    return 'created'
  }

  // Stati finali
  if (statusTo === 'COMPLETATA' || statusTo === '7-CHIUSA') {
    return 'completed'
  }
  if (statusTo === 'ABORTITA') {
    return 'aborted'
  }
  if (statusTo === 'ARCHIVIATA NON FINITA') {
    return 'archived_unfinished'
  }

  // Cambio stato normale
  return 'status_change'
}
