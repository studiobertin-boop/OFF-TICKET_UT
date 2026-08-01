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
  Alert,
  CircularProgress,
} from '@mui/material'
import toast from 'react-hot-toast'
import type { SelectChangeEvent } from '@mui/material'
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { technicalDataApi } from '@/services/api/technicalData'
import { additionalInfoSchema } from '@/services/relazione/schema'
import { generateAndDownloadRelazione } from '@/services/relazione/generateRelazione'
import { buildRelazioneModel } from '@/services/relazione/buildRelazioneModel'
import { validateRelazione, haErrori } from '@/services/relazione/preflight'
import type { AdditionalInfo, PraticaInfo, SchemaImpianto, TipoGiri } from '@/services/relazione/types'
import { leggiSchemaImpianto } from './schemaImpiantoFile'

interface RelazioneDataDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  scheda: SchedaDatiCompleta
  customer: Customer | null
  /**
   * Dati del codice pratica. Sono la sorgente unica di ubicazione impianto e
   * progressivo di revisione: la scheda dati non li duplica più.
   */
  pratica: PraticaInfo
  initialAdditionalInfo?: AdditionalInfo
  fileName?: string
}

export default function RelazioneDataDialog({
  open,
  onClose,
  requestId,
  scheda,
  customer,
  pratica,
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
  const [giri, setGiri] = useState<Record<string, TipoGiri>>({})
  const [spessimetrica, setSpessimetrica] = useState<string[]>([])
  const [collegamenti, setCollegamenti] = useState<Record<string, string[]>>({})
  const [schema, setSchema] = useState<SchemaImpianto | null>(null)
  const [saving, setSaving] = useState(false)

  // Sincronizza lo stato all'apertura del dialog
  useEffect(() => {
    if (!open) return
    const info = initialAdditionalInfo ?? {}
    setDescrizioneAttivita(info.descrizioneAttivita || customer?.descrizione_attivita || '')
    setGiri(info.compressoriGiri || {})
    setSpessimetrica(info.spessimetrica || [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi || {})
    // Lo schema non è persistito: a ogni apertura si riparte da vuoto.
    setSchema(null)
  }, [open, initialAdditionalInfo, customer])

  const handleSchemaFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setSchema(await leggiSchemaImpianto(file))
    } catch (err) {
      setSchema(null)
      toast.error(err instanceof Error ? err.message : 'Immagine non leggibile.')
    }
  }

  const setGiroFor = (code: string, value: TipoGiri) =>
    setGiri((prev) => ({ ...prev, [code]: value }))

  const setCollegamentoFor = (code: string, values: string[]) =>
    setCollegamenti((prev) => ({ ...prev, [code]: values }))

  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
    }),
    [descrizioneAttivita, giri, spessimetrica, collegamenti]
  )

  /**
   * Preflight ricalcolato a ogni modifica: il redattore vede sparire le segnalazioni
   * mentre compila, invece di scoprirle solo al momento di generare.
   */
  const segnalazioni = useMemo(() => {
    if (!customer) {
      return [
        {
          livello: 'errore' as const,
          codice: 'cliente-assente',
          messaggio: 'Anagrafica cliente non caricata: impossibile generare la relazione.',
        },
      ]
    }
    return validateRelazione(
      buildRelazioneModel({
        scheda,
        additionalInfo,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
      })
    )
  }, [customer, scheda, additionalInfo, pratica, schema])

  const bloccante = haErrori(segnalazioni)

  const handleGenera = async () => {
    const candidate: AdditionalInfo = additionalInfo

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
        pratica,
        schemaImpianto: schema ?? undefined,
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

          <Divider />
          <Typography variant="subtitle2">Schema d’impianto (§2.3)</Typography>
          <Typography variant="body2" color="text.secondary">
            L’immagine viene incorporata nel documento a larghezza fissa e non viene
            salvata: va riselezionata a ogni generazione. Formati PNG o JPEG, max 10 MB.
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button component="label" variant="outlined" size="small" disabled={saving}>
              {schema ? 'Sostituisci immagine' : 'Scegli immagine'}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  void handleSchemaFile(e.target.files?.[0])
                  // Consente di riselezionare lo stesso file dopo una rimozione.
                  e.target.value = ''
                }}
              />
            </Button>
            {schema ? (
              <>
                <Typography variant="body2">
                  {schema.nomeFile} — {schema.larghezzaPx}×{schema.altezzaPx} px
                </Typography>
                <Button size="small" color="inherit" onClick={() => setSchema(null)} disabled={saving}>
                  Rimuovi
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nessuno schema: il paragrafo resterà vuoto.
              </Typography>
            )}
          </Stack>

          <Divider />
          <Typography variant="subtitle2">Controllo di completezza</Typography>
          {segnalazioni.length === 0 ? (
            <Alert severity="success">Nessun dato mancante: la relazione è completa.</Alert>
          ) : (
            <Stack spacing={1}>
              {segnalazioni.map((s) => (
                <Alert key={s.codice} severity={s.livello === 'errore' ? 'error' : 'warning'}>
                  {s.messaggio}
                  {s.posizioni?.length ? (
                    <Typography component="div" variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {s.posizioni.join(' · ')}
                    </Typography>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Box sx={{ position: 'relative' }}>
          {/* Le segnalazioni informano, non sbarrano: il redattore può avere ragioni per
              generare comunque, ma l'etichetta gli ricorda che qualcosa manca. */}
          <Button
            variant="contained"
            color={bloccante ? 'warning' : 'primary'}
            onClick={handleGenera}
            disabled={saving || !customer}
          >
            {bloccante ? 'Genera comunque .docx' : 'Genera e scarica .docx'}
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
