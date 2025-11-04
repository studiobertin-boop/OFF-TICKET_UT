import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Checkbox,
  Typography,
  Alert,
} from '@mui/material'
import { Request } from '@/types'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { BulkActionsBar } from './BulkActionsBar'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { useAuth } from '@/hooks/useAuth'
import { useBulkUnhideRequests, useBulkDeleteRequests } from '@/hooks/useRequests'

interface HiddenRequestsViewProps {
  requests: Request[]
  requestType: 'general' | 'dm329'
}

export const HiddenRequestsView = ({ requests, requestType }: HiddenRequestsViewProps) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const bulkUnhide = useBulkUnhideRequests()
  const bulkDelete = useBulkDeleteRequests()

  // Only admin can see this view
  if (user?.role !== 'admin') {
    return (
      <Alert severity="error">
        Solo gli amministratori possono visualizzare le richieste nascoste.
      </Alert>
    )
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(requests.map(r => r.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    )
  }

  const handleUnhide = async () => {
    try {
      await bulkUnhide.mutateAsync(selectedIds)
      setSelectedIds([])
    } catch (error) {
      console.error('Error unhiding requests:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selectedIds)
      setSelectedIds([])
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Error deleting requests:', error)
    }
  }

  const isSelected = (id: string) => selectedIds.includes(id)
  const allSelected = requests.length > 0 && selectedIds.length === requests.length

  return (
    <Box>
      <BulkActionsBar
        selectedCount={selectedIds.length}
        onUnhide={handleUnhide}
        onDelete={() => setDeleteDialogOpen(true)}
        onClearSelection={() => setSelectedIds([])}
        isHiddenView
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.length > 0 && selectedIds.length < requests.length}
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Data Ultimo Cambio</TableCell>
              <TableCell>Tipo</TableCell>
              {requestType === 'dm329' && <TableCell>Cliente</TableCell>}
              <TableCell>Stato</TableCell>
              <TableCell>Creata da</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request) => (
              <TableRow
                key={request.id}
                hover
                selected={isSelected(request.id)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected(request.id)}
                    onChange={() => handleSelectOne(request.id)}
                  />
                </TableCell>
                <TableCell onClick={() => navigate(`/requests/${request.id}`)}>
                  {format(new Date(request.updated_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                </TableCell>
                <TableCell onClick={() => navigate(`/requests/${request.id}`)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {request.request_type?.name || 'N/A'}
                    <Chip label="NASCOSTA" size="small" color="warning" />
                  </Box>
                </TableCell>
                {requestType === 'dm329' && (
                  <TableCell onClick={() => navigate(`/requests/${request.id}`)}>
                    {request.customer?.ragione_sociale || '-'}
                  </TableCell>
                )}
                <TableCell onClick={() => navigate(`/requests/${request.id}`)}>
                  <Chip
                    label={getStatusLabel(request.status)}
                    color={getStatusColor(request.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell onClick={() => navigate(`/requests/${request.id}`)}>
                  {request.creator?.full_name || 'N/A'}
                </TableCell>
              </TableRow>
            ))}

            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={requestType === 'dm329' ? 6 : 5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nessuna richiesta nascosta
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        count={selectedIds.length}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        isLoading={bulkDelete.isPending}
      />
    </Box>
  )
}
