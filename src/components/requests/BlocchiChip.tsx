import { useState, type MouseEvent } from 'react'
import { Box, Chip, Divider, Popover, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  Block as BlockIcon,
  CheckCircleOutline as RipartitaIcon,
} from '@mui/icons-material'
import { durataInParole, type RiassuntoBlocchi } from '@/utils/blocchiPratica'

interface BlocchiChipProps {
  riassunto: RiassuntoBlocchi
}

/**
 * Lo stato dei fermi accanto allo stato della pratica: ambra se è ferma adesso, verde
 * spento se è ripartita ma si è fermata almeno una volta, niente se non si è mai fermata.
 *
 * Prende il posto del triangolino, che parlava solo del fermo in corso: un blocco risolto
 * la settimana prima non lasciava alcuna traccia fuori dallo storico, e chi apriva la
 * pratica non aveva modo di sapere che era già rimasta indietro una volta. Il conteggio sta
 * nel chip perché è la parte che si legge di sfuggita; date, motivi e nomi si aprono con un
 * clic, che è quanto basta per una cosa che non si consulta a ogni visita.
 */
export const BlocchiChip = ({ riassunto }: BlocchiChipProps) => {
  const [ancora, setAncora] = useState<HTMLElement | null>(null)

  if (riassunto.totale === 0) return null

  const ferma = riassunto.attivo !== null
  const etichetta = ferma
    ? `Bloccata da ${durataInParole(riassunto.giorniFermaOra ?? 0)}${riassunto.totale > 1 ? ` · ${riassunto.totale}° blocco` : ''}`
    : `Ripartita · ${riassunto.totale} ${riassunto.totale === 1 ? 'blocco' : 'blocchi'}`

  const apri = (e: MouseEvent<HTMLElement>) => setAncora(e.currentTarget)

  return (
    <>
      <Chip
        size="small"
        clickable
        onClick={apri}
        icon={ferma ? <BlockIcon /> : <RipartitaIcon />}
        label={etichetta}
        color={ferma ? 'warning' : 'success'}
        variant={ferma ? 'filled' : 'outlined'}
        aria-label={`${etichetta}. Apri la storia dei blocchi`}
        sx={{ fontWeight: 600 }}
      />

      <Popover
        open={Boolean(ancora)}
        anchorEl={ancora}
        onClose={() => setAncora(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.5, maxWidth: 460 } } }}
      >
        <Typography variant="overline" color="text.secondary" display="block">
          Blocchi della pratica
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {riassunto.totale === 1 ? 'Un fermo' : `${riassunto.totale} fermi`} · {durataInParole(riassunto.giorniPersi)} complessivi
        </Typography>

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {riassunto.eventi.map((e, i) => (
            <Box key={`${e.tipo}-${e.quando}-${i}`} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  mt: '5px', width: 8, height: 8, borderRadius: '50%', flex: 'none',
                  bgcolor: e.tipo === 'blocco' ? 'warning.main' : 'success.main',
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                  <Box component="strong" sx={{ fontWeight: 600 }}>
                    {e.tipo === 'blocco' ? 'Bloccata' : 'Sbloccata'}
                  </Box>
                  {' il '}
                  {new Date(e.quando).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  {e.chi ? ` da ${e.chi}` : ''}
                </Typography>
                {e.nota && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {e.nota}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Il richiamo allo storico: qui ci sono i soli fermi, là tutti i passaggi di stato. */}
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', mt: 1.25, pt: 1, borderTop: 1, borderColor: (t) => alpha(t.palette.divider, 0.8) }}
        >
          Tutti i passaggi di stato sono nello storico della pratica.
        </Typography>
      </Popover>
    </>
  )
}
