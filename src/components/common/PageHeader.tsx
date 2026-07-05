import { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Contesto sopra il titolo (es. "Richieste / #1041"). */
  breadcrumb?: string
  /** Azioni allineate a destra (bottoni, filtri). */
  actions?: ReactNode
}

/**
 * Intestazione pagina standard: breadcrumb opzionale + titolo + azioni a destra.
 * Sostituisce i vari <Typography variant="h4"> sparsi nelle pagine.
 */
export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
        mb: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box>
        {breadcrumb && (
          <Typography variant="overline" color="text.secondary" display="block">
            {breadcrumb}
          </Typography>
        )}
        <Typography variant="h4">{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Box>
  )
}
