import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { Info as InfoIcon } from '@mui/icons-material'
import type { SceltaCampo, ScelteCampi, UpdateData } from '@/types/equipmentUpdate'
import { getFieldLabel, formatSpecsValue } from '@/utils/equipmentSpecsComparison'

interface UpdateCatalogDialogProps {
  open: boolean
  update: UpdateData | null
  onConfirm: (scelte: ScelteCampi) => Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string | null
  /** Se falso l'opzione «aggiorna il catalogo» resta nascosta (RLS di sola lettura). */
  puoScrivereACatalogo?: boolean
}

const OPZIONI: { value: SceltaCampo; label: string; hint: string }[] = [
  { value: 'default', label: 'Valore di default', hint: 'Annulla la modifica e rimette il valore del catalogo' },
  { value: 'solo_qui', label: 'Solo per questa volta', hint: 'Tiene la modifica in questa scheda, catalogo intatto' },
  { value: 'catalogo', label: 'Aggiorna il catalogo', hint: 'Scrive il nuovo valore sulla voce di catalogo' },
]

/**
 * Cosa fare dei valori che si sono scostati dal catalogo, campo per campo.
 *
 * La scelta preselezionata è sempre «solo per questa volta»: è l'unica senza conseguenze fuori
 * dalla pratica in corso, quindi confermare distrattamente non rovina il catalogo né perde il
 * lavoro appena fatto.
 */
export const UpdateCatalogDialog = ({
  open,
  update,
  onConfirm,
  onCancel,
  loading = false,
  error = null,
  puoScrivereACatalogo = true,
}: UpdateCatalogDialogProps) => {
  const [scelte, setScelte] = useState<ScelteCampi>({})

  const campiModificati = Object.entries(update?.comparison.modifiedFields ?? {})
  const campiNuovi = Object.entries(update?.comparison.newFields ?? {})

  // Ogni apertura riparte dalla scelta neutra.
  useEffect(() => {
    if (!open) return
    const iniziali: ScelteCampi = {}
    for (const [campo] of campiModificati) iniziali[campo] = 'solo_qui'
    for (const [campo] of campiNuovi) iniziali[campo] = puoScrivereACatalogo ? 'catalogo' : 'solo_qui'
    setScelte(iniziali)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, update])

  const scegli = (campo: string, valore: SceltaCampo | null) => {
    if (!valore) return
    setScelte((prev) => ({ ...prev, [campo]: valore }))
  }

  const opzioniVisibili = OPZIONI.filter(
    (o) => o.value !== 'catalogo' || (puoScrivereACatalogo && update?.catalogData)
  )

  const selettore = (campo: string, opzioni = opzioniVisibili) => (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={scelte[campo] ?? 'solo_qui'}
      onChange={(_e, v) => scegli(campo, v)}
      disabled={loading}
    >
      {opzioni.map((o) => (
        <Tooltip key={o.value} title={o.hint}>
          <ToggleButton value={o.value} sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.4 }}>
            {o.label}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  )

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          <Typography variant="h6">
            {update ? `${update.codice} · ${update.marca} ${update.modello}` : 'Dati modificati'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hai cambiato dei valori che erano stati precompilati dal catalogo. Per ciascuno, decidi
          cosa deve valere.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!update?.catalogData && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            La voce di catalogo di partenza non è più raggiungibile: si può solo tenere o annullare
            la modifica.
          </Alert>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Campo</TableCell>
                <TableCell>Catalogo</TableCell>
                <TableCell>Scheda</TableCell>
                <TableCell>Cosa faccio</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campiModificati.map(([campo, { oldValue, newValue }]) => (
                <TableRow key={campo}>
                  <TableCell>{getFieldLabel(campo)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>
                      {formatSpecsValue(campo, oldValue)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatSpecsValue(campo, newValue)}
                    </Typography>
                  </TableCell>
                  <TableCell>{selettore(campo)}</TableCell>
                </TableRow>
              ))}

              {campiNuovi.map(([campo, value]) => (
                <TableRow key={campo}>
                  <TableCell>{getFieldLabel(campo)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">— (mancava)</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatSpecsValue(campo, value)}
                    </Typography>
                  </TableCell>
                  {/* Il catalogo non aveva nulla: non c'è un default a cui tornare. */}
                  <TableCell>{selettore(campo, opzioniVisibili.filter((o) => o.value !== 'default'))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Numero di fabbrica, anno e note restano sempre specifici di questa apparecchiatura e non
          finiscono mai a catalogo.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>Annulla</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(scelte)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Applico...' : 'Conferma'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
