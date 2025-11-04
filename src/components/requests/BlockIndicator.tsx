import { Tooltip, Box } from '@mui/material'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface BlockIndicatorProps {
  isBlocked: boolean
  reason?: string
  showResolved?: boolean
}

/**
 * Visual indicator for blocked requests
 * Shows warning icon (yellow triangle) when blocked
 * Shows check icon (green) briefly after resolution (optional)
 */
export function BlockIndicator({ isBlocked, reason, showResolved = false }: BlockIndicatorProps) {
  if (showResolved) {
    return (
      <Tooltip title="Blocco risolto">
        <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <CheckCircleIcon
            sx={{
              color: 'success.main',
              fontSize: 24,
              animation: 'pulse 1s ease-in-out',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
        </Box>
      </Tooltip>
    )
  }

  if (!isBlocked) {
    return null
  }

  return (
    <Tooltip title={reason || 'Richiesta bloccata'} arrow>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <WarningIcon
          sx={{
            color: 'warning.main',
            fontSize: 24,
          }}
        />
      </Box>
    </Tooltip>
  )
}
