import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import type { UpdateData } from '@/types/equipmentUpdate'
import { getFieldLabel, formatSpecsValue } from '@/utils/equipmentSpecsComparison'

interface UpdateCatalogDialogProps {
  open: boolean
  updates: UpdateData[]
  onConfirm: () => Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

/**
 * Dialog per confermare aggiornamenti al catalogo apparecchiature
 *
 * Mostra:
 * - Lista apparecchiature con modifiche proposte
 * - Differenze specs (nuovi campi vs campi modificati)
 * - Warning per sovrascritture
 * - Gestione errori e loading states
 */
export const UpdateCatalogDialog = ({
  open,
  updates,
  onConfirm,
  onCancel,
  loading = false,
  error = null,
}: UpdateCatalogDialogProps) => {
  const hasModifiedFields = updates.some(
    (u) => Object.keys(u.comparison.modifiedFields).length > 0
  )

  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          <Typography variant="h6">Aggiornamenti Disponibili per il Catalogo</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hai compilato informazioni che mancano nel database. Vuoi aggiornare il catalogo?
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {hasModifiedFields && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
            Alcuni valori sono diversi da quelli esistenti. Verifica i dati prima di confermare.
          </Alert>
        )}

        {/* Lista aggiornamenti */}
        <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
          {updates.map((update, index) => (
            <Paper key={index} sx={{ mb: 2, p: 2 }} elevation={1}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {update.equipmentType} {update.codice} - {update.marca} {update.modello}
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Campo</TableCell>
                      <TableCell>Valore Attuale</TableCell>
                      <TableCell>Nuovo Valore</TableCell>
                      <TableCell>Azione</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Nuovi campi */}
                    {Object.entries(update.comparison.newFields).map(([field, value]) => (
                      <TableRow key={field}>
                        <TableCell>{getFieldLabel(field)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {formatSpecsValue(field, value)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label="NUOVO"
                            color="success"
                            size="small"
                            icon={<AddIcon />}
                          />
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Campi modificati (warning) */}
                    {Object.entries(update.comparison.modifiedFields).map(
                      ([field, { oldValue, newValue }]) => (
                        <TableRow key={field} sx={{ bgcolor: 'warning.50' }}>
                          <TableCell>{getFieldLabel(field)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                              {formatSpecsValue(field, oldValue)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium" color="warning.dark">
                              {formatSpecsValue(field, newValue)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label="SOVRASCRITTURA"
                              color="warning"
                              size="small"
                              icon={<WarningIcon />}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Info su dati esclusi */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Nota: Numero di fabbrica, anno e note rimangono specifici di questa apparecchiatura
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* Legenda */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Legenda:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label="NUOVO" color="success" size="small" icon={<AddIcon />} />
              <Typography variant="caption">
                Campo aggiunto al database (era vuoto)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label="SOVRASCRITTURA" color="warning" size="small" icon={<WarningIcon />} />
              <Typography variant="caption">
                Valore esistente verrà sostituito (verifica prima di confermare)
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || updates.length === 0}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Aggiornamento...' : `Conferma Tutti (${updates.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
