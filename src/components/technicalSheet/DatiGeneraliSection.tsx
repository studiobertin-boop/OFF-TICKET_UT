import { Control, Controller } from 'react-hook-form'
import {
  TextField,
  Grid,
  Typography,
  Box,
} from '@mui/material'
import { AddressAutocompleteField } from '@/components/requests/AddressAutocompleteField'

interface DatiGeneraliSectionProps {
  control: Control<any>
  errors: any
  defaultCustomer?: string
}

/**
 * SEZIONE 1: DATI GENERALI
 * - Data sopralluogo (obbligatorio)
 * - Nome tecnico (obbligatorio)
 * - Cliente (obbligatorio, suggerimento da DB)
 * - Sede legale (obbligatorio, autocomplete OpenStreetMap)
 * - Note generali (opzionale)
 */
export const DatiGeneraliSection = ({
  control,
  errors,
  defaultCustomer,
}: DatiGeneraliSectionProps) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        1. Dati Generali
      </Typography>

      <Grid container spacing={2}>
        {/* Data Sopralluogo */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_generali.data_sopralluogo"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Data Sopralluogo"
                type="date"
                fullWidth
                required
                error={!!errors?.dati_generali?.data_sopralluogo}
                helperText={errors?.dati_generali?.data_sopralluogo?.message}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            )}
          />
        </Grid>

        {/* Nome Tecnico */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_generali.nome_tecnico"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome Tecnico"
                fullWidth
                required
                error={!!errors?.dati_generali?.nome_tecnico}
                helperText={errors?.dati_generali?.nome_tecnico?.message}
                placeholder="Nome e cognome del tecnico"
              />
            )}
          />
        </Grid>

        {/* Cliente */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_generali.cliente"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            defaultValue={defaultCustomer || ''}
            render={({ field }) => (
              <TextField
                {...field}
                label="Cliente"
                fullWidth
                required
                error={!!errors?.dati_generali?.cliente}
                helperText={errors?.dati_generali?.cliente?.message}
                placeholder="Ragione sociale cliente"
              />
            )}
          />
        </Grid>

        {/* Sede Legale */}
        <Grid item xs={12}>
          <AddressAutocompleteField
            field={{
              name: 'dati_generali.sede_legale',
              label: 'Sede Legale',
              type: 'address-autocomplete',
              required: true,
              placeholder: 'Via, Città, CAP...',
            }}
            control={control}
            error={errors?.dati_generali?.sede_legale}
          />
        </Grid>

        {/* Note Generali */}
        <Grid item xs={12}>
          <Controller
            name="dati_generali.note_generali"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Note Generali"
                fullWidth
                multiline
                rows={3}
                error={!!errors?.dati_generali?.note_generali}
                helperText={errors?.dati_generali?.note_generali?.message}
                placeholder="Note aggiuntive sul sopralluogo..."
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
