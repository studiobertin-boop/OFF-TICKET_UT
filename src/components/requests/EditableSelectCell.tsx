import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Tooltip,
  ClickAwayListener,
} from '@mui/material'

interface EditableSelectCellProps {
  value: string
  options: string[]
  optionLabels?: Record<string, string>
  onSave: (newValue: string) => Promise<void>
  validate?: (value: string) => { valid: boolean; error?: string }
  disabled?: boolean
}

export const EditableSelectCell = ({
  value,
  options,
  optionLabels,
  onSave,
  validate,
  disabled = false,
}: EditableSelectCellProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectRef = useRef<HTMLDivElement>(null)

  // Update currentValue when prop value changes
  useEffect(() => {
    setCurrentValue(value)
  }, [value])

  const getLabel = (val: string) => {
    return optionLabels?.[val] || val
  }

  const handleClick = () => {
    if (!disabled && !isSaving) {
      setIsEditing(true)
      setError(null)
    }
  }

  const handleChange = async (newValue: string) => {
    // Validate if validator provided
    if (validate) {
      const validation = validate(newValue)
      if (!validation.valid) {
        setError(validation.error || 'Valore non valido')
        // Don't save, keep editing mode open
        return
      }
    }

    // Optimistic update
    setCurrentValue(newValue)
    setIsEditing(false)
    setIsSaving(true)
    setError(null)

    try {
      await onSave(newValue)
    } catch (err: any) {
      // Rollback on error
      setCurrentValue(value)
      setError(err.message || 'Errore durante il salvataggio')
      console.error('Error saving field:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setCurrentValue(value)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isSaving) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 0.5 }}>
        <CircularProgress size={20} />
      </Box>
    )
  }

  if (isEditing) {
    return (
      <ClickAwayListener onClickAway={handleCancel}>
        <Box ref={selectRef} onKeyDown={handleKeyDown}>
          <Select
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            error={!!error}
            sx={{ minWidth: 120 }}
          >
            {options.map((option) => (
              <MenuItem key={option} value={option}>
                {getLabel(option)}
              </MenuItem>
            ))}
          </Select>
          {error && (
            <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>
              {error}
            </Box>
          )}
        </Box>
      </ClickAwayListener>
    )
  }

  const chipContent = (
    <Chip
      label={getLabel(currentValue)}
      size="small"
      onClick={handleClick}
      sx={{
        cursor: disabled ? 'default' : 'pointer',
        '&:hover': disabled ? {} : {
          backgroundColor: 'action.hover',
        },
      }}
      color={error ? 'error' : 'default'}
    />
  )

  if (error) {
    return (
      <Tooltip title={error} arrow>
        {chipContent}
      </Tooltip>
    )
  }

  return chipContent
}
