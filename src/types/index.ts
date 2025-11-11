// Database Types
export type UserRole = 'admin' | 'tecnico' | 'utente' | 'userdm329'

export type RequestStatus =
  | 'APERTA'
  | 'ASSEGNATA'
  | 'IN_LAVORAZIONE'
  | 'COMPLETATA'
  | 'BLOCCATA'
  | 'ABORTITA'

export type DM329Status =
  | '1-INCARICO_RICEVUTO'
  | '2-SCHEDA_DATI_PRONTA'
  | '3-MAIL_CLIENTE_INVIATA'
  | '4-DOCUMENTI_PRONTI'
  | '5-ATTESA_FIRMA'
  | '6-PRONTA_PER_CIVA'
  | '7-CHIUSA'
  | 'ARCHIVIATA NON FINITA'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name: string
  is_suspended: boolean
  created_at: string
  updated_at: string
}

export interface FieldSchema {
  name: string
  type: 'text' | 'textarea' | 'boolean' | 'select' | 'multiselect' | 'file' | 'date' | 'autocomplete' | 'number' | 'datetime-local' | 'repeatable_group'
  label: string
  required: boolean
  options?: string[]
  hidden?: boolean
  // Properties for autocomplete field type
  dataSource?: 'customers'
  displayField?: string
  valueField?: string
  // Properties for number/date/datetime fields
  min?: number | string
  max?: number | string
  step?: number
  // Properties for text/textarea fields
  maxLength?: number
  placeholder?: string
  // Properties for file fields
  accept?: string
  maxFiles?: number
  maxFileSize?: number  // in MB
  // Properties for repeatable_group fields
  groupFields?: FieldSchema[]
  minItems?: number
  maxItems?: number
}

export interface RequestType {
  id: string
  name: string
  fields_schema: FieldSchema[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  ragione_sociale: string
  external_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface Request {
  id: string
  request_type_id: string
  request_type?: RequestType
  title: string
  status: RequestStatus | DM329Status
  assigned_to?: string
  assigned_user?: User
  created_by: string
  creator?: User
  customer_id?: string | null
  customer?: Customer
  custom_fields: Record<string, any>
  is_hidden: boolean
  is_blocked?: boolean
  off_cac?: 'off' | 'cac' | ''
  created_at: string
  updated_at: string
}

export interface RequestHistory {
  id: string
  request_id: string
  status_from: string | null
  status_to: string
  changed_by: string
  changed_by_user?: User
  notes?: string | null
  created_at: string
}

export interface RequestBlock {
  id: string
  request_id: string
  blocked_by: string
  blocked_by_user?: User
  blocked_at: string
  unblocked_by?: string | null
  unblocked_by_user?: User | null
  unblocked_at?: string | null
  reason: string
  resolution_notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_size: number
  uploaded_by: string
  created_at: string
}

export type NotificationEventType =
  | 'request_created'
  | 'request_suspended'
  | 'request_unsuspended'
  | 'request_blocked'
  | 'status_change'

export interface Notification {
  id: string
  user_id: string
  request_id?: string
  request?: Request
  type: string
  message: string
  status_from?: string | null
  status_to?: string | null
  event_type: NotificationEventType
  metadata?: Record<string, any>
  read: boolean
  created_at: string
}

export interface UserNotificationPreferences {
  id: string
  user_id: string
  in_app: boolean
  email: boolean
  status_transitions: Record<string, boolean> // "STATUS_FROM_STATUS_TO": boolean
  created_at: string
  updated_at: string
}

export interface StatusTransitionResult {
  valid: boolean
  message: string
}

export interface DeletionArchive {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  deleted_count: number
  deleted_by: string
  deleted_by_user?: User
  created_at: string
}
