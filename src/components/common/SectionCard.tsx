import { ReactNode } from 'react'
import { Box, Card, CardContent, Typography, SxProps, Theme } from '@mui/material'

interface SectionCardProps {
  /** Titolo sezione (mostrato in maiuscoletto). */
  title?: ReactNode
  /** Azioni a destra nell'intestazione. */
  actions?: ReactNode
  /** Rimuove il padding del contenuto (utile per tabelle a piena larghezza). */
  noPadding?: boolean
  sx?: SxProps<Theme>
  children: ReactNode
}

/**
 * Scheda-sezione standard: Card + intestazione titolo + contenuto.
 * Sostituisce il pattern ripetuto Card > CardContent > Typography h6.
 */
export function SectionCard({ title, actions, noPadding, sx, children }: SectionCardProps) {
  return (
    <Card sx={sx}>
      {(title || actions) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2,
            py: 1.25,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {title && (
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {title}
            </Typography>
          )}
          {actions}
        </Box>
      )}
      <CardContent sx={noPadding ? { p: 0, '&:last-child': { pb: 0 } } : undefined}>
        {children}
      </CardContent>
    </Card>
  )
}
