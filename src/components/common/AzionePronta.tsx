import { useState, type ReactElement } from 'react'
import { Box, Button, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material'

export interface VoceAzionePronta {
  icona: ReactElement
  testo: string
  onClick: () => void
}

export interface AzioneProntaProps {
  /** Icona del pulsante chiuso: quella dell'azione più comune (di norma lo scarico). */
  icona: ReactElement
  testo: string
  /** Le opzioni del menu che si apre al click, nell'ordine in cui compaiono. */
  voci: VoceAzionePronta[]
}

/**
 * Come `AzioneIcona`, ma per un risultato già pronto: sfondo verde pieno e un menu al
 * click al posto di un'unica azione, così scaricare il documento generato e rigenerarlo
 * restano nello stesso pulsante invece di dividersi in due icone affiancate — la seconda,
 * senza etichetta a riposo, passava inosservata.
 */
export const AzionePronta = ({ icona, testo, voci }: AzioneProntaProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  return (
    <>
      <Tooltip title={testo} placement="bottom">
        <span>
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label={testo}
            sx={{
              minWidth: 0, px: 0.9, whiteSpace: 'nowrap',
              '& .etichetta': {
                display: 'grid', gridTemplateColumns: '0fr', ml: 0, opacity: 0,
                transition: 'grid-template-columns .18s ease, opacity .18s ease, margin-left .18s ease',
              },
              '& .etichetta > span': { overflow: 'hidden', minWidth: 0 },
              '&:hover .etichetta, &:focus-visible .etichetta': {
                gridTemplateColumns: '1fr', ml: 0.75, opacity: 1,
              },
              '@media (hover: none)': {
                '& .etichetta': { gridTemplateColumns: '1fr', ml: 0.75, opacity: 1 },
              },
            }}
          >
            {icona}
            <Box component="span" className="etichetta"><span>{testo}</span></Box>
          </Button>
        </span>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {voci.map((voce) => (
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
    </>
  )
}
