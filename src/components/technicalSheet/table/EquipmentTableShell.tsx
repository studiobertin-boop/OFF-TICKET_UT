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
  <Card variant="outlined" sx={{ mb: 2, overflow: 'hidden', borderRadius: `${radii.card}px` }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(color, 0.08) }}>
      <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.85rem', flex: '0 0 auto' }}>
        {letter}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontSize: '0.98rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle ? <Typography variant="caption" color="text.secondary">{subtitle}</Typography> : null}
      </Box>
      <Chip label={`${count}/${max}`} size="small" variant="outlined" color={count === 0 ? 'error' : 'primary'} sx={{ ml: 1 }} />
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        {headerActions}
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd} disabled={!canAdd}>
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
            position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'nowrap',
            fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'text.secondary', bgcolor: 'action.hover', p: '8px 10px',
            borderBottom: '1px solid', borderColor: 'divider',
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
