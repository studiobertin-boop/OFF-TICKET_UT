import type { PaletteMode } from '@mui/material'
import type { RequestStatus, DM329Status } from '@/types'

/**
 * FONTE DI VERITÀ UNICA per i colori degli stati.
 *
 * Sostituisce le tre mappe in conflitto che esistevano prima:
 *  - utils/workflow.ts  -> getStatusColor (nomi colore MUI)
 *  - dashboard/RequestsByStatusChart.ts -> getStatusColorHex (hex)
 *  - dashboard/StatusTiles + Dashboard.tsx (hex inline)
 *
 * Decisioni approvate:
 *  - "Assegnata" = indaco, "In lavorazione" = ambra (conflitto risolto)
 *  - "Bloccata" = rosso (da sbloccare), "Abortita" = grigio (annullata)
 *  - DM329 (1→7) = scala sequenziale che rende leggibile l'avanzamento
 *
 * Ogni token espone:
 *  - intent: nome colore MUI (per <Chip color> e retrocompatibilità)
 *  - light/dark: { main, bg } per rendering custom leggibile su entrambi i temi
 */

export type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

interface StatusToken {
  intent: ChipColor
  light: { main: string; bg: string }
  dark: { main: string; bg: string }
}

const DEFAULT_TOKEN: StatusToken = {
  intent: 'default',
  light: { main: '#64707f', bg: '#eceff3' },
  dark: { main: '#93a0af', bg: '#232b35' },
}

export const STATUS_TOKENS: Record<string, StatusToken> = {
  // ---- Workflow standard ----
  APERTA: {
    intent: 'info',
    light: { main: '#2f7fc9', bg: '#e6f0fa' },
    dark: { main: '#58a6e6', bg: '#14263a' },
  },
  ASSEGNATA: {
    intent: 'primary',
    light: { main: '#5457cf', bg: '#eaeafb' },
    dark: { main: '#8b8ef2', bg: '#1e2140' },
  },
  IN_LAVORAZIONE: {
    intent: 'warning',
    light: { main: '#c9770f', bg: '#fbefd9' },
    dark: { main: '#eaa73c', bg: '#33280f' },
  },
  COMPLETATA: {
    intent: 'success',
    light: { main: '#2b8a54', bg: '#e2f3e9' },
    dark: { main: '#4fc07e', bg: '#12301f' },
  },
  BLOCCATA: {
    intent: 'error',
    light: { main: '#cf3f3f', bg: '#fbe6e6' },
    dark: { main: '#ef6b6b', bg: '#351919' },
  },
  ABORTITA: {
    intent: 'default',
    light: { main: '#64707f', bg: '#eceff3' },
    dark: { main: '#93a0af', bg: '#232b35' },
  },

  // ---- Workflow DM329 (scala sequenziale 1→7) ----
  '1-INCARICO_RICEVUTO': {
    intent: 'info',
    light: { main: '#2f6fd0', bg: '#e6eefb' },
    dark: { main: '#5a9bea', bg: '#152439' },
  },
  '2-SCHEDA_DATI_PRONTA': {
    intent: 'info',
    light: { main: '#2f86c9', bg: '#e4f0fa' },
    dark: { main: '#4faede', bg: '#122938' },
  },
  '3-MAIL_CLIENTE_INVIATA': {
    intent: 'info',
    light: { main: '#2f9bb0', bg: '#e2f2f5' },
    dark: { main: '#3fbecb', bg: '#0f2d33' },
  },
  '4-DOCUMENTI_PRONTI': {
    intent: 'primary',
    light: { main: '#2fa891', bg: '#e2f3ef' },
    dark: { main: '#3ec3a6', bg: '#0f2e28' },
  },
  '5-ATTESA_FIRMA': {
    intent: 'warning',
    light: { main: '#2fa86e', bg: '#e3f3ea' },
    dark: { main: '#43c07f', bg: '#102e20' },
  },
  '6-PRONTA_PER_CIVA': {
    intent: 'success',
    light: { main: '#3a9e4e', bg: '#e6f2e8' },
    dark: { main: '#57b661', bg: '#122c19' },
  },
  '7-CHIUSA': {
    intent: 'success',
    light: { main: '#2b8a3f', bg: '#e3f1e6' },
    dark: { main: '#4fae5d', bg: '#122a18' },
  },
  'ARCHIVIATA NON FINITA': DEFAULT_TOKEN,

  // ---- Stati legacy / difensivi ----
  SOSPESA: DEFAULT_TOKEN,
}

type AnyStatus = RequestStatus | DM329Status | string

function tokenFor(status: AnyStatus): StatusToken {
  return STATUS_TOKENS[status] || DEFAULT_TOKEN
}

/** Nome colore MUI per lo stato (per <Chip color> / retrocompatibilità). */
export function getStatusIntent(status: AnyStatus): ChipColor {
  return tokenFor(status).intent
}

/** Colore esadecimale principale dello stato, adattato al tema (per grafici e accenti). */
export function getStatusHex(status: AnyStatus, mode: PaletteMode): string {
  const t = tokenFor(status)
  return mode === 'dark' ? t.dark.main : t.light.main
}

/** Coppia { main, bg } per rendere una chip di stato custom leggibile sul tema corrente. */
export function getStatusChipColors(
  status: AnyStatus,
  mode: PaletteMode
): { main: string; bg: string } {
  const t = tokenFor(status)
  return mode === 'dark' ? t.dark : t.light
}
