import { useState } from 'react'
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
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material'
import {
  useUsers,
  useDeleteUser,
  useSuspendUser,
  useUnsuspendUser,
} from '../../hooks/useUsers'
import type { User, UserRole } from '../../types'
import UserDialog from '../../components/admin/UserDialog'
import ResetPasswordDialog from '../../components/admin/ResetPasswordDialog'
import { Layout } from '../../components/common/Layout'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  tecnico: 'Tecnico',
  utente: 'Utente',
  userdm329: 'Utente DM329',
  tecnicoDM329: 'Tecnico DM329',
}

const roleColors: Record<UserRole, 'error' | 'primary' | 'default' | 'secondary'> = {
  admin: 'error',
  tecnico: 'primary',
  utente: 'default',
  userdm329: 'secondary',
  tecnicoDM329: 'primary',
}

export default function AdminUsers() {
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [userForPassword, setUserForPassword] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: users, isLoading, error } = useUsers()
  const deleteUserMutation = useDeleteUser()
  const suspendUserMutation = useSuspendUser()
  const unsuspendUserMutation = useUnsuspendUser()

  const handleCreateUser = () => {
    setSelectedUser(undefined)
    setUserDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteError(null) // Reset errore precedente
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return

    setDeleteError(null) // Reset errore

    try {
      console.log('Starting delete for user:', userToDelete.id)
      await deleteUserMutation.mutateAsync(userToDelete.id)
      console.log('Delete successful')
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    } catch (err: any) {
      console.error('Error deleting user:', err)
      // Mostrare l'errore all'utente
      setDeleteError(err?.message || 'Errore sconosciuto durante l\'eliminazione')
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setUserToDelete(null)
    setDeleteError(null)
  }

  const handleSuspendToggle = async (user: User) => {
    try {
      if (user.is_suspended) {
        await unsuspendUserMutation.mutateAsync(user.id)
      } else {
        await suspendUserMutation.mutateAsync(user.id)
      }
    } catch (err) {
      console.error('Error toggling suspend:', err)
    }
  }

  const handleResetPassword = (user: User) => {
    setUserForPassword(user)
    setPasswordDialogOpen(true)
  }

  if (isLoading) {
    return (
      <Layout>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            Errore nel caricamento degli utenti: {error.message}
          </Alert>
        </Box>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Gestione Utenti
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateUser}
        >
          Nuovo Utente
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Ruolo</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Data Creazione</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.map((user) => (
              <TableRow
                key={user.id}
                sx={{
                  opacity: user.is_suspended ? 0.6 : 1,
                  backgroundColor: user.is_suspended
                    ? 'action.hover'
                    : 'inherit',
                }}
              >
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={roleLabels[user.role]}
                    color={roleColors[user.role]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.is_suspended ? 'Sospeso' : 'Attivo'}
                    color={user.is_suspended ? 'warning' : 'success'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {format(new Date(user.created_at), 'dd MMM yyyy', {
                    locale: it,
                  })}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Modifica">
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Reset Password">
                    <IconButton
                      size="small"
                      onClick={() => handleResetPassword(user)}
                      color="info"
                    >
                      <VpnKeyIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip
                    title={user.is_suspended ? 'Riattiva' : 'Sospendi'}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleSuspendToggle(user)}
                      color="warning"
                      disabled={
                        suspendUserMutation.isPending ||
                        unsuspendUserMutation.isPending
                      }
                    >
                      {user.is_suspended ? <LockOpenIcon /> : <LockIcon />}
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Elimina">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(user)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {users && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    Nessun utente trovato
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog Creazione/Modifica Utente */}
      <UserDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        user={selectedUser}
      />

      {/* Dialog Reset Password */}
      <ResetPasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        user={userForPassword}
      />

      {/* Dialog Conferma Eliminazione */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare l'utente{' '}
            <strong>{userToDelete?.full_name}</strong> (
            {userToDelete?.email})?
            <br />
            <br />
            Questa azione è <strong>irreversibile</strong>. Le richieste create
            dall'utente verranno mantenute ma il creatore sarà rimosso.
          </DialogContentText>

          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}

          {deleteUserMutation.isPending && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Eliminazione in corso...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelDelete}
            disabled={deleteUserMutation.isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteUserMutation.isPending}
            startIcon={
              deleteUserMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {deleteUserMutation.isPending ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Layout>
  )
}
