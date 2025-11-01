import { useState, useMemo } from 'react'
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
} from '@mui/material'
import {
  Add as AddIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequests } from '@/hooks/useRequests'
import { useRequestTypes } from '@/hooks/useRequestTypes'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import { RequestsTableView } from '@/components/requests/RequestsTableView'
import { DM329TableView } from '@/components/requests/DM329TableView'

type ViewMode = 'grid' | 'table'

export const Requests = () => {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('table') // Default: vista tabellare
  const [activeTab, setActiveTab] = useState(0) // 0 = Tutte, 1 = DM329

  const { data: requestTypes = [], isLoading: loadingTypes } = useRequestTypes()
  const {
    data: requests = [],
    isLoading,
    error,
  } = useRequests({
    status: statusFilter || undefined,
    request_type_id: typeFilter || undefined,
  })

  // Trova l'ID del tipo DM329
  const dm329Type = requestTypes.find(t => t.name === 'DM329')

  // Separa le richieste DM329 dalle altre
  const { dm329Requests, otherRequests } = useMemo(() => {
    const dm329 = requests.filter(r => r.request_type_id === dm329Type?.id)
    const other = requests.filter(r => r.request_type_id !== dm329Type?.id)
    return { dm329Requests: dm329, otherRequests: other }
  }, [requests, dm329Type])

  // Richieste da visualizzare in base al tab attivo
  const displayRequests = activeTab === 0 ? otherRequests : dm329Requests

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
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
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
              onClick={() => navigate('/requests/new')}
            >
              Nuova Richiesta
            </Button>
          </Box>
        </Box>

        {/* Tabs per separare richieste generali e DM329 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label={`Richieste Generali (${otherRequests.length})`} />
            <Tab label={`Richieste DM329 (${dm329Requests.length})`} />
          </Tabs>
        </Box>

        {/* Filters - solo per visualizzazione griglia */}
        {viewMode === 'grid' && (
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

        {/* Visualizzazione Tabella */}
        {viewMode === 'table' && (
          <>
            {activeTab === 0 ? (
              <RequestsTableView requests={otherRequests} />
            ) : (
              <DM329TableView requests={dm329Requests} />
            )}
          </>
        )}

        {/* Visualizzazione Griglia */}
        {viewMode === 'grid' && (
          <>
            {displayRequests.length === 0 ? (
              <Alert severity="info">Nessuna richiesta trovata</Alert>
            ) : (
              <Grid container spacing={2}>
                {displayRequests.map(request => (
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
