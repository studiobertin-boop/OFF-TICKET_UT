import { Controller, Control } from 'react-hook-form'
import {
  TextField,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  Checkbox,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
} from '@mui/material'
import { FieldSchema } from '@/types'
import { AutocompleteField } from './AutocompleteField'
import { CompressorFields } from './CompressorFields'
import { AddressAutocompleteField } from './AddressAutocompleteField'

interface DynamicFormFieldProps {
  field: FieldSchema
  control: Control<any>
  error?: any
}

export const DynamicFormField = ({ field, control, error }: DynamicFormFieldProps) => {
  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <TextField
                {...formField}
                label={field.label}
                fullWidth
                required={field.required}
                error={!!error}
                helperText={error?.message}
                margin="normal"
                placeholder={field.placeholder}
                inputProps={{
                  maxLength: field.maxLength,
                }}
              />
            )}
          />
        )

      case 'textarea':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <TextField
                {...formField}
                label={field.label}
                fullWidth
                multiline
                rows={4}
                required={field.required}
                error={!!error}
                helperText={error?.message}
                margin="normal"
                placeholder={field.placeholder}
                inputProps={{
                  maxLength: field.maxLength,
                }}
              />
            )}
          />
        )

      case 'boolean':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <FormControl margin="normal" error={!!error}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formField.value || false}
                      onChange={e => formField.onChange(e.target.checked)}
                    />
                  }
                  label={field.label}
                />
                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        )

      case 'select':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <FormControl fullWidth margin="normal" required={field.required} error={!!error}>
                <FormLabel>{field.label}</FormLabel>
                <Select {...formField} value={formField.value || ''}>
                  {!field.required && (
                    <MenuItem value="">
                      <em>Nessuna selezione</em>
                    </MenuItem>
                  )}
                  {field.options?.map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        )

      case 'multiselect':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <FormControl fullWidth margin="normal" required={field.required} error={!!error}>
                <FormLabel>{field.label}</FormLabel>
                <Select
                  multiple
                  value={formField.value || []}
                  onChange={formField.onChange}
                  input={<OutlinedInput />}
                  renderValue={selected => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map(value => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {field.options?.map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        )

      case 'file':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <FormControl fullWidth margin="normal" required={field.required} error={!!error}>
                <FormLabel>{field.label}</FormLabel>
                <TextField
                  type="file"
                  onChange={e => {
                    const target = e.target as HTMLInputElement
                    const files = target.files
                    if (field.maxFiles && field.maxFiles > 1) {
                      formField.onChange(files ? Array.from(files) : [])
                    } else {
                      formField.onChange(files?.[0] || null)
                    }
                  }}
                  inputProps={{
                    accept: field.accept || '*/*',
                    multiple: field.maxFiles ? field.maxFiles > 1 : false
                  }}
                  error={!!error}
                  helperText={error?.message || (field.maxFileSize ? `Max ${field.maxFileSize}MB per file` : '')}
                />
              </FormControl>
            )}
          />
        )

      case 'date':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <TextField
                {...formField}
                label={field.label}
                type="date"
                fullWidth
                required={field.required}
                error={!!error}
                helperText={error?.message}
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  min: field.min,
                  max: field.max,
                }}
              />
            )}
          />
        )

      case 'number':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <TextField
                {...formField}
                label={field.label}
                type="number"
                fullWidth
                required={field.required}
                error={!!error}
                helperText={error?.message}
                margin="normal"
                placeholder={field.placeholder}
                inputProps={{
                  min: field.min,
                  max: field.max,
                  step: field.step || 1,
                }}
              />
            )}
          />
        )

      case 'datetime-local':
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: formField }) => (
              <TextField
                {...formField}
                label={field.label}
                type="datetime-local"
                fullWidth
                required={field.required}
                error={!!error}
                helperText={error?.message}
                margin="normal"
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  min: field.min,
                  max: field.max,
                }}
              />
            )}
          />
        )

      case 'autocomplete':
        return <AutocompleteField field={field} control={control} error={error} />

      case 'address-autocomplete':
        return <AddressAutocompleteField field={field} control={control} error={error} />

      case 'repeatable_group':
        return <CompressorFields field={field} control={control} errors={error} />

      default:
        return null
    }
  }

  return <>{renderField()}</>
}
