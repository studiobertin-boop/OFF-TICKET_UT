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
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest } from '@/hooks/useRequests'
import { StatusTransitionButtons } from '@/components/requests/StatusTransitionButtons'
import { AssignmentSection } from '@/components/requests/AssignmentSection'
import { RequestHistoryTimeline } from '@/components/requests/RequestHistoryTimeline'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'

export const RequestDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: request, isLoading, error, refetch } = useRequest(id!)

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

  return (
    <Layout>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')} sx={{ mb: 2 }}>
          Torna alla lista
        </Button>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
              <Typography variant="h4">{request.title}</Typography>
              <Chip label={getStatusLabel(request.status)} color={getStatusColor(request.status)} />
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Tipo Richiesta
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {request.request_type?.name || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Creata da
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {request.creator?.full_name || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Data Creazione
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {new Date(request.created_at).toLocaleString('it-IT')}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Ultimo Aggiornamento
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {new Date(request.updated_at).toLocaleString('it-IT')}
                </Typography>
              </Grid>

              {request.assigned_user && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Assegnata a
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {request.assigned_user.full_name} ({request.assigned_user.email})
                  </Typography>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Dettagli Richiesta
            </Typography>

            <Grid container spacing={2}>
              {Object.entries(request.custom_fields).map(([key, value]) => {
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

        {/* Status Transition Buttons */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cambia Stato
            </Typography>
            <StatusTransitionButtons
              requestId={request.id}
              currentStatus={request.status}
              requestTypeName={request.request_type?.name || ''}
              assignedTo={request.assigned_to}
              onStatusChanged={refetch}
            />
          </CardContent>
        </Card>

        {/* Assignment Section */}
        <AssignmentSection
          requestId={request.id}
          currentAssignedTo={request.assigned_to}
          assignedUser={request.assigned_user}
          onAssignmentChanged={refetch}
        />

        {/* History Timeline */}
        <RequestHistoryTimeline requestId={request.id} />
      </Box>
    </Layout>
  )
}
