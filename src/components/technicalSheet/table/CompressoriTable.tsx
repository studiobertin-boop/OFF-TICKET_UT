import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon, Warning as WarningIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { Field, SubBand, SubBandLabel, BandBreak } from './SubBand'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { EquipmentAutocompleteWithPressure } from '../EquipmentAutocompleteWithPressure'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const COMPRESSORE_COLOR = '#d8a900'
const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

interface CompressoriTableProps {
  control: Control<any>
  errors: any
}

const CompressoreRow = ({
  control, index, adv, colCount, disoleatoriFields, appendDisoleatore, removeDisoleatore, onRemove,
}: {
  control: Control<any>; index: number; adv: boolean; colCount: number
  disoleatoriFields: any[]
  appendDisoleatore: (data: any) => void
  removeDisoleatore: (i: number) => void
  onRemove: (i: number) => void
}) => {
  const { setValue, trigger } = useFormContext()
  const base = `compressori.${index}`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, index + 1)

  const haDisoleatore = useWatch({ control, name: `${base}.ha_disoleatore`, defaultValue: false })
  const disoleatoreIndex = disoleatoriFields.findIndex((d: any) => d.compressore_associato === code)

  const handleDisoleatoreToggle = (checked: boolean) => {
    if (checked) {
      if (disoleatoriFields.findIndex((d: any) => d.compressore_associato === code) === -1) {
        appendDisoleatore({ codice: `${code}.1`, compressore_associato: code, valvola_sicurezza: {} })
      }
    } else {
      const i = disoleatoriFields.findIndex((d: any) => d.compressore_associato === code)
      if (i !== -1) removeDisoleatore(i)
    }
  }

  const handleCompressorEquipmentSelected = (specs: Record<string, any>) => {
    if (specs.fad !== undefined) {
      setValue(`${base}.volume_aria_prodotto`, specs.fad)
      setValue(`${base}.fad`, specs.fad)
    }
  }

  const handleCompressorOCR = (data: OCRExtractedData) => {
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${base}.anno`, data.anno)
    if (data.pressione_max) setValue(`${base}.pressione_max`, data.pressione_max)
    if (data.materiale_n) setValue(`${base}.materiale_n`, data.materiale_n)
    trigger(base)
  }

  const dbase = disoleatoreIndex !== -1 ? `disoleatori.${disoleatoreIndex}` : ''

  const handleDisoleatoreOCR = (data: OCRExtractedData) => {
    if (!dbase) return
    if (data.marca) setValue(`${dbase}.marca`, data.marca)
    if (data.modello) setValue(`${dbase}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${dbase}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${dbase}.anno`, data.anno)
    if (data.volume) setValue(`${dbase}.volume`, data.volume)
    if (data.valvola_sicurezza) {
      const v = data.valvola_sicurezza
      if (v.marca) setValue(`${dbase}.valvola_sicurezza.marca`, v.marca)
      if (v.modello) setValue(`${dbase}.valvola_sicurezza.modello`, v.modello)
      if (v.n_fabbrica) setValue(`${dbase}.valvola_sicurezza.n_fabbrica`, v.n_fabbrica)
      if (v.diametro_pressione) setValue(`${dbase}.valvola_sicurezza.diametro_pressione`, v.diametro_pressione)
    }
    trigger(dbase)
  }

  const handleDisoleatoreValvolaOCR = (data: OCRExtractedData) => {
    if (!dbase) return
    const vb = `${dbase}.valvola_sicurezza`
    if (data.marca) setValue(`${vb}.marca`, data.marca)
    if (data.modello) setValue(`${vb}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${vb}.n_fabbrica`, data.n_fabbrica)
    if (data.diametro_pressione) setValue(`${vb}.diametro_pressione`, data.diametro_pressione)
    trigger(vb)
  }

  return (
    <>
      {/* RIGA PRINCIPALE */}
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(COMPRESSORE_COLOR, 0.06) } }}>
        <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: COMPRESSORE_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>
        <Box component="td" colSpan={3} sx={cellTdSx}>
          <Box sx={{ px: 1, py: 0.5, '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                <Controller name={`${base}.pressione_max`} control={control} render={({ field: p }) => (
                  <EquipmentAutocompleteWithPressure
                    equipmentType="Compressori"
                    marcaValue={m.value || ''} modelloValue={mo.value || ''} pressioneValue={p.value}
                    onMarcaChange={m.onChange} onModelloChange={mo.onChange} onPressioneChange={p.onChange}
                    onEquipmentSelected={handleCompressorEquipmentSelected}
                    pressioneLabel="Pressione Max (bar)" pressioneField="pressione_max" size="small" fullWidth
                  />
                )} />
              )} />
            )} />
          </Box>
        </Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.materiale_n`} placeholder="Materiale N°" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.volume_aria_prodotto`} min={0} max={100000} /></Box>}
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.note`} placeholder="Note" /></Box>
        <Box component="td" sx={{ ...cellTdSx, textAlign: 'center' }}>
          <CheckCell control={control} name={`${base}.ha_disoleatore`} onToggle={handleDisoleatoreToggle} />
        </Box>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
            <SingleOCRButton equipmentType="Compressori" equipmentIndex={index} onOCRComplete={handleCompressorOCR} />
            <Tooltip title="Elimina compressore"><span>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Box>
        </Box>
      </Box>

      {/* SOTTO-BANDA DISOLEATORE + VALVOLA (se presente) */}
      {haDisoleatore && disoleatoreIndex !== -1 && (
        <SubBand colSpan={colCount} color={COMPRESSORE_COLOR}>
          <SubBandLabel>{code}.1 · Disoleatore</SubBandLabel>
          <Box sx={{ minWidth: 260, flex: '1 1 300px', '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${dbase}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${dbase}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete
                  equipmentType="Disoleatori"
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  size="small" fullWidth
                />
              )} />
            )} />
          </Box>
          <Field label="N° fabbrica" w={130}><TextCell control={control} name={`${dbase}.n_fabbrica`} placeholder="N° fabbrica" /></Field>
          <Field label="Anno" w={70}><NumberCell control={control} name={`${dbase}.anno`} min={1980} max={2100} /></Field>
          <Field label="Volume L" w={80}><NumberCell control={control} name={`${dbase}.volume`} min={50} max={5000} /></Field>
          {adv && <Field label="PS bar" w={70}><NumberCell control={control} name={`${dbase}.ps_pressione_max`} min={3} max={50} step={0.1} /></Field>}
          {adv && <Field label="TS °C" w={70}><NumberCell control={control} name={`${dbase}.ts_temperatura`} min={50} max={250} /></Field>}
          {adv && <Field label="Cat. PED" w={90}><SelectCell control={control} name={`${dbase}.categoria_ped`} options={PED_OPTIONS} /></Field>}
          <Box sx={{ alignSelf: 'center' }}>
            <SingleOCRButton equipmentType="Disoleatori" equipmentIndex={disoleatoreIndex} onOCRComplete={handleDisoleatoreOCR} />
          </Box>

          <BandBreak />

          <SubBandLabel icon={<WarningIcon sx={{ fontSize: 15 }} />}>{code}.2 · Valvola</SubBandLabel>
          <Box sx={{ minWidth: 280, flex: '1 1 320px', '& .MuiInputBase-root': { fontSize: '0.82rem' } }}>
            <Controller name={`${dbase}.valvola_sicurezza.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${dbase}.valvola_sicurezza.modello`} control={control} render={({ field: mo }) => (
                <Controller name={`${dbase}.valvola_sicurezza.pressione_taratura`} control={control} render={({ field: p }) => (
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
          <Field label="N° fabbrica" w={130}><TextCell control={control} name={`${dbase}.valvola_sicurezza.n_fabbrica`} placeholder="N° fabbrica" /></Field>
          <Field label="Anno" w={70}><NumberCell control={control} name={`${dbase}.valvola_sicurezza.anno`} min={1980} max={2100} /></Field>
          <Field label="Diametro" w={90}><TextCell control={control} name={`${dbase}.valvola_sicurezza.diametro`} placeholder={'1/2"'} /></Field>
          {adv && <Field label="TS °C" w={70}><NumberCell control={control} name={`${dbase}.valvola_sicurezza.ts_temperatura`} min={50} max={250} /></Field>}
          {adv && <Field label="Qmax l/min" w={90}><NumberCell control={control} name={`${dbase}.valvola_sicurezza.volume_aria_scaricato`} min={100} max={100000} /></Field>}
          {adv && <Field label="Cat. PED"><ComputedCell value="IV" /></Field>}
          <Box sx={{ ml: 'auto', alignSelf: 'center' }}>
            <SingleOCRButton equipmentType="Disoleatori" equipmentIndex={disoleatoreIndex} componentType="valvola_sicurezza" onOCRComplete={handleDisoleatoreValvolaOCR} />
          </Box>
        </SubBand>
      )}
    </>
  )
}

export const CompressoriTable = ({ control }: CompressoriTableProps) => {
  const { showAdvancedFields: adv } = useTecnicoDM329Visibility()
  const { fields, append, remove } = useFieldArray({ control, name: 'compressori' })
  const { fields: disoleatoriFields, append: appendDisoleatore, remove: removeDisoleatore } = useFieldArray({ control, name: 'disoleatori' })
  const max = EQUIPMENT_LIMITS.compressori.max
  const min = EQUIPMENT_LIMITS.compressori.min

  const handleAdd = () => append({
    codice: generateEquipmentCode(EQUIPMENT_LIMITS.compressori.prefix, fields.length + 1),
    ha_disoleatore: false,
  })

  const handleRemove = (index: number) => {
    if (fields.length <= min) { window.alert(`Numero minimo di compressori: ${min}`); return }
    if (window.confirm(`Confermi di voler eliminare il compressore ${generateEquipmentCode('C', index + 1)}?`)) remove(index)
  }

  const colCount = adv ? 11 : 10

  return (
    <EquipmentTableShell
      letter="C" color={COMPRESSORE_COLOR} title="Compressori"
      subtitle="Con eventuale disoleatore da denunciare (C{n}.1)"
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Compressore"
    >
      <thead>
        <tr>
          <th>Cod.</th>
          <th>Marca</th>
          <th>Modello</th>
          <th className="num">Press.</th>
          <th>N° fabbrica</th>
          <th>Materiale N°</th>
          <th className="num">Anno</th>
          {adv && <th className="num">FAD l/min</th>}
          <th>Note</th>
          <th className="ctr">Disol.</th>
          <th aria-label="azioni" />
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <CompressoreRow
            key={f.id} control={control} index={i} adv={adv} colCount={colCount}
            disoleatoriFields={disoleatoriFields} appendDisoleatore={appendDisoleatore} removeDisoleatore={removeDisoleatore}
            onRemove={handleRemove}
          />
        ))}
        {fields.length === 0 && (
          <Box component="tr">
            <Box component="td" colSpan={colCount} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
              Nessun compressore. Usa "+ Compressore" per iniziare.
            </Box>
          </Box>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
