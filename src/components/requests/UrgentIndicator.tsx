import { Tooltip, Box } from '@mui/material'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'

interface UrgentIndicatorProps {
  isUrgent: boolean
}

/**
 * Visual indicator for urgent requests
 * Shows priority icon (red exclamation mark) when urgent
 */
export function UrgentIndicator({ isUrgent }: UrgentIndicatorProps) {
  if (!isUrgent) {
    return null
  }

  return (
    <Tooltip title="Richiesta urgente" arrow>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <PriorityHighIcon
          sx={{
            color: 'error.main',
            fontSize: 24,
          }}
        />
      </Box>
    </Tooltip>
  )
}
