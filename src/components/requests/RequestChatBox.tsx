import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Avatar,
  Divider,
  Alert,
} from '@mui/material'
import {
  Send as SendIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requestMessagesApi, type RequestMessage } from '@/services/api/requestMessages'
import { requestMessageViewsApi } from '@/services/api/requestMessageViews'
import { useAuth } from '@/hooks/useAuth'

interface RequestChatBoxProps {
  requestId: string
}

export function RequestChatBox({ requestId }: RequestChatBoxProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: ['request-messages', requestId],
    queryFn: () => requestMessagesApi.getByRequestId(requestId),
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  })

  // Subscribe to real-time messages
  useEffect(() => {
    const unsubscribe = requestMessagesApi.subscribeToMessages(requestId, (newMsg) => {
      queryClient.setQueryData<RequestMessage[]>(
        ['request-messages', requestId],
        (old) => [...(old || []), newMsg]
      )
    })

    return () => {
      unsubscribe()
    }
  }, [requestId, queryClient])

  // Mark messages as viewed when component mounts or messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      requestMessageViewsApi.markAsViewed(requestId).catch((err) => {
        console.error('Error marking messages as viewed:', err)
      })
    }
  }, [requestId, messages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      requestMessagesApi.create({ request_id: requestId, message }),
    onSuccess: () => {
      setNewMessage('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['request-messages', requestId] })
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => requestMessagesApi.delete(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-messages', requestId] })
    },
    onError: (err: Error) => {
      alert(`Errore: ${err.message}`)
    },
  })

  const handleSendMessage = () => {
    const trimmedMessage = newMessage.trim()
    if (!trimmedMessage) return

    sendMutation.mutate(trimmedMessage)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getUserColor = (userId: string): string => {
    // Generate consistent color based on user ID
    const colors = [
      '#1976d2',
      '#388e3c',
      '#d32f2f',
      '#f57c00',
      '#7b1fa2',
      '#0097a7',
      '#c2185b',
      '#5d4037',
    ]
    const index = parseInt(userId.substring(0, 8), 16) % colors.length
    return colors[index]
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ChatIcon />
          <Typography variant="h6">
            Messaggi ({messages?.length || 0})
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Messages List */}
        <Box
          sx={{
            maxHeight: 400,
            overflowY: 'auto',
            mb: 2,
            bgcolor: 'background.default',
            borderRadius: 1,
            p: 2,
          }}
        >
          {!messages || messages.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Nessun messaggio. Inizia la conversazione!
            </Typography>
          ) : (
            <List sx={{ p: 0 }}>
              {messages.map((message, index) => {
                const isOwnMessage = message.user_id === user?.id
                const showDivider = index < messages.length - 1

                return (
                  <Box key={message.id}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                        px: 0,
                        py: 1,
                      }}
                      secondaryAction={
                        isOwnMessage ? (
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => deleteMutation.mutate(message.id)}
                            disabled={deleteMutation.isPending}
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        ) : null
                      }
                    >
                      <Avatar
                        sx={{
                          bgcolor: getUserColor(message.user_id),
                          width: 32,
                          height: 32,
                          fontSize: '0.875rem',
                          mr: isOwnMessage ? 0 : 1,
                          ml: isOwnMessage ? 1 : 0,
                        }}
                      >
                        {getInitials(message.user?.full_name || 'U')}
                      </Avatar>
                      <ListItemText
                        sx={{
                          textAlign: isOwnMessage ? 'right' : 'left',
                          m: 0,
                        }}
                        primary={
                          <Box
                            sx={{
                              display: 'inline-block',
                              bgcolor: isOwnMessage ? 'primary.main' : 'grey.700',
                              color: 'white',
                              px: 2,
                              py: 1,
                              borderRadius: 2,
                              maxWidth: '70%',
                              wordBreak: 'break-word',
                            }}
                          >
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                              {message.message}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              mt: 0.5,
                              fontSize: '0.7rem',
                            }}
                          >
                            {message.user?.full_name} • {formatDateTime(message.created_at)}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {showDivider && <Divider sx={{ my: 1 }} />}
                  </Box>
                )
              })}
              <div ref={messagesEndRef} />
            </List>
          )}
        </Box>

        {/* Message Input */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            size="small"
            placeholder="Scrivi un messaggio..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendMutation.isPending}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  )
}
