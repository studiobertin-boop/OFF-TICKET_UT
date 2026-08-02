import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import {
  Box, Card, Typography, Button, IconButton, Tooltip, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import {
  Add as AddIcon, Delete as DeleteIcon, ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon, AddLink as AddLinkIcon,
} from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { PressioneCatalogCell } from './PressioneCatalogCell'
import { ValvoleProtezioneCell } from './ValvoleProtezioneCell'
import { Field } from './SubBand'
import { codiciValvoleDisoleatore, codiciValvoleSerbatoio } from '@/utils/valvoleImpianto'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { readSheetPressure, readSpec, variantSpecKey } from '@/services/equipmentAudit'
import { generateCacheKey, rowKeyOf, useEquipmentCatalogContext } from '../EquipmentCatalogContext'
import { VALVOLE_ROW_PREFIX } from '@/hooks/useHydrateCatalogCache'
import { useRowExit } from './useRowExit'
import { useRowCatalogDivergence } from '@/hooks/useRowCatalogDivergence'
import { UpdateCatalogDialog } from '../UpdateCatalogDialog'
import type { EquipmentCatalogItem } from '@/types'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, type CategoriaPED, type EquipmentCatalogType } from '@/types'
import { compareCodes, nextFreeCode, pruneSchedaRefs } from '@/utils/equipmentCodes'
import type { OCRExtractedData } from '@/types/ocr'
import {
  EQUIPMENT_DEFS, NEW_EQUIPMENT_KINDS,
  type EquipmentKind, type NewEquipmentKind, type EquipmentTypeDef, type AdvKey, type ExtraFieldDef,
} from './equipmentConfig'

const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']
const COL_COUNT = 10

/**
 * Righe da rendere, ordinate per codice. `i` resta l'indice reale nell'array di React Hook Form:
 * l'ordinamento riguarda solo la resa, non i percorsi dei campi.
 *
 * Il codice si legge dai valori osservati (`values`), che sono la fonte autorevole: è lì che
 * finiscono sia le modifiche dell'utente sia le riscritture esterne (batch OCR, normalizzazione).
 * `fields` di `useFieldArray` resta solo come ripiego al primo render, prima che l'osservazione
 * abbia prodotto un valore.
 */
const sortedEntries = (fields: any[], values: any[] | undefined) =>
  fields
    .map((f: any, i: number) => ({ f, i, code: (values?.[i]?.codice ?? f?.codice ?? '') as string }))
    .sort((a, b) => compareCodes(a.code, b.code))

/** Codici correnti di un array, per calcolare il prossimo numero libero. */
const codesOf = (fields: any[], values: any[] | undefined) =>
  fields.map((f: any, i: number) => values?.[i]?.codice ?? f?.codice)

/**
 * Record di partenza di una nuova riga: tutti i campi legati a una cella sono presenti, e vuoti.
 * Un campo assente rende l'input non controllato al primo render, e in quel caso MUI conserva
 * il proprio stato interno invece di seguire il form.
 */
const nuovaRiga = (def: EquipmentTypeDef, codice: string, extra: Record<string, any> = {}) => ({
  codice,
  marca: undefined,
  modello: undefined,
  ...(def.capacitaField ? { [def.capacitaField]: undefined } : {}),
  ...(def.pressioneField ? { [def.pressioneField]: undefined } : {}),
  ...(def.ts ? { ts: undefined } : {}),
  ...(def.cat === 'edit' ? { categoria_ped: undefined } : {}),
  anno: undefined,
  n_fabbrica: undefined,
  ...extra,
})

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

/**
 * Campo di sola lettura: il valore viene dal catalogo e lì si modifica.
 * Componente a sé perché deve osservare il proprio campo.
 */
const ReadonlyField = ({ control, name, f }: { control: Control<any>; name: string; f: ExtraFieldDef }) => {
  const v = useWatch({ control, name }) as string | undefined
  const testo = v ? (f.display?.[v] ?? v) : (f.emptyLabel ?? '—')
  return (
    <Typography component="span" sx={{ fontSize: '0.8rem', color: v ? 'text.primary' : 'text.disabled', px: 0.5 }}>
      {testo}
    </Typography>
  )
}

const extraFieldControl = (control: Control<any>, base: string, f: ExtraFieldDef): ReactNode => {
  const name = `${base}.${f.name}`
  if (f.kind === 'readonly') return <ReadonlyField control={control} name={name} f={f} />
  if (f.kind === 'multi') return <ValvoleProtezioneCell control={control} name={name} />
  if (f.kind === 'select') return <SelectCell control={control} name={name} options={[...(f.options || [])]} display={f.display} labels={f.labels} emptyLabel={f.emptyLabel} />
  if (f.kind === 'check') return <CheckCell control={control} name={name} />
  if (f.kind === 'number') return <NumberCell control={control} name={name} min={f.min} max={f.max} step={f.step} />
  return <TextCell control={control} name={name} placeholder={f.label} />
}

const extraFieldWidth = (f: ExtraFieldDef): number | 'auto' => {
  if (f.kind === 'check' || f.kind === 'readonly') return 'auto'
  if (f.kind === 'multi') return 210
  if (f.kind === 'text') return 150
  return f.labels ? 150 : 90 // i select con etichette estese non stanno in 90px
}

/**
 * Campo extra della riga espandibile. È un componente e non una semplice chiamata perché
 * i campi con `showIf` osservano un altro campo della stessa riga (es. «Quale posizione»
 * compare solo per ubicazione ALTRO): l'hook deve stare dentro un componente proprio.
 */
const ExtraField = ({ control, base, f }: { control: Control<any>; base: string; f: ExtraFieldDef }) => {
  const dep = useWatch({ control, name: f.showIf ? `${base}.${f.showIf.field}` : `${base}.__noDep` })
  if (f.showIf && dep !== f.showIf.equals) return null
  return (
    <Field label={f.label} w={extraFieldWidth(f) as any}>
      {extraFieldControl(control, base, f)}
    </Field>
  )
}

/**
 * Identità stabile della riga, per le scritture che arrivano dopo un `await`.
 *
 * `base` è un percorso posizionale (`compressori.1`): l'eliminazione di una riga fa scalare gli
 * indici e quel percorso finisce a indicare un'altra apparecchiatura. Prima di scrivere si
 * verifica che al percorso ci sia ancora il codice atteso.
 *
 * Per le valvole l'identità è quella del recipiente che le porta: la valvola non memorizza un
 * codice proprio, la sua posizione è calcolata.
 */
interface RowIdentity {
  path: string
  value: string
}

interface EqRowProps {
  control: Control<any>
  def: EquipmentTypeDef
  base: string
  code: string
  identity: RowIdentity
  /** Chiave della riga nella mappa delle provenienze dal catalogo. */
  rowKey: string
  /** Chiamata quando il fuoco lascia la riga: verifica lo scostamento dal catalogo. */
  onRowExit: () => void
  depth: number
  adv: boolean
  ocr: OcrRef
  onDelete: (() => void) | null
  append: { label: string; onClick: () => void } | null
}

const EqRow = ({ control, def, base, code, identity, rowKey, onRowExit, depth, adv, ocr, onDelete, append }: EqRowProps) => {
  const { setValue, getValues } = useFormContext()
  const { setCache, setOrigine } = useEquipmentCatalogContext()
  const rowExit = useRowExit(onRowExit)
  const [expanded, setExpanded] = useState(false)
  useAutoPed(control, base, def, adv)

  const color = KIND_COLOR[def.kind]
  const hidden = (k: AdvKey) => (def.adv?.includes(k) ?? false) && !adv
  const modelloHidden = hidden('modello')

  /**
   * Il catalogo distingue le righe di questo tipo per pressione: la colonna PS diventa un
   * selettore sui valori esistenti, ed è la scelta della pressione — non quella del modello —
   * ad autocompilare capacità, TS e categoria.
   */
  const perVariante = variantSpecKey(def.catalogType) !== null

  /**
   * Applica al form i dati tecnici della voce scelta a catalogo.
   *
   * La lettura passa da `readSpec` perché nel catalogo convivono due generazioni
   * di chiavi: l'import massivo ha scritto nomi generici (`volume`, `pressione`,
   * `temperatura`) il cui significato dipende dal tipo, mentre le voci create
   * dall'app usano i nomi canonici. Leggendo la sola chiave canonica
   * l'autocompilazione resterebbe muta sulla quasi totalità del catalogo.
   *
   * Arriva sempre dopo una chiamata di rete: se nel frattempo un'eliminazione ha fatto scalare
   * gli indici, `base` non indica più questa riga e scrivere sporcherebbe quella subentrata.
   */
  const handleSelected = (specs: Record<string, any>, item?: EquipmentCatalogItem) => {
    if (getValues(identity.path) !== identity.value) return
    Object.entries(def.specsMap).forEach(([specKey, field]) => {
      const v = readSpec(def.catalogType, specs, specKey)
      if (v === null) return
      setValue(`${base}.${field}`, field === 'ts' ? String(v) : v)
    })

    // Si annota da dove vengono i dati: è il termine di paragone per accorgersi, più tardi,
    // che l'utente ha scostato un valore dal default del catalogo.
    if (!item) return
    const cacheKey = generateCacheKey(def.catalogType, item.marca, item.modello, {
      variante: readSheetPressure(def.catalogType, item.specs) ?? undefined,
    })
    setCache(cacheKey, item)
    setOrigine(rowKey, { cacheKey, appliedSpecs: (item.specs ?? {}) as Record<string, unknown> })
  }

  /**
   * Valore che identifica la variante di questa riga: è la pressione della colonna PS/Ptar.
   * Serve al pulsante «aggiungi al catalogo» per distinguere «modello mancante» da
   * «modello presente ma non a questa pressione».
   */
  const variantePs = useWatch({
    control,
    name: def.pressioneField ? `${base}.${def.pressioneField}` : `${base}.__noPs`,
  })
  const variantValue = typeof variantePs === 'number' ? variantePs : null

  /**
   * La capacità si compila dopo la PS, perché è la PS a dire di quale variante del modello si
   * tratta: lo stesso compressore rende portate diverse a pressioni diverse.
   *
   * Il blocco vale solo se la colonna PS è davvero visibile: a `tecnicoDM329` è nascosta su
   * serbatoi, disoleatori, essiccatori e scambiatori, e senza questa condizione la capacità
   * gli resterebbe disabilitata per sempre.
   */
  const capacitaBloccata =
    !!def.pressioneField && !hidden('pressione') && variantePs == null

  const catCell = () => {
    if (hidden('cat') || def.cat === false) return null
    if (def.cat === 'IV') return <ComputedCell value="IV" />
    return <SelectCell control={control} name={`${base}.categoria_ped`} options={PED_OPTIONS} w={58} />
  }

  return (
    <>
      <Box component="tr" {...rowExit} sx={{ '&:hover > td': { bgcolor: alpha(color, 0.06) } }}>
        {/* AZIONI (a inizio riga) */}
        <Box component="td" sx={{ ...cellTdSx, px: 0.25, whiteSpace: 'nowrap' }}>
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
                    onEquipmentSelected={perVariante ? undefined : handleSelected}
                    variantValue={variantValue}
                    rowValues={getValues(base)}
                    size="small" fullWidth />
                )} />
              )} />
            </Box>
          </Box>
        )}

        {/* PRESSIONE — viene prima della capacità: è la PS a determinare quale variante di
            modello si sta censendo, e quindi quale volume/FAD/Qmax il catalogo propone. */}
        <Box component="td" sx={{ ...cellTdSx, minWidth: 48 }}>
          {def.pressioneField && !hidden('pressione') ? (
            perVariante ? (
              <PressioneCatalogCell control={control} base={base} catalogType={def.catalogType}
                pressioneField={def.pressioneField} onSelected={handleSelected} min={0} max={100} step={0.1} />
            ) : (
              <NumberCell control={control} name={`${base}.${def.pressioneField}`} min={0} max={100} step={0.1} />
            )
          ) : null}
        </Box>
        {/* CAPACITÀ (numerica, allineata a destra: riempie la colonna) */}
        <Box component="td" sx={{ ...cellTdSx, minWidth: 60 }}>
          {def.capacitaField && !hidden('capacita') ? (
            <Tooltip title={capacitaBloccata ? 'Compila prima la PS' : ''} placement="top">
              <span>
                <NumberCell control={control} name={`${base}.${def.capacitaField}`} min={0} max={100000} step={1} disabled={capacitaBloccata} />
              </span>
            </Tooltip>
          ) : null}
        </Box>
        {/* TS (testo libero, allineata a sinistra) */}
        <Box component="td" sx={{ ...cellTdSx, minWidth: 64 }}>{def.ts && !hidden('ts') ? <TextCell control={control} name={`${base}.ts`} placeholder="°C / ÷" w={78} /> : null}</Box>
        {/* CAT. */}
        <Box component="td" sx={cellTdSx}>{catCell()}</Box>
        {/* ANNO */}
        <Box component="td" sx={{ ...cellTdSx, minWidth: 44 }}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
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
                <ExtraField key={f.name} control={control} base={base} f={f} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </>
  )
}

/**
 * Conferma di eliminazione in sospeso. NON si usa `window.confirm`: basta che una volta
 * l'utente spunti «impedisci a questa pagina di creare altre finestre di dialogo» perché
 * il browser risponda `false` a ogni conferma successiva senza mostrarla, e da lì in poi
 * tutti i cestini della scheda risultano muti fino al ricaricamento della pagina.
 */
interface PendingDelete { testo: string; conferma: () => void }
type AskDelete = (label: string, code: string, conferma: () => void) => void

interface ValveHostRowsProps {
  control: Control<any>
  /** Definizione del recipiente che porta le valvole (serbatoio o disoleatore). */
  def: EquipmentTypeDef
  base: string
  code: string
  /** Chiave della riga ospite nella mappa delle provenienze. */
  rowKey: string
  depth: number
  adv: boolean
  ocr: OcrRef
  ocrValvola: OcrRef
  onDelete: () => void
  ask: AskDelete
  /** Posizioni delle valvole secondo la convenzione del tipo: la prima è la principale. */
  posizioni: (count: number) => string[]
  /** Ripulisce i riferimenti dopo l'eliminazione di una valvola aggiuntiva. */
  afterRemove: () => void
  /** Costruisce l'handler di uscita dalla riga (verifica dello scostamento dal catalogo). */
  uscita: (def: EquipmentTypeDef, base: string, rowKey: string, code: string) => () => void
}

/**
 * Recipiente con valvola di sicurezza obbligatoria e valvole aggiuntive appendibili
 * (S1.1 + S1.2, C1.2 + C1.3): un recipiente può averne più d'una e la relazione le
 * enumera tutte. Componente a sé perché `useFieldArray` non può stare in un ciclo.
 */
const ValveHostRows = ({ control, def, base, code, rowKey, depth, adv, ocr, ocrValvola, onDelete, ask, posizioni, afterRemove, uscita }: ValveHostRowsProps) => {
  const aggiuntive = useFieldArray({ control, name: `${base}.valvole_aggiuntive` })
  const pos = posizioni(aggiuntive.fields.length + 1)

  // Le valvole non hanno codice proprio: l'identità è quella del recipiente che le porta,
  // mentre la provenienza dal catalogo si indicizza per posizione nell'impianto.
  const identity: RowIdentity = { path: `${base}.codice`, value: code }

  return (
    <>
      <EqRow control={control} def={def} base={base} code={code} identity={identity} rowKey={rowKey}
        onRowExit={uscita(def, base, rowKey, code)} depth={depth} adv={adv} ocr={ocr}
        onDelete={onDelete}
        append={{ label: 'Valvola di sicurezza', onClick: () => aggiuntive.append({}) }} />
      <EqRow control={control} def={EQUIPMENT_DEFS.valvola} base={`${base}.valvola_sicurezza`} code={pos[0]}
        identity={identity} rowKey={rowKeyOf(VALVOLE_ROW_PREFIX, pos[0])}
        onRowExit={uscita(EQUIPMENT_DEFS.valvola, `${base}.valvola_sicurezza`, rowKeyOf(VALVOLE_ROW_PREFIX, pos[0]), pos[0])}
        depth={depth + 1} adv={adv} ocr={ocrValvola} onDelete={null} append={null} />
      {aggiuntive.fields.map((f, j) => (
        <EqRow key={f.id} control={control} def={EQUIPMENT_DEFS.valvola} base={`${base}.valvole_aggiuntive.${j}`}
          code={pos[j + 1]} identity={identity} rowKey={rowKeyOf(VALVOLE_ROW_PREFIX, pos[j + 1])}
          onRowExit={uscita(EQUIPMENT_DEFS.valvola, `${base}.valvole_aggiuntive.${j}`, rowKeyOf(VALVOLE_ROW_PREFIX, pos[j + 1]), pos[j + 1])}
          depth={depth + 1} adv={adv} ocr={ocrValvola}
          onDelete={() => ask('la valvola', pos[j + 1], () => { aggiuntive.remove(j); afterRemove() })} append={null} />
      ))}
    </>
  )
}

interface UnifiedEquipmentTableProps {
  control: Control<any>
  errors: any
}

export const UnifiedEquipmentTable = ({ control }: UnifiedEquipmentTableProps) => {
  const { showAdvancedFields: adv, showRecipienteFiltro, isTecnicoDM329 } = useTecnicoDM329Visibility()
  const { setValue, getValues } = useFormContext()
  const divergenza = useRowCatalogDivergence()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [pending, setPending] = useState<PendingDelete | null>(null)

  const ask: AskDelete = (label, code, conferma) =>
    setPending({ testo: `Confermi di voler eliminare ${label} ${code}?`, conferma })

  const serbatoi = useFieldArray({ control, name: 'serbatoi' })
  const compressori = useFieldArray({ control, name: 'compressori' })
  const disoleatori = useFieldArray({ control, name: 'disoleatori' })
  const essiccatori = useFieldArray({ control, name: 'essiccatori' })
  const scambiatori = useFieldArray({ control, name: 'scambiatori' })
  const filtri = useFieldArray({ control, name: 'filtri' })
  const recipienti = useFieldArray({ control, name: 'recipienti_filtro' })
  const separatori = useFieldArray({ control, name: 'separatori' })

  // I codici vengono dai valori del form, non da `fields`: vedi sortedEntries.
  const serbatoiVals = useWatch({ control, name: 'serbatoi' }) as any[] | undefined
  const compressoriVals = useWatch({ control, name: 'compressori' }) as any[] | undefined
  const disoleatoriVals = useWatch({ control, name: 'disoleatori' }) as any[] | undefined
  const essiccatoriVals = useWatch({ control, name: 'essiccatori' }) as any[] | undefined
  const scambiatoriVals = useWatch({ control, name: 'scambiatori' }) as any[] | undefined
  const filtriVals = useWatch({ control, name: 'filtri' }) as any[] | undefined
  const recipientiVals = useWatch({ control, name: 'recipienti_filtro' }) as any[] | undefined
  const separatoriVals = useWatch({ control, name: 'separatori' }) as any[] | undefined

  const fieldArrays: Record<string, { replace: (v: any[]) => void }> = {
    serbatoi, compressori, disoleatori, essiccatori,
    scambiatori, filtri, recipienti_filtro: recipienti, separatori,
  }

  /**
   * Ripulisce i riferimenti rimasti appesi dopo un'eliminazione.
   *
   * Serve perché i codici si riassegnano: eliminato C1, il compressore creato dopo torna a
   * chiamarsi C1 ed erediterebbe il disoleatore orfano e le valvole ancora citate come
   * protezione altrove — è così che una riga nuova compare già popolata.
   *
   * `replace` solo sugli array effettivamente cambiati: rigenera gli id di `useFieldArray` e
   * quindi rimonta le righe, cosa che non ha senso pagare su un array intatto.
   */
  const dopoEliminazione = () => {
    const attuale = getValues() as Record<string, any>
    const { scheda, changed } = pruneSchedaRefs(attuale)
    if (!changed) return
    for (const [nome, fa] of Object.entries(fieldArrays)) {
      if (scheda[nome] !== attuale[nome]) fa.replace(scheda[nome] ?? [])
    }
  }

  /** Conteggio e massimo per i tipi creabili: serve a disabilitare la voce di menu. */
  const newKindState: Record<NewEquipmentKind, { count: number; max: number }> = {
    serbatoio: { count: serbatoi.fields.length, max: EQUIPMENT_LIMITS.serbatoi.max },
    compressore: { count: compressori.fields.length, max: EQUIPMENT_LIMITS.compressori.max },
    essiccatore: { count: essiccatori.fields.length, max: EQUIPMENT_LIMITS.essiccatori.max },
    filtro: { count: filtri.fields.length, max: EQUIPMENT_LIMITS.filtri.max },
    separatore: { count: separatori.fields.length, max: EQUIPMENT_LIMITS.separatori.max },
  }

  const addNew = (kind: EquipmentKind) => {
    setMenuAnchor(null)
    switch (kind) {
      case 'serbatoio': {
        const codice = nextFreeCode(EQUIPMENT_LIMITS.serbatoi.prefix, codesOf(serbatoi.fields, serbatoiVals), EQUIPMENT_LIMITS.serbatoi.max)
        if (codice) serbatoi.append(nuovaRiga(EQUIPMENT_DEFS.serbatoio, codice, { valvola_sicurezza: {}, manometro: {} }))
        break
      }
      case 'compressore': {
        const codice = nextFreeCode(EQUIPMENT_LIMITS.compressori.prefix, codesOf(compressori.fields, compressoriVals), EQUIPMENT_LIMITS.compressori.max)
        if (codice) compressori.append(nuovaRiga(EQUIPMENT_DEFS.compressore, codice, { ha_disoleatore: false }))
        break
      }
      case 'essiccatore': {
        const codice = nextFreeCode(EQUIPMENT_LIMITS.essiccatori.prefix, codesOf(essiccatori.fields, essiccatoriVals), EQUIPMENT_LIMITS.essiccatori.max)
        if (codice) essiccatori.append(nuovaRiga(EQUIPMENT_DEFS.essiccatore, codice, { ha_scambiatore: false }))
        break
      }
      case 'filtro': {
        const codice = nextFreeCode(EQUIPMENT_LIMITS.filtri.prefix, codesOf(filtri.fields, filtriVals), EQUIPMENT_LIMITS.filtri.max)
        if (codice) filtri.append(nuovaRiga(EQUIPMENT_DEFS.filtro, codice, { ha_recipiente: false }))
        break
      }
      case 'separatore': {
        const codice = nextFreeCode(EQUIPMENT_LIMITS.separatori.prefix, codesOf(separatori.fields, separatoriVals), EQUIPMENT_LIMITS.separatori.max)
        if (codice) separatori.append(nuovaRiga(EQUIPMENT_DEFS.separatore, codice))
        break
      }
    }
  }

  const rows: ReactNode[] = []

  /** Identità della riga per le scritture asincrone: percorso del codice + valore atteso. */
  const identitaDi = (base: string, code: string): RowIdentity => ({ path: `${base}.codice`, value: code })

  /** Handler di uscita dalla riga: verifica lo scostamento dai dati di catalogo. */
  const uscita = (def: EquipmentTypeDef, base: string, rowKey: string, code: string) => () =>
    divergenza.verificaRiga({ tipo: def.catalogType, base, rowKey, codice: code })

  sortedEntries(serbatoi.fields, serbatoiVals).forEach(({ f, i, code }) => {
    rows.push(<ValveHostRows key={`s-${f.id}`} control={control} def={EQUIPMENT_DEFS.serbatoio} base={`serbatoi.${i}`} code={code} rowKey={rowKeyOf('serbatoi', code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i }}
      ocrValvola={{ equipmentType: 'Serbatoi', equipmentIndex: i, componentType: 'valvola_sicurezza' }}
      onDelete={() => ask('il serbatoio', code, () => { serbatoi.remove(i); dopoEliminazione() })}
      ask={ask}
      afterRemove={dopoEliminazione}
      uscita={uscita}
      posizioni={(n) => codiciValvoleSerbatoio(code, n)} />)
  })

  sortedEntries(compressori.fields, compressoriVals).forEach(({ f, i, code }) => {
    const dIdx = (disoleatoriVals ?? disoleatori.fields).findIndex((d: any) => d?.compressore_associato === code)
    rows.push(<EqRow key={`c-${f.id}`} control={control} def={EQUIPMENT_DEFS.compressore} base={`compressori.${i}`} code={code} identity={identitaDi(`compressori.${i}`, code)} rowKey={rowKeyOf('compressori', code)} onRowExit={uscita(EQUIPMENT_DEFS.compressore, `compressori.${i}`, rowKeyOf('compressori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Compressori', equipmentIndex: i }}
      onDelete={() => ask('il compressore', code, () => { if (dIdx >= 0) disoleatori.remove(dIdx); compressori.remove(i); dopoEliminazione() })}
      append={dIdx === -1 ? { label: 'Disoleatore', onClick: () => { disoleatori.append(nuovaRiga(EQUIPMENT_DEFS.disoleatore, `${code}.1`, { compressore_associato: code, valvola_sicurezza: {} })); setValue(`compressori.${i}.ha_disoleatore`, true) } } : null} />)
    if (dIdx >= 0) {
      rows.push(<ValveHostRows key={`c-${f.id}-d`} control={control} def={EQUIPMENT_DEFS.disoleatore} base={`disoleatori.${dIdx}`} code={`${code}.1`} rowKey={rowKeyOf('disoleatori', `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx }}
        ocrValvola={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx, componentType: 'valvola_sicurezza' }}
        onDelete={() => ask('il disoleatore', `${code}.1`, () => { disoleatori.remove(dIdx); setValue(`compressori.${i}.ha_disoleatore`, false); dopoEliminazione() })}
        ask={ask}
        afterRemove={dopoEliminazione}
        uscita={uscita}
        posizioni={(n) => codiciValvoleDisoleatore(`${code}.1`, n)} />)
    }
  })

  sortedEntries(essiccatori.fields, essiccatoriVals).forEach(({ f, i, code }) => {
    const sIdx = (scambiatoriVals ?? scambiatori.fields).findIndex((s: any) => s?.essiccatore_associato === code)
    rows.push(<EqRow key={`e-${f.id}`} control={control} def={EQUIPMENT_DEFS.essiccatore} base={`essiccatori.${i}`} code={code} identity={identitaDi(`essiccatori.${i}`, code)} rowKey={rowKeyOf('essiccatori', code)} onRowExit={uscita(EQUIPMENT_DEFS.essiccatore, `essiccatori.${i}`, rowKeyOf('essiccatori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Essiccatori', equipmentIndex: i }}
      onDelete={() => ask("l'essiccatore", code, () => { if (sIdx >= 0) scambiatori.remove(sIdx); essiccatori.remove(i); dopoEliminazione() })}
      append={sIdx === -1 ? { label: 'Scambiatore', onClick: () => { scambiatori.append(nuovaRiga(EQUIPMENT_DEFS.scambiatore, `${code}.1`, { essiccatore_associato: code })); setValue(`essiccatori.${i}.ha_scambiatore`, true) } } : null} />)
    if (sIdx >= 0) {
      rows.push(<EqRow key={`e-${f.id}-s`} control={control} def={EQUIPMENT_DEFS.scambiatore} base={`scambiatori.${sIdx}`} code={`${code}.1`} identity={identitaDi(`scambiatori.${sIdx}`, `${code}.1`)} rowKey={rowKeyOf('scambiatori', `${code}.1`)} onRowExit={uscita(EQUIPMENT_DEFS.scambiatore, `scambiatori.${sIdx}`, rowKeyOf('scambiatori', `${code}.1`), `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Scambiatori', equipmentIndex: sIdx }}
        onDelete={() => ask('lo scambiatore', `${code}.1`, () => { scambiatori.remove(sIdx); setValue(`essiccatori.${i}.ha_scambiatore`, false); dopoEliminazione() })} append={null} />)
    }
  })

  sortedEntries(filtri.fields, filtriVals).forEach(({ f, i, code }) => {
    const rIdx = (recipientiVals ?? recipienti.fields).findIndex((r: any) => r?.filtro_associato === code)
    rows.push(<EqRow key={`f-${f.id}`} control={control} def={EQUIPMENT_DEFS.filtro} base={`filtri.${i}`} code={code} identity={identitaDi(`filtri.${i}`, code)} rowKey={rowKeyOf('filtri', code)} onRowExit={uscita(EQUIPMENT_DEFS.filtro, `filtri.${i}`, rowKeyOf('filtri', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Filtri', equipmentIndex: i }}
      onDelete={() => ask('il filtro', code, () => { if (rIdx >= 0) recipienti.remove(rIdx); filtri.remove(i); dopoEliminazione() })}
      append={(showRecipienteFiltro && rIdx === -1) ? { label: 'Recipiente', onClick: () => { recipienti.append(nuovaRiga(EQUIPMENT_DEFS.recipiente, `${code}.1`, { filtro_associato: code })); setValue(`filtri.${i}.ha_recipiente`, true) } } : null} />)
    if (rIdx >= 0 && showRecipienteFiltro) {
      rows.push(<EqRow key={`f-${f.id}-r`} control={control} def={EQUIPMENT_DEFS.recipiente} base={`recipienti_filtro.${rIdx}`} code={`${code}.1`} identity={identitaDi(`recipienti_filtro.${rIdx}`, `${code}.1`)} rowKey={rowKeyOf('recipienti_filtro', `${code}.1`)} onRowExit={uscita(EQUIPMENT_DEFS.recipiente, `recipienti_filtro.${rIdx}`, rowKeyOf('recipienti_filtro', `${code}.1`), `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Recipienti filtro', equipmentIndex: rIdx }}
        onDelete={() => ask('il recipiente', `${code}.1`, () => { recipienti.remove(rIdx); setValue(`filtri.${i}.ha_recipiente`, false); dopoEliminazione() })} append={null} />)
    }
  })

  sortedEntries(separatori.fields, separatoriVals).forEach(({ f, i, code }) => {
    rows.push(<EqRow key={`sep-${f.id}`} control={control} def={EQUIPMENT_DEFS.separatore} base={`separatori.${i}`} code={code} identity={identitaDi(`separatori.${i}`, code)} rowKey={rowKeyOf('separatori', code)} onRowExit={uscita(EQUIPMENT_DEFS.separatore, `separatori.${i}`, rowKeyOf('separatori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Separatori', equipmentIndex: i }}
      onDelete={() => ask('il separatore', code, () => { separatori.remove(i); dopoEliminazione() })} append={null} />)
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
            <MenuItem key={k} onClick={() => addNew(k)} disabled={newKindState[k].count >= newKindState[k].max}>
              <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: KIND_COLOR[k], mr: 1.5 }} />
              {EQUIPMENT_DEFS[k].label}
              {newKindState[k].count >= newKindState[k].max && (
                <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 1 }}>
                  (max {newKindState[k].max})
                </Typography>
              )}
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
              <th className="num">PS [bar]<br />Ptar [bar]</th>
              <th className="num">Vol [l]<br />Qmax [l/min]<br />FAD [l/min]</th>
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

      <UpdateCatalogDialog
        open={!!divergenza.pending}
        update={divergenza.pending}
        onConfirm={divergenza.conferma}
        onCancel={divergenza.annulla}
        loading={divergenza.loading}
        error={divergenza.error}
        puoScrivereACatalogo={!isTecnicoDM329}
      />

      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Elimina apparecchiatura</DialogTitle>
        <DialogContent>
          <DialogContentText>{pending?.testo}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Annulla</Button>
          <Button color="error" variant="contained" autoFocus
            onClick={() => { pending?.conferma(); setPending(null) }}>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
