import type { ReactNode } from 'react'
import { Control, Controller, useWatch } from 'react-hook-form'
import {
  TextField,
  Grid,
  Box,
  Typography,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  OutlinedInput,
  Chip,
} from '@mui/material'
import {
  ARIA_ASPIRATA_OPTIONS,
  DN_OPTIONS,
  RACCOLTA_CONDENSE_OPTIONS,
} from '@/types'

interface DatiImpiantoSectionProps {
  control: Control<any>
  errors: any
  sedeLegale?: string
}

/**
 * Selettore di diametro nominale. Memorizza sempre il DN in mm: l'etichetta mostra anche
 * i pollici perché è come li dichiara l'installatore, ma il valore salvato è confrontabile
 * con la soglia di esclusione delle tubazioni (DN 80).
 */
const DnSelect = ({ control, name, label }: { control: Control<any>; name: string; label: string }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <FormControl fullWidth size="small">
        <InputLabel shrink>{label}</InputLabel>
        <Select
          {...field}
          displayEmpty
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          input={<OutlinedInput notched label={label} />}
          renderValue={(v) =>
            v === '' || v == null
              ? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
              : (DN_OPTIONS.find((o) => o.dn === v)?.label ?? `DN${v}`)
          }
        >
          <MenuItem value=""><em>—</em></MenuItem>
          {DN_OPTIONS.map((o) => (
            <MenuItem key={o.dn} value={o.dn}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    )}
  />
)

/**
 * Colonna con titolo sopra il controllo. Tutti i box della stessa riga devono usarlo,
 * altrimenti chi ha il titolo parte più in basso e i campi non risultano allineati.
 */
const CampoConTitolo = ({ titolo, children }: { titolo: string; children: ReactNode }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
      {titolo}
    </Typography>
    {children}
  </Box>
)

/** Coppia DN minimo / massimo di una tratta, con controllo di coerenza dell'intervallo. */
const DnRange = ({ control, titolo, nameMin, nameMax }: { control: Control<any>; titolo: string; nameMin: string; nameMax: string }) => {
  const [min, max] = useWatch({ control, name: [nameMin, nameMax] })
  const invertito = min != null && max != null && min > max

  return (
    <CampoConTitolo titolo={titolo}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <DnSelect control={control} name={nameMin} label="DN min" />
        <DnSelect control={control} name={nameMax} label="DN max" />
      </Box>
      {invertito && (
        <FormHelperText error>Il DN minimo supera il massimo</FormHelperText>
      )}
    </CampoConTitolo>
  )
}

/**
 * SEZIONE 2: DATI IMPIANTO — tre colonne della stessa larghezza, allineate.
 * NB: Sede Impianto / "= Sede Legale" / Denominazione Sala rimossi (duplicati:
 * si compilano nella maschera di creazione pratica).
 */
export const DatiImpiantoSection = ({
  control,
  errors,
}: DatiImpiantoSectionProps) => {
  const localeDedicato = useWatch({
    control,
    name: 'dati_impianto.locale_dedicato',
    defaultValue: false,
  })

  const salaStorico = useWatch({ control, name: 'dati_impianto.diametri_collegamenti_sala' })
  const diametriStorici = { sala: salaStorico }

  const shrink = { shrink: true }

  return (
    <Box sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}>
      <Grid container spacing={1.5}>
        {/* RIGA 1 — 3 colonne uguali */}
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            name="dati_impianto.aria_aspirata"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel shrink>Aria Aspirata</InputLabel>
                <Select
                  {...field}
                  multiple
                  displayEmpty
                  value={field.value || []}
                  input={<OutlinedInput notched label="Aria Aspirata" />}
                  renderValue={(selected) =>
                    (selected as string[]).length === 0 ? (
                      <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )
                  }
                >
                  {ARIA_ASPIRATA_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Controller
            name="dati_impianto.raccolta_condense"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            defaultValue=""
            render={({ field }) => (
              <FormControl fullWidth size="small" required error={!!errors?.dati_impianto?.raccolta_condense}>
                <InputLabel shrink>Raccolta Condense</InputLabel>
                <Select {...field} displayEmpty value={field.value || ''} input={<OutlinedInput notched label="Raccolta Condense" />}
                  renderValue={(v) => (v ? String(v) : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>)}
                >
                  {RACCOLTA_CONDENSE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                {errors?.dati_impianto?.raccolta_condense && (
                  <FormHelperText>{errors.dati_impianto.raccolta_condense.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          {!localeDedicato && (
            <Controller
              name="dati_impianto.locale_condiviso_con"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Locale Condiviso Con" size="small" fullWidth InputLabelProps={shrink} placeholder="Se condiviso, con chi" />
              )}
            />
          )}
        </Grid>

        {/* RIGA 2 — condizioni (checkbox su una riga) */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
            <Controller
              name="dati_impianto.locale_dedicato"
              control={control}
              render={({ field }) => (
                <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Locale Dedicato" />
              )}
            />
            <Controller
              name="dati_impianto.accesso_locale_vietato"
              control={control}
              render={({ field }) => (
                <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Accesso al Locale Vietato" />
              )}
            />
            <Controller
              name="dati_impianto.lontano_fonti_calore"
              control={control}
              render={({ field }) => (
                <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Lontano da Fonti di Calore" />
              )}
            />
            <Controller
              name="dati_impianto.lontano_materiale_infiammabile"
              control={control}
              render={({ field }) => (
                <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Lontano da Materiale Infiammabile" />
              )}
            />
          </Box>
        </Grid>

        {/* RIGA 3 — 3 colonne uguali */}
        <Grid item xs={12} sm={6} md={4}>
          <CampoConTitolo titolo="Fonti calore / mat. infiammabili vicini">
            <Controller
              name="dati_impianto.fonti_calore_materiali_infiammabili"
              control={control}
              render={({ field }) => (
                <TextField {...field} value={field.value ?? ''} size="small" fullWidth placeholder="Specificare fonti o materiali" />
              )}
            />
          </CampoConTitolo>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <DnRange control={control} titolo="Collegamenti in sala"
            nameMin="dati_impianto.dn_sala_min" nameMax="dati_impianto.dn_sala_max" />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <DnRange control={control} titolo="Linee di distribuzione"
            nameMin="dati_impianto.dn_distribuzione_min" nameMax="dati_impianto.dn_distribuzione_max" />
        </Grid>

        {/* RIGA 4 — diametro dichiarato a testo libero prima dei selettori DN.
            Mostrato solo dove esiste, in sola lettura: serve a ricompilare i DN.
            NB: il corrispettivo per le linee di distribuzione è stato rimosso su richiesta. */}
        {diametriStorici.sala && (
          <Grid item xs={12}>
            <TextField label="Diametri collegamenti in sala (storico)" size="small" value={diametriStorici.sala}
              InputProps={{ readOnly: true }} InputLabelProps={shrink} sx={{ minWidth: 260 }}
              helperText="Campo superato: compilare i DN qui sopra" />
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
