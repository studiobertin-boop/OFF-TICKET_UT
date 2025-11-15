import { useState, useEffect } from 'react'
import { Controller, Control } from 'react-hook-form'
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material'
import { LocationOn } from '@mui/icons-material'
import { FieldSchema } from '@/types'

interface AddressAutocompleteFieldProps {
  field: FieldSchema
  control: Control<any>
  error?: any
}

interface PlacePrediction {
  description: string
  place_id: string
}

/**
 * Campo con autocomplete per indirizzi usando Google Places API
 * NOTA: Per il Passo 1, questo è uno skeleton. L'integrazione con Google Places
 * verrà completata nei passi successivi quando avremo la API key configurata.
 */
export const AddressAutocompleteField = ({
  field,
  control,
  error,
}: AddressAutocompleteFieldProps) => {
  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)

  // TODO Passo 2: Integrare Google Places Autocomplete API
  // Per ora usiamo un campo di testo semplice con autocomplete locale
  useEffect(() => {
    if (inputValue.length < 3) {
      setOptions([])
      return
    }

    // Placeholder: in futuro qui faremo la chiamata a Google Places API
    // Per ora simuliamo un delay
    setLoading(true)
    const timer = setTimeout(() => {
      // Simulazione: per ora nessuna suggestion
      setOptions([])
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue])

  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: formField }) => (
        <Autocomplete
          freeSolo // Permette input libero
          options={options}
          loading={loading}
          inputValue={inputValue}
          onInputChange={(_, newInputValue) => {
            setInputValue(newInputValue)
          }}
          onChange={(_, newValue) => {
            if (typeof newValue === 'string') {
              // Input libero (testo)
              formField.onChange({
                address: newValue,
                formatted: null,
              })
            } else if (newValue) {
              // Selezione da autocomplete
              formField.onChange({
                address: newValue.description,
                formatted: {
                  place_id: newValue.place_id,
                  formatted_address: newValue.description,
                },
              })
            }
          }}
          getOptionLabel={(option) => {
            if (typeof option === 'string') {
              return option
            }
            return option.description
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={field.label}
              required={field.required}
              error={!!error}
              helperText={
                error?.message ||
                'Inizia a digitare per cercare un indirizzo (min 3 caratteri)'
              }
              margin="normal"
              placeholder={field.placeholder || 'Via, Città, CAP...'}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body2">{option.description}</Typography>
            </Box>
          )}
          noOptionsText={
            inputValue.length < 3
              ? 'Digita almeno 3 caratteri'
              : 'Nessun indirizzo trovato'
          }
        />
      )}
    />
  )
}
