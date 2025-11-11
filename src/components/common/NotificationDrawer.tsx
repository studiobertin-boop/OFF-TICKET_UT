import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Button,
  Chip,
  Stack,
} from '@mui/material'
import {
  Close as CloseIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import type { Notification } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { getEventIconConfig, mapNotificationEventType } from '@/utils/eventIcons'

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
}

function getNotificationIcon(notification: Notification) {
  const { event_type, status_to } = notification
  const eventType = mapNotificationEventType(event_type, status_to)
  const iconConfig = getEventIconConfig(eventType)
  return iconConfig.icon
}

function getNotificationColor(
  notification: Notification
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const { event_type, status_to } = notification
  const eventType = mapNotificationEventType(event_type, status_to)
  const iconConfig = getEventIconConfig(eventType)
  // Mappa 'grey' a 'default' per Chip (che non supporta grey)
  return iconConfig.color === 'grey' ? 'default' : iconConfig.color
}

function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const navigate = useNavigate()
  const { deleteNotificationAsync } = useNotifications()

  const handleClick = async () => {
    try {
      // Elimina la notifica
      await deleteNotificationAsync(notification.id)
      // Chiudi il drawer
      onClose()
      // Naviga alla richiesta se presente
      if (notification.request_id) {
        navigate(`/requests/${notification.request_id}`)
      }
    } catch (error) {
      console.error('Errore eliminazione notifica:', error)
    }
  }

  return (
    <ListItem disablePadding>
      <ListItemButton onClick={handleClick}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%' }}>
          <Box sx={{ mt: 0.5 }}>{getNotificationIcon(notification)}</Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {notification.message}
                </Typography>
              }
              secondary={
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {notification.request?.title && (
                    <Typography variant="caption" color="text.secondary">
                      {notification.request.title}
                    </Typography>
                  )}
                  {notification.status_to && (
                    <Chip
                      label={notification.status_to}
                      size="small"
                      color={getNotificationColor(notification)}
                      sx={{ width: 'fit-content' }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </Typography>
                </Stack>
              }
            />
          </Box>
        </Box>
      </ListItemButton>
    </ListItem>
  )
}

export default function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { notifications, unreadCount, markAllAsRead, isLoading } = useNotifications()

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 400, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Notifiche</Typography>
            {unreadCount > 0 && (
              <Chip label={unreadCount} size="small" color="primary" />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Actions */}
        {unreadCount > 0 && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Button
              size="small"
              onClick={() => markAllAsRead()}
              variant="outlined"
              fullWidth
            >
              Segna tutte come lette
            </Button>
          </Box>
        )}

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Caricamento...</Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Nessuna notifica</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notification, index) => (
                <Box key={notification.id}>
                  <NotificationItem notification={notification} onClose={onClose} />
                  {index < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  )
}
