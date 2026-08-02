import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { useSheetReferences } from '@/hooks/useEquipmentCatalogAdmin'

interface DeleteEquipmentDialogProps {
  open: boolean
  item: EquipmentCatalogItem | null
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

/**
 * Conferma di eliminazione definitiva.
 *
 * Mostra quante schede dati citano la voce, perché il legame fra pratiche e
 * catalogo passa per marca e modello: eliminarla non cancella nulla dalle
 * pratiche, ma le lascia scollegate — niente autocompilazione, niente verifiche.
 * Dove basta togliere la voce dai menu, disattivarla è la scelta giusta.
 */
export const DeleteEquipmentDialog = ({
  open,
  item,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteEquipmentDialogProps) => {
  const { data: riferimenti, isLoading } = useSheetReferences(
    open ? (item?.marca ?? null) : null,
    open ? (item?.modello ?? null) : null
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Conferma eliminazione</DialogTitle>

      <DialogContent>
        <DialogContentText>
          Eliminare definitivamente <strong>{item?.marca}</strong> —{' '}
          <strong>{item?.modello}</strong> dal catalogo?
        </DialogContentText>

        {isLoading && <CircularProgress size={20} sx={{ mt: 2 }} />}

        {!isLoading && riferimenti !== undefined && riferimenti > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {riferimenti === 1
              ? 'Una scheda dati cita questa apparecchiatura.'
              : `${riferimenti} schede dati citano questa apparecchiatura.`}{' '}
            I dati già compilati restano nelle pratiche, ma perdono il collegamento al
            catalogo: niente autocompilazione né controlli di coerenza. Se serve solo
            toglierla dai menu, disattivala invece di eliminarla.
          </Alert>
        )}

        {!isLoading && riferimenti === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Nessuna scheda dati cita questa apparecchiatura.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} /> : null}
        >
          {isDeleting ? 'Eliminazione…' : 'Elimina'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
