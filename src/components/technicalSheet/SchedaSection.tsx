import type { ReactNode } from 'react'
import { Box, Card, Collapse, Typography } from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'
import { CompletenessBar } from '@/components/common'
import type { Completezza } from '@/utils/schedaCompleteness'

interface SchedaSectionProps {
  titolo: string
  /** Banda che identifica la sezione: sul fianco sinistro, per tutta l'altezza. */
  colore: string
  aperta: boolean
  onToggle: () => void
  completezza?: Completezza
  /** Conteggio accanto al titolo (es. «4 principali»). */
  contatore?: ReactNode
  /**
   * Riepilogo in coda alla testata. È quello che rende utile una sezione chiusa: dice cosa
   * contiene senza doverla riaprire.
   */
  riepilogo?: ReactNode
  children: ReactNode
}

/**
 * Una delle due sezioni della SCHEDA DATI.
 *
 * Prima erano linguette: si vedeva una cosa per volta e passare dal contesto alle
 * apparecchiature costava un cambio di pagina. Qui stanno una sotto l'altra, ciascuna
 * richiudibile, e restano staccate anche da chiuse — due testate a contatto si leggevano
 * come un unico blocco a righe invece che come due sezioni.
 */
export const SchedaSection = ({
  titolo, colore, aperta, onToggle, completezza, contatore, riepilogo, children,
}: SchedaSectionProps) => (
  <Card
    variant="outlined"
    sx={{
      borderRadius: `${radii.card}px`,
      borderLeft: '4px solid',
      borderLeftColor: colore,
      overflow: 'hidden',
    }}
  >
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      aria-expanded={aperta}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, width: '100%',
        px: 1.75, py: 1.25, border: 0, font: 'inherit', color: 'text.primary',
        textAlign: 'left', cursor: 'pointer',
        // La banda sfuma verso destra invece di tingere l'intera testata: identifica la
        // sezione senza competere con i colori dei tipi di apparecchiatura sotto.
        background: `linear-gradient(to right, ${alpha(colore, 0.14)}, transparent 340px)`,
        borderBottom: aperta ? '1px solid' : 0,
        borderBottomColor: 'divider',
        transition: 'background .15s',
        '&:hover': { background: `linear-gradient(to right, ${alpha(colore, 0.24)}, transparent 380px)` },
      }}
    >
      <ExpandMoreIcon
        sx={{ color: colore, fontSize: '1.1rem', transition: 'transform .18s', transform: aperta ? 'none' : 'rotate(-90deg)' }}
      />
      <Typography component="span" sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{titolo}</Typography>

      {contatore != null && (
        <Typography component="span" sx={{ fontSize: '0.82rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
          {contatore}
        </Typography>
      )}

      {completezza && <CompletenessBar completezza={completezza} larghezza={92} />}

      {riepilogo != null && (
        <Box
          component="span"
          sx={{
            ml: 'auto', minWidth: 0, pl: 1,
            fontSize: '0.74rem', color: 'text.disabled',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: { xs: 'none', md: 'block' },
          }}
        >
          {riepilogo}
        </Box>
      )}
    </Box>

    {/* `unmountOnExit` no: le due sezioni sono un unico form, e smontare i campi del
        contesto ne perderebbe la registrazione in React Hook Form. Si nascondono, non si
        tolgono. */}
    <Collapse in={aperta}>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Collapse>
  </Card>
)
