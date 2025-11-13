import { Control, Controller } from 'react-hook-form'
import { TextField, Grid, Typography, Box, Divider } from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'

interface ValvolaSicurezzaFieldsProps {
  control: Control<any>
  basePath: string
  errors: any
  codiceValvola: string
}

/**
 * Campi per Valvola di Sicurezza
 * Obbligatoria per serbatoi e disoleatori
 */
export const ValvolaSicurezzaFields = ({
  control,
  basePath,
  errors,
  codiceValvola,
}: ValvolaSicurezzaFieldsProps) => {
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
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Grid container spacing={2}>
        {/* Marca */}
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.valvola_sicurezza.marca`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Marca Valvola"
                fullWidth
                size="small"
                error={!!getError('marca')}
                helperText={getError('marca')?.message || 'Compilabile da OCR'}
                placeholder="Es: LESER, Goetze..."
              />
            )}
          />
        </Grid>

        {/* Modello */}
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.valvola_sicurezza.modello`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Modello Valvola"
                fullWidth
                size="small"
                error={!!getError('modello')}
                helperText={getError('modello')?.message || 'Compilabile da OCR'}
                placeholder="Es: 441, 526..."
              />
            )}
          />
        </Grid>

        {/* N° Fabbrica */}
        <Grid item xs={12} md={6}>
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

        {/* Diametro e Pressione */}
        <Grid item xs={12} md={6}>
          <Controller
            name={`${basePath}.valvola_sicurezza.diametro_pressione`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Diametro e Pressione"
                fullWidth
                size="small"
                error={!!getError('diametro_pressione')}
                helperText={getError('diametro_pressione')?.message || 'Compilabile da OCR - Es: 1/2" 13bar'}
                placeholder={'Es: 1/2" 13bar, 3/4" 10bar'}
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  )
}
