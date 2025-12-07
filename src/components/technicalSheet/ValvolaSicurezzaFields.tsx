import { Control, Controller, useFormContext } from 'react-hook-form'
import { TextField, Grid, Typography, Box, Divider } from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import type { ReactNode } from 'react'
import { EquipmentAutocompleteWithPressure } from './EquipmentAutocompleteWithPressure'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'

interface ValvolaSicurezzaFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  codiceValvola: string
  renderOCRButton?: ReactNode // Pulsante OCR opzionale
  bgColor?: string // Colore di sfondo personalizzato
}

/**
 * Campi per Valvola di Sicurezza
 * Obbligatoria per serbatoi e disoleatori
 *
 * AUTOCOMPLETAMENTO:
 * - Seleziona MARCA + MODELLO + PTAR → autocompleta TS, QMAX, DIAMETRO
 *
 * MODIFICHE:
 * - Aggiunto campo "Anno"
 * - Rinominato "Pressione" → "Pressione di Taratura" (pressione_taratura)
 * - Aggiunto "TS - Temperatura" (ts_temperatura) - NON visibile a tecnicoDM329
 * - Aggiunto "Volume aria scaricato" (volume_aria_scaricato) - NON visibile a tecnicoDM329
 * - Aggiunto "Categoria PED" (readonly "IV") - NON visibile a tecnicoDM329
 * - Integrato EquipmentAutocompleteWithPressure per autocompletamento 3-step
 */
export const ValvolaSicurezzaFields = ({
  control,
  basePath,
  errors,
  codiceValvola,
  renderOCRButton,
  bgColor = 'rgba(255, 235, 132, 0.50)', // Default giallo più carico
}: ValvolaSicurezzaFieldsProps) => {
  const { showAdvancedFields } = useTecnicoDM329Visibility()
  const { setValue } = useFormContext()

  // Handler per popolare campi quando viene selezionata apparecchiatura dal catalogo
  const handleEquipmentSelected = (specs: Record<string, any>) => {
    console.log('📦 Valvola: Populating fields from specs:', specs)

    // TS - Temperatura
    if (specs.ts !== undefined) {
      setValue(`${basePath}.valvola_sicurezza.ts_temperatura`, specs.ts)
    }

    // QMAX - Volume aria scaricato
    if (specs.qmax !== undefined) {
      setValue(`${basePath}.valvola_sicurezza.volume_aria_scaricato`, specs.qmax)
    }

    // DIAMETRO
    if (specs.diametro !== undefined) {
      setValue(`${basePath}.valvola_sicurezza.diametro`, specs.diametro)
    }

    console.log('✅ Valvola: Fields populated from catalog')
  }

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
    <Box sx={{ mt: 2, p: 2, bgcolor: bgColor, borderRadius: 1 }}>
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
        {/* Marca, Modello e Ptar con Autocomplete 3-step */}
        <Grid item xs={12}>
          <Controller
            name={`${basePath}.valvola_sicurezza.marca`}
            control={control}
            render={({ field: marcaField }) => (
              <Controller
                name={`${basePath}.valvola_sicurezza.modello`}
                control={control}
                render={({ field: modelloField }) => (
                  <Controller
                    name={`${basePath}.valvola_sicurezza.pressione_taratura`}
                    control={control}
                    render={({ field: ptarField }) => (
                      <EquipmentAutocompleteWithPressure
                        equipmentType="Valvole di sicurezza"
                        marcaValue={marcaField.value || ''}
                        modelloValue={modelloField.value || ''}
                        pressioneValue={ptarField.value}
                        onMarcaChange={marcaField.onChange}
                        onModelloChange={modelloField.onChange}
                        onPressioneChange={ptarField.onChange}
                        onEquipmentSelected={handleEquipmentSelected}
                        pressioneLabel="Ptar (bar)"
                        pressioneField="ptar"
                        size="small"
                        fullWidth
                      />
                    )}
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

        {/* Diametro - Autocompletato dal catalogo */}
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
                helperText={getError('diametro')?.message || 'Autocompletato o Es: 1/2", 3/4"'}
                placeholder='Es: 1/2", 3/4"'
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
