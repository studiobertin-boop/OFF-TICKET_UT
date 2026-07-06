import { useEffect } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon, Warning as WarningIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { Field } from './SubBand'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { EquipmentAutocompleteWithPressure } from '../EquipmentAutocompleteWithPressure'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type FinituraInternaOption, type ScaricoOption, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const SERBATOIO_COLOR = '#5aa6d6'
const FINITURA: FinituraInternaOption[] = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO']
const SCARICO: ScaricoOption[] = ['AUTOMATICO', 'MANUALE', 'ASSENTE']
const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

interface SerbatoiTableProps {
  control: Control<any>
  errors: any
  onSerbatoioOCR: (index: number, data: OCRExtractedData) => void
  onValvolaOCR: (index: number, data: OCRExtractedData) => void
}

/** Effetto auto-calc Categoria PED per un serbatoio (come SerbatoioItem). */
const useAutoPed = (control: Control<any>, index: number, enabled: boolean) => {
  const { setValue } = useFormContext()
  const ps = useWatch({ control, name: `serbatoi.${index}.ps_pressione_max` })
  const vol = useWatch({ control, name: `serbatoi.${index}.volume` })
  useEffect(() => {
    if (!enabled) return
    const cat = calculateCategoriaPED(ps, vol)
    if (cat) setValue(`serbatoi.${index}.categoria_ped`, cat, { shouldValidate: true })
  }, [ps, vol, index, enabled, setValue])
}

const SerbatoioRow = ({
  control, index, adv, colCount, onSerbatoioOCR, onValvolaOCR, onRemove,
}: {
  control: Control<any>; index: number; adv: boolean; colCount: number
  onSerbatoioOCR: (i: number, d: OCRExtractedData) => void
  onValvolaOCR: (i: number, d: OCRExtractedData) => void
  onRemove: (i: number) => void
}) => {
  useAutoPed(control, index, adv)
  const base = `serbatoi.${index}`
  const vbase = `${base}.valvola_sicurezza`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, index + 1)

  return (
    <>
      {/* RIGA PRINCIPALE */}
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(SERBATOIO_COLOR, 0.06) } }}>
        <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: SERBATOIO_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>

        {adv ? (
          <Box component="td" colSpan={2} sx={cellTdSx}>
            <Box sx={{ px: 1, py: 0.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
              <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
                <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                  <EquipmentAutocomplete
                    equipmentType="Serbatoi"
                    marcaValue={m.value || ''} modelloValue={mo.value || ''}
                    onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                    size="small" fullWidth
                  />
                )} />
              )} />
            </Box>
          </Box>
        ) : (
          <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.marca`} placeholder="Marca" /></Box>
        )}

        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.volume`} min={50} max={5000} /></Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.ps_pressione_max`} min={3} max={50} step={0.1} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.ts_temperatura`} min={50} max={250} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.categoria_ped`} options={PED_OPTIONS} /></Box>}
        <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.finitura_interna`} options={FINITURA} /></Box>
        <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.scarico`} options={SCARICO} /></Box>
        <Box component="td" sx={{ ...cellTdSx, textAlign: 'center' }}><CheckCell control={control} name={`${base}.ancorato_terra`} /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.manometro.fondo_scala`} min={10} max={30} step={0.1} /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.manometro.segno_rosso`} min={10} max={30} step={0.1} /></Box>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
            <SingleOCRButton equipmentType="Serbatoi" equipmentIndex={index} onOCRComplete={(d) => onSerbatoioOCR(index, d)} />
            <Tooltip title="Elimina serbatoio"><span>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Box>
        </Box>
      </Box>

      {/* SOTTO-BANDA VALVOLA (obbligatoria, full-span) */}
      <Box component="tr">
        <Box component="td" colSpan={colCount} sx={{ ...cellTdSx, bgcolor: alpha(SERBATOIO_COLOR, 0.05) }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1.5, px: 1.5, py: 1 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.76rem', alignSelf: 'center', pr: 0.5 }}>
              <WarningIcon sx={{ fontSize: 15 }} /> {code}.1 · Valvola
            </Box>
            <Box sx={{ minWidth: 280, flex: '1 1 320px', '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
              <Controller name={`${vbase}.marca`} control={control} render={({ field: m }) => (
                <Controller name={`${vbase}.modello`} control={control} render={({ field: mo }) => (
                  <Controller name={`${vbase}.pressione_taratura`} control={control} render={({ field: p }) => (
                    <EquipmentAutocompleteWithPressure
                      equipmentType="Valvole di sicurezza"
                      marcaValue={m.value || ''} modelloValue={mo.value || ''} pressioneValue={p.value}
                      onMarcaChange={m.onChange} onModelloChange={mo.onChange} onPressioneChange={p.onChange}
                      pressioneLabel="Ptar (bar)" pressioneField="ptar" size="small" fullWidth
                    />
                  )} />
                )} />
              )} />
            </Box>
            <Field label="N° fabbrica" w={130}><TextCell control={control} name={`${vbase}.n_fabbrica`} placeholder="N° fabbrica" /></Field>
            <Field label="Anno" w={70}><NumberCell control={control} name={`${vbase}.anno`} min={1980} max={2100} /></Field>
            <Field label="Diametro" w={90}><TextCell control={control} name={`${vbase}.diametro`} placeholder={'1/2"'} /></Field>
            {adv && <Field label="TS °C" w={70}><NumberCell control={control} name={`${vbase}.ts_temperatura`} min={50} max={250} /></Field>}
            {adv && <Field label="Qmax l/min" w={90}><NumberCell control={control} name={`${vbase}.volume_aria_scaricato`} min={100} max={100000} /></Field>}
            {adv && <Field label="Cat. PED"><ComputedCell value="IV" /></Field>}
            <Box sx={{ ml: 'auto', alignSelf: 'center' }}>
              <SingleOCRButton equipmentType="Serbatoi" equipmentIndex={index} componentType="valvola_sicurezza" onOCRComplete={(d) => onValvolaOCR(index, d)} />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}

export const SerbatoiTable = ({ control, onSerbatoioOCR, onValvolaOCR }: SerbatoiTableProps) => {
  const { showAdvancedFields: adv } = useTecnicoDM329Visibility()
  const { fields, append, remove } = useFieldArray({ control, name: 'serbatoi' })
  const max = EQUIPMENT_LIMITS.serbatoi.max
  const min = EQUIPMENT_LIMITS.serbatoi.min

  const handleAdd = () => append({
    codice: generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, fields.length + 1),
    valvola_sicurezza: {},
    manometro: {},
  })

  const handleRemove = (index: number) => {
    if (fields.length <= min) { window.alert(`Numero minimo di serbatoi: ${min}`); return }
    if (window.confirm(`Confermi di voler eliminare il serbatoio ${generateEquipmentCode('S', index + 1)}?`)) remove(index)
  }

  // n. colonne (per colSpan della sotto-banda valvola)
  const colCount = adv ? 15 : 11

  return (
    <EquipmentTableShell
      letter="S" color={SERBATOIO_COLOR} title="Serbatoi"
      subtitle="Ogni serbatoio ha una valvola di sicurezza (S{n}.1)"
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Serbatoio"
    >
      <thead>
        <tr>
          <th>Cod.</th>
          <th>Marca</th>
          {adv && <th>Modello</th>}
          <th>N° fabbrica</th>
          <th className="num">Anno</th>
          <th className="num">Vol. L</th>
          {adv && <th className="num">PS bar</th>}
          {adv && <th className="num">TS °C</th>}
          {adv && <th>Cat. PED</th>}
          <th>Finitura</th>
          <th>Scarico</th>
          <th className="ctr">Anc.</th>
          <th className="num">Man. fondo</th>
          <th className="num">Man. rosso</th>
          <th aria-label="azioni" />
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <SerbatoioRow
            key={f.id} control={control} index={i} adv={adv} colCount={colCount}
            onSerbatoioOCR={onSerbatoioOCR} onValvolaOCR={onValvolaOCR} onRemove={handleRemove}
          />
        ))}
        {fields.length === 0 && (
          <Box component="tr">
            <Box component="td" colSpan={colCount} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
              Nessun serbatoio. Usa "+ Serbatoio" per iniziare.
            </Box>
          </Box>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
