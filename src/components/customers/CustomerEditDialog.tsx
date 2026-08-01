import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Box } from '@mui/material'
import { useState } from 'react'
import { CustomerFormFields } from './CustomerFormFields'
import { updateCustomerSchema } from '@/utils/customerValidation'
import { useUpdateCustomer } from '@/hooks/useCustomers'
import type { Customer } from '@/types'

interface Props {
  customer: Customer
  onClose: () => void
  /** Chiamata dopo un salvataggio riuscito: il chiamante rifetcha i dati della pagina. */
  onSaved: () => void
}

/**
 * Modifica dell'anagrafica cliente dal dettaglio pratica. Riusa lo stesso form di
 * Admin > Clienti, quindi stessi campi e stessa validazione. Da montare solo quando
 * aperto: il mount fresco riapplica il prefill a ogni apertura.
 */
export const CustomerEditDialog = ({ customer, onClose, onSaved }: Props) => {
  const [error, setError] = useState<string | null>(null)
  const updateCustomer = useUpdateCustomer()

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
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
    },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await updateCustomer.mutateAsync({ id: customer.id, updates: values })
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio dei dati cliente')
    }
  })

  return (
    <Dialog open onClose={updateCustomer.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Modifica dati cliente</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Le modifiche valgono per tutte le pratiche di questo cliente.
        </Alert>
        <Box component="form">
          <CustomerFormFields control={control} errors={errors} showAllFields highlightMissing={false} />
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={updateCustomer.isPending}>
          Annulla
        </Button>
        <Button variant="contained" onClick={submit} disabled={updateCustomer.isPending}>
          {updateCustomer.isPending ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
