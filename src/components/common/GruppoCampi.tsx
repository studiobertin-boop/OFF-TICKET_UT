import type { ReactNode } from 'react'
import { Stack, Tooltip } from '@mui/material'
import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material'
import { SectionLabel } from './SectionLabel'

export interface GruppoCampiProps {
  titolo: string
  /**
   * La spiegazione lunga, che compare al passaggio del mouse sulla ⓘ.
   *
   * Ci va quella *procedurale* — «l'immagine viene ritagliata automaticamente…» — che si
   * legge la prima volta e poi è rumore. Quella che cambia cosa scrivi in un campo va
   * invece nell'`helperText` del campo, in chiaro, dove la si legge senza cercarla.
   */
  spiegazione?: string
  children: ReactNode
}

/**
 * Un gruppo di campi con la sua etichetta.
 *
 * Nasce da una finestra che annunciava ogni sezione con un titolo, un capoverso di prosa e
 * una riga di separazione: tre elementi, spesso più alti dei due campi che presentavano.
 * Qui l'annuncio è una riga sola e la prosa si ritira sotto la ⓘ, che resta lì per chi la
 * cerca la prima volta.
 */
export const GruppoCampi = ({ titolo, spiegazione, children }: GruppoCampiProps) => (
  <Stack spacing={1.25}>
    <Stack direction="row" spacing={0.75} alignItems="center">
      <SectionLabel>{titolo}</SectionLabel>
      {spiegazione && (
        <Tooltip title={spiegazione} placement="top-start">
          <InfoOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled', cursor: 'help' }} />
        </Tooltip>
      )}
    </Stack>
    {children}
  </Stack>
)
