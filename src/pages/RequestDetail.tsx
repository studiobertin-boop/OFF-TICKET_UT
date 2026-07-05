import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Divider,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Assignment as AssignmentIcon,
  PersonAdd as PersonAddIcon,
  PriorityHigh as PriorityHighIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest, useHideRequest, useDeleteRequest, useUpdateRequest, useClientDm329Overview } from '@/hooks/useRequests'
import { codiceForRequest } from '@/utils/practiceCode'
import { useCustomer, useCustomers } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { requestsApi } from '@/services/api/requests'
import { customersApi } from '@/services/api/customers'
import { technicalDataApi } from '@/services/api/technicalData'
import { StatusTransitionButtons } from '@/components/requests/StatusTransitionButtons'
import { AssignmentSection } from '@/components/requests/AssignmentSection'
import { RequestHistoryPanel } from '@/components/requests/RequestHistoryPanel'
import { RequestChatBox } from '@/components/requests/RequestChatBox'
import { BlockIndicator } from '@/components/requests/BlockIndicator'
import { BlockRequestDialog } from '@/components/requests/BlockRequestDialog'
import { UnblockRequestDialog } from '@/components/requests/UnblockRequestDialog'
import { AttributeRequestDialog } from '@/components/requests/AttributeRequestDialog'
import { ConfirmHideDialog } from '@/components/requests/ConfirmHideDialog'
import { ConfirmDeleteDialog } from '@/components/requests/ConfirmDeleteDialog'
import { AttachmentsSection } from '@/components/requests/AttachmentsSection'
import { RequestDetailsEditForm } from '@/components/requests/RequestDetailsEditForm'
import { CompleteCustomerDataDialog } from '@/components/customers/CompleteCustomerDataDialog'
import { AssegnaCodicePraticaPanel } from '@/components/requests/AssegnaCodicePraticaPanel'
import { useActiveBlock } from '@/hooks/useRequestBlocks'
import { getStatusColor, getStatusLabel, isDM329Family } from '@/utils/workflow'
import { StatusChip } from '@/components/common'
import { DM329StatusStepper } from '@/components/requests/DM329StatusStepper'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { hasIncompleteCustomerData } from '@/utils/customerValidation'
import { STATO_FATTURA_OPTIONS, STATO_FATTURA_LABELS, type StatoFattura, type Customer } from '@/types'

export const RequestDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: request, isLoading, error, refetch } = useRequest(id!)
  const { data: activeBlock } = useActiveBlock(id)
  const { isEnabled: dm329FullWorkflowEnabled } = useFeatureFlag('dm329_full_workflow')
  const { data: requestTypes = [] } = useRequestTypes()

  // Fetch full customer data if custom_fields.cliente.id exists (legacy DM329 requests)
  const legacyCustomerId = request?.custom_fields?.cliente && typeof request.custom_fields.cliente === 'object'
    ? (request.custom_fields.cliente as any).id
    : null
  const { data: legacyCustomer } = useCustomer(legacyCustomerId)

  // Fetch customer by ragione_sociale if cliente is a string (CSV imported data)
  const clienteString = request?.custom_fields?.cliente && typeof request.custom_fields.cliente === 'string'
    ? request.custom_fields.cliente
    : null

  // Only fetch customers if we have a clienteString to search for
  const shouldFetchByName = !!clienteString && !legacyCustomerId && !request?.customer
  const { data: customersSearchResult } = useCustomers(
    shouldFetchByName ? { search: clienteString } : undefined,
    { enabled: shouldFetchByName }
  )

  const customerByName = useMemo(() => {
    if (!shouldFetchByName || !customersSearchResult?.data) return null
    return customersSearchResult.data.find(
      c => c.ragione_sociale.toLowerCase() === clienteString?.toLowerCase()
    )
  }, [customersSearchResult, clienteString, shouldFetchByName])

  const hideRequest = useHideRequest()
  const deleteRequest = useDeleteRequest()
  const updateRequest = useUpdateRequest()
  const [changingType, setChangingType] = useState(false)

  const [hideDialogOpen, setHideDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
  const [attributeDialogOpen, setAttributeDialogOpen] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState('')
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [noCivaValue, setNoCivaValue] = useState(false)
  const [offCacValue, setOffCacValue] = useState<'off' | 'cac' | ''>('')
  const [statoFatturaValue, setStatoFatturaValue] = useState<StatoFattura>('NO')
  const [denominazioneSalaValue, setDenominazioneSalaValue] = useState('')
  const [togglingUrgent, setTogglingUrgent] = useState(false)
  const [sedeImpianto, setSedeImpianto] = useState<string | null>(null)

  // Load technical data for DM329 requests to get sede_impianto
  // (famiglia DM329: include anche DM329-Integrazioni)
  const isDM329 = isDM329Family(request?.request_type?.name)
  useEffect(() => {
    if (isDM329 && id) {
      technicalDataApi.getByRequestId(id)
        .then(data => {
          const sede = data?.equipment_data?.dati_impianto?.sede_impianto
          setSedeImpianto(sede || null)
        })
        .catch(() => setSedeImpianto(null))
    }
  }, [id, isDM329])

  // Extract client information from request - use useMemo to recalculate when dependencies change
  const clientInfo = useMemo(() => {
    if (!request) return null

    // Priority 1: Use joined customer relation (new requests)
    if (request.customer) {
      return {
        ragione_sociale: request.customer.ragione_sociale,
        identificativo: request.customer.identificativo || null,
        telefono: request.customer.telefono || 'N/A',
        pec: request.customer.pec || 'N/A',
        descrizione_attivita: request.customer.descrizione_attivita || 'N/A',
        sede_legale: customersApi.formatFullAddress(request.customer),
      }
    }

    // Priority 2: Use legacyCustomer fetched by ID (legacy DM329 with customer object in autocomplete)
    if (legacyCustomer) {
      return {
        ragione_sociale: legacyCustomer.ragione_sociale,
        identificativo: legacyCustomer.identificativo || null,
        telefono: legacyCustomer.telefono || 'N/A',
        pec: legacyCustomer.pec || 'N/A',
        descrizione_attivita: legacyCustomer.descrizione_attivita || 'N/A',
        sede_legale: customersApi.formatFullAddress(legacyCustomer),
      }
    }

    // Priority 2.5: Use customerByName found by search (CSV imported - cliente as string, but customer exists in DB)
    if (customerByName) {
      return {
        ragione_sociale: customerByName.ragione_sociale,
        identificativo: customerByName.identificativo || null,
        telefono: customerByName.telefono || 'N/A',
        pec: customerByName.pec || 'N/A',
        descrizione_attivita: customerByName.descrizione_attivita || 'N/A',
        sede_legale: customersApi.formatFullAddress(customerByName),
      }
    }

    // Priority 3: Use custom_fields (CSV imported data - cliente as string, no customer in DB)
    const cliente = request.custom_fields?.cliente
    const sedeLegale = request.custom_fields?.sede_legale

    // Handle both object and string formats
    if (cliente) {
      let ragioneSociale = ''

      if (typeof cliente === 'string') {
        ragioneSociale = cliente
      } else if (typeof cliente === 'object') {
        ragioneSociale = (cliente as any).ragione_sociale || (cliente as any).label || ''
      }

      if (ragioneSociale) {
        return {
          ragione_sociale: ragioneSociale,
          identificativo: (typeof cliente === 'object' && (cliente as any).identificativo) || null,
          telefono: 'N/A',
          pec: 'N/A',
          descrizione_attivita: 'N/A',
          // Use sede_legale from custom_fields if available (CSV imported data stores it here)
          sede_legale: sedeLegale && typeof sedeLegale === 'string' ? sedeLegale : 'N/A',
        }
      }
    }

    return null
  }, [request, legacyCustomer, customerByName])

  // Record cliente reale (con id) collegato alla pratica, per completare l'anagrafica.
  // È null per pratiche importate da CSV senza cliente registrato a DB (nulla da completare).
  const customerRecord = useMemo<Customer | null>(() => {
    if (request?.customer) return request.customer as Customer
    if (legacyCustomer) return legacyCustomer
    if (customerByName) return customerByName
    return null
  }, [request, legacyCustomer, customerByName])

  // Codice pratica DM329 (chip accanto al titolo)
  const { data: clientDm329Overview = [] } = useClientDm329Overview(request?.customer_id)
  const clientSalaCount = useMemo(
    () => new Set(clientDm329Overview.map(p => p.sala_lettera)).size,
    [clientDm329Overview]
  )
  const codicePratica = request ? codiceForRequest(request, clientSalaCount) : ''

  const [showCompleteCustomerDialog, setShowCompleteCustomerDialog] = useState(false)

  const handleCustomerDataComplete = () => {
    setShowCompleteCustomerDialog(false)
    // Aggiorna la pratica per riflettere il cliente joinato aggiornato
    refetch()
  }

  const handleHide = async () => {
    try {
      await hideRequest.mutateAsync(id!)
      setHideDialogOpen(false)
      navigate('/requests')
    } catch (error) {
      console.error('Error hiding request:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteRequest.mutateAsync(id!)
      setDeleteDialogOpen(false)
      navigate('/requests')
    } catch (error) {
      console.error('Error deleting request:', error)
    }
  }

  const handleEditNote = () => {
    setNoteValue((request?.custom_fields?.note as string) || '')
    setIsEditingNote(true)
  }

  const handleToggleUrgent = async () => {
    if (!id || !request) return

    const newUrgentState = !request.is_urgent

    try {
      setTogglingUrgent(true)
      await requestsApi.toggleUrgent(id, newUrgentState)
      await refetch()
    } catch (err) {
      console.error('Error toggling urgent status:', err)
      alert('Errore nel cambiamento dello stato urgente')
    } finally {
      setTogglingUrgent(false)
    }
  }

  const handleSaveNote = async () => {
    if (!request) return
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        updates: {
          custom_fields: {
            ...request.custom_fields,
            note: noteValue,
          },
        },
      })
      setIsEditingNote(false)
      refetch()
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const handleCancelNote = () => {
    setIsEditingNote(false)
    setNoteValue('')
  }

  const handleEditDetails = () => {
    const cf = request?.custom_fields || {}
    setNoCivaValue(cf.no_civa === true)
    setOffCacValue((cf.off_cac as 'off' | 'cac' | '') || '')
    setStatoFatturaValue((cf.stato_fattura as StatoFattura) || 'NO')
    setDenominazioneSalaValue(request?.denominazione_sala || '')
    setIsEditingDetails(true)
  }

  const handleSaveDetails = async () => {
    if (!request) return
    // Regola coerente con la tabella DM329: "Sì" impostabile solo su richieste CHIUSE o ARCHIVIATE NON FINITE
    if (
      statoFatturaValue === 'SI' &&
      request.status !== '7-CHIUSA' &&
      request.status !== 'ARCHIVIATA NON FINITA'
    ) {
      alert('Stato fattura "Sì" impostabile solo su richieste CHIUSE o ARCHIVIATE NON FINITE')
      return
    }
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        updates: {
          // denominazione_sala è colonna della pratica (non custom_field): NON cambia
          // la lettera sala né il codice pratica, solo l'etichetta descrittiva.
          denominazione_sala: denominazioneSalaValue.trim() || null,
          custom_fields: {
            ...request.custom_fields,
            no_civa: noCivaValue,
            off_cac: offCacValue,
            stato_fattura: statoFatturaValue,
          },
        },
      })
      setIsEditingDetails(false)
      refetch()
    } catch (error) {
      console.error('Error updating request details:', error)
      alert('Errore nel salvataggio dei dettagli')
    }
  }

  // Salvataggio campi dinamici (richieste non-DM329) dal form generato sul fields_schema
  const handleSaveDynamicDetails = async (customFields: Record<string, any>) => {
    if (!request) return
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        updates: { custom_fields: customFields },
      })
      setIsEditingDetails(false)
      refetch()
    } catch (error) {
      console.error('Error updating request details:', error)
      alert('Errore nel salvataggio dei dettagli')
    }
  }

  const handleCancelDetails = () => {
    setIsEditingDetails(false)
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error || !request) {
    return (
      <Layout>
        <Alert severity="error">Richiesta non trovata</Alert>
      </Layout>
    )
  }

  // Determine if user can block
  // Only admin and userdm329 (on DM329 requests) can block
  const canBlock =
    user?.role === 'admin' ||
    (user?.role === 'userdm329' && isDM329Family(request.request_type?.name))

  // Determine if user can unblock
  // Admin: always
  // Tecnico: only on general requests (not DM329)
  // Userdm329: only on DM329 requests
  // Utente: only on general requests (not DM329)
  // isDM329 already declared above for technical data loading
  const canUnblock =
    user?.role === 'admin' ||
    (user?.role === 'tecnico' && !isDM329) ||
    (user?.role === 'userdm329' && isDM329) ||
    (user?.role === 'utente' && !isDM329)

  // Determine if user can edit notes
  // Admin: always
  // Userdm329: only on DM329 requests
  // Tecnico: only on general requests (not DM329)
  const canEditNote =
    user?.role === 'admin' ||
    (user?.role === 'userdm329' && isDM329) ||
    (user?.role === 'tecnico' && !isDM329)

  // Determine if user can edit the "Dettagli Richiesta" fields
  // DM329: campi fissi (No CIVA, Off/Cac, Stato fattura) → admin o userdm329
  // Normali: campi dinamici del fields_schema → admin, tecnico, o l'utente creatore
  const canEditDetails =
    user?.role === 'admin' ||
    (user?.role === 'userdm329' && isDM329) ||
    (user?.role === 'tecnico' && !isDM329) ||
    (user?.role === 'utente' && !isDM329 && request.created_by === user?.id)

  // Determine if user can delete the request
  // Admin: qualsiasi richiesta; userdm329: pratiche DM329 (in qualsiasi stato, come admin lato RLS)
  const canDelete =
    user?.role === 'admin' || (user?.role === 'userdm329' && isDM329)

  // Determine if user can access technical details
  // Admin, userdm329, and tecnicoDM329 (if assigned) can access technical details for DM329 requests
  // Only if feature flag is enabled
  const canAccessTechnicalDetails =
    dm329FullWorkflowEnabled &&
    isDM329 &&
    (user?.role === 'admin' ||
     user?.role === 'userdm329' ||
     (user?.role === 'tecnicoDM329' && request?.assigned_to === user?.id))

  // Determine if user can toggle urgent status
  // Only admin and userdm329 can mark requests as urgent
  const canToggleUrgent = user?.role === 'admin' || user?.role === 'userdm329'

  // Pannello codice pratica: DM329-family, admin/userdm329, con cliente collegato.
  // Se la pratica ha già il codice il pannello è in modalità "modifica" (collassato).
  const isIntegrazione = request.request_type?.name === 'DM329-Integrazioni'
  const hasCodicePratica = isIntegrazione ? !!request.pratica_padre_id : !!request.sala_lettera
  const canManageCodice =
    isDM329 &&
    !!customerRecord &&
    (user?.role === 'admin' || user?.role === 'userdm329')

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')}>
            Torna alla lista
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Technical Details button (DM329 only, with feature flag) */}
            {canAccessTechnicalDetails && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AssignmentIcon />}
                onClick={() => navigate(`/requests/${id}/technical-details`)}
                size="small"
              >
                SCHEDA DATI
              </Button>
            )}

            {/* Urgent toggle button - Only for admin and userdm329 */}
            {canToggleUrgent && (
              <Button
                variant={request.is_urgent ? 'contained' : 'outlined'}
                color="error"
                startIcon={<PriorityHighIcon />}
                onClick={handleToggleUrgent}
                disabled={togglingUrgent}
                size="small"
              >
                {request.is_urgent ? 'URGENTE' : 'SEGNA URGENTE'}
              </Button>
            )}

            {/* Block/Unblock buttons */}
            {canBlock && !request.is_blocked && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<BlockIcon />}
                onClick={() => setBlockDialogOpen(true)}
                size="small"
              >
                Blocca Richiesta
              </Button>
            )}

            {canUnblock && request.is_blocked && activeBlock && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => setUnblockDialogOpen(true)}
                size="small"
              >
                Sblocca Richiesta
              </Button>
            )}

            {/* Attribuisci: admin sempre, userdm329 su pratiche DM329-family */}
            {(user?.role === 'admin' || (user?.role === 'userdm329' && isDM329)) && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PersonAddIcon />}
                onClick={() => setAttributeDialogOpen(true)}
                size="small"
              >
                {request.attributed_to ? 'Modifica Attribuzione' : 'Attribuisci'}
              </Button>
            )}

            {/* Admin actions */}
            {user?.role === 'admin' && (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<VisibilityOffIcon />}
                  onClick={() => setHideDialogOpen(true)}
                  size="small"
                >
                  Nascondi
                </Button>
              </>
            )}

            {/* Elimina: admin (qualsiasi) + userdm329 (pratiche DM329) */}
            {canDelete && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                size="small"
              >
                Elimina
              </Button>
            )}
          </Box>
        </Box>

        {/* HERO: cliente, codice/sala, stato + date, workflow */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {request.is_blocked && (
                    <BlockIndicator isBlocked={true} reason={activeBlock?.reason} />
                  )}
                  <Typography variant="h4" sx={{ wordBreak: 'break-word' }}>
                    {isDM329 ? clientInfo?.ragione_sociale || request.title : request.title}
                  </Typography>
                </Box>
                {isDM329 && (codicePratica || request.denominazione_sala) && (
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    {codicePratica && (
                      <Typography component="span" sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem' }}>
                        {codicePratica}
                      </Typography>
                    )}
                    {request.denominazione_sala && (
                      <Typography component="span" variant="subtitle1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        · {request.denominazione_sala}
                      </Typography>
                    )}
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1 }}>
                  <StatusChip status={request.status} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={request.request_type?.name === 'DM329-Integrazioni' ? 'Integrazioni' : request.request_type?.name || 'N/A'}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Creata ${new Date(request.created_at).toLocaleDateString('it-IT')} · ${request.creator?.full_name || 'N/A'}`}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Ultimo cambio stato: ${new Date(request.updated_at).toLocaleString('it-IT')}`}
                  />
                </Box>
              </Box>
              {isDM329 && (
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="overline" color="text.secondary" display="block">
                    Attribuita a
                  </Typography>
                  {request.attributed_user ? (
                    <Typography variant="body2">{request.attributed_user.full_name}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">Non attribuita</Typography>
                  )}
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {isDM329 ? (
              <DM329StatusStepper
                requestId={request.id}
                currentStatus={request.status}
                requestTypeName={request.request_type?.name || ''}
                isBlocked={request.is_blocked}
                onStatusChanged={refetch}
              />
            ) : (
              <StatusTransitionButtons
                requestId={request.id}
                currentStatus={request.status}
                requestTypeName={request.request_type?.name || ''}
                assignedTo={request.assigned_to}
                isBlocked={request.is_blocked}
                onStatusChanged={refetch}
              />
            )}
          </CardContent>
        </Card>

        {canManageCodice && customerRecord && (
          <AssegnaCodicePraticaPanel
            request={request}
            customer={customerRecord}
            sedeLegale={customersApi.formatFullAddress(customerRecord)}
            hasCode={hasCodicePratica}
            currentCodice={codicePratica}
            onSaved={() => refetch()}
          />
        )}

        {/* Contenuto: sinistra info, destra storico/messaggi/allegati */}
        <Grid container spacing={3}>
          {/* Left column: Request details */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Tipo Richiesta
                </Typography>
                {(user?.role === 'admin' || user?.role === 'userdm329') && isDM329 ? (
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <Select
                      value={request.request_type_id}
                      disabled={changingType}
                      onChange={async (e) => {
                        const newTypeId = e.target.value
                        if (newTypeId === request.request_type_id) return
                        const newType = requestTypes.find(t => t.id === newTypeId)
                        if (!newType) return
                        setChangingType(true)
                        try {
                          const newTitle = request.title.replace(
                            /^(DM329-Integrazioni|DM329)/,
                            newType.name
                          )
                          await updateRequest.mutateAsync({
                            id: request.id,
                            updates: { request_type_id: newTypeId, title: newTitle },
                          })
                          refetch()
                        } finally {
                          setChangingType(false)
                        }
                      }}
                    >
                      {requestTypes.filter(t => isDM329Family(t.name)).map(t => (
                        <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography variant="body1" gutterBottom>
                    {request.request_type?.name || 'N/A'}
                  </Typography>
                )}
              </Grid>
            </Grid>

            {/* Informazioni Cliente - NEW SECTION */}
            {clientInfo && (
              <>
                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Informazioni Cliente
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                  {/* Left column */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Cliente
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {clientInfo.identificativo
                        ? `${clientInfo.identificativo} — ${clientInfo.ragione_sociale}`
                        : clientInfo.ragione_sociale}
                    </Typography>
                  </Box>

                  {/* Right column */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Sede Legale
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {clientInfo.sede_legale}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Telefono
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {clientInfo.telefono}
                    </Typography>
                  </Box>

                  {/* Sede Impianto - only for DM329 requests, in right column under Sede Legale */}
                  {isDM329 && sedeImpianto && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Sede Impianto
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {sedeImpianto}
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      PEC
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {clientInfo.pec}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Descrizione Attività
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {clientInfo.descrizione_attivita}
                    </Typography>
                  </Box>
                </Box>

                {customerRecord && hasIncompleteCustomerData(customerRecord) && (
                  <Alert
                    severity="info"
                    sx={{ mt: 2 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => setShowCompleteCustomerDialog(true)}
                      >
                        Completa dati
                      </Button>
                    }
                  >
                    Alcuni dati anagrafici del cliente sono incompleti. Puoi integrarli ora.
                  </Alert>
                )}
              </>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">
                Dettagli Richiesta
              </Typography>
              {canEditDetails && !isEditingDetails && (
                <IconButton size="small" onClick={handleEditDetails} color="primary">
                  <EditIcon />
                </IconButton>
              )}
            </Box>

            {isEditingDetails && (isDM329 ? (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Denominazione sala"
                      value={denominazioneSalaValue}
                      onChange={(e) => setDenominazioneSalaValue(e.target.value)}
                      placeholder="Es. Sala principale, Verniciatura…"
                      helperText="Solo il nome della sala; non modifica la lettera né il codice pratica."
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="no-civa-label">No CIVA</InputLabel>
                      <Select
                        labelId="no-civa-label"
                        label="No CIVA"
                        value={noCivaValue ? 'true' : 'false'}
                        onChange={(e) => setNoCivaValue(e.target.value === 'true')}
                      >
                        <MenuItem value="false">No</MenuItem>
                        <MenuItem value="true">Sì</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="off-cac-label">Off / Cac</InputLabel>
                      <Select
                        labelId="off-cac-label"
                        label="Off / Cac"
                        value={offCacValue}
                        onChange={(e) => setOffCacValue(e.target.value as 'off' | 'cac' | '')}
                      >
                        <MenuItem value=""><em>Nessuno</em></MenuItem>
                        <MenuItem value="off">OFF</MenuItem>
                        <MenuItem value="cac">CAC</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="stato-fattura-label">Stato Fattura</InputLabel>
                      <Select
                        labelId="stato-fattura-label"
                        label="Stato Fattura"
                        value={statoFatturaValue}
                        onChange={(e) => setStatoFatturaValue(e.target.value as StatoFattura)}
                      >
                        {STATO_FATTURA_OPTIONS.map((opt) => (
                          <MenuItem key={opt} value={opt}>{STATO_FATTURA_LABELS[opt]}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveDetails}
                    disabled={updateRequest.isPending}
                  >
                    Salva
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloseIcon />}
                    onClick={handleCancelDetails}
                    disabled={updateRequest.isPending}
                  >
                    Annulla
                  </Button>
                </Box>
              </Box>
            ) : (
              <RequestDetailsEditForm
                request={request}
                saving={updateRequest.isPending}
                onSave={handleSaveDynamicDetails}
                onCancel={handleCancelDetails}
              />
            ))}

            {/* DM329: mostra sempre i campi fissi, anche se vuoti */}
            {isDM329 && !isEditingDetails && (
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Denominazione sala
                  </Typography>
                  <Typography variant="body1">{request.denominazione_sala || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    No CIVA
                  </Typography>
                  <Typography variant="body1">
                    {request.custom_fields?.no_civa ? 'Sì' : 'No'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Off / Cac
                  </Typography>
                  <Typography variant="body1">
                    {request.custom_fields?.off_cac
                      ? String(request.custom_fields.off_cac).toUpperCase()
                      : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Stato Fattura
                  </Typography>
                  <Typography variant="body1">
                    {STATO_FATTURA_LABELS[(request.custom_fields?.stato_fattura as StatoFattura) || 'NO']}
                  </Typography>
                </Grid>
              </Grid>
            )}

            <Grid container spacing={2}>
              {Object.entries(request.custom_fields)
                .filter(([key]) => {
                  // Escludi note (mostrata separatamente)
                  if (key === 'note') return false

                  // Campi DM329 fissi: mostrati sempre nel riquadro qui sopra
                  if (isDM329 && ['no_civa', 'off_cac', 'stato_fattura'].includes(key)) return false

                  // Escludi campi cliente (mostrati in sezione dedicata)
                  const clientFields = ['cliente', 'sede_legale', 'telefono', 'pec', 'descrizione_attivita', 'indirizzo_immobile']
                  if (clientFields.includes(key)) return false

                  // Escludi campi tecnici/interni
                  const technicalFields = ['original_csv_row', 'assignment_category', 'workflow_dates']
                  if (technicalFields.includes(key)) return false

                  return true
                })
                .map(([key, value]) => {
                // Determina come visualizzare il valore
                let displayValue: string

                if (value === null || value === undefined || value === '') {
                  displayValue = 'N/A'
                } else if (typeof value === 'boolean') {
                  displayValue = value ? 'Sì' : 'No'
                } else if (Array.isArray(value)) {
                  // Gestisci array di oggetti (es: compressori)
                  if (value.length > 0 && typeof value[0] === 'object') {
                    displayValue = `${value.length} elementi`
                  } else {
                    displayValue = value.join(', ')
                  }
                } else if (typeof value === 'object') {
                  // Gestisci oggetti (es: cliente autocomplete)
                  if ('ragione_sociale' in value) {
                    displayValue = value.ragione_sociale
                  } else if ('id' in value && 'label' in value) {
                    displayValue = value.label
                  } else {
                    displayValue = JSON.stringify(value)
                  }
                } else {
                  displayValue = String(value)
                }

                return (
                  <Grid item xs={12} md={6} key={key}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Typography variant="body1">
                      {displayValue}
                    </Typography>
                  </Grid>
                )
              })}
            </Grid>
          </CardContent>
        </Card>

        {/* Notes Section - Available for all request types */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Note</Typography>
              {canEditNote && !isEditingNote && (
                <IconButton size="small" onClick={handleEditNote} color="primary">
                  <EditIcon />
                </IconButton>
              )}
            </Box>

            {isEditingNote ? (
              <Box>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Aggiungi note..."
                  variant="outlined"
                />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveNote}
                    disabled={updateRequest.isPending}
                  >
                    Salva
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloseIcon />}
                    onClick={handleCancelNote}
                    disabled={updateRequest.isPending}
                  >
                    Annulla
                  </Button>
                </Box>
              </Box>
            ) : (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {(request.custom_fields?.note as string) || <em>Nessuna nota disponibile</em>}
              </Typography>
            )}
          </CardContent>
        </Card>

            {/* Assignment Section */}
            <AssignmentSection
              requestId={request.id}
              currentAssignedTo={request.assigned_to}
              assignedUser={request.assigned_user}
              requestTypeName={request.request_type?.name}
              onAssignmentChanged={refetch}
            />

          </Grid>

          {/* Colonna destra: storico, messaggi, allegati */}
          <Grid item xs={12} lg={4}>
            <Box sx={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <RequestHistoryPanel requestId={request.id} />
              <RequestChatBox requestId={request.id} />
              <AttachmentsSection
                requestId={request.id}
                requestCreatedBy={request.created_by}
                requestAssignedTo={request.assigned_to}
              />
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Dialogs */}
      <BlockRequestDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        requestId={request.id}
        requestTitle={request.title}
      />

      <UnblockRequestDialog
        open={unblockDialogOpen}
        onClose={() => setUnblockDialogOpen(false)}
        block={activeBlock}
        requestTitle={request.title}
      />

      <AttributeRequestDialog
        open={attributeDialogOpen}
        onClose={() => setAttributeDialogOpen(false)}
        requestId={request.id}
        requestTitle={request.title}
        currentAttributedTo={request.attributed_to}
      />

      <ConfirmHideDialog
        open={hideDialogOpen}
        count={1}
        onConfirm={handleHide}
        onCancel={() => setHideDialogOpen(false)}
        isLoading={hideRequest.isPending}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        count={1}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        isLoading={deleteRequest.isPending}
      />

      <CompleteCustomerDataDialog
        open={showCompleteCustomerDialog}
        customer={customerRecord}
        onClose={() => setShowCompleteCustomerDialog(false)}
        onComplete={handleCustomerDataComplete}
        allowSkip={true}
      />
    </Layout>
  )
}
