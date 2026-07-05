import { ReactNode } from 'react'
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material'
import { chartHeights } from '@/theme/tokens'

interface ChartCardProps {
  title: string
  /** Altezza area grafico; default = altezza barre da token. */
  height?: number
  loading?: boolean
  empty?: boolean
  emptyLabel?: string
  actions?: ReactNode
  children: ReactNode
}

/**
 * Contenitore standard per i grafici: titolo + stati loading/empty coerenti + altezza da token.
 * Sostituisce il boilerplate Card+CardContent+titolo+Skeleton duplicato in ogni grafico.
 */
export function ChartCard({
  title,
  height = chartHeights.bar,
  loading,
  empty,
  emptyLabel = 'Nessun dato disponibile',
  actions,
  children,
}: ChartCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          {actions}
        </Box>
        {loading ? (
          <Skeleton variant="rounded" height={height} />
        ) : empty ? (
          <Box
            sx={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            {emptyLabel}
          </Box>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
