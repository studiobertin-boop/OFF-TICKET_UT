import { useState } from 'react'
import {
  Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material'
import { ArrowDropDown as ArrowDropDownIcon, Check as CheckIcon } from '@mui/icons-material'
import { STATO_SCHEDA_LABELS, type CompilazioneScheda, type StatoScheda } from '@/utils/schedaStato'
import { SchedaStatoMark, descriviCompilazione } from './SchedaStatoIcon'

/**
 * Comando che impone — o restituisce al calcolo — lo stato di compilazione della scheda dati.
 *
 * Sta accanto al pulsante «Scheda dati» e mostra lo stato corrente con lo stesso segno che
 * porta l'elenco pratiche: chi guarda il dettaglio vede subito che cosa leggerà chi guarda
 * l'elenco. «Automatico» è la prima voce ed è il ripristino: dice anche a quanto è la scheda,
 * così si sa che cosa si sta per riprendere.
 */
const STATI: StatoScheda[] = ['vuota', 'parziale', 'completa']

export interface SchedaStatoToggleProps {
  compilazione: CompilazioneScheda
  /** `null` riporta lo stato al calcolo automatico. */
  onScegli: (stato: StatoScheda | null) => void
  disabled?: boolean
}

/**
 * Lo stato che il calcolo dichiara, ricostruito dalla percentuale: 0 e 100 sono i due
 * estremi che il calcolo riserva a «vuota» e «completa», quindi la corrispondenza è esatta.
 */
const statoDaPercentuale = (p: number): StatoScheda =>
  p === 0 ? 'vuota' : p === 100 ? 'completa' : 'parziale'

export const SchedaStatoToggle = ({ compilazione, onScegli, disabled }: SchedaStatoToggleProps) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const chiudi = () => setAnchor(null)
  const scegli = (stato: StatoScheda | null) => { chiudi(); onScegli(stato) }

  const desunto = statoDaPercentuale(compilazione.percentuale)

  return (
    <>
      <Tooltip title={descriviCompilazione(compilazione)}>
        <span>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={disabled}
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Stato di compilazione della scheda dati"
            endIcon={<ArrowDropDownIcon />}
            sx={{ minWidth: 0, px: 0.75, '& .MuiButton-endIcon': { ml: 0.25 } }}
          >
            <SchedaStatoMark compilazione={compilazione} />
          </Button>
        </span>
      </Tooltip>

      <Menu anchorEl={anchor} open={!!anchor} onClose={chiudi}>
        <MenuItem selected={!compilazione.manuale} onClick={() => scegli(null)}>
          <ListItemIcon>{!compilazione.manuale && <CheckIcon fontSize="small" />}</ListItemIcon>
          <ListItemText
            primary="Automatico"
            secondary={`${STATO_SCHEDA_LABELS[desunto].toLowerCase()} · ${compilazione.percentuale}% compilata`}
          />
        </MenuItem>

        <Divider />
        <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>
          Imponi
        </Typography>

        {STATI.map((stato) => {
          const scelto = compilazione.manuale && compilazione.stato === stato
          return (
            <MenuItem key={stato} selected={scelto} onClick={() => scegli(stato)}>
              <ListItemIcon>{scelto && <CheckIcon fontSize="small" />}</ListItemIcon>
              <ListItemText primary={STATO_SCHEDA_LABELS[stato]} />
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}
