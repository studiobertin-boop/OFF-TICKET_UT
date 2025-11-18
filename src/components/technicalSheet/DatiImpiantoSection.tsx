import { Control, Controller, useWatch } from 'react-hook-form'
import {
  TextField,
  Grid,
  Typography,
  Box,
  FormControl,
  FormLabel,
  FormHelperText,
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
}

/**
 * SEZIONE 2: DATI IMPIANTO
 * Informazioni sulla sala compressori e condizioni ambientali
 *
 * MODIFICHE:
 * - Aggiunto checkbox "Sede Imp. = Sede Legale"
 * - Campo "Sede Impianto" condizionale (autocomplete se diverso da sede legale)
 * - Aggiunto checkbox "Lontano da materiale infiammabile"
 * - Rinominato "Fonti di calore vicine" → "Fonti di calore / Materiali infiammabili vicini"
 */
export const DatiImpiantoSection = ({
  control,
  errors,
}: DatiImpiantoSectionProps) => {
  // Watch per logica condizionale
  const sedeImpUgualeLegale = useWatch({
    control,
    name: 'dati_impianto.sede_imp_uguale_legale',
    defaultValue: false,
  })

  const sedeLegale = useWatch({
    control,
    name: 'dati_generali.sede_legale',
    defaultValue: '',
  })

  const localeDedicato = useWatch({
    control,
    name: 'dati_impianto.locale_dedicato',
    defaultValue: false,
  })

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        2. Dati Impianto
      </Typography>

      <Grid container spacing={2}>
        {/* Checkbox: Sede Imp. = Sede Legale */}
        <Grid item xs={12}>
          <Controller
            name="dati_impianto.sede_imp_uguale_legale"
            control={control}
            defaultValue={false}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value || false}
                    onChange={(e) => {
                      field.onChange(e.target.checked)
                      // Se checked, copia automaticamente la sede legale
                      if (e.target.checked && sedeLegale) {
                        control._formValues.dati_impianto.sede_impianto = sedeLegale
                      }
                    }}
                  />
                }
                label="Sede Impianto = Sede Legale"
              />
            )}
          />
        </Grid>

        {/* Sede Impianto - Condizionale */}
        <Grid item xs={12}>
          {sedeImpUgualeLegale ? (
            // Se uguale a sede legale, mostra readonly
            <Controller
              name="dati_impianto.sede_impianto"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Sede Impianto"
                  fullWidth
                  value={sedeLegale}
                  disabled
                  helperText="Copiato automaticamente da Sede Legale"
                />
              )}
            />
          ) : (
            // Se diversa, mostra autocomplete
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

        {/* Indirizzo Impianto - DEPRECATED ma mantenuto */}
        <Grid item xs={12} md={6} sx={{ display: 'none' }}>
          <Controller
            name="dati_impianto.indirizzo_impianto"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Indirizzo Impianto (deprecated)"
                fullWidth
                disabled
              />
            )}
          />
        </Grid>

        {/* Denominazione Sala */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_impianto.denominazione_sala"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Denominazione Sala"
                fullWidth
                placeholder="Es: Sala compressori centrale"
              />
            )}
          />
        </Grid>

        {/* Locale Dedicato */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.locale_dedicato"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value || false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Locale Dedicato"
              />
            )}
          />
        </Grid>

        {/* Locale Condiviso Con - Visibile solo se locale_dedicato = false */}
        {!localeDedicato && (
          <Grid item xs={12} md={8}>
            <Controller
              name="dati_impianto.locale_condiviso_con"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Locale Condiviso Con"
                  fullWidth
                  placeholder="Specificare se il locale è condiviso"
                />
              )}
            />
          </Grid>
        )}

        {/* Aria Aspirata dai Compressori */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_impianto.aria_aspirata"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <FormControl fullWidth>
                <FormLabel>Aria Aspirata dai Compressori</FormLabel>
                <Select
                  {...field}
                  multiple
                  value={field.value || []}
                  input={<OutlinedInput />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {ARIA_ASPIRATA_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>

        {/* Raccolta Condense - OBBLIGATORIO */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_impianto.raccolta_condense"
            control={control}
            rules={{ required: 'Campo obbligatorio', validate: (value) => (value && value.length > 0) || 'Selezionare almeno un\'opzione' }}
            defaultValue={[]}
            render={({ field }) => (
              <FormControl fullWidth required error={!!errors?.dati_impianto?.raccolta_condense}>
                <FormLabel>Raccolta Condense *</FormLabel>
                <Select
                  {...field}
                  multiple
                  value={field.value || []}
                  input={<OutlinedInput />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {RACCOLTA_CONDENSE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
                {errors?.dati_impianto?.raccolta_condense && (
                  <FormHelperText>{errors.dati_impianto.raccolta_condense.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </Grid>

        {/* Accesso al Locale Vietato */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.accesso_locale_vietato"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value || false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Accesso al Locale Vietato"
              />
            )}
          />
        </Grid>

        {/* Lontano da Fonti di Calore */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.lontano_fonti_calore"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value || false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Lontano da Fonti di Calore"
              />
            )}
          />
        </Grid>

        {/* Lontano da Materiale Infiammabile - NUOVO */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.lontano_materiale_infiammabile"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={field.value || false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Lontano da Materiale Infiammabile"
              />
            )}
          />
        </Grid>

        {/* Fonti di Calore / Materiali Infiammabili Vicini - RINOMINATO */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_impianto.fonti_calore_materiali_infiammabili"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fonti di Calore / Materiali Infiammabili Vicini"
                fullWidth
                placeholder="Specificare eventuali fonti o materiali"
              />
            )}
          />
        </Grid>

        {/* Fonti di Calore Vicine - DEPRECATED nascosto */}
        <Grid item xs={12} md={4} sx={{ display: 'none' }}>
          <Controller
            name="dati_impianto.fonti_calore_vicine"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Fonti di Calore Vicine (deprecated)"
                fullWidth
                disabled
              />
            )}
          />
        </Grid>

        {/* Diametri Collegamenti in Sala */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_impianto.diametri_collegamenti_sala"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Diametri Collegamenti in Sala"
                fullWidth
                placeholder={'Es: 1/2", 3/4"'}
              />
            )}
          />
        </Grid>

        {/* Diametri Linee di Distribuzione */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_impianto.diametri_linee_distribuzione"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Diametri Linee di Distribuzione"
                fullWidth
                placeholder={'Es: 1", 1 1/4"'}
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
