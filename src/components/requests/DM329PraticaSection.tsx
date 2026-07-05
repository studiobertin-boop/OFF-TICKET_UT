import { useEffect, useMemo, useState } from 'react'
import { Control, useWatch, UseFormSetValue } from 'react-hook-form'
import {
  Box,
  Grid,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Typography,
  Chip,
  Divider,
  Alert,
} from '@mui/material'
import { Customer } from '@/types'
import { useClientDm329Overview } from '@/hooks/useRequests'
import { composeCodicePratica } from '@/utils/practiceCode'
import { AddressAutocompleteField } from './AddressAutocompleteField'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const NEW_SALA = '__NEW__'

export interface Dm329PraticaValue {
  impianto_uguale_sede_legale: boolean
  indirizzo_impianto: string
  sala_lettera: string
  denominazione_sala: string
  progressivo: number
  anno: number
}

interface Props {
  customer: Customer
  sedeLegale: string
  control: Control<any>
  setValue: UseFormSetValue<any>
  onChange: (value: Dm329PraticaValue, valid: boolean) => void
}

/**
 * Sezione dedicata del form Nuova Richiesta DM329: indirizzo impianto (con flag = sede legale),
 * scelta della sala (sale esistenti del cliente + Nuova sala), denominazione, progressivo/anno,
 * e anteprima del codice pratica. I valori sono gestiti in stato locale e sollevati via onChange.
 */
export const DM329PraticaSection = ({ customer, sedeLegale, control, setValue, onChange }: Props) => {
  const { data: overview = [] } = useClientDm329Overview(customer.id)

  const [flagUgualeSede, setFlagUgualeSede] = useState(false)
  const [salaScelta, setSalaScelta] = useState('')
  const [denominazione, setDenominazione] = useState('')
  const [progressivo, setProgressivo] = useState(0)
  const [anno, setAnno] = useState<number>(new Date().getFullYear())

  const indirizzoWatch = useWatch({ control, name: 'indirizzo_impianto' }) as string | undefined

  // Sale esistenti del cliente (lettera, denominazione, max progressivo)
  const sale = useMemo(() => {
    const m = new Map<string, { lettera: string; denominazione: string; maxProg: number }>()
    for (const p of overview) {
      const cur = m.get(p.sala_lettera)
      if (!cur) {
        m.set(p.sala_lettera, {
          lettera: p.sala_lettera,
          denominazione: p.denominazione_sala || '',
          maxProg: p.progressivo,
        })
      } else {
        cur.maxProg = Math.max(cur.maxProg, p.progressivo)
        if (!cur.denominazione && p.denominazione_sala) cur.denominazione = p.denominazione_sala
      }
    }
    return Array.from(m.values()).sort((a, b) => a.lettera.localeCompare(b.lettera))
  }, [overview])

  const nextLetter = useMemo(
    () => LETTERS.find(l => !sale.some(s => s.lettera === l)) || 'A',
    [sale]
  )

  const isNewSala = salaScelta === NEW_SALA
  const salaLettera = isNewSala ? nextLetter : salaScelta

  // Reset quando cambia cliente
  useEffect(() => {
    setSalaScelta('')
    setDenominazione('')
    setProgressivo(0)
    setValue('indirizzo_impianto', '')
  }, [customer.id, setValue])

  // Applica i default quando cambia la sala scelta
  useEffect(() => {
    if (!salaScelta) return
    if (isNewSala) {
      setDenominazione('')
      setProgressivo(0)
    } else {
      const s = sale.find(x => x.lettera === salaScelta)
      setDenominazione(s?.denominazione || '')
      setProgressivo((s?.maxProg ?? -1) + 1)
    }
  }, [salaScelta, isNewSala, sale])

  const indirizzoEffettivo = flagUgualeSede ? sedeLegale : (indirizzoWatch || '')
  const clientSalaCount = isNewSala ? sale.length + 1 : sale.length

  const codicePreview = composeCodicePratica({
    clientCode: customer.identificativo,
    sala_lettera: salaLettera,
    progressivo,
    anno,
    clientSalaCount,
  })

  const valid =
    !!salaScelta &&
    (flagUgualeSede ? !!sedeLegale : indirizzoEffettivo.trim().length > 0) &&
    (isNewSala ? denominazione.trim().length > 0 : true) &&
    progressivo >= 0 &&
    progressivo <= 99 &&
    anno >= 2000

  // Solleva i valori al form principale
  useEffect(() => {
    onChange(
      {
        impianto_uguale_sede_legale: flagUgualeSede,
        indirizzo_impianto: indirizzoEffettivo,
        sala_lettera: salaLettera,
        denominazione_sala: denominazione,
        progressivo,
        anno,
      },
      valid
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagUgualeSede, indirizzoEffettivo, salaLettera, denominazione, progressivo, anno, valid])

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Impianto e codice pratica
      </Typography>

      {!customer.identificativo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Questo cliente non ha ancora un <strong>codice cliente</strong>: il codice pratica non sarà
          visibile finché non glielo assegni (Gestione Clienti). Puoi comunque creare la pratica.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label="Sede legale (cliente)"
            value={sedeLegale || '—'}
            fullWidth
            InputProps={{ readOnly: true }}
            variant="filled"
          />
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={flagUgualeSede}
                onChange={e => setFlagUgualeSede(e.target.checked)}
              />
            }
            label="Indirizzo impianto = sede legale"
          />
        </Grid>

        <Grid item xs={12}>
          {flagUgualeSede ? (
            <TextField
              label="Indirizzo impianto"
              value={sedeLegale || '—'}
              fullWidth
              InputProps={{ readOnly: true }}
              helperText="Copiato dalla sede legale"
            />
          ) : (
            <AddressAutocompleteField
              field={{
                name: 'indirizzo_impianto',
                type: 'address-autocomplete',
                label: 'Indirizzo impianto',
                required: true,
              }}
              control={control}
            />
          )}
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Sala compressori"
            value={salaScelta}
            onChange={e => setSalaScelta(e.target.value)}
            fullWidth
            required
            helperText={isNewSala ? `Nuova sala: lettera ${nextLetter}` : ' '}
          >
            <MenuItem value="">
              <em>Seleziona…</em>
            </MenuItem>
            {sale.map(s => (
              <MenuItem key={s.lettera} value={s.lettera}>
                {s.lettera}
                {s.denominazione ? ` — ${s.denominazione}` : ''}
              </MenuItem>
            ))}
            <MenuItem value={NEW_SALA}>➕ Nuova sala</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Denominazione sala"
            value={denominazione}
            onChange={e => setDenominazione(e.target.value)}
            fullWidth
            required={isNewSala}
            InputProps={{ readOnly: !isNewSala }}
            helperText={isNewSala ? 'Es. Sala principale, Verniciatura…' : 'Dalla sala esistente'}
          />
        </Grid>

        <Grid item xs={6} sm={3}>
          <TextField
            label="Progressivo"
            type="number"
            value={progressivo}
            onChange={e => setProgressivo(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
            fullWidth
            inputProps={{ min: 0, max: 99 }}
            helperText={isNewSala ? 'Iniziale = 00' : 'Aggiornamento'}
          />
        </Grid>

        <Grid item xs={6} sm={3}>
          <TextField
            label="Anno"
            type="number"
            value={anno}
            onChange={e => setAnno(Number(e.target.value) || anno)}
            fullWidth
            inputProps={{ min: 2000, max: 2100 }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Codice pratica:
            </Typography>
            <Chip
              label={codicePreview || '—'}
              color={codicePreview ? 'primary' : 'default'}
              variant={codicePreview ? 'filled' : 'outlined'}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
