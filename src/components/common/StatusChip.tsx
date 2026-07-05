import { Chip, ChipProps } from '@mui/material'
import { useThemeMode } from '@/theme'
import { getStatusChipColors } from '@/theme/statusColors'
import { getStatusLabel } from '@/utils/workflow'
import type { RequestStatus, DM329Status } from '@/types'

interface StatusChipProps extends Omit<ChipProps, 'color' | 'label'> {
  status: RequestStatus | DM329Status | string
  /** Etichetta custom; di default usa getStatusLabel(status). */
  label?: string
}

/**
 * Chip di stato uniforme, con colori dalla fonte unica (statusColors.ts),
 * leggibili in tema chiaro e scuro. Sostituisce i <Chip> di stato inline ripetuti.
 */
export function StatusChip({ status, label, sx, ...rest }: StatusChipProps) {
  const { mode } = useThemeMode()
  const { main, bg } = getStatusChipColors(status, mode)
  return (
    <Chip
      label={label ?? getStatusLabel(status as RequestStatus | DM329Status)}
      sx={{ color: main, bgcolor: bg, fontWeight: 600, ...sx }}
      {...rest}
    />
  )
}
