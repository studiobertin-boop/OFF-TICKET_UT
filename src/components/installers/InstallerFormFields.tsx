/**
 * Installer Form Fields Component
 *
 * Campi form riutilizzabili per creazione/modifica installatori
 * Solo campi italiani (più semplice dei manufacturers)
 */

import { Controller, Control, FieldErrors } from 'react-hook-form'
import { Grid, TextField, Typography } from '@mui/material'

interface InstallerFormFieldsProps {
  control: Control<any>
  errors: FieldErrors
  showAllFields?: boolean
}

export const InstallerFormFields = ({
  control,
  errors,
  showAllFields = true,
}: InstallerFormFieldsProps) => {
  return (
    <Grid container spacing={2}>
      {/* Nome */}
      <Grid item xs={12}>
        <Controller
          name="nome"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nome Installatore"
              fullWidth
              required
              error={!!errors.nome}
              helperText={errors.nome?.message as string}
              placeholder="es. OFFICINA DEL COMPRESSORE S.R.L."
            />
          )}
        />
      </Grid>

      {/* Partita IVA */}
      <Grid item xs={12} sm={6}>
        <Controller
          name="partita_iva"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Partita IVA"
              fullWidth
              required
              error={!!errors.partita_iva}
              helperText={
                (errors.partita_iva?.message as string) ||
                '11 cifre numeriche (viene fatto padding automatico se 10 cifre)'
              }
              placeholder="03166570261"
              inputProps={{ maxLength: 11 }}
            />
          )}
        />
      </Grid>

      {/* Spacer se non mostriamo tutti i campi */}
      {!showAllFields && <Grid item xs={12} sm={6} />}

      {showAllFields && (
        <>
          {/* Sezione Indirizzo */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              Sede / Indirizzo
            </Typography>
          </Grid>

          {/* Via */}
          <Grid item xs={12} sm={8}>
            <Controller
              name="via"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Via"
                  fullWidth
                  required
                  error={!!errors.via}
                  helperText={errors.via?.message as string}
                  placeholder="es. Via G. Di Vittorio"
                />
              )}
            />
          </Grid>

          {/* Numero Civico */}
          <Grid item xs={12} sm={4}>
            <Controller
              name="numero_civico"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Numero Civico"
                  fullWidth
                  required
                  error={!!errors.numero_civico}
                  helperText={errors.numero_civico?.message as string}
                  placeholder="11"
                />
              )}
            />
          </Grid>

          {/* CAP */}
          <Grid item xs={12} sm={4}>
            <Controller
              name="cap"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="CAP"
                  fullWidth
                  required
                  error={!!errors.cap}
                  helperText={
                    (errors.cap?.message as string) || '5 cifre (viene fatto padding automatico)'
                  }
                  placeholder="31038"
                  inputProps={{ maxLength: 5 }}
                />
              )}
            />
          </Grid>

          {/* Comune */}
          <Grid item xs={12} sm={5}>
            <Controller
              name="comune"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Comune"
                  fullWidth
                  required
                  error={!!errors.comune}
                  helperText={errors.comune?.message as string}
                  placeholder="Paese"
                />
              )}
            />
          </Grid>

          {/* Provincia */}
          <Grid item xs={12} sm={3}>
            <Controller
              name="provincia"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Provincia"
                  fullWidth
                  required
                  error={!!errors.provincia}
                  helperText={
                    (errors.provincia?.message as string) ||
                    '2 lettere (es. TV, RO, PD)'
                  }
                  placeholder="TV"
                  inputProps={{
                    maxLength: 2,
                    style: { textTransform: 'uppercase' },
                  }}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
          </Grid>
        </>
      )}
    </Grid>
  )
}
