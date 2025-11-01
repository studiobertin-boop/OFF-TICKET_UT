import { useState, useMemo } from 'react'
import { Controller, Control } from 'react-hook-form'
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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { FieldSchema, Customer } from '@/types'
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers'
import { debounce } from '@/utils/debounce'

interface AutocompleteFieldProps {
  field: FieldSchema
  control: Control<any>
  error?: any
}

export const AutocompleteField = ({ field, control, error }: AutocompleteFieldProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')

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

  // Handle create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return

    try {
      const newCustomer = await createCustomer.mutateAsync({
        ragione_sociale: newCustomerName,
      })

      // Close dialog
      setOpenCreateDialog(false)
      setNewCustomerName('')

      // Return the newly created customer (will be set as value by onChange)
      return newCustomer
    } catch (error) {
      console.error('Error creating customer:', error)
    }
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
                setNewCustomerName(searchTerm)
                setOpenCreateDialog(true)
                return
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

      {/* Create New Customer Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => {
          setOpenCreateDialog(false)
          setNewCustomerName('')
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Aggiungi Nuovo Cliente</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Ragione Sociale"
            fullWidth
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateCustomer()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenCreateDialog(false)
              setNewCustomerName('')
            }}
          >
            Annulla
          </Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={!newCustomerName.trim() || createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Creazione...' : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
