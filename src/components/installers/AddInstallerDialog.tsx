/**
 * Add Installer Dialog
 *
 * Dialog per aggiungere nuovi installatori al database quando
 * l'utente digita un nome non presente nell'autocomplete della scheda dati
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material'
import { installersApi } from '@/services/api/installers'
import { createInstallerSchema } from '@/utils/installerValidation'
import { InstallerFormFields } from './InstallerFormFields'
import type { CreateInstallerInput } from '@/types/installer'

interface AddInstallerDialogProps {
  open: boolean
  onClose: () => void
  initialNome?: string
  onSuccess?: (nome: string) => void
}

/**
 * Dialog per aggiungere nuovo installatore al database
 *
 * - Triggered quando utente digita nome installatore non presente in DB
 * - Pre-compila campo "nome" con quello digitato
 * - Richiede tutti campi obbligatori (P.IVA, indirizzo completo)
 * - Callback onSuccess ritorna il nome per aggiornare l'autocomplete
 */
export const AddInstallerDialog = ({
  open,
  onClose,
  initialNome = '',
  onSuccess,
}: AddInstallerDialogProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateInstallerInput>({
    resolver: zodResolver(createInstallerSchema),
    defaultValues: {
      nome: initialNome,
      partita_iva: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    },
  })

  const handleClose = () => {
    if (!loading) {
      reset()
      setError(null)
      onClose()
    }
  }

  const onSubmit = async (data: CreateInstallerInput) => {
    setLoading(true)
    setError(null)

    try {
      const newInstaller = await installersApi.create(data)

      // Success callback con nome installatore
      if (onSuccess) {
        onSuccess(newInstaller.nome)
      }

      handleClose()
    } catch (err) {
      console.error('Error creating installer:', err)
      setError(err instanceof Error ? err.message : 'Errore nella creazione dell\'installatore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        Aggiungi Nuovo Installatore
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            L'installatore "{initialNome}" non è presente nel database.
            Compila i campi per aggiungerlo.
          </Alert>

          <InstallerFormFields
            control={control}
            errors={errors}
            showAllFields={true}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={loading}
        >
          Annulla
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Creazione...' : 'Aggiungi Installatore'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
