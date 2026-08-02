import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { Finding } from '@/services/equipmentAudit'

interface BulkFixDialogProps {
  open: boolean
  titolo: string
  findings: Finding[]
  onClose: () => void
  onConfirm: () => void
  isApplying: boolean
}

/** Anteprima leggibile della singola correzione. */
function descriviFix(finding: Finding): { azione: string; dettaglio: string } {
  const fix = finding.fix

  switch (fix.kind) {
    case 'set_specs': {
      const valori = Object.entries(fix.patch)
        .map(([k, v]) => `${k} = ${String(v)}`)
        .join(', ')
      const rimossi = fix.removeKeys?.length ? ` — rimuove ${fix.removeKeys.join(', ')}` : ''
      return { azione: 'Dati tecnici', dettaglio: `${valori}${rimossi}` }
    }
    case 'set_modello': {
      const patch = fix.patch
        ? ` e imposta ${Object.entries(fix.patch)
            .map(([k, v]) => `${k} = ${String(v)}`)
            .join(', ')}`
        : ''
      return { azione: 'Rinomina', dettaglio: `«${fix.modello}»${patch}` }
    }
    case 'set_tipo':
      return { azione: 'Tipo', dettaglio: fix.tipoApparecchiatura }
    case 'delete_row':
      return { azione: 'Elimina', dettaglio: 'la voce viene rimossa dal catalogo' }
    case 'merge_rows':
      return {
        azione: 'Fusione',
        dettaglio: `assorbe ${fix.dropIds.length} ${fix.dropIds.length === 1 ? 'voce' : 'voci'}`,
      }
    case 'create_row':
      return { azione: 'Crea', dettaglio: `${fix.row.marca} — ${fix.row.modello}` }
    default:
      return { azione: '—', dettaglio: '' }
  }
}

const ANTEPRIMA_MAX = 50

/**
 * Conferma delle correzioni in blocco.
 *
 * Le modifiche di massa si vedono prima di applicarle: normalizzare l'intero
 * catalogo tocca oltre mille voci, e nessuno deve premere un pulsante senza
 * sapere cosa cambia. Sopra una certa quantità l'anteprima si ferma, ma il
 * numero totale resta dichiarato.
 */
export const BulkFixDialog = ({
  open,
  titolo,
  findings,
  onClose,
  onConfirm,
  isApplying,
}: BulkFixDialogProps) => {
  const applicabili = findings.filter(f => f.fix.kind !== 'manual')
  const manuali = findings.length - applicabili.length
  const mostrate = applicabili.slice(0, ANTEPRIMA_MAX)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{titolo}</DialogTitle>

      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {applicabili.length === 0
            ? 'Nessuna di queste segnalazioni ha una correzione applicabile in automatico.'
            : `Stai per applicare ${applicabili.length} ${
                applicabili.length === 1 ? 'correzione' : 'correzioni'
              } in un'unica operazione.`}
        </DialogContentText>

        {manuali > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {manuali} {manuali === 1 ? 'segnalazione richiede' : 'segnalazioni richiedono'} una
            valutazione manuale e {manuali === 1 ? 'resta esclusa' : 'restano escluse'}.
          </Alert>
        )}

        {mostrate.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Apparecchiatura</TableCell>
                <TableCell>Azione</TableCell>
                <TableCell>Modifica</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mostrate.map(f => {
                const { azione, dettaglio } = descriviFix(f)
                return (
                  <TableRow key={f.key}>
                    <TableCell>{f.title}</TableCell>
                    <TableCell>{azione}</TableCell>
                    <TableCell>
                      <Typography variant="caption">{dettaglio}</Typography>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {applicabili.length > ANTEPRIMA_MAX && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Anteprima delle prime {ANTEPRIMA_MAX} su {applicabili.length}: verranno applicate
            tutte.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={applicabili.length === 0 || isApplying}
          startIcon={isApplying ? <CircularProgress size={16} /> : null}
        >
          {isApplying ? 'Applicazione…' : `Applica ${applicabili.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
