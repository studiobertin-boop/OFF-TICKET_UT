import type { ReactNode } from 'react'
import { Card, Box, Typography, Chip, Button } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'

/**
 * Guscio presentazionale per una sezione apparecchiature in modalità "foglio".
 * Card + testata (badge lettera, titolo, conteggio, azioni, aggiungi) +
 * contenitore con scroll orizzontale attorno a un <table>.
 * Il contenuto <thead>/<tbody> è passato come children.
 */

interface EquipmentTableShellProps {
  letter: string
  color: string
  title: string
  subtitle?: string
  count: number
  max: number
  onAdd: () => void
  canAdd: boolean
  addLabel: string
  headerActions?: ReactNode
  children: ReactNode
}

export const EquipmentTableShell = ({
  letter, color, title, subtitle, count, max, onAdd, canAdd, addLabel, headerActions, children,
}: EquipmentTableShellProps) => (
  <Card variant="outlined" sx={{ mb: 1, overflow: 'hidden', borderRadius: `${radii.card}px` }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(color, 0.1) }}>
      <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.72rem', flex: '0 0 auto' }}>
        {letter}
      </Box>
      <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</Typography>
      <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{count}/{max}</Typography>
      {subtitle ? <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, ml: 0.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</Typography> : null}
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {headerActions}
        <Button size="small" variant="text" startIcon={<AddIcon />} onClick={onAdd} disabled={!canAdd} sx={{ minWidth: 0, py: 0.25, px: 1, fontSize: '0.78rem' }}>
          {addLabel}
        </Button>
      </Box>
    </Box>
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: 'max-content',
          '& th': {
            position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'normal',
            lineHeight: 1.1, verticalAlign: 'bottom',
            fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
            color: 'text.primary', bgcolor: alpha(color, 0.16), p: '4px 6px',
            borderBottom: '2px solid', borderColor: alpha(color, 0.5),
          },
          '& th.num': { textAlign: 'right' },
          '& th.ctr': { textAlign: 'center' },
        }}
      >
        {children}
      </Box>
    </Box>
  </Card>
)
