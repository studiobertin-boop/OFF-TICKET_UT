import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, CheckCell, cellTdSx } from './EquipmentCells'
import { Field, SubBand, SubBandLabel } from './SubBand'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { EQUIPMENT_LIMITS, generateEquipmentCode } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const FILTRO_COLOR = '#e07a4a'

interface FiltriTableProps {
  control: Control<any>
  errors: any
}

const FiltroRow = ({
  control, index, colCount, showRecipiente, recipientiFields, appendRecipiente, removeRecipiente, onRemove,
}: {
  control: Control<any>; index: number; colCount: number; showRecipiente: boolean
  recipientiFields: any[]
  appendRecipiente: (data: any) => void
  removeRecipiente: (i: number) => void
  onRemove: (i: number) => void
}) => {
  const { setValue, trigger } = useFormContext()
  const base = `filtri.${index}`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.filtri.prefix, index + 1)

  const haRecipiente = useWatch({ control, name: `${base}.ha_recipiente`, defaultValue: false })
  const recipienteIndex = recipientiFields.findIndex((r: any) => r.filtro_associato === code)

  const handleRecipienteToggle = (checked: boolean) => {
    if (checked) {
      if (recipientiFields.findIndex((r: any) => r.filtro_associato === code) === -1) {
        appendRecipiente({ codice: `${code}.1`, filtro_associato: code })
      }
    } else {
      const i = recipientiFields.findIndex((r: any) => r.filtro_associato === code)
      if (i !== -1) removeRecipiente(i)
    }
  }

  const handleFiltroOCR = (data: OCRExtractedData) => {
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${base}.anno`, data.anno)
    trigger(base)
  }

  const rbase = recipienteIndex !== -1 ? `recipienti_filtro.${recipienteIndex}` : ''
  const handleRecipienteOCR = (data: OCRExtractedData) => {
    if (!rbase) return
    if (data.marca) setValue(`${rbase}.marca`, data.marca)
    if (data.modello) setValue(`${rbase}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${rbase}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${rbase}.anno`, data.anno)
    if (data.volume) setValue(`${rbase}.volume`, data.volume)
    trigger(rbase)
  }

  return (
    <>
      {/* RIGA PRINCIPALE */}
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(FILTRO_COLOR, 0.06) } }}>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <SingleOCRButton equipmentType="Filtri" equipmentIndex={index} onOCRComplete={handleFiltroOCR} />
            <Tooltip title="Elimina filtro"><span>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Box>
        </Box>
        <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: FILTRO_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>
        <Box component="td" colSpan={2} sx={cellTdSx}>
          <Box sx={{ px: 1, py: 0.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete
                  equipmentType="Filtri"
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  dense size="small" fullWidth
                />
              )} />
            )} />
          </Box>
        </Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        {showRecipiente && (
          <Box component="td" sx={{ ...cellTdSx, textAlign: 'center' }}>
            <CheckCell control={control} name={`${base}.ha_recipiente`} onToggle={handleRecipienteToggle} />
          </Box>
        )}
      </Box>

      {/* SOTTO-BANDA RECIPIENTE FILTRO (solo se visibile al ruolo) */}
      {showRecipiente && haRecipiente && recipienteIndex !== -1 && (
        <SubBand colSpan={colCount} color={FILTRO_COLOR}>
          <SubBandLabel>{code}.1 · Recipiente filtro</SubBandLabel>
          <Box sx={{ alignSelf: 'center' }}>
            <SingleOCRButton equipmentType="Recipienti filtro" equipmentIndex={recipienteIndex} onOCRComplete={handleRecipienteOCR} />
          </Box>
          <Box sx={{ minWidth: 260, flex: '1 1 300px', '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${rbase}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${rbase}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete
                  equipmentType="Recipienti filtro"
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  dense size="small" fullWidth
                />
              )} />
            )} />
          </Box>
          <Field label="N° fabbrica" w={130}><TextCell control={control} name={`${rbase}.n_fabbrica`} placeholder="N° fabbrica" /></Field>
          <Field label="Anno" w={70}><NumberCell control={control} name={`${rbase}.anno`} min={1980} max={2100} /></Field>
          <Field label="PS bar" w={70}><NumberCell control={control} name={`${rbase}.ps_pressione_max`} min={3} max={50} step={0.1} /></Field>
          <Field label="TS °C" w={70}><NumberCell control={control} name={`${rbase}.ts_temperatura`} min={50} max={250} /></Field>
          <Field label="Volume L" w={80}><NumberCell control={control} name={`${rbase}.volume`} min={50} max={5000} /></Field>
          <Field label="Note" w={160}><TextCell control={control} name={`${rbase}.note`} placeholder="Note" /></Field>
        </SubBand>
      )}
    </>
  )
}

export const FiltriTable = ({ control }: FiltriTableProps) => {
  const { showRecipienteFiltro } = useTecnicoDM329Visibility()
  const { fields, append, remove } = useFieldArray({ control, name: 'filtri' })
  const { fields: recipientiFields, append: appendRecipiente, remove: removeRecipiente } = useFieldArray({ control, name: 'recipienti_filtro' })
  const max = EQUIPMENT_LIMITS.filtri.max
  const min = EQUIPMENT_LIMITS.filtri.min

  const handleAdd = () => append({
    codice: generateEquipmentCode(EQUIPMENT_LIMITS.filtri.prefix, fields.length + 1),
    ha_recipiente: false,
  })

  const handleRemove = (index: number) => {
    if (fields.length <= min) { window.alert(`Numero minimo di filtri: ${min}`); return }
    if (window.confirm(`Confermi di voler eliminare il filtro ${generateEquipmentCode('F', index + 1)}?`)) remove(index)
  }

  const colCount = showRecipienteFiltro ? 7 : 6

  return (
    <EquipmentTableShell
      letter="F" color={FILTRO_COLOR} title="Filtri"
      subtitle={showRecipienteFiltro ? 'Con eventuale recipiente filtro da denunciare (F{n}.1)' : undefined}
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Filtro"
    >
      <thead>
        <tr>
          <th aria-label="azioni" />
          <th>Cod.</th>
          <th>Marca</th>
          <th>Modello</th>
          <th>N° fabbrica</th>
          <th className="num">Anno</th>
          {showRecipienteFiltro && <th className="ctr">Recip.</th>}
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <FiltroRow
            key={f.id} control={control} index={i} colCount={colCount} showRecipiente={showRecipienteFiltro}
            recipientiFields={recipientiFields} appendRecipiente={appendRecipiente} removeRecipiente={removeRecipiente}
            onRemove={handleRemove}
          />
        ))}
        {fields.length === 0 && (
          <Box component="tr">
            <Box component="td" colSpan={colCount} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
              Nessun filtro. Usa "+ Filtro" per iniziare.
            </Box>
          </Box>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
