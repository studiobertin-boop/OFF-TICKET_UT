import { ReactNode } from 'react'
import { Typography } from '@mui/material'

export interface SectionLabelProps {
  children: ReactNode
}

/**
 * Etichetta di sezione dentro una scheda.
 *
 * Non è un titolo: è un separatore che dice di cosa parla il gruppo di campi
 * sotto. Con `h6` sezioni da cinque campi e sezioni da una riga pesavano uguale
 * e promettevano più di quello che contenevano; qui il peso torna al contenuto.
 */
export const SectionLabel = ({ children }: SectionLabelProps) => (
  <Typography
    variant="subtitle2"
    color="text.secondary"
    sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
  >
    {children}
  </Typography>
)
