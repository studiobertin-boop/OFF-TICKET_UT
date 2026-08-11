/**
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { Box, IconButton, MenuItem, Select, Typography, type SelectChangeEvent } from '@mui/material'
import { ArrowUpward, ArrowDownward } from '@mui/icons-material'
import { radii } from '@/theme/tokens'
import { ORDINE_RUOLI, RUOLO_LABELS, type RuoloDichiarazione } from '@/services/dichiarazioni/tipi'

export interface PaginaMiniaturaProps {
  anteprimaUrl: string | null
  etichetta: string
  ruolo: RuoloDichiarazione | null
  onCambiaRuolo: (ruolo: RuoloDichiarazione | null) => void
  /** Frecce di riordino, mostrate solo quando la pagina ha già un ruolo assegnato. */
  onSposta?: (direzione: -1 | 1) => void
  primoNelRuolo?: boolean
  ultimoNelRuolo?: boolean
}

const VUOTO = '__nessuno__'

export const PaginaMiniatura = ({
  anteprimaUrl,
  etichetta,
  ruolo,
  onCambiaRuolo,
  onSposta,
  primoNelRuolo,
  ultimoNelRuolo,
}: PaginaMiniaturaProps) => {
  const cambia = (e: SelectChangeEvent) => {
    const v = e.target.value
    onCambiaRuolo(v === VUOTO ? null : (v as RuoloDichiarazione))
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        width: 120,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: `${radii.control}px`,
        p: 0.75,
      }}
    >
      <Box
        sx={{
          width: '100%',
          aspectRatio: '1 / 1.35',
          bgcolor: 'action.hover',
          borderRadius: `${radii.control}px`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {anteprimaUrl && (
          <Box component="img" src={anteprimaUrl} alt={etichetta} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
      </Box>

      <Typography variant="caption" noWrap title={etichetta} color="text.secondary">
        {etichetta}
      </Typography>

      <Select size="small" variant="standard" disableUnderline value={ruolo ?? VUOTO} onChange={cambia} sx={{ fontSize: '0.72rem' }}>
        <MenuItem value={VUOTO} dense sx={{ fontSize: '0.72rem' }}>
          <Typography component="span" variant="caption" color="text.disabled">nessuno</Typography>
        </MenuItem>
        {ORDINE_RUOLI.map((r) => (
          <MenuItem key={r} value={r} dense sx={{ fontSize: '0.72rem' }}>
            {RUOLO_LABELS[r]}
          </MenuItem>
        ))}
      </Select>

      {ruolo && onSposta && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
          <IconButton size="small" disabled={primoNelRuolo} onClick={() => onSposta(-1)} aria-label="Sposta prima">
            <ArrowUpward sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" disabled={ultimoNelRuolo} onClick={() => onSposta(1)} aria-label="Sposta dopo">
            <ArrowDownward sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
