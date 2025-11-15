/**
 * Dialog for sharing DM329 technical data sheets with userDM329 users
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Typography,
  Box,
  Divider,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import {
  getAvailableUsersForSharing,
  getSharedUsers,
  shareWithUser,
  removeSharing,
  type SharedUser,
} from '@/services/api/technicalDataSharing'
import type { User } from '@/types'

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  technicalDataId: string
  requestId: string
}

export const ShareDialog = ({ open, onClose, technicalDataId, requestId }: ShareDialogProps) => {
  const [availableUsers, setAvailableUsers] = useState<Pick<User, 'id' | 'full_name' | 'email'>[]>(
    []
  )
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Load available users and shared users when dialog opens
  useEffect(() => {
    if (open) {
      loadData()
    } else {
      // Reset state when dialog closes
      setSelectedUserId('')
      setError(null)
      setSuccess(null)
    }
  }, [open, technicalDataId])

  const loadData = async () => {
    setLoadingUsers(true)
    setError(null)
    try {
      const [available, shared] = await Promise.all([
        getAvailableUsersForSharing(technicalDataId),
        getSharedUsers(technicalDataId),
      ])
      setAvailableUsers(available)
      setSharedUsers(shared)
    } catch (err) {
      console.error('Error loading sharing data:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei dati')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleShare = async () => {
    if (!selectedUserId) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await shareWithUser(technicalDataId, selectedUserId)

      if (result.success) {
        setSuccess(result.message)
        setSelectedUserId('')
        // Reload data to update lists
        await loadData()
      } else {
        setError(result.message)
      }
    } catch (err) {
      console.error('Error sharing:', err)
      setError(err instanceof Error ? err.message : 'Errore nella condivisione')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveShare = async (shareId: string, userName: string) => {
    if (!confirm(`Rimuovere l'accesso per ${userName}?`)) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await removeSharing(shareId)
      setSuccess(`Accesso rimosso per ${userName}`)
      // Reload data to update lists
      await loadData()
    } catch (err) {
      console.error('Error removing share:', err)
      setError(err instanceof Error ? err.message : 'Errore nella rimozione della condivisione')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ShareIcon />
          Condividi Scheda Dati
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {loadingUsers ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Section: Add new share */}
            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Condividi con utente
              </Typography>
              <Box display="flex" gap={1} alignItems="flex-start">
                <FormControl fullWidth size="small">
                  <InputLabel>Seleziona utente</InputLabel>
                  <Select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    label="Seleziona utente"
                    disabled={loading || availableUsers.length === 0}
                  >
                    {availableUsers.length === 0 ? (
                      <MenuItem disabled>Nessun utente disponibile</MenuItem>
                    ) : (
                      availableUsers.map((user) => (
                        <MenuItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleShare}
                  disabled={!selectedUserId || loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
                  sx={{ minWidth: '120px' }}
                >
                  {loading ? 'Condivisione...' : 'Condividi'}
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Section: Currently shared users */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Utenti con accesso ({sharedUsers.length})
              </Typography>

              {sharedUsers.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Nessun utente ha ancora accesso a questa scheda
                </Typography>
              ) : (
                <List dense>
                  {sharedUsers.map((share) => (
                    <ListItem key={share.id} divider>
                      <ListItemText
                        primary={share.user.full_name}
                        secondary={
                          <>
                            {share.user.email}
                            <br />
                            Condiviso da {share.shared_by_user.full_name} il{' '}
                            {formatDate(share.shared_at)}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveShare(share.id, share.user.full_name)}
                          disabled={loading}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Chiudi
        </Button>
      </DialogActions>
    </Dialog>
  )
}
