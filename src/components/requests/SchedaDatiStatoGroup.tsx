import { Box, Button } from '@mui/material'
import { Assignment as AssignmentIcon } from '@mui/icons-material'
import { SchedaStatoToggle, type SchedaStatoToggleProps } from './SchedaStatoToggle'

export interface SchedaDatiStatoGroupProps {
  onApri: () => void
  toggle: Omit<SchedaStatoToggleProps, 'variante'>
}

/**
 * "Scheda dati" e il suo stato di compilazione fusi in un solo contorno: due zone
 * cliccabili — naviga a sinistra, apre il menu di stato a destra — che si leggono come un
 * unico controllo invece di due elementi slegati fianco a fianco.
 */
export const SchedaDatiStatoGroup = ({ onApri, toggle }: SchedaDatiStatoGroupProps) => (
  <Box sx={{ display: 'flex', border: 1, borderColor: 'primary.main', borderRadius: 1, overflow: 'hidden' }}>
    <Button
      size="small"
      variant="contained"
      color="primary"
      disableElevation
      startIcon={<AssignmentIcon />}
      onClick={onApri}
      sx={{ borderRadius: 0 }}
    >
      Scheda dati
    </Button>
    <SchedaStatoToggle {...toggle} variante="raggruppato" />
  </Box>
)
