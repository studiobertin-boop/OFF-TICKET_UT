import type { ReactElement } from 'react'
import { Box, Button, Tooltip } from '@mui/material'

export interface AzioneIconaProps {
  icona: ReactElement
  /** Nome dell'azione: è l'etichetta che si apre, il tooltip e il nome accessibile. */
  testo: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  /**
   * `error` per le azioni che non si tornano indietro: in una fila di icone tutte uguali
   * niente distingue più la routine dall'irreversibile, e il colore è ciò che resta a
   * dirlo quando la parola è chiusa.
   */
  colore?: 'primary' | 'error' | 'warning' | 'success'
  /** Sfondo pieno invece del solo contorno: segnala che l'azione ha già un risultato pronto. */
  pieno?: boolean
}

/**
 * Azione di una barra: icona sempre in vista, parola che si apre al passaggio del mouse.
 *
 * Le parole in fila occupano tutta la barra e la mandano a capo sulle finestre strette, ma
 * nasconderle dietro tre puntini le rende introvabili — è lo stesso equivoco della freccina
 * dei dettagli nella tabella apparecchiature. Così le icone restano tutte visibili e la
 * parola arriva a chiedere.
 *
 * L'apertura è una griglia da `0fr` a `1fr` e non una larghezza in pixel: la parola detta la
 * propria misura, quindi «Visualizza dati CIVA» e «Elimina» si aprono ciascuna per quel che
 * è lunga, senza numeri da tenere allineati a mano.
 *
 * Dove il passaggio del mouse non esiste — un tablet in cantiere — la parola sta sempre
 * aperta: `@media (hover: none)`. E `aria-label` porta comunque il nome dell'azione a chi
 * naviga con la tastiera o con un lettore di schermo, che l'animazione non la vede.
 */
export const AzioneIcona = ({
  icona, testo, onClick, disabled, colore = 'primary', pieno = false,
}: AzioneIconaProps) => (
  <Tooltip title={testo} placement="bottom">
    <span>
      <Button
        size="small"
        variant={pieno ? 'contained' : 'outlined'}
        color={colore}
        onClick={onClick}
        disabled={disabled}
        aria-label={testo}
        // Bordo a piena opacità: il 50% di default di MUI su fondo scuro sparisce.
        sx={{
          minWidth: 0, px: 0.9, whiteSpace: 'nowrap',
          ...(pieno ? {} : { borderColor: `${colore}.main` }),
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
)
