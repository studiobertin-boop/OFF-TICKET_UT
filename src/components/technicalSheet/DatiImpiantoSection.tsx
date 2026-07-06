import { Control, Controller, useWatch, useFormContext } from 'react-hook-form'
import {
  TextField,
  Grid,
  Box,
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
  RACCOLTA_CONDENSE_OPTIONS,
} from '@/types'
import { AddressAutocompleteField } from '@/components/requests/AddressAutocompleteField'

interface DatiImpiantoSectionProps {
  control: Control<any>
  errors: any
  sedeLegale?: string
}

/**
 * SEZIONE 2: DATI IMPIANTO — layout compatto e allineato in righe.
 * Logica invariata (sede condizionale, locale condiviso condizionale,
 * aria aspirata multiselect, raccolta condense obbligatoria).
 */
export const DatiImpiantoSection = ({
  control,
  errors,
  sedeLegale,
}: DatiImpiantoSectionProps) => {
  const { setValue } = useFormContext()

  const sedeImpUgualeLegale = useWatch({
    control,
    name: 'dati_impianto.sede_imp_uguale_legale',
    defaultValue: false,
  })

  const localeDedicato = useWatch({
    control,
    name: 'dati_impianto.locale_dedicato',
    defaultValue: false,
  })

  return (
    <Box sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}>
      <Grid container spacing={1.5} alignItems="flex-start">
        {/* RIGA 1: sede + denominazione */}
        <Grid item xs={12} sm="auto">
          <Controller
            name="dati_impianto.sede_imp_uguale_legale"
            control={control}
            defaultValue={false}
            render={({ field }) => (
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={
                  <Checkbox
                    size="small"
                    checked={field.value || false}
                    onChange={(e) => {
                      const isChecked = e.target.checked
                      if (isChecked && sedeLegale) {
                        setValue('dati_impianto.sede_impianto', sedeLegale, {
                          shouldDirty: true, shouldValidate: true, shouldTouch: true,
                        })
                      }
                      field.onChange(isChecked)
                    }}
                  />
                }
                label="Sede Impianto = Sede Legale"
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm>
          {sedeImpUgualeLegale ? (
            <Controller
              name="dati_impianto.sede_impianto"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Sede Impianto" size="small" fullWidth disabled />
              )}
            />
          ) : (
            <AddressAutocompleteField
              field={{
                name: 'dati_impianto.sede_impianto',
                label: 'Sede Impianto',
                type: 'address-autocomplete',
                required: true,
                placeholder: 'Via, Città, CAP...',
              }}
              control={control}
              error={errors?.dati_impianto?.sede_impianto}
            />
          )}
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Controller
            name="dati_impianto.denominazione_sala"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Denominazione Sala" size="small" fullWidth placeholder="Es: Sala compressori" />
            )}
          />
        </Grid>

        {/* RIGA 2: aria + raccolta + locale */}
        <Grid item xs={12} sm={6} md={3}>
          <Controller
            name="dati_impianto.aria_aspirata"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Aria Aspirata</InputLabel>
                <Select
                  {...field}
                  multiple
                  value={field.value || []}
                  input={<OutlinedInput label="Aria Aspirata" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {ARIA_ASPIRATA_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Controller
            name="dati_impianto.raccolta_condense"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            defaultValue=""
            render={({ field }) => (
              <FormControl fullWidth size="small" required error={!!errors?.dati_impianto?.raccolta_condense}>
                <InputLabel>Raccolta Condense</InputLabel>
                <Select {...field} value={field.value || ''} label="Raccolta Condense">
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

        <Grid item xs={12} sm="auto">
          <Controller
            name="dati_impianto.locale_dedicato"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Locale Dedicato"
              />
            )}
          />
        </Grid>

        {!localeDedicato && (
          <Grid item xs={12} sm md={3}>
            <Controller
              name="dati_impianto.locale_condiviso_con"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Locale Condiviso Con" size="small" fullWidth placeholder="Se condiviso, con chi" />
              )}
            />
          </Grid>
        )}

        {/* RIGA 3: condizioni (checkbox su una riga) */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
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

        {/* RIGA 4: testi liberi */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.fonti_calore_materiali_infiammabili"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Fonti Calore / Materiali Infiammabili Vicini" size="small" fullWidth placeholder="Specificare fonti o materiali" />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            name="dati_impianto.diametri_collegamenti_sala"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Diametri Collegamenti in Sala" size="small" fullWidth placeholder={'Es: 1/2", 3/4"'} />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            name="dati_impianto.diametri_linee_distribuzione"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Diametri Linee di Distribuzione" size="small" fullWidth placeholder={'Es: 1", 1 1/4"'} />
            )}
          />
        </Grid>

        {/* Campi DEPRECATED mantenuti nascosti */}
        <Grid item xs={12} sx={{ display: 'none' }}>
          <Controller name="dati_impianto.indirizzo_impianto" control={control} render={({ field }) => (<TextField {...field} disabled />)} />
          <Controller name="dati_impianto.fonti_calore_vicine" control={control} render={({ field }) => (<TextField {...field} disabled />)} />
        </Grid>
      </Grid>
    </Box>
  )
}
