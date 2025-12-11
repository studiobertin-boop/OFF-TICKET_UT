/**
 * Installers Management Page
 *
 * Pagina admin per gestione installatori.
 * CRUD completo con filtri, ricerca, pagination.
 * Pattern identico a ManufacturersManagement.tsx
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
  Build as BuildIcon,
} from '@mui/icons-material'
import {
  useInstallers,
  useCreateInstaller,
  useUpdateInstaller,
  useDeleteInstaller,
} from '@/hooks/useInstallers'
import type { Installer } from '@/types/installer'
import { Layout } from '@/components/common/Layout'
import { createInstallerSchema } from '@/utils/installerValidation'
import { InstallerFormFields } from '@/components/installers/InstallerFormFields'

export default function InstallersManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [pageInputValue, setPageInputValue] = useState('')
  const [statoFilter, setStatoFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedInstaller, setSelectedInstaller] = useState<Installer | null>(null)
  const [installerToDelete, setInstallerToDelete] = useState<Installer | null>(null)

  // Form per creazione nuovo installatore
  const {
    control: createControl,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
  } = useForm({
    resolver: zodResolver(createInstallerSchema),
    defaultValues: {
      nome: '',
      partita_iva: '',
      via: '',
      numero_civico: '',
      cap: '',
      comune: '',
      provincia: '',
    },
  })

  // Form per modifica installatore (no resolver - validation handled by API)
  const {
    control: editControl,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEditForm,
  } = useForm()

  // Hooks
  const { data: installersResponse, isLoading, error } = useInstallers({
    search: searchTerm,
    page,
    pageSize: rowsPerPage,
    is_active: statoFilter === 'all' ? undefined : statoFilter === 'active',
  })
  const createInstaller = useCreateInstaller()
  const updateInstaller = useUpdateInstaller()
  const deleteInstaller = useDeleteInstaller()

  // Extract data from response
  const installers = installersResponse?.data || []
  const totalCount = installersResponse?.count || 0
  const totalPages = installersResponse?.totalPages || 0

  // Update page input when page changes
  useEffect(() => {
    setPageInputValue(String(page + 1))
  }, [page])

  // Debounced search
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
    setPage(0) // Reset to first page on search
  }

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(event.target.value)
  }

  const handlePageInputKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const pageNum = parseInt(pageInputValue, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        setPage(pageNum - 1)
      } else {
        setPageInputValue(String(page + 1))
      }
    }
  }

  // Handlers
  const handleCreateClick = () => {
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  const handleCreateConfirm = async (data: any) => {
    try {
      await createInstaller.mutateAsync(data)
      setCreateDialogOpen(false)
      resetCreateForm()
    } catch (err) {
      console.error('Error creating installer:', err)
    }
  }

  const handleEditClick = (installer: Installer) => {
    setSelectedInstaller(installer)

    // Populate form with installer data
    const formData: any = {
      nome: installer.nome,
      partita_iva: installer.partita_iva || '',
      via: installer.via || '',
      numero_civico: installer.numero_civico || '',
      cap: installer.cap || '',
      comune: installer.comune || '',
      provincia: installer.provincia || '',
    }

    resetEditForm(formData)
    setEditDialogOpen(true)
  }

  const handleEditConfirm = async (data: any) => {
    if (!selectedInstaller) return

    try {
      await updateInstaller.mutateAsync({
        id: selectedInstaller.id,
        updates: data,
      })
      setEditDialogOpen(false)
      setSelectedInstaller(null)
      resetEditForm()
    } catch (err) {
      console.error('Error updating installer:', err)
    }
  }

  const handleDeleteClick = (installer: Installer) => {
    setInstallerToDelete(installer)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!installerToDelete) return

    try {
      await deleteInstaller.mutateAsync(installerToDelete.id)
      setDeleteDialogOpen(false)
      setInstallerToDelete(null)
    } catch (err) {
      console.error('Error deleting installer:', err)
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
          <Typography variant="h4">Gestione Installatori</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateClick}>
            Nuovo Installatore
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Errore nel caricamento degli installatori
          </Alert>
        )}

        {/* Search Bar & Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Cerca per nome installatore..."
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
              <InputLabel>Stato</InputLabel>
              <Select
                value={statoFilter}
                label="Stato"
                onChange={(e) => {
                  setStatoFilter(e.target.value as any)
                  setPage(0)
                }}
              >
                <MenuItem value="active">Attivi</MenuItem>
                <MenuItem value="inactive">Inattivi</MenuItem>
                <MenuItem value="all">Tutti</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>P.IVA</TableCell>
                <TableCell>Indirizzo</TableCell>
                <TableCell>Comune</TableCell>
                <TableCell>Provincia</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell align="right">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {installers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      Nessun installatore trovato
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                installers.map((installer) => (
                  <TableRow key={installer.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BuildIcon fontSize="small" color="action" />
                        <Typography variant="body2">{installer.nome}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {installer.partita_iva || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {installer.via && installer.numero_civico
                          ? `${installer.via} ${installer.numero_civico}`
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {installer.comune && installer.cap
                          ? `${installer.comune} (${installer.cap})`
                          : installer.comune || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{installer.provincia || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={installer.is_active ? 'Attivo' : 'Inattivo'}
                        color={installer.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Modifica">
                        <IconButton size="small" onClick={() => handleEditClick(installer)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(installer)}
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

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Vai a pagina:
              </Typography>
              <TextField
                size="small"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyPress={handlePageInputKeyPress}
                sx={{ width: 70 }}
                inputProps={{ style: { textAlign: 'center' } }}
              />
              <Typography variant="body2" color="text.secondary">
                di {totalPages}
              </Typography>
            </Box>
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[25, 50, 100]}
              labelRowsPerPage="Righe per pagina:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} di ${count}`}
            />
          </Box>
        </TableContainer>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Nuovo Installatore</DialogTitle>
          <DialogContent>
            <Box component="form" sx={{ mt: 2 }}>
              <InstallerFormFields control={createControl} errors={createErrors} showAllFields={true} />
            </Box>
            {createInstaller.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {createInstaller.error?.message || "Errore nella creazione dell'installatore"}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={createInstaller.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateSubmit(handleCreateConfirm)}
              variant="contained"
              disabled={createInstaller.isPending}
              startIcon={createInstaller.isPending ? <CircularProgress size={16} /> : null}
            >
              {createInstaller.isPending ? 'Creazione...' : 'Crea'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Modifica Installatore</DialogTitle>
          <DialogContent>
            {selectedInstaller && (
              <Box component="form" sx={{ mt: 2 }}>
                <InstallerFormFields control={editControl} errors={editErrors} showAllFields={true} />
              </Box>
            )}
            {updateInstaller.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {updateInstaller.error?.message || "Errore nell'aggiornamento dell'installatore"}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} disabled={updateInstaller.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleEditSubmit(handleEditConfirm)}
              variant="contained"
              disabled={updateInstaller.isPending}
              startIcon={updateInstaller.isPending ? <CircularProgress size={16} /> : null}
            >
              {updateInstaller.isPending ? 'Salvataggio...' : 'Salva'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Conferma Eliminazione</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Sei sicuro di voler eliminare l'installatore <strong>{installerToDelete?.nome}</strong>?
              <br />
              <br />
              L'installatore verrà disattivato (soft delete) e non sarà più visibile nelle liste,
              ma i dati storici saranno preservati.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteInstaller.isPending}>
              Annulla
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleteInstaller.isPending}
              startIcon={deleteInstaller.isPending ? <CircularProgress size={16} /> : null}
            >
              {deleteInstaller.isPending ? 'Eliminazione...' : 'Elimina'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  )
}
