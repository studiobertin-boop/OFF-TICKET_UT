import { useState, useEffect, useRef } from 'react'
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

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  importance: number
}

interface PlacePrediction {
  description: string
  place_id: string
  lat?: string
  lon?: string
}

/**
 * Campo con autocomplete per indirizzi usando OpenStreetMap Nominatim API
 * API gratuita e open source per geocoding
 */
export const AddressAutocompleteField = ({
  field,
  control,
  error,
}: AddressAutocompleteFieldProps) => {
  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState<PlacePrediction[]>([])
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Integrazione con OpenStreetMap Nominatim API
  useEffect(() => {
    if (inputValue.length < 3) {
      setOptions([])
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        // Nominatim API - priorità per indirizzi italiani
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            new URLSearchParams({
              q: inputValue,
              format: 'json',
              addressdetails: '1',
              limit: '5',
              countrycodes: 'it', // Priorità Italia
              'accept-language': 'it',
            }),
          {
            signal: abortController.signal,
            headers: {
              'User-Agent': 'OffTicketUT/1.0 (Ticketing System)',
            },
          }
        )

        if (!response.ok) {
          throw new Error('Network response was not ok')
        }

        const data: NominatimResult[] = await response.json()

        const suggestions: PlacePrediction[] = data.map(result => ({
          description: result.display_name,
          place_id: result.place_id.toString(),
          lat: result.lat,
          lon: result.lon,
        }))

        setOptions(suggestions)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error fetching address suggestions:', err)
          setOptions([])
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }, 400) // Debounce di 400ms per rispettare rate limits

    return () => {
      clearTimeout(timer)
      abortController.abort()
    }
  }, [inputValue])

  return (
    <Controller
      name={field.name}
      control={control}
      rules={
        field.required
          ? { required: `${field.label} è obbligatorio` }
          : undefined
      }
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
              formField.onChange(newValue)
            } else if (newValue) {
              // Selezione da autocomplete - salviamo l'indirizzo formattato
              formField.onChange(newValue.description)
            } else {
              formField.onChange('')
            }
          }}
          getOptionLabel={(option) => {
            if (typeof option === 'string') {
              return option
            }
            return option.description
          }}
          isOptionEqualToValue={(option, value) => {
            if (typeof value === 'string') {
              return option.description === value
            }
            return option.place_id === value.place_id
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
            <Box component="li" {...props} key={option.place_id}>
              <LocationOn sx={{ mr: 1, color: 'primary.main', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {option.description}
              </Typography>
            </Box>
          )}
          noOptionsText={
            inputValue.length < 3
              ? 'Digita almeno 3 caratteri'
              : 'Nessun indirizzo trovato'
          }
          filterOptions={(x) => x} // Non filtrare localmente, usiamo i risultati dell'API
        />
      )}
    />
  )
}
