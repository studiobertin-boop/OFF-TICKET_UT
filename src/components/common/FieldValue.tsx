import { ReactNode } from 'react'
import { Box, Typography, SxProps, Theme } from '@mui/material'

/**
 * Segnaposti che le varie catene di fallback usano per "dato assente".
 * clientInfo in RequestDetail normalizza i campi mancanti a 'N/A', quindi il
 * confronto non può limitarsi a stringa vuota / null.
 */
const SEGNAPOSTI_VUOTO = new Set(['', 'n/a', 'na', '-', '—'])

const isValoreVuoto = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return SEGNAPOSTI_VUOTO.has(value.trim().toLowerCase())
  return false
}

export interface FieldValueProps {
  label: ReactNode
  value?: ReactNode
  /** Valore in monospace: codici pratica, sigle, identificativi. */
  mono?: boolean
  sx?: SxProps<Theme>
}

/**
 * Coppia etichetta/valore compatta.
 *
 * Un dato mancante occupa una riga sola con un trattino spento invece di
 * stampare "N/A" a piena altezza: sulle pratiche importate da CSV metà dei campi
 * è vuota, e il rumore dei segnaposto nasconde quelli valorizzati.
 */
export const FieldValue = ({ label, value, mono, sx }: FieldValueProps) => {
  const vuoto = isValoreVuoto(value)

  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={vuoto ? 'text.disabled' : 'text.primary'}
        sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word' }}
      >
        {vuoto ? '—' : value}
      </Typography>
    </Box>
  )
}
