import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  VisibilityOff as InactiveIcon,
  Visibility as ActiveIcon,
} from '@mui/icons-material'
import { Layout } from '../../components/common/Layout'
import RequestTypeDialog from '../../components/admin/RequestTypeDialog'
import {
  useRequestTypes,
  useCreateRequestType,
  useUpdateRequestType,
} from '../../hooks/useRequestTypes'
import { RequestType } from '../../types'

export default function AdminRequestTypes() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRequestType, setSelectedRequestType] = useState<RequestType | null>(null)

  const { data: requestTypes, isLoading, error } = useRequestTypes()
  const createMutation = useCreateRequestType()
  const updateMutation = useUpdateRequestType()

  const handleOpenDialog = (requestType?: RequestType) => {
    setSelectedRequestType(requestType || null)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedRequestType(null)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (selectedRequestType) {
        await updateMutation.mutateAsync({
          id: selectedRequestType.id,
          updates: data,
        })
      } else {
        await createMutation.mutateAsync(data)
      }
      handleCloseDialog()
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      throw error
    }
  }

  const handleToggleActive = async (requestType: RequestType) => {
    try {
      await updateMutation.mutateAsync({
        id: requestType.id,
        updates: { is_active: !requestType.is_active },
      })
    } catch (error) {
      console.error('Errore nel cambio stato:', error)
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

  if (error) {
    return (
      <Layout>
        <Alert severity="error">
          Errore nel caricamento dei tipi di richiesta: {error.message}
        </Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Gestione Tipi di Richiesta</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Nuovo Tipo Richiesta
          </Button>
        </Box>

        {requestTypes && requestTypes.length === 0 ? (
          <Alert severity="info">
            Nessun tipo di richiesta configurato. Creane uno per iniziare.
          </Alert>
        ) : (
          <TableContainer component={Card}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Numero Campi</TableCell>
                  <TableCell>Campi Visibili</TableCell>
                  <TableCell>Stato</TableCell>
                  <TableCell align="right">Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requestTypes?.map((requestType) => {
                  const totalFields = requestType.fields_schema.length
                  const visibleFields = requestType.fields_schema.filter((f) => !f.hidden).length
                  const hiddenFields = totalFields - visibleFields

                  return (
                    <TableRow
                      key={requestType.id}
                      sx={{
                        '&:hover': { backgroundColor: 'action.hover' },
                        opacity: requestType.is_active ? 1 : 0.6,
                      }}
                    >
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {requestType.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {totalFields} {totalFields === 1 ? 'campo' : 'campi'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="body2">{visibleFields}</Typography>
                          {hiddenFields > 0 && (
                            <Chip
                              label={`${hiddenFields} nascosti`}
                              size="small"
                              variant="outlined"
                              color="default"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={requestType.is_active ? 'Attivo' : 'Disattivo'}
                          color={requestType.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Modifica">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(requestType)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={requestType.is_active ? 'Disattiva' : 'Attiva'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleActive(requestType)}
                            color={requestType.is_active ? 'warning' : 'success'}
                          >
                            {requestType.is_active ? <InactiveIcon /> : <ActiveIcon />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <RequestTypeDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          onSubmit={handleSubmit}
          requestType={selectedRequestType}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Box>
    </Layout>
  )
}
