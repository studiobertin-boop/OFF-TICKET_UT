import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  Button,
  Alert,
  Stack,
  CircularProgress,
  FormControl,
  InputLabel,
} from '@mui/material'
import { PersonAdd as PersonAddIcon, PersonRemove as PersonRemoveIcon } from '@mui/icons-material'
import { User } from '@/types'
import { getTechnicians, assignRequest, unassignRequest } from '@/services/requestService'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { REQUESTS_QUERY_KEY } from '@/hooks/useRequests'

interface AssignmentSectionProps {
  requestId: string
  currentAssignedTo?: string
  assignedUser?: User
  onAssignmentChanged: () => void
}

export const AssignmentSection = ({
  requestId,
  currentAssignedTo,
  assignedUser,
  onAssignmentChanged,
}: AssignmentSectionProps) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [technicians, setTechnicians] = useState<User[]>([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingTechnicians, setLoadingTechnicians] = useState(true)

  // Only admin can assign/unassign
  const canManageAssignment = user?.role === 'admin'

  useEffect(() => {
    loadTechnicians()
  }, [])

  const loadTechnicians = async () => {
    setLoadingTechnicians(true)
    const data = await getTechnicians()
    setTechnicians(data as User[])
    setLoadingTechnicians(false)
  }

  const handleAssign = async () => {
    if (!selectedTechnicianId || !user) return

    setLoading(true)
    setError(null)

    const result = await assignRequest(requestId, selectedTechnicianId, user.id)

    setLoading(false)

    if (result.success) {
      setSelectedTechnicianId('')
      // Invalida tutte le query delle richieste per aggiornare sia la lista che il dettaglio
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
      onAssignmentChanged()
    } else {
      setError(result.message)
    }
  }

  const handleUnassign = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    const result = await unassignRequest(requestId, user.id)

    setLoading(false)

    if (result.success) {
      // Invalida tutte le query delle richieste per aggiornare sia la lista che il dettaglio
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
      onAssignmentChanged()
    } else {
      setError(result.message)
    }
  }

  if (!canManageAssignment && !currentAssignedTo) {
    return null
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Assegnazione
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {currentAssignedTo && assignedUser ? (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Assegnata a:</strong> {assignedUser.full_name} ({assignedUser.email})
              </Typography>
            </Alert>

            {canManageAssignment && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<PersonRemoveIcon />}
                onClick={handleUnassign}
                disabled={loading}
              >
                Rimuovi Assegnazione
              </Button>
            )}
          </Box>
        ) : canManageAssignment ? (
          <Stack spacing={2}>
            <Alert severity="warning">Questa richiesta non è ancora assegnata</Alert>

            {loadingTechnicians ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel>Seleziona Tecnico</InputLabel>
                  <Select
                    value={selectedTechnicianId}
                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                    label="Seleziona Tecnico"
                    disabled={loading}
                  >
                    {technicians.map((tech) => (
                      <MenuItem key={tech.id} value={tech.id}>
                        {tech.full_name} ({tech.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={handleAssign}
                  disabled={!selectedTechnicianId || loading}
                >
                  {loading ? 'Assegnazione...' : 'Assegna'}
                </Button>
              </>
            )}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}
