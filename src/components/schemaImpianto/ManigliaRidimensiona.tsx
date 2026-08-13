/**
 * La maniglia che ridimensiona la finestra dell'editor. Sta in fondo alla barra inferiore, cioè
 * nell'angolo in basso a destra della finestra: sovrapporla al Paper del dialog la farebbe
 * cadere sopra il pulsante di conferma.
 *
 * L'aritmetica sta in `dimensioneFinestra` (preferenzeEditor.ts), che ricava le percentuali
 * dalla distanza dell'angolo dal centro dello schermo invece di inseguire il bordo: il dialog è
 * centrato, e un elemento che si ricentra mentre lo si trascina insegue il puntatore.
 */
import { useCallback } from 'react'
import { SouthEast as ManigliaIcon } from '@mui/icons-material'
import { Box, Tooltip } from '@mui/material'
import { dimensioneFinestra } from './preferenzeEditor'

interface ManigliaRidimensionaProps {
  onCambia: (dimensione: { larghezza: number; altezza: number }) => void
}

export function ManigliaRidimensiona({ onCambia }: ManigliaRidimensionaProps) {
  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      onCambia(dimensioneFinestra(e.clientX, e.clientY, window.innerWidth, window.innerHeight))
    },
    [onCambia],
  )

  // Come per il divisorio: rilascio e annullamento chiudono il gesto allo stesso modo, così una
  // revoca del puntatore da parte del sistema non lascia la cattura alzata.
  const suFineGesto = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <Tooltip title="Trascina per ridimensionare la finestra">
      <Box
        onPointerDown={suPointerDown}
        onPointerMove={suPointerMove}
        onPointerUp={suFineGesto}
        onPointerCancel={suFineGesto}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'nwse-resize',
          color: 'text.secondary',
          touchAction: 'none',
          pl: 1,
          '&:hover': { color: 'text.primary' },
        }}
      >
        <ManigliaIcon fontSize="small" />
      </Box>
    </Tooltip>
  )
}
