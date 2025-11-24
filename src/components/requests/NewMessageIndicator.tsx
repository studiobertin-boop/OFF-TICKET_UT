import { Tooltip, Box, Badge } from '@mui/material'
import { Chat as ChatIcon } from '@mui/icons-material'

interface NewMessageIndicatorProps {
  hasNewMessages: boolean
}

export function NewMessageIndicator({ hasNewMessages }: NewMessageIndicatorProps) {
  if (!hasNewMessages) return null

  return (
    <Tooltip title="Nuovi messaggi non letti" arrow>
      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Badge color="error" variant="dot">
          <ChatIcon sx={{ color: 'info.main', fontSize: 24 }} />
        </Badge>
      </Box>
    </Tooltip>
  )
}
