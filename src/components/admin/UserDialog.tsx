import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { User, UserRole } from '../../types'
import { useCreateUser, useUpdateUser } from '../../hooks/useUsers'

// Schema di validazione per creazione utente
const createUserSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'La password deve contenere almeno 8 caratteri'),
  full_name: z.string().min(2, 'Il nome completo è richiesto'),
  role: z.enum(['admin', 'tecnico', 'utente', 'userdm329', 'tecnicoDM329']),
})

// Schema di validazione per modifica utente
const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Il nome completo è richiesto'),
  role: z.enum(['admin', 'tecnico', 'utente', 'userdm329', 'tecnicoDM329']),
})

type CreateUserFormData = z.infer<typeof createUserSchema>
type UpdateUserFormData = z.infer<typeof updateUserSchema>

interface UserDialogProps {
  open: boolean
  onClose: () => void
  user?: User // Se presente, è modalità modifica
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  tecnico: 'Tecnico',
  utente: 'Utente',
  userdm329: 'Utente DM329',
  tecnicoDM329: 'Tecnico DM329',
}

const roleDescriptions: Record<UserRole, string> = {
  admin: 'Può fare e vedere tutto',
  tecnico: 'Può vedere tutto, può modificare solo le pratiche assegnate',
  utente: 'Può vedere solo le pratiche assegnate',
  userdm329: 'Può vedere solo dashboard DM329, vedere e modificare tutte le richieste DM329',
  tecnicoDM329: 'Può vedere e modificare solo le schede dati DM329 assegnate a lui',
}

export default function UserDialog({ open, onClose, user }: UserDialogProps) {
  const isEdit = !!user
  const [error, setError] = useState<string | null>(null)

  const createUserMutation = useCreateUser()
  const updateUserMutation = useUpdateUser()

  // Form per creazione
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      role: 'utente',
    },
  })

  // Form per modifica
  const updateForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      role: user?.role || 'utente',
    },
  })

  // Aggiornare il form quando l'utente cambia
  useEffect(() => {
    if (user) {
      updateForm.reset({
        full_name: user.full_name,
        role: user.role,
      })
    }
  }, [user, updateForm])

  // Reset del form quando il dialog si chiude
  useEffect(() => {
    if (!open) {
      createForm.reset()
      updateForm.reset()
      setError(null)
    }
  }, [open, createForm, updateForm])

  const handleCreate = async (data: CreateUserFormData) => {
    setError(null)
    try {
      await createUserMutation.mutateAsync({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        role: data.role,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella creazione dell\'utente')
    }
  }

  const handleUpdate = async (data: UpdateUserFormData) => {
    if (!user) return
    setError(null)
    try {
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: data,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nell\'aggiornamento dell\'utente')
    }
  }

  const form = isEdit ? updateForm : createForm
  const isLoading = createUserMutation.isPending || updateUserMutation.isPending

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Modifica Utente' : 'Crea Nuovo Utente'}</DialogTitle>
      <form
        onSubmit={
          isEdit
            ? updateForm.handleSubmit(handleUpdate)
            : createForm.handleSubmit(handleCreate)
        }
      >
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {!isEdit && (
              <>
                <Controller
                  name="email"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Email"
                      type="email"
                      fullWidth
                      required
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      disabled={isLoading}
                    />
                  )}
                />

                <Controller
                  name="password"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Password"
                      type="password"
                      fullWidth
                      required
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ||
                        'Minimo 8 caratteri'
                      }
                      disabled={isLoading}
                    />
                  )}
                />
              </>
            )}

            {isEdit && (
              <TextField
                label="Email"
                value={user?.email}
                fullWidth
                disabled
                helperText="L'email non può essere modificata"
              />
            )}

            <Controller
              name="full_name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nome Completo"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={isLoading}
                />
              )}
            />

            <Controller
              name="role"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Ruolo"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ||
                    (field.value ? roleDescriptions[field.value as UserRole] : '')
                  }
                  disabled={isLoading}
                >
                  {(['admin', 'tecnico', 'utente', 'userdm329', 'tecnicoDM329'] as UserRole[]).map(
                    (role) => (
                      <MenuItem key={role} value={role}>
                        {roleLabels[role]}
                      </MenuItem>
                    )
                  )}
                </TextField>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Annulla
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isEdit ? 'Salva' : 'Crea'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
