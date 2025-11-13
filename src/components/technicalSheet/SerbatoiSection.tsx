import { Control, Controller, useFieldArray } from 'react-hook-form'
import { Grid, TextField, FormControlLabel, Checkbox, Typography, Divider } from '@mui/material'
import { EquipmentSection } from './EquipmentSection'
import { CommonEquipmentFields } from './CommonEquipmentFields'
import { ValvolaSicurezzaFields } from './ValvolaSicurezzaFields'
import { EQUIPMENT_LIMITS, generateEquipmentCode } from '@/types'

interface SerbatoiSectionProps {
  control: Control<any>
  errors: any
}

export const SerbatoiSection = ({ control, errors }: SerbatoiSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'serbatoi',
  })

  const handleAdd = () => {
    const newIndex = fields.length + 1
    append({
      codice: generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, newIndex),
      valvola_sicurezza: {}, // Obbligatoria
      manometro: {},
    })
  }

  return (
    <EquipmentSection
      title="3. Serbatoi"
      subtitle="Massimo 7 serbatoi (S1-S7). Ogni serbatoio DEVE avere una valvola di sicurezza."
      items={fields}
      maxItems={EQUIPMENT_LIMITS.serbatoi.max}
      minItems={EQUIPMENT_LIMITS.serbatoi.min}
      onAdd={handleAdd}
      onRemove={remove}
      generateCode={(index) => generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, index + 1)}
      itemTypeName="serbatoio"
      renderItem={(item, index) => (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <CommonEquipmentFields
              control={control}
              basePath={`serbatoi.${index}`}
              errors={errors}
              fields={{
                marca: true,
                modello: true,
                n_fabbrica: true,
                anno: true,
                volume: true,
                note: true,
              }}
            />
          </Grid>

          {/* Finitura Interna */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.finitura_interna`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Finitura Interna"
                  fullWidth
                  placeholder="Es: Zincato, Verniciato..."
                />
              )}
            />
          </Grid>

          {/* Ancorato a Terra */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.ancorato_terra`}
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Ancorato a Terra"
                />
              )}
            />
          </Grid>

          {/* Scarico */}
          <Grid item xs={12} md={4}>
            <Controller
              name={`serbatoi.${index}.scarico`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Scarico"
                  fullWidth
                  placeholder="Es: Manuale, Automatico..."
                />
              )}
            />
          </Grid>

          {/* Valvola di Sicurezza - OBBLIGATORIA */}
          <Grid item xs={12}>
            <ValvolaSicurezzaFields
              control={control}
              basePath={`serbatoi.${index}`}
              errors={errors}
              codiceValvola={`S${index + 1}.1`}
            />
          </Grid>

          {/* Manometro */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Manometro
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Controller
                  name={`serbatoi.${index}.manometro.fondo_scala`}
                  control={control}
                  rules={{
                    min: { value: 10, message: 'Min 10 bar' },
                    max: { value: 30, message: 'Max 30 bar' },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Fondo Scala (BAR)"
                      type="number"
                      fullWidth
                      size="small"
                      placeholder="Es: 16"
                      inputProps={{ min: 10, max: 30, step: 0.1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name={`serbatoi.${index}.manometro.segno_rosso`}
                  control={control}
                  rules={{
                    min: { value: 10, message: 'Min 10 bar' },
                    max: { value: 30, message: 'Max 30 bar' },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Segno Rosso (BAR)"
                      type="number"
                      fullWidth
                      size="small"
                      placeholder="Es: 13"
                      inputProps={{ min: 10, max: 30, step: 0.1 }}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )}
    />
  )
}
