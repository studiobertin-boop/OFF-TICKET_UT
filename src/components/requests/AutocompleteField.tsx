import { useState, useMemo } from 'react'
import { Controller, Control, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { FieldSchema, Customer } from '@/types'
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers'
import { debounce } from '@/utils/debounce'
import { createCustomerSchema, checkCustomerCompleteness } from '@/utils/customerValidation'
import { CustomerFormFields } from '@/components/customers/CustomerFormFields'
import { CompleteCustomerDataDialog } from '@/components/customers/CompleteCustomerDataDialog'

interface AutocompleteFieldProps {
  field: FieldSchema
  control: Control<any>
  error?: any
}

export const AutocompleteField = ({ field, control, error }: AutocompleteFieldProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [customerToComplete, setCustomerToComplete] = useState<Customer | null>(null)
  const [pendingCustomerCallback, setPendingCustomerCallback] = useState<((customer: Customer) => void) | null>(null)

  // Form for creating new customer with all fields
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
  } = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      ragione_sociale: '',
      identificativo: '',
      telefono: '',
      pec: '',
      descrizione_attivita: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    },
  })

  // Fetch customers with debounced search
  const { data: customersResponse, isLoading } = useCustomers({
    search: debouncedSearch,
    is_active: true,
    pageSize: 100, // Limit autocomplete results
  })

  const customers = customersResponse?.data || []
  const createCustomer = useCreateCustomer()

  // Debounce search input to avoid excessive API calls
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value)
    }, 300),
    []
  )

  // Handle input change
  const handleInputChange = (_event: React.SyntheticEvent, newInputValue: string) => {
    setSearchTerm(newInputValue)
    debouncedSetSearch(newInputValue)
  }

  // Handle create new customer with complete data
  const handleCreateCustomer = async (data: any) => {
    try {
      const newCustomer = await createCustomer.mutateAsync(data)

      // Close dialog and reset form
      setOpenCreateDialog(false)
      resetCreateForm()

      // Return the newly created customer (will be set as value by onChange)
      return newCustomer
    } catch (error) {
      console.error('Error creating customer:', error)
    }
  }

  // When "+ Aggiungi" is clicked, pre-fill ragione sociale
  const handleOpenCreateDialog = () => {
    resetCreateForm({
      ragione_sociale: searchTerm.trim(),
      identificativo: '',
      telefono: '',
      pec: '',
      descrizione_attivita: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    })
    setOpenCreateDialog(true)
  }

  // Add "Create new" option if search term is entered
  const optionsWithCreate = useMemo(() => {
    const options = [...customers]

    // Add "Create new" option if user has typed something
    if (searchTerm && searchTerm.trim().length > 0) {
      // Check if exact match exists
      const exactMatch = customers.find(
        c => c.ragione_sociale.toLowerCase() === searchTerm.trim().toLowerCase()
      )

      if (!exactMatch) {
        options.push({
          id: 'CREATE_NEW',
          ragione_sociale: `+ Aggiungi "${searchTerm}"`,
          is_active: true,
          created_at: '',
          updated_at: '',
        } as Customer)
      }
    }

    return options
  }, [customers, searchTerm])

  return (
    <>
      <Controller
        name={field.name}
        control={control}
        render={({ field: formField }) => (
          <Autocomplete
            options={optionsWithCreate}
            loading={isLoading}
            value={formField.value || null}
            onChange={(_event, newValue) => {
              // Handle "Create new" option
              if (newValue && newValue.id === 'CREATE_NEW') {
                handleOpenCreateDialog()
                return
              }

              // Check if selected customer has complete data
              if (newValue) {
                const completeness = checkCustomerCompleteness(newValue)
                if (!completeness.isComplete) {
                  // Show complete data dialog and save callback
                  setCustomerToComplete(newValue)
                  setPendingCustomerCallback(() => formField.onChange)
                  return
                }
              }

              formField.onChange(newValue)
            }}
            onInputChange={handleInputChange}
            inputValue={searchTerm}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option
              return option.ragione_sociale
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            filterOptions={(x) => x} // Disable client-side filtering (we use server-side)
            noOptionsText={
              searchTerm.trim().length === 0
                ? 'Inizia a digitare per cercare...'
                : 'Nessun cliente trovato'
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                required={field.required}
                error={!!error}
                helperText={error?.message || 'Inizia a digitare per cercare un cliente'}
                margin="normal"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              // Render "Create new" option differently
              if (option.id === 'CREATE_NEW') {
                return (
                  <li {...props} key="create-new">
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
                      <AddIcon sx={{ mr: 1 }} />
                      <Typography>{option.ragione_sociale}</Typography>
                    </Box>
                  </li>
                )
              }

              return (
                <li {...props} key={option.id}>
                  {option.ragione_sociale}
                </li>
              )
            }}
          />
        )}
      />

      {/* Create New Customer Dialog - with ALL required fields */}
      <Dialog
        open={openCreateDialog}
        onClose={() => {
          if (!createCustomer.isPending) {
            setOpenCreateDialog(false)
            resetCreateForm()
          }
        }}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={createCustomer.isPending}
      >
        <DialogTitle>Aggiungi Nuovo Cliente</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Compila tutti i campi obbligatori per creare il nuovo cliente.
          </Alert>

          <Box component="form" sx={{ mt: 1 }}>
            <CustomerFormFields
              control={createControl}
              errors={createErrors}
              showAllFields={true}
              highlightMissing={false}
            />
          </Box>

          {createCustomer.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Errore durante la creazione: {createCustomer.error?.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenCreateDialog(false)
              resetCreateForm()
            }}
            disabled={createCustomer.isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={handleCreateSubmit(handleCreateCustomer)}
            variant="contained"
            disabled={createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Creazione...' : 'Crea Cliente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete Customer Data Dialog */}
      {customerToComplete && pendingCustomerCallback && (
        <CompleteCustomerDataDialog
          customer={customerToComplete}
          open={true}
          onClose={() => {
            // User clicked "Skip for Now" - set customer anyway
            pendingCustomerCallback(customerToComplete)
            setCustomerToComplete(null)
            setPendingCustomerCallback(null)
          }}
          onComplete={(updatedCustomer) => {
            // Customer data has been completed, use the updated customer
            pendingCustomerCallback(updatedCustomer)
            setCustomerToComplete(null)
            setPendingCustomerCallback(null)
          }}
          allowSkip={true}
        />
      )}
    </>
  )
}
