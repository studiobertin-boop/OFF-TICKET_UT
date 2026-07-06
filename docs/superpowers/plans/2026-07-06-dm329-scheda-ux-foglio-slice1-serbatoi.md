# DM329 Scheda UX "Foglio" — Slice 1 (Serbatoi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la UI a card impilate dei Serbatoi della scheda DM329 con una tabella densa ("foglio di calcolo"), costruendo le fondamenta riutilizzabili (celle + guscio tabella) per le sezioni successive, senza alterare dati, salvataggio o logiche.

**Architecture:** Un guscio presentazionale `EquipmentTableShell` (Card + testata + scroll orizzontale + riga "aggiungi") e un set di celle tipizzate (`EquipmentCells`) che avvolgono i `Controller` di react-hook-form. `SerbatoiTable` compone guscio + celle per rendere una riga per serbatoio, con valvola di sicurezza come **sotto-riga** obbligatoria e manometro come **2 colonne**. `SerbatoiSection` viene modificata per montare `SerbatoiTable` mantenendo `useFieldArray` e gli handler OCR esistenti. Le sezioni restano dentro l'accordion attuale (l'header compatto e la navigazione sono slice successivi).

**Tech Stack:** React 18 + TypeScript, MUI 6 (dark), react-hook-form 7, Vite/Vitest.

## Global Constraints

- **Nessuna modifica** a: `SchedaDatiCompleta`/tipi ([src/types/technicalSheet.ts](../../../src/types/technicalSheet.ts)), API, schema DB, salvataggio `equipment_data` JSONB, OCR backend, calcolo PED.
- **Stile:** solo token/tema esistenti — palette [src/theme/palette.ts](../../../src/theme/palette.ts), `radii`/`density` da [src/theme/tokens.ts](../../../src/theme/tokens.ts). Niente palette nuove.
- **Convenzione test del progetto (CLAUDE.md):** "Vitest per workflow logic, validations, calculations (no UI test)". Questo slice è assemblaggio UI senza nuova logica pura → **verifica = `npm run build:check` + `npm run lint` + verifica manuale nel browser**. Non si scrivono test UI.
- **Comandi:** typecheck+build `npm run build:check` · lint `npm run lint` · dev server `npm run dev` · test `npm run test`.
- **Tinte per tipo** (hex, coerenti con gli accordion attuali): Serbatoi `#5aa6d6`.
- **Visibilità `tecnicoDM329`** via [useTecnicoDM329Visibility](../../../src/hooks/useTecnicoDM329Visibility.ts): per i Serbatoi sono avanzati (nascosti) `modello`, `ps_pressione_max`, `ts_temperatura`, `categoria_ped`; per la valvola `ts_temperatura`, `volume_aria_scaricato`, `categoria_ped`.
- **Logiche da preservare** (checklist di accettazione — vedi spec [2026-07-06-dm329-scheda-ux-foglio-design.md](../specs/2026-07-06-dm329-scheda-ux-foglio-design.md) §4): codifiche automatiche, precompilazione autocomplete marca/modello + valvola 3-step, auto-fill specs da catalogo, auto-calcolo Categoria PED (PS×Volume), OCR singolo serbatoio, OCR singolo valvola, OCR batch invariato, visibilità tecnicoDM329, autosave, validazioni range.

---

### Task 1: Celle tipizzate della tabella

**Files:**
- Create: `src/components/technicalSheet/table/EquipmentCells.tsx`

**Interfaces:**
- Consumes: `Control` da react-hook-form; tema MUI.
- Produces (consumati da Task 3):
  - `TextCell({ control, name, placeholder?, disabled? })`
  - `NumberCell({ control, name, min?, max?, step?, placeholder?, disabled? })` — parse a `number | undefined`, allineata a destra, `tabular-nums`.
  - `SelectCell({ control, name, options, disabled? })`
  - `CheckCell({ control, name, onToggle? })` — `onToggle?: (checked: boolean) => void` per side-effect (relazioni padre-figlio).
  - `ComputedCell({ value, badge? })` — sola lettura; `badge?: 'auto' | 'cat'`.
  - `cellTdSx` — oggetto `sx` per i `<td>` (padding 0, bordo, allineamento verticale).

- [ ] **Step 1: Creare il file con le celle**

```tsx
import { Controller, type Control } from 'react-hook-form'
import { InputBase, Select, MenuItem, Checkbox, Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

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

export const NumberCell = ({ control, name, min, max, step, placeholder, disabled }: CellBase & { min?: number; max?: number; step?: number; placeholder?: string }) => (
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
        sx={{ fontSize: '0.82rem', px: 1.25, py: 0.4, '& .MuiSelect-select': { py: 0.5 } }}
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

export const ComputedCell = ({ value, badge }: { value: React.ReactNode; badge?: 'auto' | 'cat' }) => (
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build:check`
Expected: PASS (nessun errore TS relativo a `table/EquipmentCells.tsx`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/technicalSheet/table/EquipmentCells.tsx
git commit -m "feat(dm329): celle tipizzate per la tabella scheda (foglio)"
```

---

### Task 2: Guscio tabella riutilizzabile

**Files:**
- Create: `src/components/technicalSheet/table/EquipmentTableShell.tsx`

**Interfaces:**
- Consumes: tema MUI, icone `@mui/icons-material`.
- Produces (consumato da Task 3):
  - `EquipmentTableShell({ letter, color, title, subtitle?, count, max, onAdd, canAdd, addLabel, headerActions?, children })`
    - `letter: string` (es. "S"), `color: string` (hex tinta), `count: number`, `max: number`, `canAdd: boolean`, `onAdd: () => void`, `addLabel: string`, `headerActions?: React.ReactNode`, `children: React.ReactNode` (il contenuto `<thead>`/`<tbody>`).

- [ ] **Step 1: Creare il guscio**

```tsx
import type { ReactNode } from 'react'
import { Card, Box, Typography, Chip, Button } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'

interface EquipmentTableShellProps {
  letter: string
  color: string
  title: string
  subtitle?: string
  count: number
  max: number
  onAdd: () => void
  canAdd: boolean
  addLabel: string
  headerActions?: ReactNode
  children: ReactNode
}

export const EquipmentTableShell = ({
  letter, color, title, subtitle, count, max, onAdd, canAdd, addLabel, headerActions, children,
}: EquipmentTableShellProps) => (
  <Card variant="outlined" sx={{ mb: 2, overflow: 'hidden', borderRadius: `${radii.card}px` }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(color, 0.08) }}>
      <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.85rem', flex: '0 0 auto' }}>
        {letter}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontSize: '0.98rem', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle ? <Typography variant="caption" color="text.secondary">{subtitle}</Typography> : null}
      </Box>
      <Chip label={`${count}/${max}`} size="small" variant="outlined" color={count === 0 ? 'error' : 'primary'} sx={{ ml: 1 }} />
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        {headerActions}
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd} disabled={!canAdd}>
          {addLabel}
        </Button>
      </Box>
    </Box>
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: 'max-content',
          '& th': {
            position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'nowrap',
            fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'text.secondary', bgcolor: 'action.hover', p: '8px 10px',
            borderBottom: '1px solid', borderColor: 'divider',
          },
          '& th.num': { textAlign: 'right' },
          '& th.ctr': { textAlign: 'center' },
        }}
      >
        {children}
      </Box>
    </Box>
  </Card>
)
```

- [ ] **Step 2: Typecheck**

Run: `npm run build:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/technicalSheet/table/EquipmentTableShell.tsx
git commit -m "feat(dm329): guscio tabella riutilizzabile per la scheda (foglio)"
```

---

### Task 3: SerbatoiTable (riga + sotto-riga valvola + manometro)

**Files:**
- Create: `src/components/technicalSheet/table/SerbatoiTable.tsx`

**Interfaces:**
- Consumes: celle da Task 1, guscio da Task 2, `EquipmentAutocomplete`/`EquipmentAutocompleteWithPressure` esistenti, `useTecnicoDM329Visibility`, `calculateCategoriaPED`, `EQUIPMENT_LIMITS`, `generateEquipmentCode`, `SingleOCRButton`.
- Produces (consumato da Task 4):
  - `SerbatoiTable({ control, errors, onSerbatoioOCR, onValvolaOCR })`
    - `control: Control<any>`, `errors: any`
    - `onSerbatoioOCR: (index: number, data: OCRExtractedData) => void`
    - `onValvolaOCR: (index: number, data: OCRExtractedData) => void`
  - Gestisce internamente `useFieldArray({ name: 'serbatoi' })` (append/remove) e la creazione della valvola/manometro vuoti all'append.

**Note di comportamento da rispettare:**
- Colonne riga `S{n}`: `Cod.` · **Marca+Modello** (cella `colSpan={2}` con `EquipmentAutocomplete`, tipo `Serbatoi`; quando `!showAdvancedFields` il modello è nascosto → cella singola con `TextCell` marca, come il fallback attuale) · `N° fabbrica` · `Anno`(num) · `Volume L`(num) · `PS bar`(num, adv) · `TS °C`(num, adv) · `Cat. PED`(SelectCell adv, con auto-calc) · `Finitura`(select) · `Scarico`(select) · `Ancorato`(check) · `Man. fondo`(num) · `Man. rosso`(num) · azioni (OCR + elimina).
- Sotto-riga valvola `S{n}.1` (sempre presente, obbligatoria): **Marca+Modello+Ptar** (cella `colSpan={3}` con `EquipmentAutocompleteWithPressure`, tipo `Valvole di sicurezza`) · `N° fabbrica` · `Anno`(num) · `Diametro` · `TS`(num, adv) · `Qmax`(num, adv) · `Cat. PED`(ComputedCell "IV", adv) · azioni (OCR valvola). La sotto-riga occupa le stesse colonne con tinta serbatoio a bassa opacità e codice indentato.
- Header colonne generato una volta; le colonne `adv` sono rese solo se `showAdvancedFields` (sia in `<thead>` che nelle righe, per mantenere l'allineamento).
- Auto-calc Categoria PED serbatoio: replicare l'effetto di `SerbatoioItem` (watch `ps_pressione_max` + `volume` → `setValue(categoria_ped)` solo se `showAdvancedFields`).

- [ ] **Step 1: Creare `SerbatoiTable.tsx`**

```tsx
import { useEffect } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Delete as DeleteIcon, Warning as WarningIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { EquipmentTableShell } from './EquipmentTableShell'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { EquipmentAutocompleteWithPressure } from '../EquipmentAutocompleteWithPressure'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, generateEquipmentCode, type FinituraInternaOption, type ScaricoOption } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

const SERBATOIO_COLOR = '#5aa6d6'
const FINITURA: FinituraInternaOption[] = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO']
const SCARICO: ScaricoOption[] = ['AUTOMATICO', 'MANUALE', 'ASSENTE']

interface SerbatoiTableProps {
  control: Control<any>
  errors: any
  onSerbatoioOCR: (index: number, data: OCRExtractedData) => void
  onValvolaOCR: (index: number, data: OCRExtractedData) => void
}

// Effetto auto-calc Categoria PED per un serbatoio (identico a SerbatoioItem)
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

const SerbatoioRow = ({ control, index, adv, colCount, onSerbatoioOCR, onValvolaOCR, onRemove }: {
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
      <Box component="tr" sx={{ '&:hover td': { bgcolor: alpha(SERBATOIO_COLOR, 0.06) } }}>
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
        {adv && <Box component="td" sx={cellTdSx}><SelectCell control={control} name={`${base}.categoria_ped`} options={['I', 'II', 'III', 'IV']} /></Box>}
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

      {/* SOTTO-RIGA VALVOLA (obbligatoria) */}
      <Box component="tr" sx={{ '& td': { bgcolor: alpha(SERBATOIO_COLOR, 0.05) } }}>
        <Box component="td" sx={{ ...cellTdSx, pl: 3, whiteSpace: 'nowrap', color: 'text.secondary', fontWeight: 600, fontSize: '0.76rem' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><WarningIcon sx={{ fontSize: 14 }} /> {code}.1</Box>
        </Box>
        <Box component="td" colSpan={adv ? 3 : 2} sx={cellTdSx}>
          <Box sx={{ px: 1, py: 0.5 }}>
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
        </Box>
        {/* N° fabbrica + Anno + Diametro occupano le colonne successive; il resto vuoto per allineare */}
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${vbase}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.anno`} min={1980} max={2100} /></Box>
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${vbase}.diametro`} placeholder='Es: 1/2"' /></Box>
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.ts_temperatura`} min={50} max={250} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${vbase}.volume_aria_scaricato`} min={100} max={100000} /></Box>}
        {adv && <Box component="td" sx={cellTdSx}><ComputedCell value="IV" /></Box>}
        {/* colonne restanti vuote fino a colCount, poi azioni valvola */}
        <Box component="td" colSpan={2} sx={cellTdSx} />
        <Box component="td" sx={{ ...cellTdSx, px: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SingleOCRButton equipmentType="Serbatoi" equipmentIndex={index} componentType="valvola_sicurezza" onOCRComplete={(d) => onValvolaOCR(index, d)} />
          </Box>
        </Box>
      </Box>
    </>
  )
}

export const SerbatoiTable = ({ control, errors, onSerbatoioOCR, onValvolaOCR }: SerbatoiTableProps) => {
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

  // conteggio colonne per eventuali celle spacer (mantiene allineamento)
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
          <th />
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
          <tr><td colSpan={colCount} style={{ padding: 16, color: 'var(--mui-palette-text-secondary)', fontSize: '0.85rem' }}>
            Nessun serbatoio. Usa "+ Serbatoio" per iniziare.
          </td></tr>
        )}
      </tbody>
    </EquipmentTableShell>
  )
}
```

> **Nota per l'esecutore:** l'allineamento colonne tra header, riga principale e sotto-riga valvola è la parte fragile. Al termine, in verifica manuale (Task 4) controllare che le colonne combacino sia in vista completa sia in vista `tecnicoDM329`; se una `colSpan`/spacer non torna, correggere il numero di celle spacer nella sotto-riga valvola. `colCount` è fornito per calcolare gli spacer se necessario.

- [ ] **Step 2: Typecheck**

Run: `npm run build:check`
Expected: PASS. Se compaiono errori su prop dei componenti autocomplete, allineare le firme a [EquipmentAutocomplete.tsx](../../../src/components/technicalSheet/EquipmentAutocomplete.tsx) / [EquipmentAutocompleteWithPressure.tsx](../../../src/components/technicalSheet/EquipmentAutocompleteWithPressure.tsx).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (rimuovere `errors`/`colCount` se non usati, o usarli negli spacer).

- [ ] **Step 4: Commit**

```bash
git add src/components/technicalSheet/table/SerbatoiTable.tsx
git commit -m "feat(dm329): SerbatoiTable a foglio con valvola sotto-riga e manometro"
```

---

### Task 4: Integrazione in SerbatoiSection + verifica manuale nel browser

**Files:**
- Modify: `src/components/technicalSheet/SerbatoiSection.tsx` (sostituire il corpo `EquipmentSection`/`SerbatoioItem` con `SerbatoiTable`, mantenendo gli handler OCR)

**Interfaces:**
- Consumes: `SerbatoiTable` (Task 3).
- Produces: nessuna nuova firma pubblica; `SerbatoiSection({ control, errors })` invariata.

- [ ] **Step 1: Riscrivere `SerbatoiSection.tsx`**

Sostituire l'intero contenuto con:

```tsx
import { type Control, useFormContext } from 'react-hook-form'
import { SerbatoiTable } from './table/SerbatoiTable'
import type { OCRExtractedData } from '@/types/ocr'

interface SerbatoiSectionProps {
  control: Control<any>
  errors: any
}

export const SerbatoiSection = ({ control, errors }: SerbatoiSectionProps) => {
  const { setValue, trigger } = useFormContext()

  const handleOCRComplete = (index: number, data: OCRExtractedData) => {
    const base = `serbatoi.${index}`
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.anno) setValue(`${base}.anno`, data.anno)
    if (data.volume) setValue(`${base}.volume`, data.volume)
    if (data.pressione_max) setValue(`${base}.pressione_max`, data.pressione_max)
    if (data.valvola_sicurezza) {
      const v = data.valvola_sicurezza
      if (v.marca) setValue(`${base}.valvola_sicurezza.marca`, v.marca)
      if (v.modello) setValue(`${base}.valvola_sicurezza.modello`, v.modello)
      if (v.n_fabbrica) setValue(`${base}.valvola_sicurezza.n_fabbrica`, v.n_fabbrica)
      if (v.diametro_pressione) setValue(`${base}.valvola_sicurezza.diametro_pressione`, v.diametro_pressione)
    }
    if (data.manometro) {
      if (data.manometro.fondo_scala) setValue(`${base}.manometro.fondo_scala`, data.manometro.fondo_scala)
      if (data.manometro.segno_rosso) setValue(`${base}.manometro.segno_rosso`, data.manometro.segno_rosso)
    }
    trigger(base)
  }

  const handleValvolaOCRComplete = (index: number, data: OCRExtractedData) => {
    const base = `serbatoi.${index}.valvola_sicurezza`
    if (data.marca) setValue(`${base}.marca`, data.marca)
    if (data.modello) setValue(`${base}.modello`, data.modello)
    if (data.n_fabbrica) setValue(`${base}.n_fabbrica`, data.n_fabbrica)
    if (data.diametro_pressione) setValue(`${base}.diametro_pressione`, data.diametro_pressione)
    trigger(base)
  }

  return (
    <SerbatoiTable
      control={control}
      errors={errors}
      onSerbatoioOCR={handleOCRComplete}
      onValvolaOCR={handleValvolaOCRComplete}
    />
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build:check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Avviare il dev server**

Run: `npm run dev`
Aprire una pratica DM329 → "Scheda Dati" → espandere l'accordion "S - Serbatoi".

- [ ] **Step 4: Verifica manuale — checklist logiche preservate**

Con ruolo admin/userdm329 (vista completa):
- [ ] La sezione Serbatoi è una tabella densa; header colonne allineato alle righe.
- [ ] "+ Serbatoio" aggiunge una riga `S{n}` con sotto-riga valvola `S{n}.1`; il codice è corretto e progressivo.
- [ ] Elimina blocca sotto il minimo e chiede conferma.
- [ ] Autocomplete Marca: digitando appaiono i suggerimenti dal catalogo; selezionando Modello si **auto-compilano** i campi specs (es. volume) → verifica su un modello noto a catalogo.
- [ ] Valvola: autocomplete Marca+Modello+Ptar; selezione modello auto-compila TS/Qmax/Diametro.
- [ ] Inserendo PS e Volume, la cella **Cat. PED** si popola da sola (auto-calc).
- [ ] OCR riga serbatoio: il pulsante popola i campi della riga (mock/immagine di test).
- [ ] OCR valvola: popola i campi della sotto-riga.
- [ ] `Tab` scorre le celle sinistra→destra saltando Cod./computed; incollare un valore in una cella lo scrive senza effetti collaterali.
- [ ] Il pulsante "Riconosci Automaticamente" (batch OCR) apre il dialog e popola come prima.
- [ ] Salva Bozza / autosave: ricaricando la pagina i valori inseriti persistono.

Con ruolo `tecnicoDM329` (simulabile con un utente di test tecnicoDM329):
- [ ] Le colonne `Modello`, `PS`, `TS`, `Cat. PED` (serbatoio) e `TS`/`Qmax`/`Cat.PED` (valvola) **spariscono**; header e righe restano allineati; marca torna a campo semplice.

- [ ] **Step 5: Commit**

```bash
git add src/components/technicalSheet/SerbatoiSection.tsx
git commit -m "feat(dm329): monta SerbatoiTable a foglio in SerbatoiSection"
```

---

## Self-Review

**Spec coverage (spec §):**
- §2 direzione Foglio → Task 3/4 (tabella Serbatoi). ✅
- §4 logiche preservate → checklist Task 4 Step 4 (codifiche, autocomplete, auto-fill, PED, OCR singolo+batch, visibilità, autosave, validazioni). ✅
- §5 architettura (EquipmentTable + celle) → Task 1 (celle) + Task 2 (guscio) + Task 3 (composizione). ✅
- §5 valvola sotto-riga + manometro 2 colonne → Task 3. ✅
- §6 Tab/incolla → Task 4 Step 4. ✅
- §8 stile/token → Task 1/2 (usano tema e `radii`). ✅
- §9 rollout slice Serbatoi → questo piano. Slice 2 (altre sezioni) e slice 3 (header compatto + Dati Generali/Impianto) = piani successivi. ✅ (fuori da questo piano, dichiarato)

**Placeholder scan:** nessun TBD/TODO; codice completo in ogni step. ✅

**Type consistency:** `SerbatoiTable` props (`onSerbatoioOCR`/`onValvolaOCR`) coincidono tra Task 3 (Produces) e Task 4 (uso). Celle: firme in Task 1 (Produces) usate in Task 3. `EquipmentTableShell` props in Task 2 usate in Task 3. ✅

**Nota di rischio nota:** l'allineamento colonne header/riga/sotto-riga è il punto fragile; gestito esplicitamente nella nota di Task 3 e nella verifica di Task 4.
