import { RequestStatus, DM329Status, UserRole } from '@/types'

/**
 * Standard workflow transitions map
 * Key: current status
 * Value: array of allowed next statuses
 */
export const STANDARD_WORKFLOW: Record<RequestStatus, RequestStatus[]> = {
  APERTA: ['ASSEGNATA', 'ABORTITA'],
  ASSEGNATA: ['IN_LAVORAZIONE', 'APERTA'],
  IN_LAVORAZIONE: ['COMPLETATA', 'BLOCCATA'],
  COMPLETATA: [], // Only admin can reopen
  BLOCCATA: ['IN_LAVORAZIONE', 'ABORTITA'],
  ABORTITA: [], // Only admin can reopen
}

/**
 * DM329 custom workflow transitions map (sequential)
 */
export const DM329_WORKFLOW: Record<DM329Status, DM329Status[]> = {
  '1-INCARICO_RICEVUTO': ['2-SCHEDA_DATI_PRONTA'],
  '2-SCHEDA_DATI_PRONTA': ['3-MAIL_CLIENTE_INVIATA'],
  '3-MAIL_CLIENTE_INVIATA': ['4-DOCUMENTI_PRONTI'],
  '4-DOCUMENTI_PRONTI': ['5-ATTESA_FIRMA'],
  '5-ATTESA_FIRMA': ['6-PRONTA_PER_CIVA'],
  '6-PRONTA_PER_CIVA': ['7-CHIUSA'],
  '7-CHIUSA': [], // Only admin can reopen
  'ARCHIVIATA NON FINITA': [], // Only admin can reopen
}

/**
 * All possible statuses for admin (unrestricted)
 */
export const ALL_STANDARD_STATUSES: RequestStatus[] = [
  'APERTA',
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  'COMPLETATA',
  'BLOCCATA',
  'ABORTITA',
]

export const ALL_DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
  'ARCHIVIATA NON FINITA',
]

/**
 * Get allowed next statuses based on current status, user role, and request type
 */
export function getAllowedNextStatuses(
  currentStatus: RequestStatus | DM329Status,
  requestTypeName: string,
  userRole: UserRole
): (RequestStatus | DM329Status)[] {
  // Admin has unrestricted access
  if (userRole === 'admin') {
    if (requestTypeName === 'DM329') {
      return ALL_DM329_STATUSES
    }
    return ALL_STANDARD_STATUSES
  }

  // Utente CANNOT change status at all
  if (userRole === 'utente') {
    return []
  }

  // DM329 workflow (userdm329 and admin can modify)
  if (requestTypeName === 'DM329') {
    if (userRole === 'userdm329') {
      // userdm329 has full access to all DM329 statuses (like admin)
      return ALL_DM329_STATUSES
    }
    // Tecnico cannot modify DM329
    return []
  }

  // Standard workflow (only tecnico can modify)
  if (userRole === 'tecnico') {
    return STANDARD_WORKFLOW[currentStatus as RequestStatus] || []
  }

  // userdm329 cannot modify standard requests
  return []
}

/**
 * Check if a status transition is valid
 */
export function isTransitionAllowed(
  currentStatus: RequestStatus | DM329Status,
  newStatus: RequestStatus | DM329Status,
  requestTypeName: string,
  userRole: UserRole
): boolean {
  const allowedStatuses = getAllowedNextStatuses(currentStatus, requestTypeName, userRole)
  return allowedStatuses.includes(newStatus)
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/-/g, ' ')
}

/**
 * Get color for status chip
 */
export function getStatusColor(
  status: string
): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  const statusColors: Record<
    string,
    'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  > = {
    // Standard workflow
    APERTA: 'info',
    ASSEGNATA: 'primary',
    IN_LAVORAZIONE: 'warning',
    COMPLETATA: 'success',
    BLOCCATA: 'error',
    ABORTITA: 'error',
    // DM329 workflow
    '1-INCARICO_RICEVUTO': 'info',
    '2-SCHEDA_DATI_PRONTA': 'primary',
    '3-MAIL_CLIENTE_INVIATA': 'primary',
    '4-DOCUMENTI_PRONTI': 'warning',
    '5-ATTESA_FIRMA': 'warning',
    '6-PRONTA_PER_CIVA': 'success',
    '7-CHIUSA': 'success',
    'ARCHIVIATA NON FINITA': 'default',
  }
  return statusColors[status] || 'default'
}

/**
 * Get human-readable status labels for DM329
 */
export const DM329_STATUS_LABELS: Record<DM329Status, string> = {
  '1-INCARICO_RICEVUTO': '1 - Incarico ricevuto',
  '2-SCHEDA_DATI_PRONTA': '2 - Scheda dati pronta',
  '3-MAIL_CLIENTE_INVIATA': '3 - Mail cliente inviata',
  '4-DOCUMENTI_PRONTI': '4 - Documenti pronti',
  '5-ATTESA_FIRMA': '5 - Attesa firma',
  '6-PRONTA_PER_CIVA': '6 - Pronta per CIVA',
  '7-CHIUSA': '7 - Chiusa',
  'ARCHIVIATA NON FINITA': 'Archiviata non finita',
}

/**
 * Get human-readable status labels for standard workflow
 */
export const STANDARD_STATUS_LABELS: Record<RequestStatus, string> = {
  APERTA: 'Aperta',
  ASSEGNATA: 'Assegnata',
  IN_LAVORAZIONE: 'In Lavorazione',
  COMPLETATA: 'Completata',
  BLOCCATA: 'Bloccata',
  ABORTITA: 'Abortita',
}

/**
 * Get label for any status
 */
export function getStatusLabel(status: RequestStatus | DM329Status): string {
  if (!status) return ''
  if (status in DM329_STATUS_LABELS) {
    return DM329_STATUS_LABELS[status as DM329Status]
  }
  if (status in STANDARD_STATUS_LABELS) {
    return STANDARD_STATUS_LABELS[status as RequestStatus]
  }
  return formatStatus(status)
}
