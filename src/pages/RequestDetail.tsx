import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Divider,
  TextField,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest, useHideRequest, useDeleteRequest, useUpdateRequest, useClientDm329Overview } from '@/hooks/useRequests'
import { codiceForRequest } from '@/utils/practiceCode'
import { useCustomer, useCustomers } from '@/hooks/useCustomers'
import { useAuth } from '@/hooks/useAuth'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'
import { requestsApi } from '@/services/api/requests'
import { customersApi } from '@/services/api/customers'
import { attachmentsApi } from '@/services/api/attachments'
import { requestMessagesApi } from '@/services/api/requestMessages'
import { StatusTransitionButtons } from '@/components/requests/StatusTransitionButtons'
import { AssignmentSection } from '@/components/requests/AssignmentSection'
import { RequestHistoryPanel } from '@/components/requests/RequestHistoryPanel'
import { RequestChatBox } from '@/components/requests/RequestChatBox'
import { RequestDetailHeader } from '@/components/requests/RequestDetailHeader'
import { RequestActionsBar } from '@/components/requests/RequestActionsBar'
import { RequestPropertiesRail } from '@/components/requests/RequestPropertiesRail'
import { BlockRequestDialog } from '@/components/requests/BlockRequestDialog'
import { UnblockRequestDialog } from '@/components/requests/UnblockRequestDialog'
import { AttributeRequestDialog } from '@/components/requests/AttributeRequestDialog'
import { ConfirmHideDialog } from '@/components/requests/ConfirmHideDialog'
import { ConfirmDeleteDialog } from '@/components/requests/ConfirmDeleteDialog'
import { AttachmentsSection } from '@/components/requests/AttachmentsSection'
import { RequestDetailsEditForm } from '@/components/requests/RequestDetailsEditForm'
import { CompleteCustomerDataDialog } from '@/components/customers/CompleteCustomerDataDialog'
import { CodicePraticaDialog } from '@/components/requests/CodicePraticaDialog'
import { CustomerInfoSection } from '@/components/requests/CustomerInfoSection'
import { PlantLocationSection } from '@/components/requests/PlantLocationSection'
import { useActiveBlock } from '@/hooks/useRequestBlocks'
import { isDM329Family } from '@/utils/workflow'
import { FieldValue, SectionLabel } from '@/components/common'
import { DM329StatusStepper } from '@/components/requests/DM329StatusStepper'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { hasIncompleteCustomerData } from '@/utils/customerValidation'
import { type StatoFattura, type Customer } from '@/types'
import { risolviIndirizzoImpianto } from '@/utils/indirizzoImpianto'

const TAB_DETTAGLIO = ['dettagli', 'storico', 'messaggi', 'allegati'] as const

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
  const [togglingUrgent, setTogglingUrgent] = useState(false)

  // Il tab attivo vive nella querystring: un refresh, un "indietro" o un link
  // condiviso riportano dove si stava guardando.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabRichiesto = searchParams.get('tab') || ''
  const tab = (TAB_DETTAGLIO as readonly string[]).includes(tabRichiesto) ? tabRichiesto : 'dettagli'
  const cambiaTab = (nuovo: string) => {
    const params = new URLSearchParams(searchParams)
    if (nuovo === 'dettagli') params.delete('tab')
    else params.set('tab', nuovo)
    setSearchParams(params, { replace: true })
  }

  // Contatori sulle linguette. Stesse queryKey dei pannelli: TanStack condivide
  // la cache, quindi leggerli qui non aggiunge richieste di rete.
  const { data: messaggi } = useQuery({
    queryKey: ['request-messages', id],
    queryFn: () => requestMessagesApi.getByRequestId(id!),
    enabled: !!id,
  })
  const { data: allegati } = useQuery({
    queryKey: ['attachments', id],
    queryFn: () => attachmentsApi.getByRequestId(id!),
    enabled: !!id,
  })

  // Famiglia DM329: include anche DM329-Integrazioni
  const isDM329 = isDM329Family(request?.request_type?.name)

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

  /**
   * Campi di custom_fields che non hanno già un posto proprio nella pagina.
   * Il filtro è lo stesso di prima, spostato fuori dal JSX perché ora produce
   * anche l'etichetta e il valore formattato per FieldValue.
   */
  const campiExtra = useMemo(() => {
    if (!request?.custom_fields) return []

    const campiCliente = ['cliente', 'sede_legale', 'telefono', 'pec', 'descrizione_attivita', 'indirizzo_immobile']
    const campiTecnici = ['original_csv_row', 'assignment_category', 'workflow_dates']

    return Object.entries(request.custom_fields)
      .filter(([key]) => {
        if (key === 'note') return false                                               // ha una sezione dedicata
        if (isDM329 && ['no_civa', 'off_cac', 'stato_fattura'].includes(key)) return false // colonna proprietà
        if (campiCliente.includes(key)) return false                                   // sezione Cliente
        if (campiTecnici.includes(key)) return false                                   // interni
        return true
      })
      .map(([key, value]) => {
        // undefined = campo vuoto: FieldValue lo rende con un trattino spento.
        let display: string | undefined

        if (value === null || value === undefined || value === '') {
          display = undefined
        } else if (typeof value === 'boolean') {
          display = value ? 'Sì' : 'No'
        } else if (Array.isArray(value)) {
          display = value.length > 0 && typeof value[0] === 'object'
            ? `${value.length} elementi`
            : value.join(', ')
        } else if (typeof value === 'object') {
          const oggetto = value as any
          if ('ragione_sociale' in oggetto) display = oggetto.ragione_sociale
          else if ('id' in oggetto && 'label' in oggetto) display = oggetto.label
          else display = JSON.stringify(oggetto)
        } else {
          display = String(value)
        }

        return {
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: display,
        }
      })
  }, [request, isDM329])

  const [showCompleteCustomerDialog, setShowCompleteCustomerDialog] = useState(false)
  const [codiceDialogOpen, setCodiceDialogOpen] = useState(false)

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

  const handleChangeType = async (newTypeId: string) => {
    if (!request || newTypeId === request.request_type_id) return
    const newType = requestTypes.find(t => t.id === newTypeId)
    if (!newType) return

    setChangingType(true)
    try {
      // Il titolo porta in testa il nome del tipo: cambiandolo va riallineato.
      const newTitle = request.title.replace(/^(DM329-Integrazioni|DM329)/, newType.name)
      await updateRequest.mutateAsync({
        id: request.id,
        updates: { request_type_id: newTypeId, title: newTitle },
      })
      refetch()
    } finally {
      setChangingType(false)
    }
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

  const indirizzoImpianto = risolviIndirizzoImpianto(request.indirizzo_impianto)
  const noteSalvata = (request.custom_fields?.note as string) || ''

  return (
    <Layout>
      <Box>
        <RequestDetailHeader
          request={request}
          title={isDM329 ? clientInfo?.ragione_sociale || request.title : request.title}
          isDM329={isDM329}
          codicePratica={codicePratica}
          canManageCodice={canManageCodice}
          onEditCodice={() => setCodiceDialogOpen(true)}
          blockReason={activeBlock?.reason}
          onBack={() => navigate('/requests')}
          primaryActions={
            <>
              {canAccessTechnicalDetails && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigate(`/requests/${id}/technical-details`)}
                >
                  Scheda dati
                </Button>
              )}
              {/* Sbloccare è ciò che rimette in moto la pratica: fuori dal menu,
                  a differenza delle altre azioni secondarie. */}
              {canUnblock && request.is_blocked && activeBlock && (
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setUnblockDialogOpen(true)}
                >
                  Sblocca
                </Button>
              )}
            </>
          }
          actions={
            <RequestActionsBar
              isUrgent={!!request.is_urgent}
              isBlocked={!!request.is_blocked}
              hasAttribution={!!request.attributed_to}
              canToggleUrgent={canToggleUrgent}
              canBlock={canBlock}
              canAttribute={user?.role === 'admin' || (user?.role === 'userdm329' && isDM329)}
              canHide={user?.role === 'admin'}
              canDelete={canDelete}
              togglingUrgent={togglingUrgent}
              onToggleUrgent={handleToggleUrgent}
              onBlock={() => setBlockDialogOpen(true)}
              onAttribute={() => setAttributeDialogOpen(true)}
              onHide={() => setHideDialogOpen(true)}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          }
          workflow={
            isDM329 ? (
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
            )
          }
        />

        {codiceDialogOpen && canManageCodice && customerRecord && (
          <CodicePraticaDialog
            request={request}
            customer={customerRecord}
            sedeLegale={customersApi.formatFullAddress(customerRecord)}
            hasCode={hasCodicePratica}
            onClose={() => setCodiceDialogOpen(false)}
            onSaved={() => refetch()}
          />
        )}

        <Tabs
          value={tab}
          onChange={(_, valore) => cambiaTab(valore)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab value="dettagli" label="Dettagli" sx={{ minHeight: 40 }} />
          <Tab value="storico" label="Storico" sx={{ minHeight: 40 }} />
          <Tab value="messaggi" label={`Messaggi (${messaggi?.length ?? 0})`} sx={{ minHeight: 40 }} />
          <Tab value="allegati" label={`Allegati (${allegati?.length ?? 0})`} sx={{ minHeight: 40 }} />
        </Tabs>

        <Grid container spacing={2}>
          {/* Pannello del tab attivo */}
          <Grid item xs={12} md={8} lg={9}>
            {tab === 'dettagli' && (
              <Card>
                <CardContent>
                  {clientInfo && (
                    <>
                      <CustomerInfoSection
                        info={clientInfo}
                        customer={customerRecord}
                        canEdit={canManageCodice}
                        onSaved={() => refetch()}
                      />

                      {/* Solo pratiche DM329 "base": sulle DM329-Integrazioni indirizzo impianto e
                          denominazione sala non vengono mai valorizzati e la matita aprirebbe il
                          selettore della pratica padre. */}
                      {isDM329 && !isIntegrazione && (
                        <PlantLocationSection
                          request={request}
                          customer={customerRecord}
                          indirizzoImpianto={indirizzoImpianto}
                          canEdit={canManageCodice}
                          onSaved={() => refetch()}
                        />
                      )}
                    </>
                  )}

                  {/* Richieste non DM329: campi dinamici generati dal fields_schema.
                      Sulle DM329 i tre campi fissi stanno nella colonna proprietà. */}
                  {!isDM329 && (
                    <>
                      <Divider sx={{ my: 3 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <SectionLabel>Dettagli richiesta</SectionLabel>
                        {canEditDetails && !isEditingDetails && (
                          <IconButton size="small" onClick={handleEditDetails} color="primary">
                            <EditIcon />
                          </IconButton>
                        )}
                      </Box>
                      {isEditingDetails && (
                        <RequestDetailsEditForm
                          request={request}
                          saving={updateRequest.isPending}
                          onSave={handleSaveDynamicDetails}
                          onCancel={handleCancelDetails}
                        />
                      )}
                    </>
                  )}

                  {campiExtra.length > 0 && (
                    <>
                      <Divider sx={{ my: 3 }} />
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                          gap: 2,
                        }}
                      >
                        {campiExtra.map(({ key, label, value }) => (
                          <FieldValue key={key} label={label} value={value} />
                        ))}
                      </Box>
                    </>
                  )}

                  <Divider sx={{ my: 3 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <SectionLabel>Note</SectionLabel>
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
                    <Typography variant="body2" color={noteSalvata ? 'text.primary' : 'text.disabled'} sx={{ whiteSpace: 'pre-wrap' }}>
                      {noteSalvata || 'Nessuna nota'}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {tab === 'storico' && <RequestHistoryPanel requestId={request.id} />}

            {tab === 'messaggi' && <RequestChatBox requestId={request.id} />}

            {tab === 'allegati' && (
              <AttachmentsSection
                requestId={request.id}
                requestCreatedBy={request.created_by}
                requestAssignedTo={request.assigned_to}
              />
            )}
          </Grid>

          {/* Colonna proprietà: sempre visibile, indipendente dal tab */}
          <Grid item xs={12} md={4} lg={3}>
            <RequestPropertiesRail
              request={request}
              isDM329={isDM329}
              canChangeType={(user?.role === 'admin' || user?.role === 'userdm329') && isDM329}
              requestTypes={requestTypes}
              changingType={changingType}
              onChangeType={handleChangeType}
              canEditDetails={canEditDetails}
              isEditingDetails={isEditingDetails}
              onEditDetails={handleEditDetails}
              onSaveDetails={handleSaveDetails}
              onCancelDetails={handleCancelDetails}
              saving={updateRequest.isPending}
              noCivaValue={noCivaValue}
              setNoCivaValue={setNoCivaValue}
              offCacValue={offCacValue}
              setOffCacValue={setOffCacValue}
              statoFatturaValue={statoFatturaValue}
              setStatoFatturaValue={setStatoFatturaValue}
              showIncompleteCustomer={!!customerRecord && hasIncompleteCustomerData(customerRecord)}
              onCompleteCustomer={() => setShowCompleteCustomerDialog(true)}
            />

            <AssignmentSection
              requestId={request.id}
              currentAssignedTo={request.assigned_to}
              assignedUser={request.assigned_user}
              requestTypeName={request.request_type?.name}
              onAssignmentChanged={refetch}
            />
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
