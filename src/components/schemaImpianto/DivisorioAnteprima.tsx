/**
 * Il divisorio fra la tela e l'anteprima: si afferra e si trascina per decidere quanto spazio
 * dare al disegno e quanto alla resa finale.
 *
 * L'aritmetica sta in `percentualeAnteprima` (preferenzeEditor.ts) perché lì si può collaudare;
 * qui resta il solo gesto. La misura viene dal riquadro del genitore, cioè dalla riga che
 * contiene tela e anteprima: il divisorio va montato come suo figlio diretto.
 */
import { useCallback } from 'react'
import { Box } from '@mui/material'
import { percentualeAnteprima } from './preferenzeEditor'

interface DivisorioAnteprimaProps {
  /** Chiamata a ogni movimento con la nuova quota dell'anteprima, già entro i limiti. */
  onCambia: (percentuale: number) => void
}

export function DivisorioAnteprima({ onCambia }: DivisorioAnteprimaProps) {
  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Senza questo il browser comincia una selezione di testo e il trascinamento si impunta.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const riga = e.currentTarget.parentElement?.getBoundingClientRect()
      if (!riga || riga.width === 0) return
      onCambia(percentualeAnteprima(riga.right, riga.width, e.clientX))
    },
    [onCambia],
  )

  // Rilascio e annullamento chiudono il gesto allo stesso modo. L'annullamento arriva quando il
  // sistema revoca il puntatore (una gesture del sistema operativo, un tocco che diventa
  // scorrimento): senza questo ramo la cattura resterebbe alzata e il divisorio continuerebbe a
  // seguire il puntatore anche a dito sollevato.
  const suFineGesto = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Larghezza dell’anteprima"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suFineGesto}
      onPointerCancel={suFineGesto}
      sx={{
        flex: '0 0 auto',
        width: 8,
        cursor: 'col-resize',
        bgcolor: 'divider',
        touchAction: 'none',
        '&:hover': { bgcolor: 'primary.main' },
      }}
    />
  )
}
