import { Box, LinearProgress, Tooltip, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material'
import { eCompleta, percentuale, type Completezza } from '@/utils/schedaCompleteness'

export interface CompletenessBarProps {
  completezza: Completezza
  /** Larghezza della barra in px. */
  larghezza?: number
  /** Testo davanti alla barra (es. «6 di 8 complete»). */
  etichetta?: string
  /** Elenca i campi mancanti accanto alla barra, non solo nel tooltip. */
  mostraMancanti?: boolean
}

/**
 * Avanzamento di compilazione di una sezione: barra + rapporto.
 *
 * Verde solo a sezione completa: un colore che resta uguale al 60% e al 100% non dice
 * nulla, e la barra da sola non basta a distinguere «quasi» da «fatto».
 */
export const CompletenessBar = ({
  completezza,
  larghezza = 120,
  etichetta,
  mostraMancanti = false,
}: CompletenessBarProps) => {
  const pieno = eCompleta(completezza)
  const colore = pieno ? 'success' : 'warning'
  const mancanti = completezza.mancanti

  const riepilogo = pieno
    ? `${completezza.previsti} campi su ${completezza.previsti}`
    : `Mancano: ${mancanti.join(', ')}`

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {etichetta && (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {etichetta}
        </Typography>
      )}

      <Tooltip title={riepilogo} placement="top">
        <LinearProgress
          variant="determinate"
          value={percentuale(completezza)}
          color={colore}
          sx={{ width: larghezza, height: 5, borderRadius: 3, flex: 'none' }}
        />
      </Tooltip>

      {pieno ? (
        <Typography
          variant="caption"
          color="success.main"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
        >
          <CheckCircleIcon sx={{ fontSize: '0.95rem' }} />
          {completezza.compilati} di {completezza.previsti}
        </Typography>
      ) : (
        <Typography variant="caption" color="warning.main" sx={{ minWidth: 0 }}>
          {completezza.compilati} di {completezza.previsti}
          {mostraMancanti && mancanti.length > 0 && (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {' '}· manca {mancanti.length === 1 ? `«${mancanti[0]}»` : `${mancanti.length} campi`}
            </Box>
          )}
        </Typography>
      )}
    </Box>
  )
}
