import { Controller, Control } from 'react-hook-form'
import { Grid, TextField, Typography, Chip } from '@mui/material'
import { useNextCustomerCode } from '@/hooks/useCustomers'

interface CustomerFormFieldsProps {
  control: Control<any>
  errors: any
  showAllFields?: boolean
  highlightMissing?: boolean
  missingFields?: string[]
  readonlyFields?: string[]
}

/**
 * Reusable form fields component for customer data
 * Used in: AutocompleteField dialog, CompleteCustomerDataDialog, CustomersManagement
 */
export const CustomerFormFields = ({
  control,
  errors,
  showAllFields = true,
  highlightMissing = false,
  missingFields = [],
  readonlyFields = [],
}: CustomerFormFieldsProps) => {
  const isMissing = (field: string) => highlightMissing && missingFields.includes(field)
  const isReadonly = (field: string) => readonlyFields.includes(field)

  // Prossimo codice cliente disponibile (per l'hint sotto il campo Identificativo)
  const { data: nextCode } = useNextCustomerCode()
  const nextCodeLabel = nextCode != null ? String(nextCode).padStart(3, '0') : '…'

  // Helper to check if ANY address field is missing
  const hasAnyAddressMissing = () => {
    if (!highlightMissing || showAllFields) return false
    const addressFields = ['via', 'numero_civico', 'cap', 'comune', 'provincia']
    return addressFields.some(field => missingFields.includes(field))
  }

  const showAddressFields = showAllFields || hasAnyAddressMissing()

  // Helper to render missing badge
  const MissingBadge = () => (
    <Chip label="Mancante" color="warning" size="small" sx={{ ml: 1 }} />
  )

  return (
    <Grid container spacing={2}>
      {/* Ragione Sociale */}
      <Grid item xs={12}>
        <Controller
          name="ragione_sociale"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Ragione Sociale"
              fullWidth
              required
              disabled={isReadonly('ragione_sociale')}
              error={!!errors.ragione_sociale}
              helperText={errors.ragione_sociale?.message}
              InputProps={{
                endAdornment: isMissing('ragione_sociale') ? <MissingBadge /> : null,
              }}
            />
          )}
        />
      </Grid>

      {/* Identificativo (only if showAllFields or missing) */}
      {(showAllFields || isMissing('identificativo')) && (
        <Grid item xs={12} sm={6}>
          <Controller
            name="identificativo"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Identificativo"
                fullWidth
                disabled={isReadonly('identificativo')}
                error={!!errors.identificativo}
                helperText={
                  errors.identificativo?.message ||
                  (!field.value ? `Auto-generato se vuoto (prossimo numero disponibile: ${nextCodeLabel})` : undefined)
                }
                placeholder={nextCodeLabel}
                InputProps={{
                  endAdornment: isMissing('identificativo') ? <MissingBadge /> : null,
                }}
              />
            )}
          />
        </Grid>
      )}

      {/* Telefono */}
      {(showAllFields || isMissing('telefono')) && (
        <Grid item xs={12} sm={showAllFields ? 6 : 12}>
          <Controller
            name="telefono"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Telefono"
                fullWidth
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

      {/* PEC */}
      {(showAllFields || isMissing('pec')) && (
        <Grid item xs={12} sm={6}>
          <Controller
            name="pec"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="PEC"
                fullWidth
                type="email"
                disabled={isReadonly('pec')}
                error={!!errors.pec}
                helperText={errors.pec?.message}
                placeholder="info@example.pec.it"
                InputProps={{
                  endAdornment: isMissing('pec') ? <MissingBadge /> : null,
                }}
              />
            )}
          />
        </Grid>
      )}

      {/* Descrizione Attività */}
      {(showAllFields || isMissing('descrizione_attivita')) && (
        <Grid item xs={12}>
          <Controller
            name="descrizione_attivita"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descrizione Attività"
                fullWidth
                multiline
                rows={2}
                disabled={isReadonly('descrizione_attivita')}
                error={!!errors.descrizione_attivita}
                helperText={errors.descrizione_attivita?.message}
                placeholder="Descrizione dell'attività svolta dal cliente"
                InputProps={{
                  endAdornment: isMissing('descrizione_attivita') ? <MissingBadge /> : null,
                }}
              />
            )}
          />
        </Grid>
      )}

      {/* Sede Legale Section Header */}
      {showAddressFields && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Sede Legale
          </Typography>
        </Grid>
      )}

      {/* Via */}
      {showAddressFields && (
        <Grid item xs={12} sm={8}>
          <Controller
            name="via"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Via"
                fullWidth
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
      {showAddressFields && (
        <Grid item xs={12} sm={4}>
          <Controller
            name="numero_civico"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Numero Civico"
                fullWidth
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
      {showAddressFields && (
        <Grid item xs={12} sm={3}>
          <Controller
            name="cap"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="CAP"
                fullWidth
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
      {showAddressFields && (
        <Grid item xs={12} sm={6}>
          <Controller
            name="comune"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Comune"
                fullWidth
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
      {showAddressFields && (
        <Grid item xs={12} sm={3}>
          <Controller
            name="provincia"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Provincia"
                fullWidth
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
    </Grid>
  )
}
