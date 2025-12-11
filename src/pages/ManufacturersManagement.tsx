/**
 * Manufacturers Management Page
 *
 * Pagina admin per gestione costruttori/marche apparecchiature.
 * CRUD completo con filtri, ricerca, pagination.
 * Pattern identico a CustomersManagement.tsx
 */

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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Factory as FactoryIcon,
} from '@mui/icons-material'
import {
  useManufacturers,
  useCreateManufacturer,
  useUpdateManufacturer,
  useDeleteManufacturer,
} from '@/hooks/useManufacturers'
import type { Manufacturer } from '@/types/manufacturer'
import { Layout } from '@/components/common/Layout'
import { isManufacturerComplete, createManufacturerSchema } from '@/utils/manufacturerValidation'
import { manufacturersApi } from '@/services/api/manufacturers'
import { ManufacturerFormFields } from '@/components/manufacturers/ManufacturerFormFields'

export default function ManufacturersManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [pageInputValue, setPageInputValue] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | 'italiano' | 'estero'>('all')
  const [statoFilter, setStatoFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null)
  const [manufacturerToDelete, setManufacturerToDelete] = useState<Manufacturer | null>(null)

  // Form per creazione nuovo costruttore
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
  } = useForm({
    resolver: zodResolver(createManufacturerSchema),
    defaultValues: {
      nome: '',
      is_estero: false,
      // Italian fields (default for is_estero = false)
      partita_iva: '',
      telefono: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    },
  })

  // Form per modifica costruttore (no resolver - validation handled by API)
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEditForm,
  } = useForm()

  // Hooks
  const { data: manufacturersResponse, isLoading, error } = useManufacturers({
    search: searchTerm,
    page,
    pageSize: rowsPerPage,
    is_estero: tipoFilter === 'all' ? undefined : tipoFilter === 'estero',
    is_active: statoFilter === 'all' ? undefined : statoFilter === 'active',
  })
  const createManufacturer = useCreateManufacturer()
  const updateManufacturer = useUpdateManufacturer()
  const deleteManufacturer = useDeleteManufacturer()

  // Extract data from response
  const manufacturers = manufacturersResponse?.data || []
  const totalCount = manufacturersResponse?.count || 0
  const totalPages = manufacturersResponse?.totalPages || 0

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
        setPageInputValue((page + 1).toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const pageNumber = parseInt(pageInputValue, 10)
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      setPage(pageNumber - 1)
    } else {
      setPageInputValue((page + 1).toString())
    }
  }

  const handleCreateClick = () => {
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  const handleCreateConfirm = async (data: any) => {
    try {
      await createManufacturer.mutateAsync(data)
      setCreateDialogOpen(false)
      resetCreateForm()
    } catch (err) {
      console.error('Error creating manufacturer:', err)
    }
  }

  const handleEditClick = (manufacturer: Manufacturer) => {
    setSelectedManufacturer(manufacturer)

    // Prepare form data based on is_estero
    const formData: any = {
      nome: manufacturer.nome,
      is_estero: manufacturer.is_estero,
    }

    if (manufacturer.is_estero) {
      formData.paese = manufacturer.paese || ''
    } else {
      formData.partita_iva = manufacturer.partita_iva || ''
      formData.telefono = manufacturer.telefono || ''
      formData.via = manufacturer.via || ''
      formData.numero_civico = manufacturer.numero_civico || ''
      formData.cap = manufacturer.cap || ''
      formData.comune = manufacturer.comune || ''
      formData.provincia = manufacturer.provincia || ''
    }

    resetEditForm(formData)
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async (data: any) => {
    if (!selectedManufacturer) return

    try {
      await updateManufacturer.mutateAsync({
        id: selectedManufacturer.id,
        updates: data,
      })
      setEditDialogOpen(false)
      setSelectedManufacturer(null)
      resetEditForm()
    } catch (err) {
      console.error('Error updating manufacturer:', err)
    }
  }

  const handleDeleteClick = (manufacturer: Manufacturer) => {
    setManufacturerToDelete(manufacturer)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!manufacturerToDelete) return

    try {
      await deleteManufacturer.mutateAsync(manufacturerToDelete.id)
      setDeleteDialogOpen(false)
      setManufacturerToDelete(null)
    } catch (err) {
      console.error('Error deleting manufacturer:', err)
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
          <Typography variant="h4">Gestione Costruttori</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateClick}>
            Nuovo Costruttore
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Errore nel caricamento dei costruttori
          </Alert>
        )}

        {/* Search Bar & Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Cerca per nome costruttore..."
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
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={tipoFilter}
                label="Tipo"
                onChange={(e) => {
                  setTipoFilter(e.target.value as any)
                  setPage(0)
                }}
              >
                <MenuItem value="all">Tutti</MenuItem>
                <MenuItem value="italiano">Italiano</MenuItem>
                <MenuItem value="estero">Estero</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Stato</InputLabel>
              <Select
                value={statoFilter}
                label="Stato"
                onChange={(e) => {
                  setStatoFilter(e.target.value as any)
                  setPage(0)
                }}
              >
                <MenuItem value="all">Tutti</MenuItem>
                <MenuItem value="active">Attivi</MenuItem>
                <MenuItem value="inactive">Inattivi</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Manufacturers Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>P.IVA / Paese</TableCell>
                <TableCell>Telefono</TableCell>
                <TableCell>Indirizzo / Paese</TableCell>
                <TableCell>Utilizzi</TableCell>
                <TableCell>Completezza</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell align="right">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {manufacturers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Nessun costruttore trovato
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                manufacturers.map((manufacturer) => {
                  const completeness = isManufacturerComplete(manufacturer)
                  const displayInfo = manufacturersApi.formatFullAddress(manufacturer)

                  return (
                    <TableRow key={manufacturer.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {manufacturer.nome}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={manufacturer.is_estero ? 'Estero' : 'Italiano'}
                          color={manufacturer.is_estero ? 'warning' : 'primary'}
                          size="small"
                          icon={<FactoryIcon />}
                        />
                      </TableCell>
                      <TableCell>
                        {manufacturer.is_estero ? (
                          <Typography variant="body2" color="text.secondary">
                            {manufacturer.paese || '-'}
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {manufacturer.partita_iva || '-'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {manufacturer.telefono ? (
                          <Typography variant="body2">{manufacturer.telefono}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {displayInfo ? (
                          <Typography variant="body2">{displayInfo}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={manufacturer.usage_count}
                          size="small"
                          color={manufacturer.usage_count > 0 ? 'success' : 'default'}
                          variant="outlined"
                        />
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
                          label={manufacturer.is_active ? 'Attivo' : 'Inattivo'}
                          color={manufacturer.is_active ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Modifica">
                          <IconButton
                            size="small"
                            onClick={() => handleEditClick(manufacturer)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Elimina">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(manufacturer)}
                            color="error"
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

          {/* Pagination */}
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Pagina
              </Typography>
              <TextField
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                onBlur={handlePageInputBlur}
                size="small"
                sx={{ width: 60 }}
                inputProps={{
                  style: { textAlign: 'center' },
                }}
              />
              <Typography variant="body2" color="text.secondary">
                di {totalPages} ({totalCount} totali)
              </Typography>
            </Box>
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100]}
              labelRowsPerPage="Righe per pagina:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} di ${count}`}
            />
          </Box>
        </TableContainer>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Nuovo Costruttore</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ mt: 2 }}>
              <ManufacturerFormFields
                control={createControl}
                errors={createErrors}
                showAllFields={true}
              />
            </Box>
            {createManufacturer.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {createManufacturer.error?.message || 'Errore nella creazione del costruttore'}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={createManufacturer.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateSubmit(handleCreateConfirm)}
              variant="contained"
              disabled={createManufacturer.isPending}
              startIcon={createManufacturer.isPending ? <CircularProgress size={16} /> : null}
            >
              {createManufacturer.isPending ? 'Creazione...' : 'Crea'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Modifica Costruttore</DialogTitle>
          <DialogContent>
            {selectedManufacturer && (
              <Box component="form" sx={{ mt: 2 }}>
                <ManufacturerFormFields
                  control={editControl}
                  errors={editErrors}
                  showAllFields={true}
                />
              </Box>
            )}
            {updateManufacturer.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {updateManufacturer.error?.message || 'Errore nell\'aggiornamento del costruttore'}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} disabled={updateManufacturer.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleEditSubmit(handleEditConfirm)}
              variant="contained"
              disabled={updateManufacturer.isPending}
              startIcon={updateManufacturer.isPending ? <CircularProgress size={16} /> : null}
            >
              {updateManufacturer.isPending ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Conferma Eliminazione</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Sei sicuro di voler eliminare il costruttore "<strong>{manufacturerToDelete?.nome}</strong>"?
              Questa azione lo contrassegnerà come inattivo.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteManufacturer.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleteManufacturer.isPending}
              startIcon={deleteManufacturer.isPending ? <CircularProgress size={16} /> : null}
            >
              {deleteManufacturer.isPending ? 'Eliminazione...' : 'Elimina'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  )
}
