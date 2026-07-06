import type { ReactNode } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { InputBase, Select, MenuItem, Checkbox, Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

/**
 * Celle tipizzate per la SCHEDA DATI DM329 in modalità "foglio di calcolo".
 * Ogni cella avvolge un Controller di react-hook-form e applica lo stile
 * compatto (input borderless, focus ring, tabular-nums sui numeri).
 * Nessuna logica dati nuova: solo presentazione/interazione.
 */

export const cellTdSx = {
  p: 0,
  borderBottom: '1px solid',
  borderColor: 'divider',
  verticalAlign: 'middle',
} as const

const baseInputSx = {
  width: '100%',
  fontSize: '0.82rem',
  px: 1.25,
  py: 0.9,
  color: 'text.primary',
  '& input': { p: 0 },
  '& input::placeholder': { color: 'text.disabled', opacity: 1 },
  '&:hover:not(.Mui-focused)': { bgcolor: (t: any) => alpha(t.palette.text.primary, 0.04) },
  '&.Mui-focused': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: '-2px',
    borderRadius: 1,
    bgcolor: 'background.paper',
  },
}

const errorSx = {
  boxShadow: (t: any) => `inset 0 0 0 1.5px ${t.palette.error.main}`,
  borderRadius: 1,
}

interface CellBase {
  control: Control<any>
  name: string
  disabled?: boolean
}

export const TextCell = ({ control, name, placeholder, disabled }: CellBase & { placeholder?: string }) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <Tooltip title={fieldState.error?.message ?? ''} placement="top" arrow disableHoverListener={!fieldState.error}>
        <InputBase
          {...field}
          value={field.value ?? ''}
          placeholder={placeholder ?? '—'}
          disabled={disabled}
          sx={{ ...baseInputSx, ...(fieldState.error ? errorSx : {}) }}
        />
      </Tooltip>
    )}
  />
)

export const NumberCell = ({
  control, name, min, max, step, placeholder, disabled,
}: CellBase & { min?: number; max?: number; step?: number; placeholder?: string }) => (
  <Controller
    name={name}
    control={control}
    rules={{
      ...(min !== undefined ? { min: { value: min, message: `Minimo ${min}` } } : {}),
      ...(max !== undefined ? { max: { value: max, message: `Massimo ${max}` } } : {}),
    }}
    render={({ field, fieldState }) => (
      <Tooltip title={fieldState.error?.message ?? ''} placement="top" arrow disableHoverListener={!fieldState.error}>
        <InputBase
          {...field}
          type="number"
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={placeholder ?? '—'}
          disabled={disabled}
          inputProps={{ min, max, step, style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
          sx={{ ...baseInputSx, ...(fieldState.error ? errorSx : {}) }}
        />
      </Tooltip>
    )}
  />
)

export const SelectCell = ({ control, name, options, disabled }: CellBase & { options: string[] }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Select
        {...field}
        value={field.value ?? ''}
        disabled={disabled}
        variant="standard"
        disableUnderline
        displayEmpty
        fullWidth
        sx={{ fontSize: '0.82rem', px: 1.25, '& .MuiSelect-select': { py: 0.75 } }}
      >
        <MenuItem value=""><em>—</em></MenuItem>
        {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </Select>
    )}
  />
)

export const CheckCell = ({ control, name, onToggle }: CellBase & { onToggle?: (checked: boolean) => void }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => (
      <Box sx={{ display: 'grid', placeItems: 'center' }}>
        <Checkbox
          size="small"
          checked={field.value ?? false}
          onChange={(e) => { field.onChange(e.target.checked); onToggle?.(e.target.checked) }}
        />
      </Box>
    )}
  />
)

export const ComputedCell = ({ value, badge }: { value: ReactNode; badge?: 'auto' | 'cat' }) => (
  <Box sx={{ px: 1.25, py: 0.9, display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
    <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'success.main', fontVariantNumeric: 'tabular-nums' }}>
      {value || '—'}
    </Typography>
    {badge && value ? (
      <Box component="span" sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', px: 0.6, py: '1px', borderRadius: '4px', bgcolor: 'success.lighter', color: 'success.main' }}>
        {badge}
      </Box>
    ) : null}
  </Box>
)
