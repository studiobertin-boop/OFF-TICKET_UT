import { Control, Controller } from 'react-hook-form'
import { TextField, Grid, Typography, Box, Divider } from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import type { ReactNode } from 'react'
import { EquipmentAutocomplete } from './EquipmentAutocomplete'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'

interface ValvolaSicurezzaFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  codiceValvola: string
  renderOCRButton?: ReactNode // Pulsante OCR opzionale
}

/**
 * Campi per Valvola di Sicurezza
 * Obbligatoria per serbatoi e disoleatori
 *
 * MODIFICHE:
 * - Aggiunto campo "Anno"
 * - Rinominato "Pressione" → "Pressione di Taratura" (pressione_taratura)
 * - Aggiunto "TS - Temperatura" (ts_temperatura) - NON visibile a tecnicoDM329
 * - Aggiunto "Volume aria scaricato" (volume_aria_scaricato) - NON visibile a tecnicoDM329
 * - Aggiunto "Categoria PED" (readonly "IV") - NON visibile a tecnicoDM329
 */
export const ValvolaSicurezzaFields = ({
  control,
  basePath,
  errors,
  codiceValvola,
  renderOCRButton,
}: ValvolaSicurezzaFieldsProps) => {
  const { showAdvancedFields } = useTecnicoDM329Visibility()

  const getError = (fieldName: string) => {
    const parts = `${basePath}.valvola_sicurezza.${fieldName}`.split('.')
    let error = errors
    for (const part of parts) {
      if (!error) return undefined
      error = error[part]
    }
    return error
  }

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningIcon fontSize="small" />
        <Typography variant="subtitle2" fontWeight="bold">
          Valvola di Sicurezza {codiceValvola} (OBBLIGATORIA)
        </Typography>
        {renderOCRButton && (
          <Box sx={{ ml: 'auto' }}>
            {renderOCRButton}
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        {/* Marca e Modello con Autocomplete */}
        <Grid item xs={12}>
          <Controller
            name={`${basePath}.valvola_sicurezza.marca`}
            control={control}
            render={({ field: marcaField }) => (
              <Controller
                name={`${basePath}.valvola_sicurezza.modello`}
                control={control}
                render={({ field: modelloField }) => (
                  <EquipmentAutocomplete
                    equipmentType="Valvole di sicurezza"
                    marcaValue={marcaField.value || ''}
                    modelloValue={modelloField.value || ''}
                    onMarcaChange={marcaField.onChange}
                    onModelloChange={modelloField.onChange}
                    size="small"
                    fullWidth
                  />
                )}
              />
            )}
          />
        </Grid>

        {/* N° Fabbrica */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.valvola_sicurezza.n_fabbrica`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="N° Fabbrica Valvola"
                fullWidth
                size="small"
                error={!!getError('n_fabbrica')}
                helperText={getError('n_fabbrica')?.message || 'Compilabile da OCR'}
                placeholder="Numero seriale valvola"
              />
            )}
          />
        </Grid>

        {/* Anno - NUOVO */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.valvola_sicurezza.anno`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Anno"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1980, max: 2100, step: 1 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                error={!!getError('anno')}
                helperText={getError('anno')?.message || 'Anno di fabbricazione'}
                placeholder="Es: 2020"
              />
            )}
          />
        </Grid>

        {/* Diametro */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.valvola_sicurezza.diametro`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Diametro"
                fullWidth
                size="small"
                error={!!getError('diametro')}
                helperText={getError('diametro')?.message || 'Es: 1/2", 3/4"'}
                placeholder='Es: 1/2", 3/4"'
              />
            )}
          />
        </Grid>

        {/* Pressione di Taratura - RINOMINATO */}
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.valvola_sicurezza.pressione_taratura`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Ptar - Pressione di Taratura (bar)"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 0, max: 100000, step: 0.1 }}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                error={!!getError('pressione_taratura') || !!getError('pressione')}
                helperText={getError('pressione_taratura')?.message || 'Da 0 a 100.000 bar (1 decimale)'}
              />
            )}
          />
        </Grid>

        {/* Pressione - DEPRECATED nascosto */}
        <Grid item xs={12} md={6} sx={{ display: 'none' }}>
          <Controller
            name={`${basePath}.valvola_sicurezza.pressione`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Pressione (deprecated)"
                fullWidth
                size="small"
                disabled
              />
            )}
          />
        </Grid>

        {/* TS - Temperatura - NUOVO - NASCOSTO a tecnicoDM329 */}
        {showAdvancedFields && (
          <Grid item xs={12} md={6}>
            <Controller
              name={`${basePath}.valvola_sicurezza.ts_temperatura`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="TS - Temperatura massima (°C)"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 50, max: 250, step: 1 }}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  error={!!getError('ts_temperatura')}
                  helperText={getError('ts_temperatura')?.message || 'Intero da 50 a 250 °C'}
                />
              )}
            />
          </Grid>
        )}

        {/* Temperatura massima ammissibile - DEPRECATED nascosto */}
        <Grid item xs={12} md={6} sx={{ display: 'none' }}>
          <Controller
            name={`${basePath}.valvola_sicurezza.temperatura_max`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Temperatura max (deprecated)"
                fullWidth
                size="small"
                disabled
              />
            )}
          />
        </Grid>

        {/* Volume aria scaricato - NUOVO - NASCOSTO a tecnicoDM329 */}
        {showAdvancedFields && (
          <Grid item xs={12} md={6}>
            <Controller
              name={`${basePath}.valvola_sicurezza.volume_aria_scaricato`}
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Qmax - Volume aria scaricato (l/min)"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 100, max: 100000, step: 1 }}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  error={!!getError('volume_aria_scaricato')}
                  helperText={getError('volume_aria_scaricato')?.message || 'Intero da 100 a 100.000 l/min'}
                />
              )}
            />
          </Grid>
        )}

        {/* Portata massima - DEPRECATED nascosto */}
        <Grid item xs={12} md={6} sx={{ display: 'none' }}>
          <Controller
            name={`${basePath}.valvola_sicurezza.portata_max`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Portata max (deprecated)"
                fullWidth
                size="small"
                disabled
              />
            )}
          />
        </Grid>

        {/* Categoria PED - NUOVO - readonly "IV" - NASCOSTO a tecnicoDM329 */}
        {showAdvancedFields && (
          <Grid item xs={12} md={6}>
            <Controller
              name={`${basePath}.valvola_sicurezza.categoria_ped`}
              control={control}
              defaultValue="IV"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Categoria PED"
                  fullWidth
                  size="small"
                  value="IV"
                  disabled
                  helperText="Categoria PED sempre IV per valvole di sicurezza"
                />
              )}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
