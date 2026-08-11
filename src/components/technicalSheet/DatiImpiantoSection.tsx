import type { ReactNode } from 'react'
import { Control, Controller, useWatch } from 'react-hook-form'
import {
  TextField,
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
import { radii } from '@/theme/tokens'
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
 *
 * Senza bordo proprio: vive dentro il riquadro della coppia min/max, e due bordi
 * annidati leggerebbero come due controlli separati che per caso stanno vicini.
 */
const DnSelect = ({ control, name, aria }: { control: Control<any>; name: string; aria: string }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Select
        {...field}
        displayEmpty
        variant="standard"
        disableUnderline
        inputProps={{ 'aria-label': aria }}
        value={field.value ?? ''}
        /* `null` e non `undefined` sul «—»: react-hook-form ripesca il default di un campo
           indefinito, e il DN appena tolto sarebbe tornato da sé. Vedi `NumberCell`. */
        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
        renderValue={(v) =>
          v === '' || v == null
            ? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
            : (DN_OPTIONS.find((o) => o.dn === v)?.label ?? `DN${v}`)
        }
        sx={{ flex: 1, minWidth: 0, fontSize: '0.875rem', '& .MuiSelect-select': { py: 0 } }}
      >
        <MenuItem value=""><em>—</em></MenuItem>
        {DN_OPTIONS.map((o) => (
          <MenuItem key={o.dn} value={o.dn}>{o.label}</MenuItem>
        ))}
      </Select>
    )}
  />
)

/**
 * Riquadro con etichetta incassata nel bordo, della stessa altezza di un TextField
 * `size="small"`.
 *
 * Serve perché i campi composti (le coppie DN) avevano il titolo *sopra* il controllo
 * mentre tutti gli altri lo hanno *dentro* il bordo: nella stessa riga le due famiglie
 * partivano da quote diverse, ed è la ragione principale per cui la sezione si leggeva
 * storta.
 */
const GruppoCampo = ({ titolo, children }: { titolo: string; children: ReactNode }) => (
  <Box>
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 40,
        px: 1.25,
        border: 1,
        borderColor: 'rgba(255, 255, 255, 0.23)',
        borderRadius: `${radii.control}px`,
      }}
    >
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ position: 'absolute', top: -8, left: 9, px: 0.5, bgcolor: 'background.paper', lineHeight: 1 }}
      >
        {titolo}
      </Typography>
      {children}
    </Box>
  </Box>
)

/** Coppia DN minimo / massimo di una tratta, con controllo di coerenza dell'intervallo. */
const DnRange = ({ control, titolo, nameMin, nameMax }: { control: Control<any>; titolo: string; nameMin: string; nameMax: string }) => {
  const [min, max] = useWatch({ control, name: [nameMin, nameMax] })
  const invertito = min != null && max != null && min > max

  return (
    <Box>
      <GruppoCampo titolo={titolo}>
        <DnSelect control={control} name={nameMin} aria={`${titolo} — DN minimo`} />
        <Box component="span" sx={{ color: 'text.disabled', flex: 'none' }}>–</Box>
        <DnSelect control={control} name={nameMax} aria={`${titolo} — DN massimo`} />
      </GruppoCampo>
      {invertito && (
        <FormHelperText error>Il DN minimo supera il massimo</FormHelperText>
      )}
    </Box>
  )
}

/**
 * SEZIONE 2: DATI IMPIANTO — griglia a riempimento, tutti i campi con l'etichetta
 * nella stessa posizione.
 *
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

  const shrink = { shrink: true }

  return (
    <Box sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}>
      {/* Le spunte prima dei campi liberi: sono loro a dire quali degli altri campi
          hanno ancora senso (locale condiviso, fonti di calore vicine). */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5, mb: 1 }}>
        <Controller
          name="dati_impianto.locale_dedicato"
          control={control}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Locale dedicato" />
          )}
        />
        <Controller
          name="dati_impianto.accesso_locale_vietato"
          control={control}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Accesso al locale vietato" />
          )}
        />
        <Controller
          name="dati_impianto.lontano_fonti_calore"
          control={control}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Lontano da fonti di calore" />
          )}
        />
        <Controller
          name="dati_impianto.lontano_materiale_infiammabile"
          control={control}
          render={({ field }) => (
            <FormControlLabel control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />} label="Lontano da materiale infiammabile" />
          )}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5, alignItems: 'start' }}>
        <Controller
          name="dati_impianto.aria_aspirata"
          control={control}
          defaultValue={[]}
          render={({ field }) => (
            <FormControl fullWidth size="small">
              <InputLabel shrink>Aria aspirata</InputLabel>
              <Select
                {...field}
                multiple
                displayEmpty
                value={field.value || []}
                input={<OutlinedInput notched label="Aria aspirata" />}
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

        <Controller
          name="dati_impianto.raccolta_condense"
          control={control}
          rules={{ required: 'Campo obbligatorio' }}
          defaultValue=""
          render={({ field }) => (
            <FormControl fullWidth size="small" required error={!!errors?.dati_impianto?.raccolta_condense}>
              <InputLabel shrink>Raccolta condense</InputLabel>
              <Select {...field} displayEmpty value={field.value || ''} input={<OutlinedInput notched label="Raccolta condense" />}
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

        {/* A locale dedicato il campo non ha senso: sparisce senza lasciare la
            colonna vuota, perché la griglia a riempimento si richiude da sola. */}
        {!localeDedicato && (
          <Controller
            name="dati_impianto.locale_condiviso_con"
            control={control}
            render={({ field }) => (
              <TextField {...field} value={field.value ?? ''} label="Locale condiviso con" size="small" fullWidth InputLabelProps={shrink} placeholder="Con chi" />
            )}
          />
        )}

        <Controller
          name="dati_impianto.fonti_calore_materiali_infiammabili"
          control={control}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} label="Fonti di calore o materiali vicini" size="small" fullWidth InputLabelProps={shrink} placeholder="Specificare fonti o materiali" />
          )}
        />

        <DnRange control={control} titolo="Collegamenti in sala"
          nameMin="dati_impianto.dn_sala_min" nameMax="dati_impianto.dn_sala_max" />

        <DnRange control={control} titolo="Linee di distribuzione"
          nameMin="dati_impianto.dn_distribuzione_min" nameMax="dati_impianto.dn_distribuzione_max" />
      </Box>

      {/* Diametro dichiarato a testo libero, in sola lettura: serve a ricompilare i DN.
          Mostrato solo dove esiste.
          NB: il corrispettivo per le linee di distribuzione è stato rimosso su richiesta. */}
      {salaStorico && (
        <Box sx={{ mt: 1.5 }}>
          <TextField label="Diametri collegamenti in sala (storico)" size="small" value={salaStorico}
            InputProps={{ readOnly: true }} InputLabelProps={shrink} sx={{ minWidth: 260 }}
            helperText="Campo superato: compilare i DN qui sopra" />
        </Box>
      )}
    </Box>
  )
}
