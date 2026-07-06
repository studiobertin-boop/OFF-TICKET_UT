import { Controller, useFieldArray, useFormContext, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { cellTdSx } from './EquipmentCells'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { EQUIPMENT_LIMITS, generateEquipmentCode } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const SEPARATORE_COLOR = '#b061c4'

interface SeparatoriTableProps {
  control: Control<any>
  errors: any
}

const SeparatoreRow = ({ control, index, onRemove }: { control: Control<any>; index: number; onRemove: (i: number) => void }) => {
  const { setValue, trigger } = useFormContext()
  const base = `separatori.${index}`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.separatori.prefix, index + 1)

  const handleOCR = (data: OCRExtractedData) => {
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    trigger(base)
  }

  return (
    <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(SEPARATORE_COLOR, 0.06) } }}>
      <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <SingleOCRButton equipmentType="Separatori" equipmentIndex={index} onOCRComplete={handleOCR} />
          <Tooltip title="Elimina separatore"><span>
            <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
          </span></Tooltip>
        </Box>
      </Box>
      <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: SEPARATORE_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>
      <Box component="td" colSpan={2} sx={cellTdSx}>
        <Box sx={{ px: 1, py: 0.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
          <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
            <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
              <EquipmentAutocomplete
                equipmentType="Separatori"
                marcaValue={m.value || ''} modelloValue={mo.value || ''}
                onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                dense size="small" fullWidth
              />
            )} />
          )} />
        </Box>
      </Box>
    </Box>
  )
}

export const SeparatoriTable = ({ control }: SeparatoriTableProps) => {
  const { fields, append, remove } = useFieldArray({ control, name: 'separatori' })
  const max = EQUIPMENT_LIMITS.separatori.max
  const min = EQUIPMENT_LIMITS.separatori.min

  const handleAdd = () => append({ codice: generateEquipmentCode(EQUIPMENT_LIMITS.separatori.prefix, fields.length + 1) })

  const handleRemove = (index: number) => {
    if (fields.length <= min) { window.alert(`Numero minimo di separatori: ${min}`); return }
    if (window.confirm(`Confermi di voler eliminare il separatore ${generateEquipmentCode('SEP', index + 1)}?`)) remove(index)
  }

  return (
    <EquipmentTableShell
      letter="SE" color={SEPARATORE_COLOR} title="Separatori"
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Separatore"
    >
      <thead>
        <tr>
          <th aria-label="azioni" />
          <th>Cod.</th>
          <th>Marca</th>
          <th>Modello</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <SeparatoreRow key={f.id} control={control} index={i} onRemove={handleRemove} />
        ))}
        {fields.length === 0 && (
          <Box component="tr">
            <Box component="td" colSpan={4} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
              Nessun separatore. Usa "+ Separatore" per iniziare.
            </Box>
          </Box>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
