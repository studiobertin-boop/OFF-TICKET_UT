import { Chip } from '@mui/material'
import { FilterList as FilterListIcon } from '@mui/icons-material'

interface ConteggioFiltratiProps {
  /** Richieste che passano i filtri, cioè quelle visualizzate. */
  filtrate: number
  /** Richieste dell'elenco prima dei filtri. */
  totali: number
}

/**
 * Quante richieste restano a filtri applicati, accanto alle chip dei filtri attivi.
 *
 * Pieno e in colore primario, a differenza delle chip dei filtri, che sono grigie: è il
 * risultato dei filtri, non uno di loro, e deve leggersi per primo.
 */
export const ConteggioFiltrati = ({ filtrate, totali }: ConteggioFiltratiProps) => (
  <Chip
    size="small"
    color="primary"
    icon={<FilterListIcon />}
    aria-label={`${filtrate} richieste visualizzate su ${totali}`}
    label={
      <>
        <strong>{filtrate}</strong> di {totali} richieste
      </>
    }
    sx={{ fontWeight: 500 }}
  />
)
