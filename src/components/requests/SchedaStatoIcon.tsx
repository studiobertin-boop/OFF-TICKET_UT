import { Box, Tooltip } from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material'
import { STATO_SCHEDA_LABELS, type CompilazioneScheda } from '@/utils/schedaStato'

/**
 * Stato di compilazione della scheda dati, in una icona della misura delle altre
 * segnalazioni dell'elenco pratiche.
 *
 * Vuota e completa sono due forme nette — cerchio aperto, cerchio spuntato —; in mezzo c'è
 * la percentuale, che è l'unica cosa che distingue una scheda appena iniziata da una a cui
 * manca un campo. Due cifre entrano in 19px e non chiedono una legenda.
 *
 * Uno stato imposto a mano si disegna uguale ma con il contorno tratteggiato: chi guarda
 * l'elenco deve poter distinguere ciò che la scheda dice da ciò che qualcuno ha dichiarato.
 * La percentuale resta quella reale in entrambi i casi.
 */
export const MISURA_ICONA = 19

const tratteggio = (colore: string) => ({
  outline: '1px dashed',
  outlineColor: colore,
  outlineOffset: '1px',
  borderRadius: '50%',
})

/** Il solo segno, senza testo di aiuto: serve anche al comando del dettaglio pratica. */
export const SchedaStatoMark = ({ compilazione }: { compilazione: CompilazioneScheda }) => {
  const { stato, percentuale, manuale } = compilazione

  if (stato === 'completa') {
    return (
      <CheckCircleIcon
        sx={{ fontSize: MISURA_ICONA, color: 'success.main', ...(manuale ? tratteggio('success.main') : {}) }}
      />
    )
  }

  if (stato === 'vuota') {
    return (
      <RadioButtonUncheckedIcon
        sx={{ fontSize: MISURA_ICONA, color: 'text.disabled', ...(manuale ? tratteggio('text.disabled') : {}) }}
      />
    )
  }

  return (
    <Box
      component="span"
      sx={{
        width: MISURA_ICONA,
        height: MISURA_ICONA,
        borderRadius: '50%',
        border: `1.5px ${manuale ? 'dashed' : 'solid'}`,
        borderColor: 'warning.main',
        color: 'warning.main',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6rem',
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {percentuale}
    </Box>
  )
}

/** Come si legge lo stato a parole, testo di aiuto dell'icona e del comando. */
export const descriviCompilazione = ({ stato, percentuale, manuale }: CompilazioneScheda) => {
  const base = STATO_SCHEDA_LABELS[stato]
  if (!manuale) return stato === 'parziale' ? `${base} (${percentuale}%)` : base
  return `${base} — impostata a mano; i dati compilati sono il ${percentuale}%`
}

export const SchedaStatoIcon = ({ compilazione }: { compilazione: CompilazioneScheda }) => (
  <Tooltip title={descriviCompilazione(compilazione)} arrow>
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <SchedaStatoMark compilazione={compilazione} />
    </Box>
  </Tooltip>
)
