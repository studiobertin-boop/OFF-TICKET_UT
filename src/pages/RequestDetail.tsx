import { useState } from 'react'
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
import {
  ArrowBack as ArrowBackIcon,
  VisibilityOff as VisibilityOffIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest, useHideRequest, useDeleteRequest } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { StatusTransitionButtons } from '@/components/requests/StatusTransitionButtons'
import { AssignmentSection } from '@/components/requests/AssignmentSection'
import { RequestHistoryPanel } from '@/components/requests/RequestHistoryPanel'
import { BlockIndicator } from '@/components/requests/BlockIndicator'
import { BlockRequestDialog } from '@/components/requests/BlockRequestDialog'
import { UnblockRequestDialog } from '@/components/requests/UnblockRequestDialog'
import { ConfirmHideDialog } from '@/components/requests/ConfirmHideDialog'
import { ConfirmDeleteDialog } from '@/components/requests/ConfirmDeleteDialog'
import { AttachmentsSection } from '@/components/requests/AttachmentsSection'
import { useActiveBlock } from '@/hooks/useRequestBlocks'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'

export const RequestDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: request, isLoading, error, refetch } = useRequest(id!)
  const { data: activeBlock } = useActiveBlock(id)
  const hideRequest = useHideRequest()
  const deleteRequest = useDeleteRequest()

  const [hideDialogOpen, setHideDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)

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
    (user?.role === 'userdm329' && request.request_type?.name === 'DM329')

  // Determine if user can unblock
  // Admin: always
  // Tecnico: only on general requests (not DM329)
  // Userdm329: only on DM329 requests
  // Utente: only on general requests (not DM329)
  const isDM329 = request.request_type?.name === 'DM329'
  const canUnblock =
    user?.role === 'admin' ||
    (user?.role === 'tecnico' && !isDM329) ||
    (user?.role === 'userdm329' && isDM329) ||
    (user?.role === 'utente' && !isDM329)

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')}>
            Torna alla lista
          </Button>

          <Box sx={{ display: 'flex', gap: 1 }}>
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
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  size="small"
                >
                  Elimina
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Two column layout: details on left, history on right */}
        <Grid container spacing={3}>
          {/* Left column: Request details */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {request.is_blocked && (
                      <BlockIndicator isBlocked={true} reason={activeBlock?.reason} />
                    )}
                    <Typography variant="h4">{request.title}</Typography>
                  </Box>
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
              isBlocked={request.is_blocked}
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

            {/* Attachments Section */}
            <AttachmentsSection requestId={request.id} />
          </Grid>

          {/* Right column: History panel */}
          <Grid item xs={12} lg={4}>
            <Box sx={{ position: 'sticky', top: 16 }}>
              <RequestHistoryPanel requestId={request.id} />
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
    </Layout>
  )
}
