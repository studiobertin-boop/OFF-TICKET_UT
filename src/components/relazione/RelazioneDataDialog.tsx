/**
 * Step "Dati relazione": raccoglie i dati aggiuntivi (additional_info) non presenti
 * nella scheda, li salva e genera/scarica la relazione .docx.
 *
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Box,
  CircularProgress,
} from '@mui/material'
import toast from 'react-hot-toast'
import type { SelectChangeEvent } from '@mui/material'
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { technicalDataApi } from '@/services/api/technicalData'
import { additionalInfoSchema } from '@/services/relazione/schema'
import { generateAndDownloadRelazione } from '@/services/relazione/generateRelazione'
import type { AdditionalInfo, TipoGiri } from '@/services/relazione/types'

interface RelazioneDataDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  scheda: SchedaDatiCompleta
  customer: Customer | null
  initialAdditionalInfo?: AdditionalInfo
  fileName?: string
}

export default function RelazioneDataDialog({
  open,
  onClose,
  requestId,
  scheda,
  customer,
  initialAdditionalInfo,
  fileName,
}: RelazioneDataDialogProps) {
  const compressoriCodes = useMemo(
    () => (scheda.compressori ?? []).map((c) => c.codice),
    [scheda]
  )
  const serbatoiCodes = useMemo(() => (scheda.serbatoi ?? []).map((s) => s.codice), [scheda])
  const spessimetricaOptions = useMemo(
    () => [
      ...(scheda.disoleatori ?? []).map((d) => d.codice),
      ...serbatoiCodes,
      ...(scheda.scambiatori ?? []).map((s) => s.codice),
      ...(scheda.recipienti_filtro ?? []).map((r) => r.codice),
    ],
    [scheda, serbatoiCodes]
  )

  const [descrizioneAttivita, setDescrizioneAttivita] = useState('')
  const [motivoRevisione, setMotivoRevisione] = useState('')
  const [giri, setGiri] = useState<Record<string, TipoGiri>>({})
  const [spessimetrica, setSpessimetrica] = useState<string[]>([])
  const [collegamenti, setCollegamenti] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  // Sincronizza lo stato all'apertura del dialog
  useEffect(() => {
    if (!open) return
    const info = initialAdditionalInfo ?? {}
    setDescrizioneAttivita(info.descrizioneAttivita || customer?.descrizione_attivita || '')
    setMotivoRevisione(info.motivoRevisione || '')
    setGiri(info.compressoriGiri || {})
    setSpessimetrica(info.spessimetrica || [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi || {})
  }, [open, initialAdditionalInfo, customer])

  const setGiroFor = (code: string, value: TipoGiri) =>
    setGiri((prev) => ({ ...prev, [code]: value }))

  const setCollegamentoFor = (code: string, values: string[]) =>
    setCollegamenti((prev) => ({ ...prev, [code]: values }))

  const handleGenera = async () => {
    const candidate: AdditionalInfo = {
      descrizioneAttivita: descrizioneAttivita.trim(),
      motivoRevisione: motivoRevisione.trim() || undefined,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
    }

    const parsed = additionalInfoSchema.safeParse(candidate)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Dati non validi')
      return
    }
    if (!customer) {
      toast.error('Anagrafica cliente mancante: impossibile generare la relazione.')
      return
    }

    setSaving(true)
    try {
      await technicalDataApi.updateAdditionalInfo(requestId, parsed.data)
      await generateAndDownloadRelazione({
        scheda,
        additionalInfo: parsed.data,
        customer,
        fileName,
      })
      toast.success('Relazione generata e scaricata.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nella generazione della relazione')
    } finally {
      setSaving(false)
    }
  }

  const renderMultiValue = (selected: string[]) => selected.join(', ')

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Dati per la relazione tecnica</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="Descrizione attività (ATECO)"
            value={descrizioneAttivita}
            onChange={(e) => setDescrizioneAttivita(e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            helperText="Testo inserito così com'è nella premessa della relazione."
          />

          <TextField
            label="Motivo revisione (opzionale)"
            value={motivoRevisione}
            onChange={(e) => setMotivoRevisione(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            helperText="Se valorizzato, il documento è trattato come una revisione."
          />

          <Divider />
          <Typography variant="subtitle2">Giri dei compressori</Typography>
          {compressoriCodes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nessun compressore nella scheda.
            </Typography>
          )}
          {compressoriCodes.map((code) => (
            <FormControl key={code} fullWidth size="small">
              <InputLabel id={`giri-${code}`}>{`Compressore ${code}`}</InputLabel>
              <Select
                labelId={`giri-${code}`}
                label={`Compressore ${code}`}
                value={giri[code] ?? ''}
                onChange={(e: SelectChangeEvent) => setGiroFor(code, e.target.value as TipoGiri)}
              >
                <MenuItem value="fissi">a giri fissi</MenuItem>
                <MenuItem value="variabili">a giri variabili (inverter)</MenuItem>
              </Select>
            </FormControl>
          ))}

          <Divider />
          <Typography variant="subtitle2">
            Collegamenti compressori → serbatoi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Serve al calcolo della portata delle valvole dei serbatoi.
          </Typography>
          {compressoriCodes.map((code) => (
            <FormControl key={code} fullWidth size="small">
              <InputLabel id={`coll-${code}`}>{`${code} collegato a`}</InputLabel>
              <Select
                labelId={`coll-${code}`}
                multiple
                value={collegamenti[code] ?? []}
                onChange={(e: SelectChangeEvent<string[]>) =>
                  setCollegamentoFor(
                    code,
                    typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                  )
                }
                input={<OutlinedInput label={`${code} collegato a`} />}
                renderValue={renderMultiValue}
              >
                {serbatoiCodes.map((s) => (
                  <MenuItem key={s} value={s}>
                    <Checkbox checked={(collegamenti[code] ?? []).includes(s)} />
                    <ListItemText primary={s} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          <Divider />
          <Typography variant="subtitle2">
            Apparecchiature con verifica spessimetrica
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="spess">Apparecchiature</InputLabel>
            <Select
              labelId="spess"
              multiple
              value={spessimetrica}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setSpessimetrica(
                  typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                )
              }
              input={<OutlinedInput label="Apparecchiature" />}
              renderValue={renderMultiValue}
            >
              {spessimetricaOptions.map((code) => (
                <MenuItem key={code} value={code}>
                  <Checkbox checked={spessimetrica.includes(code)} />
                  <ListItemText primary={code} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Box sx={{ position: 'relative' }}>
          <Button variant="contained" onClick={handleGenera} disabled={saving}>
            Genera e scarica .docx
          </Button>
          {saving && (
            <CircularProgress
              size={24}
              sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px' }}
            />
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}
