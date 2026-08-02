import { Controller, type Control, type FieldErrors, type FieldValues } from 'react-hook-form'
import { Autocomplete, Divider, Grid, MenuItem, TextField, Typography } from '@mui/material'
import type { EquipmentCatalogType } from '@/types'
import { EQUIPMENT_CATALOG_TYPES } from '@/utils/equipmentCatalogValidation'
import { EquipmentSpecsFields } from './EquipmentSpecsFields'

interface EquipmentFormFieldsProps {
  control: Control<FieldValues>
  errors: FieldErrors
  /** Tipo attualmente selezionato: determina i campi dei dati tecnici. */
  tipo: EquipmentCatalogType | null
  /** Marche già presenti a catalogo, per non riscriverle a mano ogni volta. */
  marche: string[]
  /** In modifica il tipo resta bloccato: cambiarlo cambierebbe il significato dei dati tecnici. */
  tipoBloccato?: boolean
}

export const EquipmentFormFields = ({
  control,
  errors,
  tipo,
  marche,
  tipoBloccato = false,
}: EquipmentFormFieldsProps) => (
  <Grid container spacing={2}>
    <Grid item xs={12} sm={6}>
      <Controller
        name="tipo_apparecchiatura"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            fullWidth
            size="small"
            label="Tipo"
            value={field.value ?? ''}
            disabled={tipoBloccato}
            error={Boolean(errors.tipo_apparecchiatura)}
            helperText={
              (errors.tipo_apparecchiatura?.message as string | undefined) ??
              (tipoBloccato
                ? 'Il tipo determina il significato dei dati tecnici e non si cambia'
                : ' ')
            }
          >
            {EQUIPMENT_CATALOG_TYPES.map(t => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </Grid>

    <Grid item xs={12} sm={6}>
      <Controller
        name="marca"
        control={control}
        render={({ field }) => (
          <Autocomplete
            freeSolo
            options={marche}
            value={field.value ?? ''}
            onChange={(_e, v) => field.onChange(v ?? '')}
            onInputChange={(_e, v) => field.onChange(v)}
            renderInput={params => (
              <TextField
                {...params}
                size="small"
                label="Marca"
                error={Boolean(errors.marca)}
                helperText={(errors.marca?.message as string | undefined) ?? ' '}
              />
            )}
          />
        )}
      />
    </Grid>

    <Grid item xs={12}>
      <Controller
        name="modello"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            size="small"
            label="Modello"
            value={field.value ?? ''}
            error={Boolean(errors.modello)}
            helperText={
              (errors.modello?.message as string | undefined) ??
              'Senza la pressione: quella va nei dati tecnici qui sotto'
            }
          />
        )}
      />
    </Grid>

    <Grid item xs={12}>
      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Dati tecnici
      </Typography>
      <EquipmentSpecsFields control={control} errors={errors} tipo={tipo} />
    </Grid>
  </Grid>
)
