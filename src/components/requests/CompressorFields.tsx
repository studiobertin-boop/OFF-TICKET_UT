import { useState } from 'react'
import { Controller, Control } from 'react-hook-form'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  TextField,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { FieldSchema } from '@/types'

interface CompressorFieldsProps {
  field: FieldSchema
  control: Control<any>
  errors?: any
}

const TIPO_COMPRESSORE_OPTIONS = [
  { value: 'VITE', label: 'A vite' },
  { value: 'CENTRIFUGO', label: 'Centrifugo' },
  { value: 'SCROLL', label: 'Scroll' },
  { value: 'PISTONI', label: 'A pistoni' },
  { value: 'VSD', label: 'Velocità variabile (VSD)' },
  { value: 'ALTRO', label: 'Altro' },
]

export const CompressorFields = ({ field, control, errors }: CompressorFieldsProps) => {
  const minItems = field.minItems || 0
  const maxItems = field.maxItems || 4
  const [compressorCount, setCompressorCount] = useState(minItems)

  const addCompressor = () => {
    if (compressorCount < maxItems) {
      setCompressorCount(compressorCount + 1)
    }
  }

  const removeCompressor = (index: number) => {
    if (compressorCount > minItems) {
      setCompressorCount(compressorCount - 1)
    }
  }

  const renderCompressorCard = (index: number) => {
    const prefix = `compressore_${index + 1}`

    return (
      <Card key={index} sx={{ mb: 2 }}>
        <CardHeader
          title={`Compressore ${index + 1}`}
          action={
            compressorCount > minItems && (
              <IconButton
                onClick={() => removeCompressor(index)}
                color="error"
                aria-label="Rimuovi compressore"
              >
                <DeleteIcon />
              </IconButton>
            )
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            {/* Marca */}
            <Grid item xs={12} sm={6}>
              <Controller
                name={`${prefix}_marca`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Marca"
                    fullWidth
                    placeholder="Es: Atlas Copco"
                    error={!!errors?.[`${prefix}_marca`]}
                    helperText={errors?.[`${prefix}_marca`]?.message}
                    inputProps={{ maxLength: 100 }}
                  />
                )}
              />
            </Grid>

            {/* Modello */}
            <Grid item xs={12} sm={6}>
              <Controller
                name={`${prefix}_modello`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Modello"
                    fullWidth
                    placeholder="Es: GA 75 VSD+"
                    error={!!errors?.[`${prefix}_modello`]}
                    helperText={errors?.[`${prefix}_modello`]?.message}
                    inputProps={{ maxLength: 100 }}
                  />
                )}
              />
            </Grid>

            {/* Anno */}
            <Grid item xs={12} sm={4}>
              <Controller
                name={`${prefix}_anno`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Anno"
                    type="number"
                    fullWidth
                    placeholder="Es: 2018"
                    error={!!errors?.[`${prefix}_anno`]}
                    helperText={errors?.[`${prefix}_anno`]?.message}
                    inputProps={{ min: 1980, max: 2100, step: 1 }}
                  />
                )}
              />
            </Grid>

            {/* Ore di Lavoro */}
            <Grid item xs={12} sm={4}>
              <Controller
                name={`${prefix}_ore_lavoro`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Ore di Lavoro"
                    type="number"
                    fullWidth
                    placeholder="Es: 25000"
                    error={!!errors?.[`${prefix}_ore_lavoro`]}
                    helperText={errors?.[`${prefix}_ore_lavoro`]?.message}
                    inputProps={{ min: 0, max: 150000, step: 1 }}
                  />
                )}
              />
            </Grid>

            {/* Tipo */}
            <Grid item xs={12} sm={4}>
              <Controller
                name={`${prefix}_tipo`}
                control={control}
                render={({ field: formField }) => (
                  <FormControl fullWidth error={!!errors?.[`${prefix}_tipo`]}>
                    <FormLabel>Tipo</FormLabel>
                    <Select {...formField} value={formField.value || ''}>
                      <MenuItem value="">
                        <em>Seleziona tipo...</em>
                      </MenuItem>
                      {TIPO_COMPRESSORE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors?.[`${prefix}_tipo`] && (
                      <FormHelperText>{errors[`${prefix}_tipo`].message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Pressione Lavoro */}
            <Grid item xs={12} sm={6}>
              <Controller
                name={`${prefix}_pressione_lavoro`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Pressione Lavoro (bar)"
                    type="number"
                    fullWidth
                    placeholder="Es: 7.5"
                    error={!!errors?.[`${prefix}_pressione_lavoro`]}
                    helperText={errors?.[`${prefix}_pressione_lavoro`]?.message}
                    inputProps={{ min: 0, max: 50, step: 0.1 }}
                  />
                )}
              />
            </Grid>

            {/* Potenza (kW) */}
            <Grid item xs={12} sm={6}>
              <Controller
                name={`${prefix}_potenza_kw`}
                control={control}
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    label="Potenza (kW)"
                    type="number"
                    fullWidth
                    placeholder="Es: 75"
                    error={!!errors?.[`${prefix}_potenza_kw`]}
                    helperText={errors?.[`${prefix}_potenza_kw`]?.message}
                    inputProps={{ min: 5, max: 500, step: 1 }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box sx={{ my: 2 }}>
      <FormLabel sx={{ mb: 2, display: 'block' }}>{field.label}</FormLabel>

      {Array.from({ length: compressorCount }, (_, i) => renderCompressorCard(i))}

      {compressorCount < maxItems && (
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addCompressor}
          fullWidth
          sx={{ mt: 1 }}
        >
          Aggiungi Compressore ({compressorCount}/{maxItems})
        </Button>
      )}
    </Box>
  )
}
