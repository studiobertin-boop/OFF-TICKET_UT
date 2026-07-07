import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, Card, Typography, Button, IconButton, Tooltip, Menu, MenuItem } from '@mui/material'
import {
  Add as AddIcon, Delete as DeleteIcon, ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon, AddLink as AddLinkIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { Field } from './SubBand'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type CategoriaPED, type EquipmentCatalogType } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'
import {
  EQUIPMENT_DEFS, NEW_EQUIPMENT_KINDS, type EquipmentKind, type EquipmentTypeDef, type AdvKey, type ExtraFieldDef,
} from './equipmentConfig'

const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']
const COL_COUNT = 10

const KIND_COLOR: Record<EquipmentKind, string> = {
  serbatoio: '#5aa6d6', compressore: '#d8a900', disoleatore: '#c99a00', essiccatore: '#4fa564',
  scambiatore: '#3f8f55', filtro: '#e07a4a', recipiente: '#c96a3f', separatore: '#b061c4', valvola: '#8892a0',
}

interface OcrRef { equipmentType: EquipmentCatalogType; equipmentIndex: number; componentType?: 'valvola_sicurezza' }

/** Applica dati OCR ai campi della riga (generico per tutti i tipi). */
const applyOcr = (def: EquipmentTypeDef, base: string, data: OCRExtractedData, setValue: (n: string, v: any) => void) => {
  if (data.marca) setValue(`${base}.marca`, data.marca)
  if (data.modello) setValue(`${base}.modello`, data.modello)
  if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
  if (data.anno) setValue(`${base}.anno`, data.anno)
  if (def.capacitaField && data.volume != null) setValue(`${base}.${def.capacitaField}`, data.volume)
  if (def.pressioneField && data.pressione_max != null) setValue(`${base}.${def.pressioneField}`, data.pressione_max)
  if (data.materiale_n && def.extra.some((e) => e.name === 'materiale_n')) setValue(`${base}.materiale_n`, data.materiale_n)
  if (def.kind === 'valvola' && (data as any).diametro_pressione) setValue(`${base}.diametro`, (data as any).diametro_pressione)
  if (def.mandatoryValvola && data.valvola_sicurezza) {
    const v = data.valvola_sicurezza
    if (v.marca) setValue(`${base}.valvola_sicurezza.marca`, v.marca)
    if (v.modello) setValue(`${base}.valvola_sicurezza.modello`, v.modello)
    if (v.n_fabbrica) setValue(`${base}.valvola_sicurezza.n_fabbrica`, v.n_fabbrica)
    if ((v as any).diametro_pressione) setValue(`${base}.valvola_sicurezza.diametro`, (v as any).diametro_pressione)
  }
  if (def.kind === 'serbatoio' && data.manometro) {
    if (data.manometro.fondo_scala) setValue(`${base}.manometro.fondo_scala`, data.manometro.fondo_scala)
    if (data.manometro.segno_rosso) setValue(`${base}.manometro.segno_rosso`, data.manometro.segno_rosso)
  }
}

/** Auto-calc Categoria PED (PS × capacità) — attivo solo per i tipi con autoPed. */
const useAutoPed = (control: Control<any>, base: string, def: EquipmentTypeDef, enabled: boolean) => {
  const { setValue } = useFormContext()
  const ps = useWatch({ control, name: def.pressioneField ? `${base}.${def.pressioneField}` : `${base}.__noPs` })
  const cap = useWatch({ control, name: def.capacitaField ? `${base}.${def.capacitaField}` : `${base}.__noCap` })
  useEffect(() => {
    if (!enabled || !def.autoPed) return
    const cat = calculateCategoriaPED(ps, cap)
    if (cat) setValue(`${base}.categoria_ped`, cat, { shouldValidate: true })
  }, [ps, cap, enabled, base, def.autoPed, setValue])
}

const extraFieldControl = (control: Control<any>, base: string, f: ExtraFieldDef): ReactNode => {
  const name = `${base}.${f.name}`
  if (f.kind === 'select') return <SelectCell control={control} name={name} options={[...(f.options || [])]} display={f.display} />
  if (f.kind === 'check') return <CheckCell control={control} name={name} />
  if (f.kind === 'number') return <NumberCell control={control} name={name} min={f.min} max={f.max} step={f.step} />
  return <TextCell control={control} name={name} placeholder={f.label} />
}

interface EqRowProps {
  control: Control<any>
  def: EquipmentTypeDef
  base: string
  code: string
  depth: number
  adv: boolean
  ocr: OcrRef
  onDelete: (() => void) | null
  append: { label: string; onClick: () => void } | null
}

const EqRow = ({ control, def, base, code, depth, adv, ocr, onDelete, append }: EqRowProps) => {
  const { setValue } = useFormContext()
  const [expanded, setExpanded] = useState(false)
  useAutoPed(control, base, def, adv)

  const color = KIND_COLOR[def.kind]
  const hidden = (k: AdvKey) => (def.adv?.includes(k) ?? false) && !adv
  const modelloHidden = hidden('modello')

  const handleSelected = (specs: Record<string, any>) => {
    Object.entries(def.specsMap).forEach(([specKey, field]) => {
      const v = specs[specKey]
      if (v === undefined || v === null) return
      setValue(`${base}.${field}`, field === 'ts' ? String(v) : v)
    })
  }

  const catCell = () => {
    if (hidden('cat') || def.cat === false) return null
    if (def.cat === 'IV') return <ComputedCell value="IV" />
    return <SelectCell control={control} name={`${base}.categoria_ped`} options={PED_OPTIONS} w={58} />
  }

  return (
    <>
      <Box component="tr" sx={{ '&:hover > td': { bgcolor: alpha(color, 0.06) } }}>
        {/* AZIONI (a inizio riga) */}
        <Box component="td" sx={{ ...cellTdSx, px: 0.25, whiteSpace: 'nowrap', width: 1 }}>
          <Box sx={{ display: 'flex', gap: 0, alignItems: 'center', '& .MuiIconButton-root': { p: 0.25 } }}>
            {def.extra.length > 0 ? (
              <IconButton size="small" onClick={() => setExpanded((e) => !e)}>
                {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            ) : <Box sx={{ width: 20 }} />}
            <SingleOCRButton equipmentType={ocr.equipmentType} equipmentIndex={ocr.equipmentIndex} componentType={ocr.componentType} onOCRComplete={(d) => applyOcr(def, base, d, setValue)} />
            {onDelete ? (
              <Tooltip title={`Elimina ${def.label.toLowerCase()}`}><span>
                <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
              </span></Tooltip>
            ) : <Box sx={{ width: 26 }} />}
            {append && (
              <Tooltip title={`Appendi ${append.label.toLowerCase()}`}>
                <IconButton size="small" color="primary" onClick={append.onClick}><AddLinkIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* COD. */}
        <Box component="td" sx={{ ...cellTdSx, pl: `${4 + depth * 12}px`, pr: 0.5, whiteSpace: 'nowrap', fontWeight: depth === 0 ? 700 : 600, color: depth === 0 ? color : 'text.secondary', fontSize: depth === 0 ? '0.82rem' : '0.76rem' }}>{code}</Box>

        {/* MARCA / MOD. */}
        {modelloHidden ? (
          <>
            <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.marca`} placeholder="Marca" w={180} /></Box>
            <Box component="td" sx={cellTdSx} />
          </>
        ) : (
          <Box component="td" colSpan={2} sx={cellTdSx}>
            <Box sx={{ px: 0.5, minWidth: 380 }}>
              <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
                <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                  <EquipmentAutocomplete equipmentType={def.catalogType} dense
                    marcaValue={m.value || ''} modelloValue={mo.value || ''}
                    onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                    onEquipmentSelected={handleSelected} size="small" fullWidth />
                )} />
              )} />
            </Box>
          </Box>
        )}

        {/* CAPACITÀ */}
        <Box component="td" sx={cellTdSx}>{def.capacitaField && !hidden('capacita') ? <NumberCell control={control} name={`${base}.${def.capacitaField}`} min={0} max={100000} step={1} w={66} /> : null}</Box>
        {/* PRESSIONE */}
        <Box component="td" sx={cellTdSx}>{def.pressioneField && !hidden('pressione') ? <NumberCell control={control} name={`${base}.${def.pressioneField}`} min={0} max={100} step={0.1} w={52} /> : null}</Box>
        {/* TS (testo libero) */}
        <Box component="td" sx={cellTdSx}>{def.ts && !hidden('ts') ? <TextCell control={control} name={`${base}.ts`} placeholder="°C / ÷" w={78} /> : null}</Box>
        {/* CAT. */}
        <Box component="td" sx={cellTdSx}>{catCell()}</Box>
        {/* ANNO */}
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} w={50} /></Box>
        {/* N.F. */}
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" w={140} /></Box>
      </Box>

      {/* RIGA ESPANSA: campi extra del tipo */}
      {expanded && def.extra.length > 0 && (
        <Box component="tr">
          <Box component="td" colSpan={COL_COUNT} sx={{ ...cellTdSx, bgcolor: alpha(color, 0.05) }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1.5, px: 1.5, py: 1 }}>
              <Typography component="span" sx={{ fontSize: '0.7rem', fontWeight: 700, color, alignSelf: 'center', pr: 0.5 }}>{code} · dettagli</Typography>
              {def.extra.map((f) => (
                <Field key={f.name} label={f.label} w={f.kind === 'check' ? 'auto' as any : (f.kind === 'text' ? 150 : 90)}>
                  {extraFieldControl(control, base, f)}
                </Field>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </>
  )
}

interface UnifiedEquipmentTableProps {
  control: Control<any>
  errors: any
}

export const UnifiedEquipmentTable = ({ control }: UnifiedEquipmentTableProps) => {
  const { showAdvancedFields: adv, showRecipienteFiltro } = useTecnicoDM329Visibility()
  const { setValue } = useFormContext()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

  const serbatoi = useFieldArray({ control, name: 'serbatoi' })
  const compressori = useFieldArray({ control, name: 'compressori' })
  const disoleatori = useFieldArray({ control, name: 'disoleatori' })
  const essiccatori = useFieldArray({ control, name: 'essiccatori' })
  const scambiatori = useFieldArray({ control, name: 'scambiatori' })
  const filtri = useFieldArray({ control, name: 'filtri' })
  const recipienti = useFieldArray({ control, name: 'recipienti_filtro' })
  const separatori = useFieldArray({ control, name: 'separatori' })

  const confirmDel = (label: string, code: string) => window.confirm(`Confermi di voler eliminare ${label} ${code}?`)

  const addNew = (kind: EquipmentKind) => {
    setMenuAnchor(null)
    switch (kind) {
      case 'serbatoio':
        serbatoi.append({ codice: generateEquipmentCode('S', serbatoi.fields.length + 1), valvola_sicurezza: {}, manometro: {} }); break
      case 'compressore':
        compressori.append({ codice: generateEquipmentCode('C', compressori.fields.length + 1), ha_disoleatore: false }); break
      case 'essiccatore':
        essiccatori.append({ codice: generateEquipmentCode('E', essiccatori.fields.length + 1), ha_scambiatore: false }); break
      case 'filtro':
        filtri.append({ codice: generateEquipmentCode('F', filtri.fields.length + 1), ha_recipiente: false }); break
      case 'separatore':
        separatori.append({ codice: generateEquipmentCode('SEP', separatori.fields.length + 1) }); break
    }
  }

  const rows: ReactNode[] = []

  serbatoi.fields.forEach((f, i) => {
    const code = generateEquipmentCode('S', i + 1)
    rows.push(<EqRow key={`s-${f.id}`} control={control} def={EQUIPMENT_DEFS.serbatoio} base={`serbatoi.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i }}
      onDelete={() => { if (serbatoi.fields.length <= EQUIPMENT_LIMITS.serbatoi.min) { window.alert(`Minimo ${EQUIPMENT_LIMITS.serbatoi.min} serbatoio`); return } if (confirmDel('il serbatoio', code)) serbatoi.remove(i) }}
      append={null} />)
    rows.push(<EqRow key={`s-${f.id}-v`} control={control} def={EQUIPMENT_DEFS.valvola} base={`serbatoi.${i}.valvola_sicurezza`} code={`${code}.1`} depth={1} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i, componentType: 'valvola_sicurezza' }} onDelete={null} append={null} />)
  })

  compressori.fields.forEach((f, i) => {
    const code = generateEquipmentCode('C', i + 1)
    const dIdx = disoleatori.fields.findIndex((d: any) => d.compressore_associato === code)
    rows.push(<EqRow key={`c-${f.id}`} control={control} def={EQUIPMENT_DEFS.compressore} base={`compressori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Compressori', equipmentIndex: i }}
      onDelete={() => { if (compressori.fields.length <= EQUIPMENT_LIMITS.compressori.min) { window.alert('Minimo 1 compressore'); return } if (confirmDel('il compressore', code)) { if (dIdx >= 0) disoleatori.remove(dIdx); compressori.remove(i) } }}
      append={dIdx === -1 ? { label: 'Disoleatore', onClick: () => { disoleatori.append({ codice: `${code}.1`, compressore_associato: code, valvola_sicurezza: {} }); setValue(`compressori.${i}.ha_disoleatore`, true) } } : null} />)
    if (dIdx >= 0) {
      rows.push(<EqRow key={`c-${f.id}-d`} control={control} def={EQUIPMENT_DEFS.disoleatore} base={`disoleatori.${dIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx }}
        onDelete={() => { if (confirmDel('il disoleatore', `${code}.1`)) { disoleatori.remove(dIdx); setValue(`compressori.${i}.ha_disoleatore`, false) } }} append={null} />)
      rows.push(<EqRow key={`c-${f.id}-dv`} control={control} def={EQUIPMENT_DEFS.valvola} base={`disoleatori.${dIdx}.valvola_sicurezza`} code={`${code}.2`} depth={2} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx, componentType: 'valvola_sicurezza' }} onDelete={null} append={null} />)
    }
  })

  essiccatori.fields.forEach((f, i) => {
    const code = generateEquipmentCode('E', i + 1)
    const sIdx = scambiatori.fields.findIndex((s: any) => s.essiccatore_associato === code)
    rows.push(<EqRow key={`e-${f.id}`} control={control} def={EQUIPMENT_DEFS.essiccatore} base={`essiccatori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Essiccatori', equipmentIndex: i }}
      onDelete={() => { if (essiccatori.fields.length <= EQUIPMENT_LIMITS.essiccatori.min) { window.alert('Minimo 1 essiccatore'); return } if (confirmDel("l'essiccatore", code)) { if (sIdx >= 0) scambiatori.remove(sIdx); essiccatori.remove(i) } }}
      append={sIdx === -1 ? { label: 'Scambiatore', onClick: () => { scambiatori.append({ codice: `${code}.1`, essiccatore_associato: code }); setValue(`essiccatori.${i}.ha_scambiatore`, true) } } : null} />)
    if (sIdx >= 0) {
      rows.push(<EqRow key={`e-${f.id}-s`} control={control} def={EQUIPMENT_DEFS.scambiatore} base={`scambiatori.${sIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Scambiatori', equipmentIndex: sIdx }}
        onDelete={() => { if (confirmDel('lo scambiatore', `${code}.1`)) { scambiatori.remove(sIdx); setValue(`essiccatori.${i}.ha_scambiatore`, false) } }} append={null} />)
    }
  })

  filtri.fields.forEach((f, i) => {
    const code = generateEquipmentCode('F', i + 1)
    const rIdx = recipienti.fields.findIndex((r: any) => r.filtro_associato === code)
    rows.push(<EqRow key={`f-${f.id}`} control={control} def={EQUIPMENT_DEFS.filtro} base={`filtri.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Filtri', equipmentIndex: i }}
      onDelete={() => { if (filtri.fields.length <= EQUIPMENT_LIMITS.filtri.min) { window.alert('Minimo 1 filtro'); return } if (confirmDel('il filtro', code)) { if (rIdx >= 0) recipienti.remove(rIdx); filtri.remove(i) } }}
      append={(showRecipienteFiltro && rIdx === -1) ? { label: 'Recipiente', onClick: () => { recipienti.append({ codice: `${code}.1`, filtro_associato: code }); setValue(`filtri.${i}.ha_recipiente`, true) } } : null} />)
    if (rIdx >= 0 && showRecipienteFiltro) {
      rows.push(<EqRow key={`f-${f.id}-r`} control={control} def={EQUIPMENT_DEFS.recipiente} base={`recipienti_filtro.${rIdx}`} code={`${code}.1`} depth={1} adv={adv}
        ocr={{ equipmentType: 'Recipienti filtro', equipmentIndex: rIdx }}
        onDelete={() => { if (confirmDel('il recipiente', `${code}.1`)) { recipienti.remove(rIdx); setValue(`filtri.${i}.ha_recipiente`, false) } }} append={null} />)
    }
  })

  separatori.fields.forEach((f, i) => {
    const code = generateEquipmentCode('SEP', i + 1)
    rows.push(<EqRow key={`sep-${f.id}`} control={control} def={EQUIPMENT_DEFS.separatore} base={`separatori.${i}`} code={code} depth={0} adv={adv}
      ocr={{ equipmentType: 'Separatori', equipmentIndex: i }}
      onDelete={() => { if (separatori.fields.length <= EQUIPMENT_LIMITS.separatori.min) { window.alert('Minimo 1 separatore'); return } if (confirmDel('il separatore', code)) separatori.remove(i) }} append={null} />)
  })

  const total = serbatoi.fields.length + compressori.fields.length + essiccatori.fields.length + filtri.fields.length + separatori.fields.length

  return (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: `${radii.card}px` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Apparecchiature</Typography>
        <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{total} principali</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ ml: 'auto' }}>
          Nuova apparecchiatura
        </Button>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {NEW_EQUIPMENT_KINDS.map((k) => (
            <MenuItem key={k} onClick={() => addNew(k)}>
              <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: KIND_COLOR[k], mr: 1.5 }} />
              {EQUIPMENT_DEFS[k].label}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse', width: '100%', minWidth: 'max-content',
            '& th': {
              position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.1, verticalAlign: 'bottom',
              fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
              color: 'text.primary', bgcolor: 'background.paper', p: '5px 6px', borderBottom: '2px solid', borderColor: 'divider',
            },
            '& th.num': { textAlign: 'right' },
          }}
        >
          <thead>
            <tr>
              <th aria-label="azioni" />
              <th>Cod.</th>
              <th>Marca</th>
              <th>Mod.</th>
              <th className="num">Vol [l]<br />Qmax [l/min]<br />FAD [l/min]</th>
              <th className="num">PS [bar]<br />Ptar [bar]</th>
              <th>TS [°C]</th>
              <th>Cat.</th>
              <th className="num">Anno</th>
              <th>N.F.</th>
            </tr>
          </thead>
          <tbody>
            {rows}
            {total === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={COL_COUNT} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
                  Nessuna apparecchiatura. Usa "Nuova apparecchiatura" per iniziare.
                </Box>
              </Box>
            )}
          </tbody>
        </Box>
      </Box>
    </Card>
  )
}
