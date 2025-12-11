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
import { Customer } from '@/types'
import { useUpdateCustomer } from '@/hooks/useCustomers'
import { updateCustomerSchema } from '@/utils/customerValidation'
import { getMissingCustomerFields } from '@/utils/customerValidation'
import { CustomerFormFields } from './CustomerFormFields'

interface CompleteCustomerDataDialogProps {
  open: boolean
  customer: Customer | null
  onClose: () => void
  onComplete: (updatedCustomer: Customer) => void
  allowSkip?: boolean
}

/**
 * Dialog for completing missing customer data
 * Shows only fields that are missing with warning badges
 * Allows "Skip for Now" option to not block workflow
 */
export const CompleteCustomerDataDialog = ({
  open,
  customer,
  onClose,
  onComplete,
  allowSkip = true,
}: CompleteCustomerDataDialogProps) => {
  const [missingFieldNames, setMissingFieldNames] = useState<string[]>([])
  const updateCustomer = useUpdateCustomer()

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(updateCustomerSchema),
  })

  useEffect(() => {
    if (customer && open) {
      const missing = getMissingCustomerFields(customer)
      setMissingFieldNames(missing.map((f) => f.field))

      // Pre-fill form with existing data
      reset({
        ragione_sociale: customer.ragione_sociale || '',
        identificativo: customer.identificativo || '',
        telefono: customer.telefono || '',
        pec: customer.pec || '',
        descrizione_attivita: customer.descrizione_attivita || '',
        via: customer.via || '',
        numero_civico: customer.numero_civico || '',
        cap: customer.cap || '',
        comune: customer.comune || '',
        provincia: customer.provincia || '',
      })
    }
  }, [customer, open, reset])

  const onSubmit = async (data: any) => {
    if (!customer) return

    try {
      const updatedCustomer = await updateCustomer.mutateAsync({
        id: customer.id,
        updates: data,
      })
      onComplete(updatedCustomer)
    } catch (error) {
      console.error('Error completing customer data:', error)
    }
  }

  const handleClose = () => {
    if (!updateCustomer.isPending) {
      onClose()
    }
  }

  if (!customer) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={updateCustomer.isPending}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Completa Dati Cliente
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Il cliente "<strong>{customer.ragione_sociale}</strong>" ha dei dati mancanti. Compila i
          campi evidenziati per completare il profilo.
        </Alert>

        {missingFieldNames.length === 0 ? (
          <Alert severity="success">Tutti i dati del cliente sono completi!</Alert>
        ) : (
          <Box component="form" sx={{ mt: 2 }}>
            <CustomerFormFields
              control={control}
              errors={errors}
              showAllFields={false}
              highlightMissing={true}
              missingFields={missingFieldNames}
            />
          </Box>
        )}

        {updateCustomer.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Errore durante l'aggiornamento: {updateCustomer.error?.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {allowSkip && (
          <Button onClick={handleClose} disabled={updateCustomer.isPending}>
            Salta per Ora
          </Button>
        )}
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={updateCustomer.isPending || missingFieldNames.length === 0}
          startIcon={updateCustomer.isPending ? <CircularProgress size={16} /> : null}
        >
          {updateCustomer.isPending ? 'Salvataggio...' : 'Completa e Continua'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
