import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { ripartisciPerValore, testoConferma, type ChiaveMassiva } from '@/utils/modificaMassiva'

interface ModificaMassivaDialogProps {
  open: boolean
  /** Righe già risolte: nel modo «tutte quelle del filtro» le carica la pagina, non il dialog. */
  righe: EquipmentCatalogItem[]
  chiave: ChiaveMassiva | null
  valore: string | null
  inCorso: boolean
  errore: string | null
  onAnnulla: () => void
  /** Riceve i soli id da scrivere: le righe che hanno già il valore non si toccano. */
  onConferma: (ids: string[]) => void
}

/**
 * Conferma della modifica massiva: dice cosa sta per succedere, prima che succeda.
 *
 * I modelli il cui valore verrà sostituito si elencano per nome. È l'unica cosa che
 * distingue un'operazione voluta da una fatta con un filtro troppo largo.
 */
export const ModificaMassivaDialog = ({
  open,
  righe,
  chiave,
  valore,
  inCorso,
  errore,
  onAnnulla,
  onConferma,
}: ModificaMassivaDialogProps) => {
  if (!chiave || !valore) return null

  const rip = ripartisciPerValore(righe, chiave, valore)
  const testo = testoConferma(rip, chiave, valore)
  const daScrivere = [...rip.daCompilare, ...rip.daSostituire].map(r => r.id)

  return (
    <Dialog open={open} onClose={inCorso ? undefined : onAnnulla} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>{testo.titolo}</DialogTitle>
      <DialogContent>
        <List dense disablePadding>
          {testo.righe.map(r => (
            <ListItem key={r} sx={{ display: 'list-item', listStyleType: 'disc', ml: 3, py: 0.25 }} disablePadding>
              <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }} primary={r} />
            </ListItem>
          ))}
        </List>
        {errore && <Alert severity="error" sx={{ mt: 2 }}>{errore}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onAnnulla} disabled={inCorso}>Annulla</Button>
        <Button
          variant="contained"
          disabled={!testo.applicabile || inCorso}
          onClick={() => onConferma(daScrivere)}
        >
          {testo.azione}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
