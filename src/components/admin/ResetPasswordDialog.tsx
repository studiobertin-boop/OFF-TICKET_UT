import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { User } from '../../types'
import { useResetUserPassword } from '../../hooks/useUsers'

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'La password deve contenere almeno 8 caratteri'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non corrispondono',
    path: ['confirmPassword'],
  })

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

interface ResetPasswordDialogProps {
  open: boolean
  onClose: () => void
  user: User | null
}

export default function ResetPasswordDialog({
  open,
  onClose,
  user,
}: ResetPasswordDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const resetPasswordMutation = useResetUserPassword()

  const { control, handleSubmit, reset } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  // Reset del form quando il dialog si chiude
  useEffect(() => {
    if (!open) {
      reset()
      setError(null)
      setSuccess(false)
    }
  }, [open, reset])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!user) return
    setError(null)
    setSuccess(false)

    try {
      await resetPasswordMutation.mutateAsync({
        userId: user.id,
        newPassword: data.password,
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel reset della password')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reset Password</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success">
                Password resettata con successo!
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              Reset password per: <strong>{user?.email}</strong>
            </Typography>

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nuova Password"
                  type="password"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message || 'Minimo 8 caratteri'
                  }
                  disabled={resetPasswordMutation.isPending || success}
                />
              )}
            />

            <Controller
              name="confirmPassword"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Conferma Password"
                  type="password"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={resetPasswordMutation.isPending || success}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onClose}
            disabled={resetPasswordMutation.isPending || success}
          >
            {success ? 'Chiudi' : 'Annulla'}
          </Button>
          {!success && (
            <Button
              type="submit"
              variant="contained"
              disabled={resetPasswordMutation.isPending}
              startIcon={
                resetPasswordMutation.isPending ? (
                  <CircularProgress size={20} />
                ) : null
              }
            >
              Reset Password
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  )
}
