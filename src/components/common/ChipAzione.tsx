import { useState, type ReactElement } from 'react'
import { Chip, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material'

export interface VoceChipAzione {
  icona: ReactElement
  testo: string
  onClick: () => void
}

export interface ChipAzioneProps {
  /** Quel che si legge dentro il chip: un codice di apparecchiatura, o una lettera sola. */
  sigla: string
  /** Nome dell'azione: tooltip e nome accessibile. */
  testo: string
  /** Spunta piena su fondo verde invece di spunta vuota contornata. */
  fatto: boolean
  onClick?: () => void
  /**
   * Se ci sono, il clic apre questo menu invece di chiamare `onClick`: è il caso dei
   * documenti già generati, dove «scarica» e «rigenera» convivono nello stesso posto.
   */
  voci?: VoceChipAzione[]
  disabled?: boolean
}

/**
 * Pulsante a forma di chip per un traguardo della pratica: relazione, dichiarazioni,
 * fascicolo di un'apparecchiatura, documentazione completa.
 *
 * Sta in barra titolo accanto al chip della percentuale di compilazione e ne ripete la
 * forma di proposito: dicono la stessa cosa — questo pezzo c'è o non c'è — e leggerli in
 * fila deve costare un colpo d'occhio solo. Da qui la spunta, che è il segno già usato lì
 * per «completo», e la sigla breve, che tiene la fila corta quanto basta a restare su una
 * riga sola.
 *
 * Non è un `AzioneIcona`: quelle sono le azioni della pratica (assegnare, aprire il CIVA)
 * e restano a destra, con la loro icona e la parola che si apre al passaggio del mouse.
 * Qui invece l'informazione è lo *stato*, e il pulsante la porta addosso.
 */
export const ChipAzione = ({ sigla, testo, fatto, onClick, voci, disabled }: ChipAzioneProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const conMenu = !!voci?.length

  // Il gestore c'è sempre, anche da disabilitato, e a rifiutare il clic è lui: è quel che
  // rende il chip un `button` per il browser e per chi legge con un lettore di schermo.
  // Togliendolo, «F» spento diventerebbe un pezzo di testo qualunque, senza ruolo né fuoco.
  const gestisciClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    if (conMenu) setAnchorEl(e.currentTarget)
    else onClick?.()
  }

  return (
    <>
      {/* Il `<span>` serve al tooltip: su un chip disabilitato — «F» finché manca un
          documento — MUI non riceverebbe alcun evento del mouse, e la spiegazione di
          *cosa* manca è proprio quella che serve di più. */}
      <Tooltip title={testo} placement="bottom">
        <span>
          <Chip
            size="small"
            variant={fatto ? 'filled' : 'outlined'}
            color={fatto ? 'success' : 'default'}
            icon={fatto ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
            label={sigla}
            aria-label={testo}
            disabled={disabled}
            onClick={gestisciClick}
            sx={{
              fontFamily: 'monospace',
              fontWeight: 700,
              '& .MuiChip-icon': { fontSize: 15 },
              ...(fatto ? {} : { borderColor: 'text.disabled', color: 'text.secondary' }),
            }}
          />
        </span>
      </Tooltip>

      {conMenu && (
        <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
          {voci!.map((voce) => (
            <MenuItem
              key={voce.testo}
              onClick={() => {
                setAnchorEl(null)
                voce.onClick()
              }}
            >
              <ListItemIcon>{voce.icona}</ListItemIcon>
              {voce.testo}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  )
}
