import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { cellTdSx } from './EquipmentCells'

/**
 * Elementi condivisi per le sotto-bande delle tabelle scheda DM329
 * (valvola, disoleatore, scambiatore, recipiente): una riga <tr> a piena
 * larghezza con sfondo tinta della sezione e campi etichettati compatti.
 */

/** Campo etichettato compatto (label sopra input) usato nelle sotto-bande. */
export const Field = ({ label, w = 120, children }: { label: ReactNode; w?: number; children: ReactNode }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
    <Typography component="span" sx={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
    <Box sx={{ width: w, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>{children}</Box>
  </Box>
)

/** Etichetta di testa di una sotto-banda (icona + codice/descrizione). */
export const SubBandLabel = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.76rem', alignSelf: 'center', pr: 0.5, whiteSpace: 'nowrap' }}>
    {icon}{children}
  </Box>
)

/** Interruttore di riga: forza il ritorno a capo dentro il flex della sotto-banda. */
export const BandBreak = () => <Box sx={{ flexBasis: '100%', height: 0 }} />

/** Riga <tr> full-span tinta per una sotto-banda. */
export const SubBand = ({ colSpan, color, children }: { colSpan: number; color: string; children: ReactNode }) => (
  <Box component="tr">
    <Box component="td" colSpan={colSpan} sx={{ ...cellTdSx, bgcolor: alpha(color, 0.05) }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1.5, px: 1.5, py: 1 }}>
        {children}
      </Box>
    </Box>
  </Box>
)
