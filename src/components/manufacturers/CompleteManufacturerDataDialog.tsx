/**
 * Complete Manufacturer Data Dialog
 *
 * Dialog per completare dati mancanti del costruttore.
 * Mostra solo i campi mancanti con badge warning.
 * Pattern identico a CompleteCustomerDataDialog.tsx
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import { Manufacturer } from '@/types/manufacturer'
import { useUpdateManufacturer } from '@/hooks/useManufacturers'
import { updateManufacturerSchema, getMissingManufacturerFields } from '@/utils/manufacturerValidation'
import { ManufacturerFormFields } from './ManufacturerFormFields'

interface CompleteManufacturerDataDialogProps {
  open: boolean
  manufacturer: Manufacturer | null
  onClose: () => void
  onComplete: (updatedManufacturer: Manufacturer) => void
  allowSkip?: boolean
}

/**
 * Dialog for completing missing manufacturer data
 * Shows only fields that are missing with warning badges
 * Allows "Skip for Now" option to not block workflow
 */
export const CompleteManufacturerDataDialog = ({
  open,
  manufacturer,
  onClose,
  onComplete,
  allowSkip = true,
}: CompleteManufacturerDataDialogProps) => {
  const [missingFieldNames, setMissingFieldNames] = useState<string[]>([])
  const updateManufacturer = useUpdateManufacturer()

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(updateManufacturerSchema),
  })

  useEffect(() => {
    if (manufacturer && open) {
      const missing = getMissingManufacturerFields(manufacturer)
      setMissingFieldNames(missing.map((f) => f.field))

      // Pre-fill form with existing data
      reset({
        nome: manufacturer.nome || '',
        is_estero: manufacturer.is_estero,
        // Italian fields
        partita_iva: manufacturer.partita_iva || '',
        telefono: manufacturer.telefono || '',
        via: manufacturer.via || '',
        numero_civico: manufacturer.numero_civico || '',
        cap: manufacturer.cap || '',
        comune: manufacturer.comune || '',
        provincia: manufacturer.provincia || '',
        // Foreign field
        paese: manufacturer.paese || '',
      })
    }
  }, [manufacturer, open, reset])

  const onSubmit = async (data: any) => {
    if (!manufacturer) return

    try {
      const updatedManufacturer = await updateManufacturer.mutateAsync({
        id: manufacturer.id,
        updates: data,
      })
      onComplete(updatedManufacturer)
    } catch (error) {
      console.error('Error completing manufacturer data:', error)
    }
  }

  const handleClose = () => {
    if (!updateManufacturer.isPending) {
      onClose()
    }
  }

  if (!manufacturer) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={updateManufacturer.isPending}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Completa Dati Costruttore
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Il costruttore "<strong>{manufacturer.nome}</strong>" ha dei dati mancanti. Compila i
          campi evidenziati per completare il profilo.
        </Alert>

        {missingFieldNames.length === 0 ? (
          <Alert severity="success">Tutti i dati del costruttore sono completi!</Alert>
        ) : (
          <Box component="form" sx={{ mt: 2 }}>
            <ManufacturerFormFields
              control={control}
              errors={errors}
              showAllFields={false}
              highlightMissing={true}
              missingFields={missingFieldNames}
            />
          </Box>
        )}

        {updateManufacturer.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Errore durante l'aggiornamento: {updateManufacturer.error?.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {allowSkip && (
          <Button onClick={handleClose} disabled={updateManufacturer.isPending}>
            Salta per Ora
          </Button>
        )}
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={updateManufacturer.isPending || missingFieldNames.length === 0}
          startIcon={updateManufacturer.isPending ? <CircularProgress size={16} /> : null}
        >
          {updateManufacturer.isPending ? 'Salvataggio...' : 'Completa e Continua'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
