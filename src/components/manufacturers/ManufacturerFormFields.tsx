/**
 * Manufacturer Form Fields Component
 *
 * Componente riutilizzabile per form dati costruttore.
 * Logica discriminata: checkbox is_estero determina quali campi mostrare.
 * Pattern identico a CustomerFormFields.tsx
 */

import { Controller, Control, useWatch } from 'react-hook-form'
import { Grid, TextField, Typography, Chip, FormControlLabel, Checkbox } from '@mui/material'

interface ManufacturerFormFieldsProps {
  control: Control<any>
  errors: any
  showAllFields?: boolean
  highlightMissing?: boolean
  missingFields?: string[]
  readonlyFields?: string[]
}

/**
 * Reusable form fields component for manufacturer data
 * Used in: CompleteManufacturerDataDialog, ManufacturersManagement
 */
export const ManufacturerFormFields = ({
  control,
  errors,
  showAllFields = true,
  highlightMissing = false,
  missingFields = [],
  readonlyFields = [],
}: ManufacturerFormFieldsProps) => {
  // Watch is_estero value to conditionally render fields
  const isEstero = useWatch({ control, name: 'is_estero', defaultValue: false })

  const isMissing = (field: string) => highlightMissing && missingFields.includes(field)
  const isReadonly = (field: string) => readonlyFields.includes(field)

  // Helper to render missing badge
  const MissingBadge = () => (
    <Chip label="Mancante" color="warning" size="small" sx={{ ml: 1 }} />
  )

  return (
    <Grid container spacing={2}>
      {/* Nome Costruttore */}
      <Grid item xs={12}>
        <Controller
          name="nome"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Nome Costruttore"
              fullWidth
              required
              disabled={isReadonly('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              placeholder="es: FIAT, Bosch, Siemens"
              InputProps={{
                endAdornment: isMissing('nome') ? <MissingBadge /> : null,
              }}
            />
          )}
        />
      </Grid>

      {/* Checkbox: Costruttore Estero */}
      <Grid item xs={12}>
        <Controller
          name="is_estero"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Checkbox
                  checked={field.value || false}
                  onChange={(e) => {
                    field.onChange(e.target.checked)
                    // Reset campi opposti quando si cambia tipo
                    // Non fare nulla qui - lasciare che la validazione Zod gestisca
                  }}
                  disabled={isReadonly('is_estero')}
                />
              }
              label={
                <Typography variant="body2">
                  Costruttore estero
                  <Typography variant="caption" display="block" color="text.secondary">
                    {isEstero
                      ? 'Richiede solo il paese di provenienza'
                      : 'Richiede P.IVA, telefono e indirizzo completo'}
                  </Typography>
                </Typography>
              }
            />
          )}
        />
      </Grid>

      {/* ============================================ */}
      {/* COSTRUTTORE ESTERO - Solo campo Paese */}
      {/* ============================================ */}
      {isEstero && (
        <Grid item xs={12}>
          <Controller
            name="paese"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Paese"
                fullWidth
                required
                disabled={isReadonly('paese')}
                error={!!errors.paese}
                helperText={errors.paese?.message}
                placeholder="es: Germania, Francia, Stati Uniti"
                InputProps={{
                  endAdornment: isMissing('paese') ? <MissingBadge /> : null,
                }}
              />
            )}
          />
        </Grid>
      )}

      {/* ============================================ */}
      {/* COSTRUTTORE ITALIANO - Tutti i campi */}
      {/* ============================================ */}
      {!isEstero && (
        <>
          {/* Partita IVA */}
          {(showAllFields || isMissing('partita_iva')) && (
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
                    disabled={isReadonly('partita_iva')}
                    error={!!errors.partita_iva}
                    helperText={errors.partita_iva?.message || '11 cifre numeriche'}
                    placeholder="12345678901"
                    inputProps={{ maxLength: 11 }}
                    InputProps={{
                      endAdornment: isMissing('partita_iva') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Telefono */}
          {(showAllFields || isMissing('telefono')) && (
            <Grid item xs={12} sm={6}>
              <Controller
                name="telefono"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Telefono"
                    fullWidth
                    required
                    disabled={isReadonly('telefono')}
                    error={!!errors.telefono}
                    helperText={errors.telefono?.message}
                    placeholder="+39 02 1234567"
                    InputProps={{
                      endAdornment: isMissing('telefono') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Indirizzo Section Header */}
          {(showAllFields ||
            isMissing('via') ||
            isMissing('numero_civico') ||
            isMissing('cap') ||
            isMissing('comune') ||
            isMissing('provincia')) && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Sede / Indirizzo
              </Typography>
            </Grid>
          )}

          {/* Via */}
          {(showAllFields || isMissing('via')) && (
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
                    disabled={isReadonly('via')}
                    error={!!errors.via}
                    helperText={errors.via?.message}
                    placeholder="Via Roma"
                    InputProps={{
                      endAdornment: isMissing('via') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Numero Civico */}
          {(showAllFields || isMissing('numero_civico')) && (
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
                    disabled={isReadonly('numero_civico')}
                    error={!!errors.numero_civico}
                    helperText={errors.numero_civico?.message}
                    placeholder="123"
                    InputProps={{
                      endAdornment: isMissing('numero_civico') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* CAP */}
          {(showAllFields || isMissing('cap')) && (
            <Grid item xs={12} sm={3}>
              <Controller
                name="cap"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="CAP"
                    fullWidth
                    required
                    disabled={isReadonly('cap')}
                    error={!!errors.cap}
                    helperText={errors.cap?.message}
                    placeholder="20100"
                    inputProps={{ maxLength: 5 }}
                    InputProps={{
                      endAdornment: isMissing('cap') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Comune */}
          {(showAllFields || isMissing('comune')) && (
            <Grid item xs={12} sm={6}>
              <Controller
                name="comune"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Comune"
                    fullWidth
                    required
                    disabled={isReadonly('comune')}
                    error={!!errors.comune}
                    helperText={errors.comune?.message}
                    placeholder="Milano"
                    InputProps={{
                      endAdornment: isMissing('comune') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Provincia */}
          {(showAllFields || isMissing('provincia')) && (
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
                    disabled={isReadonly('provincia')}
                    error={!!errors.provincia}
                    helperText={errors.provincia?.message}
                    placeholder="MI"
                    inputProps={{
                      maxLength: 2,
                      style: { textTransform: 'uppercase' },
                    }}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    InputProps={{
                      endAdornment: isMissing('provincia') ? <MissingBadge /> : null,
                    }}
                  />
                )}
              />
            </Grid>
          )}
        </>
      )}
    </Grid>
  )
}
