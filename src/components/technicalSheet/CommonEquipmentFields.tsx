import { Control, Controller } from 'react-hook-form'
import { TextField, Grid } from '@mui/material'

interface CommonEquipmentFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  fields?: {
    marca?: boolean
    modello?: boolean
    n_fabbrica?: boolean
    materiale_n?: boolean
    anno?: boolean
    pressione_max?: boolean
    volume?: boolean
    note?: boolean
  }
}

/**
 * Campi comuni per apparecchiature
 * Riutilizzabile tra serbatoi, compressori, essiccatori, etc.
 */
export const CommonEquipmentFields = ({
  control,
  basePath,
  errors,
  fields = {},
}: CommonEquipmentFieldsProps) => {
  const {
    marca = true,
    modello = true,
    n_fabbrica = true,
    materiale_n = false,
    anno = true,
    pressione_max = false,
    volume = false,
    note = false,
  } = fields

  // Helper per ottenere error path annidato
  const getError = (fieldName: string) => {
    const parts = `${basePath}.${fieldName}`.split('.')
    let error = errors
    for (const part of parts) {
      if (!error) return undefined
      error = error[part]
    }
    return error
  }

  return (
    <Grid container spacing={2}>
      {/* Marca */}
      {marca && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.marca`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Marca"
                fullWidth
                error={!!getError('marca')}
                helperText={getError('marca')?.message || 'Compilabile da OCR'}
                placeholder="Es: Atlas Copco, Kaeser..."
              />
            )}
          />
        </Grid>
      )}

      {/* Modello */}
      {modello && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.modello`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Modello"
                fullWidth
                error={!!getError('modello')}
                helperText={getError('modello')?.message || 'Compilabile da OCR'}
                placeholder="Es: GA 30, BSD 72..."
              />
            )}
          />
        </Grid>
      )}

      {/* N° di Fabbrica */}
      {n_fabbrica && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.n_fabbrica`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="N° di Fabbrica / Matricola"
                fullWidth
                error={!!getError('n_fabbrica')}
                helperText={getError('n_fabbrica')?.message || 'Compilabile da OCR'}
                placeholder="Numero seriale"
              />
            )}
          />
        </Grid>
      )}

      {/* Materiale N° (solo compressori) */}
      {materiale_n && (
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.materiale_n`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Materiale N°"
                fullWidth
                error={!!getError('materiale_n')}
                helperText={getError('materiale_n')?.message || 'Compilabile da OCR'}
                placeholder="Numero materiale"
              />
            )}
          />
        </Grid>
      )}

      {/* Anno */}
      {anno && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.anno`}
            control={control}
            rules={{
              min: { value: 1980, message: 'Anno minimo: 1980' },
              max: { value: 2100, message: 'Anno massimo: 2100' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Anno"
                type="number"
                fullWidth
                error={!!getError('anno')}
                helperText={getError('anno')?.message || 'Compilabile da OCR'}
                placeholder="Es: 2015"
                inputProps={{ min: 1980, max: 2100 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Pressione Max */}
      {pressione_max && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.pressione_max`}
            control={control}
            rules={{
              min: { value: 10, message: 'Pressione minima: 10 bar' },
              max: { value: 30, message: 'Pressione massima: 30 bar' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Pressione Max (bar)"
                type="number"
                fullWidth
                error={!!getError('pressione_max')}
                helperText={getError('pressione_max')?.message || 'Compilabile da OCR (1 decimale)'}
                placeholder="Es: 13,0"
                inputProps={{ min: 10, max: 30, step: 0.1 }}
                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Volume */}
      {volume && (
        <Grid item xs={12} md={4}>
          <Controller
            name={`${basePath}.volume`}
            control={control}
            rules={{
              min: { value: 50, message: 'Volume minimo: 50 litri' },
              max: { value: 5000, message: 'Volume massimo: 5000 litri' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Volume (litri)"
                type="number"
                fullWidth
                error={!!getError('volume')}
                helperText={getError('volume')?.message}
                placeholder="Es: 500"
                inputProps={{ min: 50, max: 5000 }}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
              />
            )}
          />
        </Grid>
      )}

      {/* Note */}
      {note && (
        <Grid item xs={12}>
          <Controller
            name={`${basePath}.note`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Note"
                fullWidth
                multiline
                rows={2}
                error={!!getError('note')}
                helperText={getError('note')?.message}
                placeholder="Note aggiuntive..."
              />
            )}
          />
        </Grid>
      )}
    </Grid>
  )
}
