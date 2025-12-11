import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
} from '@/hooks/useCustomers'
import type { Customer } from '@/types'
import { Layout } from '@/components/common/Layout'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { isCustomerComplete, createCustomerSchema, updateCustomerSchema } from '@/utils/customerValidation'
import { customersApi } from '@/services/api/customers'
import { CustomerFormFields } from '@/components/customers/CustomerFormFields'

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

  // Form per creazione nuovo cliente
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
  } = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      ragione_sociale: '',
      identificativo: '',
      telefono: '',
      pec: '',
      descrizione_attivita: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    },
  })

  // Form per modifica cliente
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEditForm,
  } = useForm({
    resolver: zodResolver(updateCustomerSchema),
  })

  // Hooks
  const { data: customersResponse, isLoading, error } = useCustomers({
    search: searchTerm,
    page,
    pageSize: rowsPerPage,
  })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

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
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  const handleCreateConfirm = async (data: any) => {
    try {
      await createCustomer.mutateAsync(data)
      setCreateDialogOpen(false)
      resetCreateForm()
    } catch (err) {
      console.error('Error creating customer:', err)
    }
  }

  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    resetEditForm({
      ragione_sociale: customer.ragione_sociale,
      identificativo: customer.identificativo || '',
      telefono: customer.telefono || '',
      pec: customer.pec || '',
      descrizione_attivita: customer.descrizione_attivita || '',
      via: customer.via || '',
      numero_civico: customer.numero_civico || '',
      cap: customer.cap || '',
      comune: customer.comune || '',
      provincia: customer.provincia || '',
    })
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async (data: any) => {
    if (!selectedCustomer) return

    try {
      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        updates: data,
      })
      setEditDialogOpen(false)
      setSelectedCustomer(null)
      resetEditForm()
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

  const handleSyncClick = () => {
    alert(
      'Per sincronizzare i clienti da Excel MAGO, esegui il seguente comando nel terminale:\n\n' +
        'npm run sync-customers:dry-run\n\n' +
        '(per vedere le modifiche senza applicarle)\n\n' +
        'oppure\n\n' +
        'npm run sync-customers\n\n' +
        '(per applicare le modifiche)'
    )
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
            >
              Sincronizza da Excel MAGO
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
                <TableCell>Identificativo</TableCell>
                <TableCell>Ragione Sociale</TableCell>
                <TableCell>Telefono</TableCell>
                <TableCell>PEC</TableCell>
                <TableCell>Indirizzo Completo</TableCell>
                <TableCell>Completezza</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell align="right">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Nessun cliente trovato
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => {
                  const completeness = isCustomerComplete(customer)
                  const fullAddress = customersApi.formatFullAddress(customer)

                  return (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        {customer.identificativo ? (
                          <Chip label={customer.identificativo} size="small" color="primary" variant="outlined" />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{customer.ragione_sociale}</Typography>
                      </TableCell>
                      <TableCell>
                        {customer.telefono ? (
                          <Typography variant="body2">{customer.telefono}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.pec ? (
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{customer.pec}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {fullAddress ? (
                          <Typography variant="body2">{fullAddress}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={completeness ? 'Completo' : 'Incompleto'}
                          color={completeness ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={customer.is_active ? 'Attivo' : 'Inattivo'}
                          color={customer.is_active ? 'success' : 'default'}
                          size="small"
                        />
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
                  )
                })
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
      <Dialog open={createDialogOpen} onClose={() => !createCustomer.isPending && setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nuovo Cliente</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Compila tutti i campi obbligatori per creare il nuovo cliente.
          </Alert>

          <Box component="form" sx={{ mt: 1 }}>
            <CustomerFormFields
              control={createControl}
              errors={createErrors}
              showAllFields={true}
              highlightMissing={false}
            />
          </Box>

          {createCustomer.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Errore durante la creazione: {createCustomer.error?.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createCustomer.isPending}>
            Annulla
          </Button>
          <Button
            onClick={handleCreateSubmit(handleCreateConfirm)}
            variant="contained"
            disabled={createCustomer.isPending}
          >
            {createCustomer.isPending ? 'Creazione...' : 'Crea Cliente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => !updateCustomer.isPending && setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modifica Cliente</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Modifica i dati del cliente <strong>{selectedCustomer?.ragione_sociale}</strong>.
          </Alert>

          <Box component="form" sx={{ mt: 1 }}>
            <CustomerFormFields
              control={editControl}
              errors={editErrors}
              showAllFields={true}
              highlightMissing={false}
            />
          </Box>

          {updateCustomer.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Errore durante l'aggiornamento: {updateCustomer.error?.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={updateCustomer.isPending}>
            Annulla
          </Button>
          <Button
            onClick={handleEditSubmit(handleEditConfirm)}
            variant="contained"
            disabled={updateCustomer.isPending}
          >
            {updateCustomer.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
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
