/**
 * Installer Types
 *
 * Type definitions for installers (installatori) management
 * Installers are Italian companies only - no foreign option
 */

// ================================================
// CORE TYPES
// ================================================

/**
 * Installer entity (from database)
 */
export interface Installer {
  id: string
  nome: string

  // Italian fields (all required for installers)
  partita_iva: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string

  // Metadata
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
  created_by?: string | null
}

/**
 * Input for creating new installer
 * All fields required
 */
export interface CreateInstallerInput {
  nome: string
  partita_iva: string
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}

/**
 * Input for updating installer
 * All fields optional (partial update)
 */
export interface UpdateInstallerInput {
  nome?: string
  partita_iva?: string
  via?: string
  numero_civico?: string
  cap?: string
  comune?: string
  provincia?: string
}

// ================================================
// API RESPONSE TYPES
// ================================================

/**
 * Paginated response for installers list
 */
export interface InstallersResponse {
  data: Installer[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Filters for querying installers
 */
export interface InstallerFilters {
  search?: string
  page?: number
  pageSize?: number
  is_active?: boolean
}

/**
 * Installer completeness check result
 */
export interface InstallerCompleteness {
  isComplete: boolean
  missingFields: Array<{
    field: keyof Installer
    label: string
  }>
}
