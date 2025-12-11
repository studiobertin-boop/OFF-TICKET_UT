import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { DynamicFormField } from '@/components/requests/DynamicFormField'
import { CompleteCustomerDataDialog } from '@/components/customers/CompleteCustomerDataDialog'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { useCreateRequest } from '@/hooks/useRequests'
import { useCustomer } from '@/hooks/useCustomers'
import { generateZodSchemaWithValidations, getDefaultValues } from '@/utils/formSchema'
import { isCustomerComplete } from '@/utils/customerValidation'
import { customersApi } from '@/services/api/customers'
import { Customer } from '@/types'

export const NewRequest = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [selectedCustomerForComplete, setSelectedCustomerForComplete] = useState<Customer | null>(null)
  const { data: requestTypes = [], isLoading: loadingTypes } = useRequestTypes()
  const createRequest = useCreateRequest()

  // Determina se il tipo è stato pre-impostato dalla URL (utenti DM329)
  const typePreselected = !!searchParams.get('type')

  const selectedType = requestTypes.find(t => t.id === selectedTypeId)

  // Filtra solo i campi non nascosti per nuove richieste
  const visibleFields = selectedType?.fields_schema.filter(field => !field.hidden) || []

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: selectedType ? zodResolver(generateZodSchemaWithValidations(visibleFields, selectedType.name)) : undefined,
    defaultValues: selectedType ? getDefaultValues(visibleFields) : {},
  })

  // Watch cliente field for auto-filling sede_legale (only for DM329)
  const clienteValue = useWatch({
    control,
    name: 'cliente',
  })

  // Get customer details when cliente is selected
  const customerId = typeof clienteValue === 'object' && clienteValue?.id ? clienteValue.id : null
  const { data: customerData } = useCustomer(customerId || '')

  // Check customer completeness and auto-fill address for DM329
  useEffect(() => {
    if (selectedType?.name === 'DM329' && customerData) {
      // Check if customer has all required fields
      if (!isCustomerComplete(customerData)) {
        // Show dialog to complete missing data
        setSelectedCustomerForComplete(customerData)
        setShowCompleteDialog(true)
      } else {
        // Customer is complete - auto-fill address
        const formattedAddress = customersApi.formatFullAddress(customerData)
        if (formattedAddress) {
          setValue('sede_legale', formattedAddress)
        }
      }
    }
  }, [customerData, selectedType, setValue])

  // Handle customer data completion
  const handleCustomerComplete = (updatedCustomer: Customer) => {
    setShowCompleteDialog(false)
    setSelectedCustomerForComplete(null)

    // Auto-fill address with updated data
    const formattedAddress = customersApi.formatFullAddress(updatedCustomer)
    if (formattedAddress) {
      setValue('sede_legale', formattedAddress)
    }
  }

  // Handle skip customer completion
  const handleSkipComplete = () => {
    setShowCompleteDialog(false)
    setSelectedCustomerForComplete(null)
    // Don't auto-fill address if user skips
  }

  // Pre-seleziona il tipo se viene passato nella query string
  useEffect(() => {
    const typeFromUrl = searchParams.get('type')
    if (typeFromUrl && requestTypes.length > 0 && !selectedTypeId) {
      const typeExists = requestTypes.find(t => t.id === typeFromUrl)
      if (typeExists) {
        setSelectedTypeId(typeFromUrl)
        const visible = typeExists.fields_schema.filter(field => !field.hidden)
        reset(getDefaultValues(visible))
      }
    }
  }, [searchParams, requestTypes, selectedTypeId, reset])

  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId)
    const type = requestTypes.find(t => t.id === typeId)
    if (type) {
      const visible = type.fields_schema.filter(field => !field.hidden)
      reset(getDefaultValues(visible))
    }
  }

  const onSubmit = async (data: any) => {
    if (!selectedTypeId || !selectedType) return

    try {
      // Extract customer_id from autocomplete fields
      let customer_id: string | undefined

      // Process form data to extract customer_id from autocomplete fields
      const processedData = { ...data }

      visibleFields.forEach(field => {
        if (field.type === 'autocomplete' && field.dataSource === 'customers') {
          const customerValue = processedData[field.name]
          if (customerValue && typeof customerValue === 'object' && customerValue.id) {
            customer_id = customerValue.id
            // Keep customer data in custom_fields for backward compatibility and display
            processedData[field.name] = {
              id: customerValue.id,
              ragione_sociale: customerValue.ragione_sociale,
            }
          }
        }
      })

      // Generate title based on request type
      let title = `${selectedType.name} - ${new Date().toLocaleDateString('it-IT')}`

      // For DM329, include customer name in title and set default stato_fattura
      if (selectedType.name === 'DM329') {
        // Set default stato_fattura
        processedData.stato_fattura = 'NO'

        // Include customer name in title
        if (processedData.cliente) {
          const clienteName = typeof processedData.cliente === 'string'
            ? processedData.cliente
            : processedData.cliente.ragione_sociale || processedData.cliente
          title = `DM329 - ${clienteName} - ${new Date().toLocaleDateString('it-IT')}`
        }
      }

      const request = await createRequest.mutateAsync({
        request_type_id: selectedTypeId,
        title,
        custom_fields: processedData,
        customer_id,
      })

      navigate(`/requests/${request.id}`)
    } catch (error) {
      console.error('Errore nella creazione della richiesta:', error)
    }
  }

  if (loadingTypes) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')} sx={{ mb: 2 }}>
          Torna alla lista
        </Button>

        <Typography variant="h4" gutterBottom>
          Nuova Richiesta
        </Typography>

        <Card>
          <CardContent>
            {/* Nascondi il select se il tipo è stato pre-impostato dalla URL */}
            {!typePreselected && (
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Tipo di Richiesta</InputLabel>
                <Select
                  value={selectedTypeId}
                  onChange={e => handleTypeChange(e.target.value)}
                  label="Tipo di Richiesta"
                >
                  <MenuItem value="">
                    <em>Seleziona un tipo di richiesta</em>
                  </MenuItem>
                  {requestTypes.map(type => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {selectedType && (
              <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Dettagli {selectedType.name}
                </Typography>

                {visibleFields.map(field => (
                  <DynamicFormField
                    key={field.name}
                    field={field}
                    control={control}
                    error={errors[field.name]}
                  />
                ))}

                {createRequest.isError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Errore nella creazione della richiesta. Riprova.
                  </Alert>
                )}

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={createRequest.isPending}
                  >
                    {createRequest.isPending ? 'Salvataggio...' : 'Crea Richiesta'}
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/requests')}>
                    Annulla
                  </Button>
                </Box>
              </Box>
            )}

            {!selectedType && (
              <Alert severity="info" sx={{ mt: 3 }}>
                Seleziona un tipo di richiesta per iniziare
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Dialog for completing customer data when missing fields detected */}
      <CompleteCustomerDataDialog
        open={showCompleteDialog}
        customer={selectedCustomerForComplete}
        onClose={handleSkipComplete}
        onComplete={handleCustomerComplete}
        allowSkip={true}
      />
    </Layout>
  )
}
