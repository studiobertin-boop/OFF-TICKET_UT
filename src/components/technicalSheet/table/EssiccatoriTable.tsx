import { useEffect } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, SelectCell, CheckCell, cellTdSx } from './EquipmentCells'
import { Field, SubBand, SubBandLabel } from './SubBand'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const ESSICCATORE_COLOR = '#4fa564'
const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

interface EssiccatoriTableProps {
  control: Control<any>
  errors: any
}

/** Auto-calc Categoria PED per uno scambiatore (come CategoriaPEDFieldWithAutoCalc). */
const useAutoPedScambiatore = (control: Control<any>, scambiatoreIndex: number, enabled: boolean) => {
  const { setValue, getValues } = useFormContext()
  const ps = useWatch({ control, name: scambiatoreIndex !== -1 ? `scambiatori.${scambiatoreIndex}.ps_pressione_max` : 'noop' })
  const vol = useWatch({ control, name: scambiatoreIndex !== -1 ? `scambiatori.${scambiatoreIndex}.volume` : 'noop' })
  useEffect(() => {
    if (!enabled || scambiatoreIndex === -1) return
    const cat = calculateCategoriaPED(ps, vol)
    if (!cat) return
    const current = getValues(`scambiatori.${scambiatoreIndex}.categoria_ped`)
    if (!current) setValue(`scambiatori.${scambiatoreIndex}.categoria_ped`, cat)
  }, [ps, vol, scambiatoreIndex, enabled, setValue, getValues])
}

const EssiccatoreRow = ({
  control, index, adv, colCount, scambiatoriFields, appendScambiatore, removeScambiatore, onRemove,
}: {
  control: Control<any>; index: number; adv: boolean; colCount: number
  scambiatoriFields: any[]
  appendScambiatore: (data: any) => void
  removeScambiatore: (i: number) => void
  onRemove: (i: number) => void
}) => {
  const { setValue, trigger } = useFormContext()
  const base = `essiccatori.${index}`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, index + 1)

  const haScambiatore = useWatch({ control, name: `${base}.ha_scambiatore`, defaultValue: false })
  const scambiatoreIndex = scambiatoriFields.findIndex((s: any) => s.essiccatore_associato === code)
  useAutoPedScambiatore(control, scambiatoreIndex, adv && haScambiatore)

  const handleScambiatoreToggle = (checked: boolean) => {
    if (checked) {
      if (scambiatoriFields.findIndex((s: any) => s.essiccatore_associato === code) === -1) {
        appendScambiatore({ codice: `${code}.1`, essiccatore_associato: code })
      }
    } else {
      const i = scambiatoriFields.findIndex((s: any) => s.essiccatore_associato === code)
      if (i !== -1) removeScambiatore(i)
    }
  }

  const handleEssiccatoreOCR = (data: OCRExtractedData) => {
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${base}.anno`, data.anno)
    if (data.pressione_max) setValue(`${base}.pressione_max`, data.pressione_max)
    trigger(base)
  }

  const sbase = scambiatoreIndex !== -1 ? `scambiatori.${scambiatoreIndex}` : ''
  const handleScambiatoreOCR = (data: OCRExtractedData) => {
    if (!sbase) return
    if (data.marca) setValue(`${sbase}.marca`, data.marca)
    if (data.modello) setValue(`${sbase}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${sbase}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${sbase}.anno`, data.anno)
    if (data.volume) setValue(`${sbase}.volume`, data.volume)
    trigger(sbase)
  }

  return (
    <>
      {/* RIGA PRINCIPALE */}
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(ESSICCATORE_COLOR, 0.06) } }}>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <SingleOCRButton equipmentType="Essiccatori" equipmentIndex={index} onOCRComplete={handleEssiccatoreOCR} />
            <Tooltip title="Elimina essiccatore"><span>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Box>
        </Box>
        <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: ESSICCATORE_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>
        <Box component="td" colSpan={2} sx={cellTdSx}>
          <Box sx={{ px: 1, py: 0.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete
                  equipmentType="Essiccatori"
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  size="small" fullWidth
                />
              )} />
            )} />
          </Box>
        </Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.ps_pressione_max`} min={3} max={50} step={0.1} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.volume_aria_trattata`} min={0} max={100000} /></Box>}
        <Box component="td" sx={{ ...cellTdSx, textAlign: 'center' }}>
          <CheckCell control={control} name={`${base}.ha_scambiatore`} onToggle={handleScambiatoreToggle} />
        </Box>
      </Box>

      {/* SOTTO-BANDA SCAMBIATORE */}
      {haScambiatore && scambiatoreIndex !== -1 && (
        <SubBand colSpan={colCount} color={ESSICCATORE_COLOR}>
          <SubBandLabel>{code}.1 · Scambiatore</SubBandLabel>
          <Box sx={{ minWidth: 260, flex: '1 1 300px', '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${sbase}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${sbase}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete
                  equipmentType="Scambiatori"
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  size="small" fullWidth
                />
              )} />
            )} />
          </Box>
          <Field label="N° fabbrica" w={130}><TextCell control={control} name={`${sbase}.n_fabbrica`} placeholder="N° fabbrica" /></Field>
          <Field label="Anno" w={70}><NumberCell control={control} name={`${sbase}.anno`} min={1980} max={2100} /></Field>
          {adv && <Field label="PS bar" w={70}><NumberCell control={control} name={`${sbase}.ps_pressione_max`} min={3} max={50} step={0.1} /></Field>}
          {adv && <Field label="TS °C" w={70}><NumberCell control={control} name={`${sbase}.ts_temperatura`} min={50} max={250} /></Field>}
          {adv && <Field label="Volume L" w={80}><NumberCell control={control} name={`${sbase}.volume`} min={50} max={5000} /></Field>}
          {adv && <Field label="Cat. PED" w={90}><SelectCell control={control} name={`${sbase}.categoria_ped`} options={PED_OPTIONS} /></Field>}
          <Box sx={{ ml: 'auto', alignSelf: 'center' }}>
            <SingleOCRButton equipmentType="Scambiatori" equipmentIndex={scambiatoreIndex} onOCRComplete={handleScambiatoreOCR} />
          </Box>
        </SubBand>
      )}
    </>
  )
}

export const EssiccatoriTable = ({ control }: EssiccatoriTableProps) => {
  const { showAdvancedFields: adv } = useTecnicoDM329Visibility()
  const { fields, append, remove } = useFieldArray({ control, name: 'essiccatori' })
  const { fields: scambiatoriFields, append: appendScambiatore, remove: removeScambiatore } = useFieldArray({ control, name: 'scambiatori' })
  const max = EQUIPMENT_LIMITS.essiccatori.max
  const min = EQUIPMENT_LIMITS.essiccatori.min

  const handleAdd = () => append({
    codice: generateEquipmentCode(EQUIPMENT_LIMITS.essiccatori.prefix, fields.length + 1),
    ha_scambiatore: false,
  })

  const handleRemove = (index: number) => {
    if (fields.length <= min) { window.alert(`Numero minimo di essiccatori: ${min}`); return }
    if (window.confirm(`Confermi di voler eliminare l'essiccatore ${generateEquipmentCode('E', index + 1)}?`)) remove(index)
  }

  const colCount = adv ? 9 : 7

  return (
    <EquipmentTableShell
      letter="E" color={ESSICCATORE_COLOR} title="Essiccatori"
      subtitle="Con eventuale scambiatore da denunciare (E{n}.1)"
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Essiccatore"
    >
      <thead>
        <tr>
          <th aria-label="azioni" />
          <th>Cod.</th>
          <th>Marca</th>
          <th>Modello</th>
          <th>N° fabbrica</th>
          <th className="num">Anno</th>
          {adv && <th className="num">PS bar</th>}
          {adv && <th className="num">Q l/min</th>}
          <th className="ctr">Scamb.</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <EssiccatoreRow
            key={f.id} control={control} index={i} adv={adv} colCount={colCount}
            scambiatoriFields={scambiatoriFields} appendScambiatore={appendScambiatore} removeScambiatore={removeScambiatore}
            onRemove={handleRemove}
          />
        ))}
        {fields.length === 0 && (
          <Box component="tr">
            <Box component="td" colSpan={colCount} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
              Nessun essiccatore. Usa "+ Essiccatore" per iniziare.
            </Box>
          </Box>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
