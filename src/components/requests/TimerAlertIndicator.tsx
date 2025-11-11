import { Tooltip, Box } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

interface TimerAlertIndicatorProps {
  hasAlert: boolean
  message?: string
}

/**
 * Visual indicator for timer alerts on DM329 requests
 * Shows red clock icon when timer threshold exceeded
 */
export function TimerAlertIndicator({ hasAlert, message }: TimerAlertIndicatorProps) {
  if (!hasAlert) {
    return null
  }

  return (
    <Tooltip title={message || 'Timer scaduto'} arrow>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <AccessTimeIcon
          sx={{
            color: 'error.main',
            fontSize: 24,
          }}
        />
      </Box>
    </Tooltip>
  )
}
