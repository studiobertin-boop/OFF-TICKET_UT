import { DM329Status, RequestHistory } from '../types'

// Timer thresholds in days for each monitored DM329 state
export const DM329_TIMER_THRESHOLDS: Record<string, number> = {
  '1-INCARICO_RICEVUTO': 30,
  '3-MAIL_CLIENTE_INVIATA': 15,
  '4-DOCUMENTI_PRONTI': 15,
  '5-ATTESA_FIRMA': 10,
  '6-PRONTA_PER_CIVA': 7,
}

// States that are monitored for timer alerts
export const MONITORED_STATES = Object.keys(DM329_TIMER_THRESHOLDS)

/**
 * Calculate timer status for a DM329 request
 * @param currentStatus - Current status of the request
 * @param statusStartedAt - Timestamp when the request entered current status
 * @returns Object with hasAlert flag and days remaining/exceeded
 */
export function calculateTimerStatus(
  currentStatus: DM329Status,
  statusStartedAt: string
): {
  hasAlert: boolean
  daysInState: number
  threshold?: number
  daysRemaining?: number
  daysExceeded?: number
} {
  // Check if current status is monitored
  if (!MONITORED_STATES.includes(currentStatus)) {
    return {
      hasAlert: false,
      daysInState: 0,
    }
  }

  const threshold = DM329_TIMER_THRESHOLDS[currentStatus]
  const now = new Date()
  const startDate = new Date(statusStartedAt)
  const daysInState = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const hasAlert = daysInState >= threshold
  const daysRemaining = hasAlert ? 0 : threshold - daysInState
  const daysExceeded = hasAlert ? daysInState - threshold : 0

  return {
    hasAlert,
    daysInState,
    threshold,
    daysRemaining,
    daysExceeded,
  }
}

/**
 * Get the timestamp when the request entered its current status
 * @param currentStatus - Current status of the request
 * @param requestHistory - Full request history ordered by created_at DESC
 * @param createdAt - Request creation timestamp (fallback)
 * @returns ISO timestamp when current status started
 */
export function getStatusStartedAt(
  currentStatus: DM329Status,
  requestHistory: RequestHistory[],
  createdAt: string
): string {
  // Find the most recent transition to current status
  const transition = requestHistory.find(
    (h) => h.status_to === currentStatus
  )

  // If no transition found, use request creation date
  return transition ? transition.created_at : createdAt
}

/**
 * Format timer alert message for tooltip
 * @param status - Current status
 * @param daysExceeded - Days exceeded threshold
 * @param daysInState - Total days in current state
 * @returns Formatted message
 */
export function formatTimerAlertMessage(
  status: DM329Status,
  daysExceeded: number,
  daysInState: number
): string {
  const statusLabel = status.replace(/^\d+-/, '').replace(/_/g, ' ')
  return `Timer scaduto: ${daysInState} giorni in stato ${statusLabel} (soglia superata di ${daysExceeded} giorni)`
}

/**
 * Check if user has permission to view timer alerts
 * @param userRole - User role
 * @returns true if user can view timer alerts
 */
export function canViewTimerAlerts(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'userdm329'
}
