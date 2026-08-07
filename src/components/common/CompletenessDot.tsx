import { Box, Tooltip } from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { eCompleta, type Completezza } from '@/utils/schedaCompleteness'

export interface CompletenessDotProps {
  completezza: Completezza
  /** Nome del record, per il tooltip («S1: mancano Marca, Anno»). */
  soggetto?: string
}

/**
 * Stato di compilazione di una singola riga: spunta verde quando è completa,
 * pastiglia ambra col rapporto quando manca qualcosa.
 *
 * Il rapporto, e non la sola percentuale, perché a fianco di righe di tipi diversi il
 * denominatore cambia: un filtro completo è 5 su 5, un serbatoio completo è 17 su 17,
 * e vedere il denominatore spiega da solo perché quella riga mezza vuota è verde.
 */
export const CompletenessDot = ({ completezza, soggetto }: CompletenessDotProps) => {
  const pieno = eCompleta(completezza)

  const titolo = pieno
    ? `${soggetto ? `${soggetto}: ` : ''}tutti i ${completezza.previsti} campi previsti sono compilati`
    : `${soggetto ? `${soggetto} — ` : ''}mancano: ${completezza.mancanti.join(', ')}`

  return (
    <Tooltip title={titolo} placement="right">
      <Box
        component="span"
        aria-label={titolo}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 18,
          px: 0.5,
          borderRadius: '9px',
          border: '1px solid',
          fontSize: '0.62rem',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          borderColor: pieno ? 'success.main' : 'warning.main',
          color: pieno ? 'success.main' : 'warning.main',
          bgcolor: (t) => alpha(pieno ? t.palette.success.main : t.palette.warning.main, 0.12),
        }}
      >
        {pieno ? (
          <CheckIcon sx={{ fontSize: '0.8rem' }} />
        ) : (
          `${completezza.compilati}/${completezza.previsti}`
        )}
      </Box>
    </Tooltip>
  )
}
