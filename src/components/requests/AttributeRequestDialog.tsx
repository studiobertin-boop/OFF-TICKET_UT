import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Autocomplete,
  Box,
  Chip,
} from '@mui/material'
import { useAttributeRequest, useAllUsers } from '@/hooks/useAttributeRequest'

interface AttributeRequestDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  requestTitle: string
}

interface UserOption {
  id: string
  full_name: string
  email: string
  role: string
}

/**
 * Dialog for attributing a request to a user
 * Visible to: admin only
 */
export function AttributeRequestDialog({
  open,
  onClose,
  requestId,
  requestTitle,
}: AttributeRequestDialogProps) {
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const attributeMutation = useAttributeRequest()
  const { data: users = [], isLoading: loadingUsers } = useAllUsers()

  const handleAttribute = async () => {
    if (!selectedUser) {
      setError('Seleziona un utente a cui attribuire la richiesta')
      return
    }

    try {
      const result = await attributeMutation.mutateAsync({
        requestId,
        attributedToUserId: selectedUser.id,
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        handleClose()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('Errore durante l\'attribuzione della richiesta')
      console.error('Attribution error:', err)
    }
  }

  const handleClose = () => {
    setSelectedUser(null)
    setNotes('')
    setError(null)
    onClose()
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'tecnico':
        return 'Tecnico'
      case 'utente':
        return 'Utente'
      case 'userdm329':
        return 'Utente DM329'
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error'
      case 'tecnico':
        return 'primary'
      case 'userdm329':
        return 'secondary'
      default:
        return 'default'
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Attribuisci Richiesta</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Attribuendo la richiesta &quot;{requestTitle}&quot; ad un utente, questo potrà vederla e
          gestirla come se fosse stata creata da lui. L&apos;utente riceverà una notifica.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Autocomplete
          value={selectedUser}
          onChange={(_, newValue) => {
            setSelectedUser(newValue)
            setError(null)
          }}
          options={users}
          getOptionLabel={(option) => option.full_name}
          loading={loadingUsers}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{option.full_name}</span>
                  <Chip
                    label={getRoleLabel(option.role)}
                    size="small"
                    color={getRoleColor(option.role) as any}
                  />
                </Box>
                <Box
                  component="span"
                  sx={{ fontSize: '0.875rem', color: 'text.secondary' }}
                >
                  {option.email}
                </Box>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Seleziona utente"
              placeholder="Cerca per nome o email..."
              required
              error={!!error && !selectedUser}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
        />

        <TextField
          margin="dense"
          label="Note (opzionale)"
          placeholder="Es: Attribuzione per competenza specifica, delega temporanea..."
          fullWidth
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          helperText="Aggiungi eventuali note sulla motivazione dell'attribuzione"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={attributeMutation.isPending}>
          Annulla
        </Button>
        <Button
          onClick={handleAttribute}
          variant="contained"
          color="primary"
          disabled={attributeMutation.isPending || !selectedUser}
          startIcon={attributeMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {attributeMutation.isPending ? 'Attribuzione...' : 'Attribuisci'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
