/**
 * La maniglia che ridimensiona la finestra dell'editor. Sta in fondo alla barra inferiore, cioè
 * dentro la finestra e non sull'angolo del Paper: sovrapporla al Paper del dialog la farebbe
 * cadere sopra il pulsante di conferma.
 *
 * Proprio perché non sta sull'angolo, il suo centro non coincide con il punto che
 * `dimensioneFinestra` userebbe per calcolare le percentuali: al pointerdown misuriamo lo
 * scostamento fra l'angolo vero e il punto di presa (`scostamentoManiglia`) e lo teniamo in un
 * ref, per sommarlo a ogni pointermove. Senza questo, il primo movimento farebbe scattare la
 * finestra alla dimensione che avrebbe se il puntatore fosse esattamente sull'angolo.
 *
 * L'aritmetica sta in `preferenzeEditor.ts`, che ricava le percentuali dalla distanza
 * dell'angolo dal centro dello schermo invece di inseguire il bordo: il dialog è centrato, e un
 * elemento che si ricentra mentre lo si trascina insegue il puntatore.
 */
import { useCallback, useRef } from 'react'
import { SouthEast as ManigliaIcon } from '@mui/icons-material'
import { Box, Tooltip } from '@mui/material'
import { dimensioneFinestra, scostamentoManiglia } from './preferenzeEditor'

interface ManigliaRidimensionaProps {
  onCambia: (dimensione: { larghezza: number; altezza: number }) => void
  /** Larghezza e altezza correnti della finestra, in percentuale dello schermo: servono a
   *  calcolare lo scostamento della maniglia dall'angolo vero al momento della presa. */
  larghezza: number
  altezza: number
}

export function ManigliaRidimensiona({ onCambia, larghezza, altezza }: ManigliaRidimensionaProps) {
  // Scostamento (dx, dy) fra l'angolo vero della finestra e il punto in cui si è afferrata la
  // maniglia, misurato una volta al pointerdown. Un ref e non uno stato: cambia dentro lo stesso
  // gesto e non deve provocare un render.
  const scostamento = useRef({ dx: 0, dy: 0 })

  const suPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      scostamento.current = scostamentoManiglia(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
        larghezza,
        altezza,
      )
    },
    [larghezza, altezza],
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const { dx, dy } = scostamento.current
      onCambia(dimensioneFinestra(e.clientX + dx, e.clientY + dy, window.innerWidth, window.innerHeight))
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
