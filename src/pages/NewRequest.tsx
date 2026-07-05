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
import { DM329PraticaSection, Dm329PraticaValue } from '@/components/requests/DM329PraticaSection'
import { DM329IntegrazioneSection, Dm329IntegrazioneValue } from '@/components/requests/DM329IntegrazioneSection'
import { CompleteCustomerDataDialog } from '@/components/customers/CompleteCustomerDataDialog'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { useCreateRequest } from '@/hooks/useRequests'
import { useCustomer } from '@/hooks/useCustomers'
import { generateZodSchemaWithValidations, getDefaultValues } from '@/utils/formSchema'
import { hasIncompleteCustomerData } from '@/utils/customerValidation'
import { isDM329Family } from '@/utils/workflow'
import { customersApi } from '@/services/api/customers'
import { Customer } from '@/types'

export const NewRequest = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedTypeId, setSelectedTypeId] = useState<string>('')
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [selectedCustomerForComplete, setSelectedCustomerForComplete] = useState<Customer | null>(null)
  // Evita di riproporre automaticamente il dialog per lo stesso cliente già mostrato
  const [promptedCustomerId, setPromptedCustomerId] = useState<string | null>(null)
  const { data: requestTypes = [], isLoading: loadingTypes } = useRequestTypes()
  const createRequest = useCreateRequest()

  // Valori delle sezioni DM329 dedicate (gestiti fuori dal resolver Zod)
  const [praticaValue, setPraticaValue] = useState<{ value: Dm329PraticaValue | null; valid: boolean }>({ value: null, valid: false })
  const [integrazioneValue, setIntegrazioneValue] = useState<{ value: Dm329IntegrazioneValue | null; valid: boolean }>({ value: null, valid: false })
  const [sectionError, setSectionError] = useState<string | null>(null)

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

  // Auto-fill address for DM329 and offer to complete missing optional data
  useEffect(() => {
    if (isDM329Family(selectedType?.name) && customerData) {
      // Auto-fill address with whatever data is available (partial address is fine)
      const formattedAddress = customersApi.formatFullAddress(customerData)
      if (formattedAddress) {
        setValue('sede_legale', formattedAddress)
      }

      // Propose completing missing optional fields, only once per selected customer
      if (hasIncompleteCustomerData(customerData) && promptedCustomerId !== customerData.id) {
        setSelectedCustomerForComplete(customerData)
        setShowCompleteDialog(true)
        setPromptedCustomerId(customerData.id)
      }
    }
  }, [customerData, selectedType, setValue, promptedCustomerId])

  // Manually re-open the completion dialog for the currently selected customer
  const handleOpenCompleteDialog = () => {
    if (customerData) {
      setSelectedCustomerForComplete(customerData)
      setShowCompleteDialog(true)
    }
  }

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

  // Handle skip customer completion (procedi comunque)
  const handleSkipComplete = () => {
    setShowCompleteDialog(false)
    setSelectedCustomerForComplete(null)
    // Address already auto-filled above; nothing else to do
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

    // Validazione delle sezioni DM329 dedicate (fuori dal resolver)
    if (selectedType.name === 'DM329' && !praticaValue.valid) {
      setSectionError('Completa i dati impianto e sala: indirizzo impianto, sala e denominazione (per una nuova sala).')
      return
    }
    if (selectedType.name === 'DM329-Integrazioni' && !integrazioneValue.valid) {
      setSectionError('Seleziona la pratica DM329 da integrare.')
      return
    }
    setSectionError(null)

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

      // Set default stato_fattura for all request types
      processedData.stato_fattura = 'NO'

      // Generate title based on request type
      let title = `${selectedType.name} - ${new Date().toLocaleDateString('it-IT')}`

      // Per DM329 e DM329-Integrazioni, include il nome cliente nel titolo
      if (isDM329Family(selectedType.name)) {
        if (processedData.cliente) {
          const clienteName = typeof processedData.cliente === 'string'
            ? processedData.cliente
            : processedData.cliente.ragione_sociale || processedData.cliente
          title = `${selectedType.name} - ${clienteName} - ${new Date().toLocaleDateString('it-IT')}`
        }
      }

      const payload: any = {
        request_type_id: selectedTypeId,
        title,
        custom_fields: processedData,
        customer_id,
      }

      // Codice pratica: DM329 (sala/progressivo) vs Integrazioni (pratica padre)
      if (selectedType.name === 'DM329' && praticaValue.value) {
        Object.assign(payload, {
          sala_lettera: praticaValue.value.sala_lettera,
          progressivo: praticaValue.value.progressivo,
          anno: praticaValue.value.anno,
          denominazione_sala: praticaValue.value.denominazione_sala,
          indirizzo_impianto: praticaValue.value.indirizzo_impianto,
          impianto_uguale_sede_legale: praticaValue.value.impianto_uguale_sede_legale,
        })
      } else if (selectedType.name === 'DM329-Integrazioni' && integrazioneValue.value) {
        Object.assign(payload, {
          pratica_padre_id: integrazioneValue.value.pratica_padre_id,
          sala_lettera: integrazioneValue.value.sala_lettera,
          progressivo: integrazioneValue.value.progressivo,
          anno: integrazioneValue.value.anno,
        })
      }

      const request = await createRequest.mutateAsync(payload)

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

                {selectedType.name === 'DM329' && customerData && (
                  <DM329PraticaSection
                    customer={customerData}
                    sedeLegale={customersApi.formatFullAddress(customerData)}
                    control={control}
                    setValue={setValue}
                    onChange={(value, valid) => setPraticaValue({ value, valid })}
                  />
                )}

                {selectedType.name === 'DM329-Integrazioni' && customerData && (
                  <DM329IntegrazioneSection
                    customer={customerData}
                    onChange={(value, valid) => setIntegrazioneValue({ value, valid })}
                  />
                )}

                {selectedType.name === 'DM329' &&
                  customerData &&
                  hasIncompleteCustomerData(customerData) && (
                    <Alert
                      severity="info"
                      sx={{ mt: 2 }}
                      action={
                        <Button color="inherit" size="small" onClick={handleOpenCompleteDialog}>
                          Completa dati
                        </Button>
                      }
                    >
                      Alcuni dati anagrafici del cliente sono incompleti. Puoi integrarli ora oppure
                      procedere comunque.
                    </Alert>
                  )}

                {sectionError && (
                  <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setSectionError(null)}>
                    {sectionError}
                  </Alert>
                )}

                {createRequest.isError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {createRequest.error instanceof Error
                      ? createRequest.error.message
                      : 'Errore nella creazione della richiesta. Riprova.'}
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
