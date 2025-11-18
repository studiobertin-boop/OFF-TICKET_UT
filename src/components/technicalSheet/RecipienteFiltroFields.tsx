import { Control, Controller } from 'react-hook-form'
import { TextField, Grid, Typography, Box, Divider, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import type { ReactNode } from 'react'
import { EquipmentAutocomplete } from './EquipmentAutocomplete'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import type { CategoriaPED } from '@/types'

interface RecipienteFiltroFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  codiceRecipiente: string
  filtroAssociato: string
  renderOCRButton?: ReactNode // Pulsante OCR opzionale
}

const CATEGORIA_PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

/**
 * Campi per Recipiente Filtro
 * Dipendente da Filtro (max 1 per filtro)
 *
 * TUTTI I CAMPI NASCOSTI A tecnicoDM329
 *
 * CAMPI:
 * - Marca/Modello (autocomplete)
 * - N° Fabbrica
 * - Anno
 * - PS - Pressione Massima (3.0-50.0 bar)
 * - TS - Temperatura Massima (50-250 °C)
 * - Volume (50-5000 litri)
 * - Categoria PED (I/II/III/IV)
 */
export const RecipienteFiltroFields = ({
  control,
  basePath,
  errors,
  codiceRecipiente,
  filtroAssociato,
  renderOCRButton,
}: RecipienteFiltroFieldsProps) => {
  const { showRecipienteFiltro } = useTecnicoDM329Visibility()

  const getError = (fieldName: string) => {
    const parts = `${basePath}.${fieldName}`.split('.')
    let error = errors
    for (const part of parts) {
      if (!error) return undefined
      error = error[part]
    }
    return error
  }

  // Se tecnicoDM329, non mostrare nulla
  if (!showRecipienteFiltro) {
    return null
  }

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.dark', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningIcon fontSize="small" />
        <Typography variant="subtitle2" fontWeight="bold">
          Recipiente Filtro {codiceRecipiente} - Associato a {filtroAssociato}
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
            name={`${basePath}.marca`}
            control={control}
            render={({ field: marcaField }) => (
              <Controller
                name={`${basePath}.modello`}
                control={control}
                render={({ field: modelloField }) => (
                  <EquipmentAutocomplete
                    equipmentType="Recipienti filtro"
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
            name={`${basePath}.n_fabbrica`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="N° Fabbrica"
                fullWidth
                size="small"
                error={!!getError('n_fabbrica')}
                helperText={getError('n_fabbrica')?.message || 'Compilabile da OCR'}
                placeholder="Numero seriale"
              />
            )}
          />
        </Grid>

        {/* Anno */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.anno`}
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

        {/* PS - Pressione Massima */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.ps_pressione_max`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="PS - Pressione Massima (bar)"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 3.0, max: 50.0, step: 0.1 }}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                error={!!getError('ps_pressione_max')}
                helperText={getError('ps_pressione_max')?.message || 'Da 3.0 a 50.0 bar (1 decimale)'}
                placeholder="Es: 12.5"
              />
            )}
          />
        </Grid>

        {/* TS - Temperatura Massima */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.ts_temperatura`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="TS - Temperatura Massima (°C)"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 50, max: 250, step: 1 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                error={!!getError('ts_temperatura')}
                helperText={getError('ts_temperatura')?.message || 'Intero da 50 a 250 °C'}
                placeholder="Es: 120"
              />
            )}
          />
        </Grid>

        {/* Volume */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.volume`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="V - Volume (litri)"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 50, max: 5000, step: 1 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                error={!!getError('volume')}
                helperText={getError('volume')?.message || 'Intero da 50 a 5.000 litri'}
                placeholder="Es: 500"
              />
            )}
          />
        </Grid>

        {/* Categoria PED */}
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.categoria_ped`}
            control={control}
            render={({ field }) => (
              <FormControl fullWidth size="small" error={!!getError('categoria_ped')}>
                <InputLabel>Categoria PED</InputLabel>
                <Select
                  {...field}
                  label="Categoria PED"
                  value={field.value || ''}
                >
                  <MenuItem value=""><em>Nessuna</em></MenuItem>
                  {CATEGORIA_PED_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
