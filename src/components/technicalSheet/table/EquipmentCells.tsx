import type { ReactNode } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { InputBase, Select, MenuItem, Checkbox, Box, Chip, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useNoAutofillToken } from '@/utils/noAutofill'

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
  px: 1,
  py: 0.4,
  color: 'text.primary',
  '& input': { p: 0 },
  '& input::placeholder': { color: 'text.disabled', opacity: 1 },
  // Niente frecce su/giù: in una tabella fitta rubano spazio al numero e invitano a
  // cambiare un valore di targa un passo alla volta, che non è mai il gesto giusto.
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none', margin: 0,
  },
  '&:hover:not(.Mui-focused)': { bgcolor: (t: any) => alpha(t.palette.text.primary, 0.04) },
  '&.Mui-focused': {
    outline: '2px solid',
    outlineColor: 'primary.main',
    outlineOffset: '-2px',
    borderRadius: 1,
    bgcolor: 'background.paper',
  },
  // Evita che il browser colori di bianco/giallo i campi autocompletati (es. N.F.)
  '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus': {
    WebkitBoxShadow: (t: any) => `0 0 0 1000px ${t.palette.background.paper} inset`,
    WebkitTextFillColor: (t: any) => t.palette.text.primary,
    caretColor: (t: any) => t.palette.text.primary,
    transition: 'background-color 9999s ease-out',
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

export const TextCell = ({ control, name, placeholder, disabled, w }: CellBase & { placeholder?: string; w?: number }) => {
  const ac = useNoAutofillToken()
  return (
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
            inputProps={{ autoComplete: ac }}
            sx={{ ...baseInputSx, ...(w ? { width: w } : {}), ...(fieldState.error ? errorSx : {}) }}
          />
        </Tooltip>
      )}
    />
  )
}

export const NumberCell = ({
  control, name, min, max, step, placeholder, disabled, w,
}: CellBase & { min?: number; max?: number; step?: number; placeholder?: string; w?: number }) => {
  const ac = useNoAutofillToken()
  return (
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
            inputProps={{ min, max, step, autoComplete: ac, style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
            sx={{ ...baseInputSx, ...(w ? { width: w } : {}), ...(fieldState.error ? errorSx : {}) }}
          />
        </Tooltip>
      )}
    />
  )
}

/**
 * `display` = resa compatta del valore scelto; `labels` = testo esteso nelle voci di menu
 * (i due differiscono dove la colonna è stretta: finitura ZINCATO → «Z»).
 * `emptyLabel` mostra in grigio il default applicato dal motore quando il campo è vuoto,
 * così un campo non compilato non si legge come «dato mancante».
 */
export const SelectCell = ({ control, name, options, disabled, display, labels, emptyLabel, w }: CellBase & { options: string[]; display?: Record<string, string>; labels?: Record<string, string>; emptyLabel?: string; w?: number }) => (
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
        fullWidth={!w}
        renderValue={(v) => {
          const val = (v as string) || ''
          if (!val) return <Box component="span" sx={{ color: 'text.disabled' }}>{emptyLabel ?? '—'}</Box>
          return display ? (display[val] ?? val) : val
        }}
        sx={{ fontSize: '0.82rem', px: 1, '& .MuiSelect-select': { py: 0.4 }, ...(w ? { width: w } : {}) }}
      >
        <MenuItem value=""><em>{emptyLabel ? `${emptyLabel} (default)` : '—'}</em></MenuItem>
        {options.map((o) => <MenuItem key={o} value={o}>{labels?.[o] ?? o}</MenuItem>)}
      </Select>
    )}
  />
)

/** Selezione multipla con opzioni etichettate; il valore memorizzato è un array di stringhe. */
export const MultiSelectCell = ({ control, name, options, disabled, emptyLabel, w }: CellBase & { options: { value: string; label: string }[]; emptyLabel?: string; w?: number }) => (
  <Controller
    name={name}
    control={control}
    render={({ field }) => {
      const selected: string[] = Array.isArray(field.value) ? field.value : []
      return (
        <Select
          {...field}
          multiple
          value={selected}
          disabled={disabled || options.length === 0}
          variant="standard"
          disableUnderline
          displayEmpty
          fullWidth={!w}
          renderValue={() => {
            if (selected.length === 0) {
              return <Box component="span" sx={{ color: 'text.disabled' }}>{options.length === 0 ? 'nessuna valvola censita' : (emptyLabel ?? '—')}</Box>
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((v) => <Chip key={v} label={v} size="small" sx={{ height: 18, fontSize: '0.68rem' }} />)}
              </Box>
            )
          }}
          sx={{ fontSize: '0.82rem', px: 1, '& .MuiSelect-select': { py: 0.4 }, ...(w ? { width: w } : {}) }}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.8rem' }}>
              <Checkbox size="small" checked={selected.includes(o.value)} sx={{ p: 0.25, mr: 1 }} />
              {o.label}
            </MenuItem>
          ))}
        </Select>
      )
    }}
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
  <Box sx={{ px: 1, py: 0.4, display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
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
