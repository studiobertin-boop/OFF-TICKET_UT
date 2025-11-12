import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  TextField,
  Checkbox,
  ListItemText,
  OutlinedInput,
  IconButton,
} from '@mui/material'
import {
  Add as AddIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
  Clear as ClearIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequests } from '@/hooks/useRequests'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { useAuth } from '@/hooks/useAuth'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import type { DM329Status } from '@/types'
import { RequestsTableView } from '@/components/requests/RequestsTableView'
import { DM329TableView } from '@/components/requests/DM329TableView'
import { HiddenRequestsView } from '@/components/requests/HiddenRequestsView'
import { BulkActionsBar } from '@/components/requests/BulkActionsBar'
import { BulkDeleteConfirmDialog } from '@/components/requests/BulkDeleteConfirmDialog'
import { deletionArchivesApi } from '@/services/api/deletionArchives'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

type ViewMode = 'grid' | 'table'

const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
]

const getDM329StatusLabel = (status: DM329Status): string => {
  const labels: Record<DM329Status, string> = {
    '1-INCARICO_RICEVUTO': '1 - Incarico Ricevuto',
    '2-SCHEDA_DATI_PRONTA': '2 - Scheda Dati Pronta',
    '3-MAIL_CLIENTE_INVIATA': '3 - Mail Cliente Inviata',
    '4-DOCUMENTI_PRONTI': '4 - Documenti Pronti',
    '5-ATTESA_FIRMA': '5 - Attesa Firma',
    '6-PRONTA_PER_CIVA': '6 - Pronta per CIVA',
    '7-CHIUSA': '7 - Chiusa',
    'ARCHIVIATA NON FINITA': 'Archiviata Non Finita',
  }
  return labels[status] || status
}

export const Requests = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('table') // Default: vista tabellare
  // Se è userdm329, parte dal tab DM329 (tab 1), altrimenti dal tab Generali (tab 0)
  // Tab: 0 = Generali, 1 = DM329, 2 = Nascoste Generali (admin), 3 = Nascoste DM329 (admin)
  const [activeTab, setActiveTab] = useState(user?.role === 'userdm329' ? 1 : 0)

  // DM329 specific filters for cards view
  const [dm329ClienteFilter, setDm329ClienteFilter] = useState<string[]>([])
  const [dm329StatoFilter, setDm329StatoFilter] = useState<string[]>([])
  const [dm329NoCivaFilter, setDm329NoCivaFilter] = useState<'all' | 'true' | 'false'>('all')
  const [dm329NoteFilter, setDm329NoteFilter] = useState('')

  // Selection state
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const { data: requestTypes = [], isLoading: loadingTypes } = useRequestTypes()

  // Fetch visible requests
  const {
    data: visibleRequests = [],
    isLoading,
    error,
  } = useRequests({
    status: statusFilter || undefined,
    request_type_id: typeFilter || undefined,
    is_hidden: false,
    // Tecnici vedono solo le richieste assegnate a loro
    assigned_to: user?.role === 'tecnico' ? user.id : undefined,
  })

  // Fetch hidden requests (only for admin)
  const hiddenRequestsQuery = useRequests(
    user?.role === 'admin'
      ? {
          is_hidden: true,
        }
      : { is_hidden: true } // Mantieni il filtro anche se non admin, la RLS gestirà i permessi
  )

  const hiddenRequests = hiddenRequestsQuery.data || []

  // Trova l'ID del tipo DM329
  const dm329Type = requestTypes.find(t => t.name === 'DM329')

  // Handler per il pulsante Nuova Richiesta
  const handleNewRequest = () => {
    // Se è userdm329, va direttamente al form DM329
    if (user?.role === 'userdm329' && dm329Type) {
      navigate(`/requests/new?type=${dm329Type.id}`)
    } else {
      navigate('/requests/new')
    }
  }

  // Separa le richieste visibili DM329 dalle altre
  const { dm329Requests, otherRequests } = useMemo(() => {
    const dm329 = visibleRequests.filter(r => r.request_type_id === dm329Type?.id)
    const other = visibleRequests.filter(r => r.request_type_id !== dm329Type?.id)
    return { dm329Requests: dm329, otherRequests: other }
  }, [visibleRequests, dm329Type])

  // Separa le richieste nascoste DM329 dalle altre
  const { hiddenDM329Requests, hiddenOtherRequests } = useMemo(() => {
    const dm329 = hiddenRequests.filter(r => r.request_type_id === dm329Type?.id)
    const other = hiddenRequests.filter(r => r.request_type_id !== dm329Type?.id)
    return { hiddenDM329Requests: dm329, hiddenOtherRequests: other }
  }, [hiddenRequests, dm329Type])

  // Solo userdm329 non può vedere il tab generale
  const canViewGeneralTab = user?.role !== 'userdm329'
  // Solo admin e userdm329 possono vedere il tab DM329
  const canViewDM329Tab = user?.role === 'admin' || user?.role === 'userdm329'

  // Forza la vista tabella quando si accede ai tab delle richieste nascoste
  useEffect(() => {
    if (activeTab >= 2 && viewMode !== 'table') {
      setViewMode('table')
    }
  }, [activeTab, viewMode])

  // Richieste da visualizzare in base al tab attivo
  // Se è userdm329, mostra sempre DM329, altrimenti usa activeTab
  const displayRequests = useMemo(() => {
    if (!canViewGeneralTab) return dm329Requests

    // Gestione indici tab in base ai ruoli:
    // user/tecnico: tab 0 = Generali, tab 1 = Nascoste Generali (solo admin)
    // admin: tab 0 = Generali, tab 1 = DM329, tab 2 = Nascoste Generali, tab 3 = Nascoste DM329
    if (!canViewDM329Tab) {
      // user/tecnico vedono solo tab Generali
      switch (activeTab) {
        case 0: return otherRequests
        case 1: return hiddenOtherRequests // Non dovrebbe mai arrivare qui
        default: return otherRequests
      }
    }

    // admin vede tutti i tab
    switch (activeTab) {
      case 0: return otherRequests
      case 1: return dm329Requests
      case 2: return hiddenOtherRequests
      case 3: return hiddenDM329Requests
      default: return otherRequests
    }
  }, [canViewGeneralTab, canViewDM329Tab, activeTab, otherRequests, dm329Requests, hiddenOtherRequests, hiddenDM329Requests])

  // Filtraggio per vista cards DM329
  const filteredDM329Requests = useMemo(() => {
    if (activeTab !== 1 || viewMode !== 'grid') return displayRequests

    let filtered = [...displayRequests]

    // Applica filtri DM329
    if (dm329ClienteFilter.length > 0) {
      filtered = filtered.filter(req => {
        const cliente = req.custom_fields?.cliente
        const clienteStr = typeof cliente === 'string'
          ? cliente
          : (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente)
            ? cliente.ragione_sociale
            : ''
        return dm329ClienteFilter.includes(clienteStr)
      })
    }
    if (dm329StatoFilter.length > 0) {
      filtered = filtered.filter(req =>
        dm329StatoFilter.includes(req.status as DM329Status)
      )
    }
    if (dm329NoCivaFilter !== 'all') {
      filtered = filtered.filter(req => {
        const noCiva = req.custom_fields?.no_civa as boolean
        return dm329NoCivaFilter === 'true' ? noCiva === true : noCiva !== true
      })
    }
    if (dm329NoteFilter) {
      filtered = filtered.filter(req => {
        const note = req.custom_fields?.note as string
        return note?.toLowerCase().includes(dm329NoteFilter.toLowerCase())
      })
    }

    return filtered
  }, [displayRequests, activeTab, viewMode, dm329ClienteFilter, dm329StatoFilter, dm329NoCivaFilter, dm329NoteFilter])

  // Estrai valori unici clienti per filtro DM329
  const uniqueDM329Clients = useMemo(() => {
    const clients = dm329Requests
      .map(r => {
        const cliente = r.custom_fields?.cliente
        if (typeof cliente === 'string') return cliente
        if (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente) {
          return cliente.ragione_sociale
        }
        return null
      })
      .filter(Boolean) as string[]
    return Array.from(new Set(clients)).sort()
  }, [dm329Requests])

  const clearDM329Filters = () => {
    setDm329ClienteFilter([])
    setDm329StatoFilter([])
    setDm329NoCivaFilter('all')
    setDm329NoteFilter('')
  }

  const hasDM329ActiveFilters = dm329ClienteFilter.length > 0 || dm329StatoFilter.length > 0 || dm329NoCivaFilter !== 'all' || dm329NoteFilter

  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedRequests(new Set())
  }, [activeTab])

  // Selection handlers
  const handleSelectRequest = (id: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      // Select all COMPLETATA or 7-CHIUSA requests in current view
      const completedRequests = displayRequests
        .filter(r => r.status === 'COMPLETATA' || r.status === '7-CHIUSA')
        .map(r => r.id)
      setSelectedRequests(new Set(completedRequests))
    } else {
      setSelectedRequests(new Set())
    }
  }

  const handleClearSelection = () => {
    setSelectedRequests(new Set())
  }

  // Bulk delete handlers
  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true)
  }

  const handleConfirmBulkDelete = async () => {
    try {
      setIsBulkDeleting(true)
      const requestIds = Array.from(selectedRequests)

      // Call API to delete with archive generation
      await deletionArchivesApi.bulkDeleteWithArchive(requestIds)

      // Refetch requests
      await queryClient.invalidateQueries({ queryKey: ['requests'] })

      toast.success(`${requestIds.length} richieste eliminate con successo. PDF archivio generato.`)
      setSelectedRequests(new Set())
      setBulkDeleteDialogOpen(false)
    } catch (error: any) {
      console.error('Errore eliminazione massiva:', error)
      toast.error(error.message || 'Errore durante l\'eliminazione massiva')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Get selected requests objects for dialog
  const selectedRequestsObjects = useMemo(() => {
    return displayRequests.filter(r => selectedRequests.has(r.id))
  }, [displayRequests, selectedRequests])

  // Check if selected requests contain completed/closed ones (for showing bulk delete button)
  const hasCompletedRequests = useMemo(() => {
    return selectedRequestsObjects.some(r => r.status === 'COMPLETATA' || r.status === '7-CHIUSA')
  }, [selectedRequestsObjects])

  // Only admin can use bulk delete
  const canBulkDelete = user?.role === 'admin'

  // Enable selection only for admin in table view on visible requests tabs (not hidden)
  const selectionEnabled = canBulkDelete && viewMode === 'table' && activeTab < 2

  if (isLoading || loadingTypes) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error">Errore nel caricamento delle richieste</Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Richieste</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {/* Disabilita il toggle vista quando si visualizzano richieste nascoste */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
              disabled={activeTab >= 2}
            >
              <ToggleButton value="grid">
                <GridViewIcon />
              </ToggleButton>
              <ToggleButton value="table">
                <TableViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewRequest}
            >
              Nuova Richiesta
            </Button>
          </Box>
        </Box>

        {/* Tabs per separare richieste generali e DM329 */}
        {canViewGeneralTab ? (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
            >
              <Tab label={`Richieste Generali (${otherRequests.length})`} />
              {canViewDM329Tab && <Tab label={`Richieste DM329 (${dm329Requests.length})`} />}
              {user?.role === 'admin' && <Tab label={`Nascoste Generali (${hiddenOtherRequests.length})`} />}
              {user?.role === 'admin' && <Tab label={`Nascoste DM329 (${hiddenDM329Requests.length})`} />}
            </Tabs>
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6">Richieste DM329 ({dm329Requests.length})</Typography>
          </Box>
        )}

        {/* Filters - solo per visualizzazione griglia e solo per richieste generali (non DM329) */}
        {viewMode === 'grid' && activeTab === 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Filtra per Stato</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  label="Filtra per Stato"
                >
                  <MenuItem value="">Tutti</MenuItem>
                  <MenuItem value="APERTA">Aperta</MenuItem>
                  <MenuItem value="ASSEGNATA">Assegnata</MenuItem>
                  <MenuItem value="IN_LAVORAZIONE">In Lavorazione</MenuItem>
                  <MenuItem value="COMPLETATA">Completata</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Filtra per Tipo</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  label="Filtra per Tipo"
                >
                  <MenuItem value="">Tutti</MenuItem>
                  {requestTypes.map(type => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}

        {/* DM329 Filters - solo per visualizzazione griglia e solo per richieste DM329 */}
        {viewMode === 'grid' && (activeTab === 1 || !canViewGeneralTab) && (
          <>
            {/* Active filters chips */}
            {hasDM329ActiveFilters && (
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {dm329ClienteFilter.length > 0 && (
                    <Chip label={`Clienti: ${dm329ClienteFilter.length}`} size="small" onDelete={() => setDm329ClienteFilter([])} />
                  )}
                  {dm329StatoFilter.length > 0 && (
                    <Chip label={`Stati: ${dm329StatoFilter.length}`} size="small" onDelete={() => setDm329StatoFilter([])} />
                  )}
                  {dm329NoCivaFilter !== 'all' && (
                    <Chip label={`No CIVA: ${dm329NoCivaFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setDm329NoCivaFilter('all')} />
                  )}
                  {dm329NoteFilter && (
                    <Chip label={`Note: "${dm329NoteFilter}"`} size="small" onDelete={() => setDm329NoteFilter('')} />
                  )}
                </Box>
                <IconButton size="small" onClick={clearDM329Filters} color="primary" title="Cancella tutti i filtri">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Box>
            )}

            <Grid container spacing={2} sx={{ mb: 3 }}>
              {/* Cliente Filter */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Cliente</InputLabel>
                  <Select
                    multiple
                    value={dm329ClienteFilter}
                    onChange={(e) => setDm329ClienteFilter(e.target.value as string[])}
                    input={<OutlinedInput label="Cliente" />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <em>Tutti</em>
                      return `${selected.length} selezionati`
                    }}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {uniqueDM329Clients.map((cliente) => (
                      <MenuItem key={cliente} value={cliente}>
                        <Checkbox checked={dm329ClienteFilter.indexOf(cliente) > -1} />
                        <ListItemText primary={cliente} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Stato Filter */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stato</InputLabel>
                  <Select
                    multiple
                    value={dm329StatoFilter}
                    onChange={(e) => setDm329StatoFilter(e.target.value as string[])}
                    input={<OutlinedInput label="Stato" />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <em>Tutti</em>
                      return `${selected.length} selezionati`
                    }}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {DM329_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>
                        <Checkbox checked={dm329StatoFilter.indexOf(status) > -1} />
                        <ListItemText primary={getDM329StatusLabel(status)} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* No CIVA Filter */}
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>No CIVA</InputLabel>
                  <Select
                    value={dm329NoCivaFilter}
                    onChange={(e) => setDm329NoCivaFilter(e.target.value as 'all' | 'true' | 'false')}
                    label="No CIVA"
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="true">Sì</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Note Filter */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cerca nelle note"
                  value={dm329NoteFilter}
                  onChange={(e) => setDm329NoteFilter(e.target.value)}
                  placeholder="Filtra per note..."
                />
              </Grid>
            </Grid>
          </>
        )}

        {/* Bulk Actions Bar */}
        {selectionEnabled && (
          <BulkActionsBar
            selectedCount={selectedRequests.size}
            onBulkDelete={handleBulkDelete}
            onClearSelection={handleClearSelection}
            hasCompletedRequests={hasCompletedRequests}
          />
        )}

        {/* Visualizzazione Tabella */}
        {viewMode === 'table' && (
          <>
            {canViewGeneralTab ? (
              <>
                {activeTab === 0 && (
                  <RequestsTableView
                    requests={otherRequests}
                    selectedRequests={selectedRequests}
                    onSelectRequest={handleSelectRequest}
                    onSelectAll={handleSelectAll}
                    selectionEnabled={selectionEnabled}
                  />
                )}
                {activeTab === 1 && canViewDM329Tab && (
                  <DM329TableView
                    requests={dm329Requests}
                    selectedRequests={selectedRequests}
                    onSelectRequest={handleSelectRequest}
                    onSelectAll={handleSelectAll}
                    selectionEnabled={selectionEnabled}
                  />
                )}
                {activeTab === 2 && user?.role === 'admin' && (
                  <HiddenRequestsView requests={hiddenOtherRequests} requestType="general" />
                )}
                {activeTab === 3 && user?.role === 'admin' && (
                  <HiddenRequestsView requests={hiddenDM329Requests} requestType="dm329" />
                )}
              </>
            ) : (
              <DM329TableView
                requests={dm329Requests}
                selectedRequests={selectedRequests}
                onSelectRequest={handleSelectRequest}
                onSelectAll={handleSelectAll}
                selectionEnabled={selectionEnabled}
              />
            )}
          </>
        )}

        {/* Bulk Delete Confirm Dialog */}
        <BulkDeleteConfirmDialog
          open={bulkDeleteDialogOpen}
          requests={selectedRequestsObjects}
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setBulkDeleteDialogOpen(false)}
          isLoading={isBulkDeleting}
        />

        {/* Visualizzazione Griglia */}
        {viewMode === 'grid' && (
          <>
            {((activeTab === 1 || !canViewGeneralTab) ? filteredDM329Requests : displayRequests).length === 0 ? (
              <Alert severity="info">Nessuna richiesta trovata</Alert>
            ) : (
              <Grid container spacing={2}>
                {((activeTab === 1 || !canViewGeneralTab) ? filteredDM329Requests : displayRequests).map(request => (
                  <Grid item xs={12} key={request.id}>
                    <Card
                      sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                      onClick={() => navigate(`/requests/${request.id}`)}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" gutterBottom>
                              {request.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Tipo: {request.request_type?.name || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Creata da: {request.creator?.full_name || 'N/A'} il{' '}
                              {new Date(request.created_at).toLocaleDateString('it-IT')}
                            </Typography>
                            {request.assigned_user && (
                              <Typography variant="body2" color="text.secondary">
                                Assegnata a: {request.assigned_user.full_name}
                              </Typography>
                            )}
                          </Box>
                          <Box>
                            <Chip label={getStatusLabel(request.status)} color={getStatusColor(request.status)} />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Box>
    </Layout>
  )
}
