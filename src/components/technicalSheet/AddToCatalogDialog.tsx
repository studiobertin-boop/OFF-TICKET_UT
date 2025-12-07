import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { EquipmentCatalogType } from '@/types'

interface AddToCatalogDialogProps {
  open: boolean
  equipmentType: EquipmentCatalogType
  marca: string
  modello: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Dialog per confermare aggiunta di nuova apparecchiatura al catalogo
 *
 * Mostra anteprima della combinazione TIPO-MARCA-MODELLO
 * e chiede conferma prima del salvataggio
 */
export const AddToCatalogDialog = ({
  open,
  equipmentType,
  marca,
  modello,
  onConfirm,
  onCancel,
}: AddToCatalogDialogProps) => {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Handle confirm
   */
  const handleConfirm = async () => {
    if (!marca || !modello) {
      setError('Marca e modello sono obbligatori')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await equipmentCatalogApi.addEquipment(equipmentType, marca, modello)

      // Success - close dialog
      onConfirm()
    } catch (err) {
      console.error('Error adding to catalog:', err)
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setError(null)
    onCancel()
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          Aggiungi al Catalogo
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Stai per aggiungere una nuova apparecchiatura al catalogo.
          Sarà disponibile per suggerimenti futuri.
        </Alert>

        <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Tipo Apparecchiatura
          </Typography>
          <Typography variant="body1" fontWeight="bold" color="text.primary" gutterBottom>
            {equipmentType}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
            Marca
          </Typography>
          <Typography variant="body1" fontWeight="bold" color="text.primary" gutterBottom>
            {marca}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
            Modello
          </Typography>
          <Typography variant="body1" fontWeight="bold" color="text.primary">
            {modello}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={saving}>
          Annulla
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <CheckIcon />}
        >
          {saving ? 'Salvataggio...' : 'Conferma e Aggiungi'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
