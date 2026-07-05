import { ReactNode } from 'react'
import { Box, Paper, Skeleton, Typography } from '@mui/material'

interface KpiTileProps {
  label: string
  count: ReactNode
  /** Colore accento del bordo sinistro e del numero (di solito da getStatusHex). */
  accentColor?: string
  /** Testo secondario sotto il numero (es. "+2 oggi"). */
  caption?: string
  onClick?: () => void
  loading?: boolean
}

/**
 * Tile KPI riutilizzabile: etichetta + numero grande + accento colore.
 * Estratto da StatusTiles; l'accento arriva dai token di stato.
 */
export function KpiTile({ label, count, accentColor, caption, onClick, loading }: KpiTileProps) {
  if (loading) {
    return (
      <Paper sx={{ p: 2, height: '100%' }}>
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="40%" height={36} sx={{ mt: 1 }} />
      </Paper>
    )
  }

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...(onClick && {
          '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
        }),
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography variant="h4" component="div" sx={{ fontWeight: 700, color: accentColor || 'text.primary' }}>
          {count}
        </Typography>
      </Box>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
          {caption}
        </Typography>
      )}
    </Paper>
  )
}
