import { useEffect } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, InputBase, Tooltip } from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type FinituraInternaOption, type ScaricoOption, type CategoriaPED } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const SERBATOIO_COLOR = '#5aa6d6'
const FINITURA: FinituraInternaOption[] = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO']
const SCARICO: ScaricoOption[] = ['AUTOMATICO', 'MANUALE', 'ASSENTE']
const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']
const FINITURA_ABBR = { VERNICIATO: 'V', ZINCATO: 'Z', VITROFLEX: 'VF', ALTRO: 'A' }
const SCARICO_ABBR = { AUTOMATICO: 'A', MANUALE: 'M', ASSENTE: '—' }

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

/** Cella manometro compatta: due valori fondo/rosso in una colonna (es. 16/11). */
const ManometroCell = ({ control, index }: { control: Control<any>; index: number }) => {
  const numSx = { width: 34, fontSize: '0.82rem', '& input': { p: 0, textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums' } }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.4 }}>
      <Controller name={`serbatoi.${index}.manometro.fondo_scala`} control={control} render={({ field }) => (
        <InputBase {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} type="number" placeholder="F" inputProps={{ min: 10, max: 30, step: 0.1 }} sx={numSx} />
      )} />
      <Box component="span" sx={{ color: 'text.disabled' }}>/</Box>
      <Controller name={`serbatoi.${index}.manometro.segno_rosso`} control={control} render={({ field }) => (
        <InputBase {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} type="number" placeholder="R" inputProps={{ min: 10, max: 30, step: 0.1 }} sx={numSx} />
      )} />
    </Box>
  )
}

const SerbatoioRow = ({
  control, index, adv, onSerbatoioOCR, onValvolaOCR, onRemove,
}: {
  control: Control<any>; index: number; adv: boolean
  onSerbatoioOCR: (i: number, d: OCRExtractedData) => void
  onValvolaOCR: (i: number, d: OCRExtractedData) => void
  onRemove: (i: number) => void
}) => {
  const { setValue } = useFormContext()
  useAutoPed(control, index, adv)
  const base = `serbatoi.${index}`
  const vbase = `${base}.valvola_sicurezza`
  const code = generateEquipmentCode(EQUIPMENT_LIMITS.serbatoi.prefix, index + 1)

  // Precompilazione valvola dal catalogo (marca+modello → Ptar, TS, Qmax, Ø)
  const handleValvolaSelected = (specs: Record<string, any>) => {
    if (specs.ptar !== undefined) setValue(`${vbase}.pressione_taratura`, specs.ptar)
    if (specs.ts !== undefined) setValue(`${vbase}.ts_temperatura`, specs.ts)
    if (specs.qmax !== undefined) setValue(`${vbase}.volume_aria_scaricato`, specs.qmax)
    if (specs.diametro !== undefined) setValue(`${vbase}.diametro`, specs.diametro)
  }

  return (
    <>
      {/* RIGA SERBATOIO */}
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(SERBATOIO_COLOR, 0.06) } }}>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <SingleOCRButton equipmentType="Serbatoi" equipmentIndex={index} onOCRComplete={(d) => onSerbatoioOCR(index, d)} />
            <Tooltip title="Elimina serbatoio"><span>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}><DeleteIcon fontSize="small" /></IconButton>
            </span></Tooltip>
          </Box>
        </Box>
        <Box component="td" sx={{ ...cellTdSx, fontWeight: 700, color: SERBATOIO_COLOR, px: 1.5, whiteSpace: 'nowrap' }}>{code}</Box>

        {adv ? (
          <Box component="td" colSpan={2} sx={cellTdSx}>
            <Box sx={{ px: 0.5 }}>
              <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
                <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                  <EquipmentAutocomplete equipmentType="Serbatoi" dense
                    marcaValue={m.value || ''} modelloValue={mo.value || ''}
                    onMarcaChange={m.onChange} onModelloChange={mo.onChange} size="small" fullWidth />
                )} />
              )} />
            </Box>
          </Box>
        ) : (
          <>
            <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.marca`} placeholder="Marca" /></Box>
            <Box component="td" sx={cellTdSx} />
          </>
        )}

        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.volume`} min={50} max={5000} /></Box>
        <Box component="td" sx={cellTdSx}>{adv ? <NumberCell control={control} name={`${base}.ps_pressione_max`} min={3} max={50} step={0.1} /> : null}</Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.ts_temperatura`} min={50} max={250} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.categoria_ped`} options={PED_OPTIONS} /></Box>}
        <Box component="td" sx={cellTdSx} />{/* Ø: solo valvola */}
        <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.finitura_interna`} options={FINITURA} display={FINITURA_ABBR} /></Box>
        <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.scarico`} options={SCARICO} display={SCARICO_ABBR} /></Box>
        <Box component="td" sx={{ ...cellTdSx, textAlign: 'center' }}><CheckCell control={control} name={`${base}.ancorato_terra`} /></Box>
        <Box component="td" sx={cellTdSx}><ManometroCell control={control} index={index} /></Box>
      </Box>

      {/* RIGA VALVOLA (allineata alle stesse colonne) */}
      <Box component="tr" sx={{ '& > td': { bgcolor: alpha(SERBATOIO_COLOR, 0.05) } }}>
        <Box component="td" sx={{ ...cellTdSx, px: 0.5, whiteSpace: 'nowrap' }}>
          <SingleOCRButton equipmentType="Serbatoi" equipmentIndex={index} componentType="valvola_sicurezza" onOCRComplete={(d) => onValvolaOCR(index, d)} />
        </Box>
        <Box component="td" sx={{ ...cellTdSx, pl: 2.5, whiteSpace: 'nowrap', color: 'text.secondary', fontWeight: 600, fontSize: '0.76rem' }}>{code}.1</Box>
        <Box component="td" colSpan={2} sx={cellTdSx}>
          <Box sx={{ px: 0.5 }}>
            <Controller name={`${vbase}.marca`} control={control} render={({ field: m }) => (
              <Controller name={`${vbase}.modello`} control={control} render={({ field: mo }) => (
                <EquipmentAutocomplete equipmentType="Valvole di sicurezza" dense
                  marcaValue={m.value || ''} modelloValue={mo.value || ''}
                  onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                  onEquipmentSelected={handleValvolaSelected} size="small" fullWidth />
              )} />
            )} />
          </Box>
        </Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${vbase}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.anno`} min={1980} max={2100} /></Box>
        <Box component="td" sx={cellTdSx}>{adv ? <NumberCell control={control} name={`${vbase}.volume_aria_scaricato`} min={100} max={100000} /> : null}</Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.pressione_taratura`} min={0} step={0.1} /></Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.ts_temperatura`} min={50} max={250} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><ComputedCell value="IV" /></Box>}
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${vbase}.diametro`} placeholder={'Ø 1/2"'} /></Box>
        <Box component="td" sx={cellTdSx} />{/* Finitura */}
        <Box component="td" sx={cellTdSx} />{/* Scarico */}
        <Box component="td" sx={cellTdSx} />{/* Anc. */}
        <Box component="td" sx={cellTdSx} />{/* Man. */}
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

  const colCount = adv ? 15 : 13

  return (
    <EquipmentTableShell
      letter="S" color={SERBATOIO_COLOR} title="Serbatoi"
      count={fields.length} max={max} canAdd={fields.length < max} onAdd={handleAdd} addLabel="Serbatoio"
    >
      <thead>
        <tr>
          <th aria-label="azioni" />
          <th>Cod.</th>
          <th>Marca</th>
          <th>Modello</th>
          <th>N°<br />fabbr.</th>
          <th className="num">Anno</th>
          <th className="num">Vol L /<br />Qmax</th>
          <th className="num">PS /<br />Ptar</th>
          {adv && <th className="num">TS<br />°C</th>}
          {adv && <th>Cat.<br />PED</th>}
          <th>Ø</th>
          <th>Fin.</th>
          <th>Scar.</th>
          <th className="ctr">Anc.</th>
          <th className="num">Man.<br />F/R</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <SerbatoioRow
            key={f.id} control={control} index={i} adv={adv}
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
