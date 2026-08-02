import type { Severity } from '@/services/equipmentAudit'

/** Colore MUI per ciascun livello di gravità, condiviso da pannello e righe. */
export const SEVERITY_COLOR: Record<Severity, 'error' | 'warning' | 'info' | 'default'> = {
  critica: 'error',
  alta: 'warning',
  media: 'info',
  bassa: 'default',
}
