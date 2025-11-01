import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  TablePagination,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Sync as SyncIcon,
} from '@mui/icons-material'
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useSyncCustomers,
} from '@/hooks/useCustomers'
import type { Customer } from '@/types'
import { Layout } from '@/components/common/Layout'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export default function CustomersManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [pageInputValue, setPageInputValue] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [editCustomerName, setEditCustomerName] = useState('')

  // Hooks
  const { data: customersResponse, isLoading, error } = useCustomers({
    search: searchTerm,
    page,
    pageSize: rowsPerPage,
  })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()
  const syncCustomers = useSyncCustomers()

  // Extract data from response
  const customers = customersResponse?.data || []
  const totalCount = customersResponse?.count || 0
  const totalPages = customersResponse?.totalPages || 0

  // Update page input when page changes
  useEffect(() => {
    setPageInputValue((page + 1).toString())
  }, [page])

  // Handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
    setPage(0) // Reset to first page on search
  }

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(event.target.value)
  }

  const handlePageInputKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const pageNumber = parseInt(pageInputValue, 10)
      if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
        setPage(pageNumber - 1) // Convert to 0-based index
      } else {
        // Reset to current page if invalid
        setPageInputValue((page + 1).toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const pageNumber = parseInt(pageInputValue, 10)
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      setPage(pageNumber - 1)
    } else {
      // Reset to current page if invalid
      setPageInputValue((page + 1).toString())
    }
  }

  const handleCreateClick = () => {
    setNewCustomerName('')
    setCreateDialogOpen(true)
  }

  const handleCreateConfirm = async () => {
    if (!newCustomerName.trim()) return

    try {
      await createCustomer.mutateAsync({ ragione_sociale: newCustomerName })
      setCreateDialogOpen(false)
      setNewCustomerName('')
    } catch (err) {
      console.error('Error creating customer:', err)
    }
  }

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setEditCustomerName(customer.ragione_sociale)
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async () => {
    if (!selectedCustomer || !editCustomerName.trim()) return

    try {
      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        updates: { ragione_sociale: editCustomerName },
      })
      setEditDialogOpen(false)
      setSelectedCustomer(null)
      setEditCustomerName('')
    } catch (err) {
      console.error('Error updating customer:', err)
    }
  }

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return

    try {
      await deleteCustomer.mutateAsync(customerToDelete.id)
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    } catch (err) {
      console.error('Error deleting customer:', err)
    }
  }

  const handleSyncClick = async () => {
    try {
      const result = await syncCustomers.mutateAsync()
      alert(`Sincronizzazione completata! ${result.inserted} clienti sincronizzati.`)
    } catch (err: any) {
      console.error('Error syncing customers:', err)
      alert(`Errore nella sincronizzazione: ${err.message}`)
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

  return (
    <Layout>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Gestione Clienti</Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={handleSyncClick}
              disabled={syncCustomers.isPending}
            >
              {syncCustomers.isPending ? 'Sincronizzazione...' : 'Sincronizza da Progetto Esterno'}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateClick}>
              Nuovo Cliente
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Errore nel caricamento dei clienti
          </Alert>
        )}

        {/* Search Bar */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Cerca per ragione sociale..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* Customers Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ragione Sociale</TableCell>
                <TableCell>ID Esterno</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell>Data Creazione</TableCell>
                <TableCell align="right">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Nessun cliente trovato
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>
                      <Typography variant="body1">{customer.ragione_sociale}</Typography>
                    </TableCell>
                    <TableCell>
                      {customer.external_id ? (
                        <Chip label={customer.external_id} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.is_active ? 'Attivo' : 'Inattivo'}
                        color={customer.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {format(new Date(customer.created_at), 'dd MMM yyyy', { locale: it })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifica">
                        <IconButton size="small" onClick={() => handleEditClick(customer)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(customer)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[25, 50, 100, 200]}
            labelRowsPerPage="Righe per pagina:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} di ${count !== -1 ? count : `più di ${to}`}`
            }
          />
        </TableContainer>

        {/* Total Count and Page Jump */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Vai alla pagina:
            </Typography>
            <TextField
              size="small"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyPress={handlePageInputKeyPress}
              onBlur={handlePageInputBlur}
              type="number"
              inputProps={{
                min: 1,
                max: totalPages,
                style: { textAlign: 'center' },
              }}
              sx={{ width: '80px' }}
              placeholder={`1-${totalPages}`}
            />
            <Typography variant="body2" color="text.secondary">
              di {totalPages}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Totale: {totalCount} clienti
            {searchTerm && ' (filtrati)'}
          </Typography>
        </Box>
      </Box>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuovo Cliente</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Ragione Sociale"
            fullWidth
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateConfirm()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Annulla</Button>
          <Button
            onClick={handleCreateConfirm}
            variant="contained"
            disabled={!newCustomerName.trim() || createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Creazione...' : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifica Cliente</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Ragione Sociale"
            fullWidth
            value={editCustomerName}
            onChange={(e) => setEditCustomerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleEditConfirm()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Annulla</Button>
          <Button
            onClick={handleEditConfirm}
            variant="contained"
            disabled={!editCustomerName.trim() || updateCustomer.isPending}
          >
            {updateCustomer.isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare il cliente "{customerToDelete?.ragione_sociale}"?
            <br />
            <br />
            <strong>Attenzione:</strong> Questa operazione non eliminerà fisicamente il cliente dal database,
            ma lo renderà inattivo. Le richieste esistenti che riferiscono questo cliente non saranno
            modificate.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annulla</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteCustomer.isPending}
          >
            {deleteCustomer.isPending ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  )
}
