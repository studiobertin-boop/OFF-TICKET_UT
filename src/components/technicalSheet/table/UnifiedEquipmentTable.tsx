import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import {
  Box, Card, Typography, Button, Tooltip, Menu, MenuItem, Drawer,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, useMediaQuery,
} from '@mui/material'
import {
  Add as AddIcon, ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import { alpha, useTheme } from '@mui/material/styles'
import { radii } from '@/theme/tokens'
import { CompletenessBar, CompletenessDot } from '@/components/common'
import { completezzaRiga, type Completezza } from '@/utils/schedaCompleteness'
import { RowDetailPanel } from './RowDetailPanel'
import { ALTEZZA_BARRA } from '../TechnicalSheetHeader'
import { TextCell, NumberCell, SelectCell, CheckCell, ComputedCell, cellTdSx } from './EquipmentCells'
import { PressioneCatalogCell } from './PressioneCatalogCell'
import { CatalogValueCell } from './CatalogValueCell'
import { ValvoleProtezioneCell } from './ValvoleProtezioneCell'
import { Field } from './SubBand'
import { codiciValvoleDisoleatore, codiciValvoleSerbatoio } from '@/utils/valvoleImpianto'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { capacityKey, readSpec, variantSpecKey } from '@/services/equipmentAudit'
import { rowKeyOf, useEquipmentCatalogContext } from '../EquipmentCatalogContext'
import { VALVOLE_ROW_PREFIX } from '@/hooks/useHydrateCatalogOrigini'
import { useRowExit } from './useRowExit'
import { useRowCatalogDivergence } from '@/hooks/useRowCatalogDivergence'
import { UpdateCatalogDialog } from '../UpdateCatalogDialog'
import type { EquipmentCatalogItem } from '@/types'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, type CategoriaPED, type EquipmentCatalogType } from '@/types'
import { compareCodes, nextFreeCode, pruneSchedaRefs } from '@/utils/equipmentCodes'
import type { OCRExtractedData } from '@/types/ocr'
import {
  EQUIPMENT_DEFS, NEW_EQUIPMENT_KINDS, nuovaRiga,
  type EquipmentKind, type NewEquipmentKind, type EquipmentTypeDef, type AdvKey, type ExtraFieldDef,
} from './equipmentConfig'

const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']
const COL_COUNT = 12

/**
 * Rientro orizzontale delle celle, uguale per intestazioni e contenuto.
 *
 * Le testate avevano 6px e gli input 8px: bastavano quei due pixel perché una colonna
 * numerica sembrasse fuori asse rispetto al proprio titolo.
 */
const PAD_CELLA = '8px'

/**
 * Rientro maggiorato della colonna TS. È l'unica coppia di colonne in cui un valore
 * allineato a destra (la capacità) confina con uno allineato a sinistra: senza uno
 * spazio in più i due numeri si toccano e si leggono come un'unica cifra.
 */
const PAD_GRONDA = '20px'

/**
 * Larghezze dichiarate delle colonne. Senza, la tabella si dimensionava sul contenuto
 * (`min-width: max-content`) e il passo delle colonne cambiava da una riga all'altra:
 * un numero di fabbrica lungo allargava la sua colonna e disallineava tutte le altre.
 * Le prime tre restano agganciate a sinistra durante lo scorrimento orizzontale.
 */
const COLONNE = [
  { w: 34, sticky: 0 },   // stato di compilazione
  { w: 108, sticky: 34 }, // azioni (il pulsante «Dettagli» più la lettura targhetta)
  { w: 58, sticky: 142 }, // codice
  { w: 32, sticky: 200 }, // aggiunta a catalogo
  // Marca e modello della stessa larghezza: la cella le contiene entrambe, e a colonne
  // disuguali il confine fra i due input non coincide con quello fra le due testate.
  { w: 181 },             // marca
  { w: 181 },             // modello
  { w: 76 },              // PS / Ptar
  { w: 106 },             // capacità (il valore più il pulsante che sblocca l'inserimento libero)
  { w: 116 },             // TS (più larga: porta anche la gronda che la stacca dalla capacità)
  { w: 54 },              // categoria PED
  { w: 60 },              // anno
  { w: 168 },             // numero di fabbrica
] as const

/** Celle agganciate a sinistra: restano visibili mentre la tabella scorre in orizzontale. */
const congelata = (left: number) => ({
  position: 'sticky' as const,
  left,
  zIndex: 1,
  bgcolor: 'background.paper',
})

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
  if (f.kind === 'multi') return <ValvoleProtezioneCell control={control} name={name} />
  if (f.kind === 'select') return <SelectCell control={control} name={name} options={[...(f.options || [])]} display={f.display} labels={f.labels} emptyLabel={f.emptyLabel} />
  if (f.kind === 'check') return <CheckCell control={control} name={name} />
  if (f.kind === 'number') return <NumberCell control={control} name={name} min={f.min} max={f.max} step={f.step} />
  return <TextCell control={control} name={name} placeholder={f.label} />
}

const extraFieldWidth = (f: ExtraFieldDef): number | 'auto' => {
  if (f.kind === 'check') return 'auto'
  if (f.kind === 'multi') return 210
  if (f.kind === 'text') return 150
  return f.labels ? 150 : 90 // i select con etichette estese non stanno in 90px
}

/**
 * Campo extra della riga espandibile. È un componente e non una semplice chiamata perché
 * i campi con `showIf` osservano un altro campo della stessa riga (es. «Quale posizione»
 * compare solo per ubicazione ALTRO): l'hook deve stare dentro un componente proprio.
 */
const ExtraField = ({ control, base, f, larghezza }: { control: Control<any>; base: string; f: ExtraFieldDef; larghezza?: number | string }) => {
  const dep = useWatch({ control, name: f.showIf ? `${base}.${f.showIf.field}` : `${base}.__noDep` })
  if (f.showIf && dep !== f.showIf.equals) return null
  return (
    <Field label={f.label} w={(larghezza ?? extraFieldWidth(f)) as any}>
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

/**
 * Riga di cui sono aperti i dettagli. Si tiene l'oggetto intero e non il solo percorso
 * perché il pannello deve poter eliminare e appendere come faceva la riga: le
 * chiusure arrivano da chi ha in mano i field array.
 */
export interface DettaglioRiga {
  def: EquipmentTypeDef
  base: string
  code: string
  color: string
  onDelete: (() => void) | null
  append: { label: string; onClick: () => void } | null
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
  /** Apre il pannello dei dettagli su questa riga. */
  onSelect: (dettaglio: DettaglioRiga) => void
  selezionata: boolean
}

const EqRow = ({ control, def, base, code, identity, rowKey, onRowExit, depth, adv, ocr, onDelete, append, onSelect, selezionata }: EqRowProps) => {
  const { setValue, getValues } = useFormContext()
  const { setOrigine } = useEquipmentCatalogContext()
  const rowExit = useRowExit(onRowExit)
  useAutoPed(control, base, def, adv)

  const color = KIND_COLOR[def.kind]

  // Completezza della riga: conteggio su valori già in memoria, nessuna scrittura.
  const valoriRiga = useWatch({ control, name: base })
  const completezza = completezzaRiga(def, valoriRiga)
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
    // che l'utente ha scostato un valore dal default del catalogo, ed è la riga su cui scrivere
    // se decide di riportarcelo. Si conserva la voce intera, non la sua pressione: due varianti
    // dello stesso modello possono dichiararne una uguale e si confonderebbero fra loro.
    if (!item) return
    setOrigine(rowKey, { catalogItem: item, appliedSpecs: (item.specs ?? {}) as Record<string, unknown> })
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

  const apri = () => onSelect({ def, base, code, color, onDelete, append })

  /**
   * Cella che ospita il «+» dell'autocomplete. È uno stato e non un ref perché il
   * portale ha bisogno di un nodo già montato: con un ref il primo render lo troverebbe
   * ancora nullo e il pulsante non comparirebbe finché la riga non cambia per altro.
   */
  const [cellaAggiunta, setCellaAggiunta] = useState<HTMLElement | null>(null)

  /** Le tre celle agganciate seguono la riga anche nel colore di selezione. */
  const fondoCongelato = selezionata ? alpha(color, 0.16) : undefined

  return (
    <>
      <Box
        component="tr"
        {...rowExit}
        sx={{
          '&:hover > td': { bgcolor: alpha(color, 0.06) },
          ...(selezionata ? { '& > td': { bgcolor: alpha(color, 0.12) } } : {}),
        }}
      >
        {/* STATO DI COMPILAZIONE */}
        <Box component="td" sx={{ ...cellTdSx, ...congelata(COLONNE[0].sticky!), bgcolor: fondoCongelato ?? 'background.paper', textAlign: 'center' }}>
          <CompletenessDot completezza={completezza} soggetto={code} />
        </Box>

        {/* AZIONI: dettagli e lettura targhetta. Il pulsante porta la parola «Dettagli» e non
            una sola freccia: era l'unica via al pannello di destra e nessuno la trovava.
            Eliminazione e apparecchiature collegate stanno nel pannello, dove c'è spazio per
            dire cosa fanno invece di affidarlo a due icone da 20px. */}
        <Box component="td" sx={{ ...cellTdSx, ...congelata(COLONNE[1].sticky!), bgcolor: fondoCongelato ?? 'background.paper', px: 0.25, whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', '& .MuiIconButton-root': { p: 0.25 } }}>
            <Button
              size="small"
              variant={selezionata ? 'contained' : 'outlined'}
              onClick={apri}
              aria-label={`Dettagli di ${code}`}
              aria-expanded={selezionata}
              endIcon={
                <ChevronRightIcon sx={{ transition: 'transform .15s', transform: selezionata ? 'rotate(90deg)' : 'none' }} />
              }
              sx={{
                minWidth: 0, px: 0.6, py: 0, fontSize: '0.66rem', lineHeight: 1.9,
                textTransform: 'none', whiteSpace: 'nowrap',
                '& .MuiButton-endIcon': { ml: 0.2, '& svg': { fontSize: '0.85rem' } },
              }}
            >
              Dettagli
            </Button>
            <SingleOCRButton equipmentType={ocr.equipmentType} equipmentIndex={ocr.equipmentIndex} componentType={ocr.componentType} onOCRComplete={(d) => applyOcr(def, base, d, setValue)} />
          </Box>
        </Box>

        {/* COD. — anche il codice apre i dettagli: è il modo più diretto di dire «questa riga». */}
        <Box component="td" sx={{ ...cellTdSx, ...congelata(COLONNE[2].sticky!), bgcolor: fondoCongelato ?? 'background.paper', pl: `${8 + depth * 12}px`, pr: 0.5, whiteSpace: 'nowrap', fontWeight: depth === 0 ? 700 : 600, color: depth === 0 ? color : 'text.secondary', fontSize: depth === 0 ? '0.82rem' : '0.76rem' }}>
          <Tooltip title={`Dettagli di ${code}`} placement="top">
            <Box
              component="button"
              type="button"
              onClick={apri}
              aria-label={`Dettagli di ${code}`}
              sx={{
                p: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit',
                cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted',
                textUnderlineOffset: '3px', textDecorationColor: alpha(color, 0.5),
                '&:hover': { textDecorationStyle: 'solid', textDecorationColor: 'currentColor' },
              }}
            >
              {code}
            </Box>
          </Tooltip>
        </Box>

        {/* MARCA / MOD. */}
        {/* AGGIUNTA A CATALOGO: colonna propria, subito dopo il codice. Il pulsante
            arriva per portale dall'autocomplete, che sa se la voce manca a catalogo. */}
        <Box
          component="td"
          ref={setCellaAggiunta}
          sx={{ ...cellTdSx, ...congelata(COLONNE[3].sticky!), bgcolor: fondoCongelato ?? 'background.paper', borderRight: '1px solid', borderRightColor: 'divider', textAlign: 'center', lineHeight: 0 }}
        />

        {modelloHidden ? (
          <>
            <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.marca`} placeholder="Marca" /></Box>
            <Box component="td" sx={cellTdSx} />
          </>
        ) : (
          <Box component="td" colSpan={2} sx={cellTdSx}>
            {/* Nessun rientro sulla cella e i due autocomplete a metà esatta: così il
                confine fra Marca e Modello cade dove cade quello fra le due testate.
                Il rientro del testo lo mette l'autocomplete stesso (denseInputSx). */}
            <Box sx={{ '& > div': { display: 'flex', gap: 0 }, '& > div > .MuiAutocomplete-root': { flex: '1 1 0', minWidth: 0 } }}>
              <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
                <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
                  <EquipmentAutocomplete equipmentType={def.catalogType} dense
                    marcaValue={m.value || ''} modelloValue={mo.value || ''}
                    onMarcaChange={m.onChange} onModelloChange={mo.onChange}
                    onEquipmentSelected={perVariante ? undefined : handleSelected}
                    variantValue={variantValue}
                    rowValues={getValues(base)}
                    contenitoreAggiunta={cellaAggiunta}
                    size="small" fullWidth />
                )} />
              )} />
            </Box>
          </Box>
        )}

        {/* PRESSIONE — viene prima della capacità: è la PS a determinare quale variante di
            modello si sta censendo, e quindi quale volume/FAD/Qmax il catalogo propone. */}
        <Box component="td" sx={cellTdSx}>
          {def.pressioneField && !hidden('pressione') ? (
            perVariante ? (
              <PressioneCatalogCell control={control} base={base} catalogType={def.catalogType}
                pressioneField={def.pressioneField} onSelected={handleSelected} min={0} max={100} step={0.1} />
            ) : (
              <NumberCell control={control} name={`${base}.${def.pressioneField}`} min={0} max={100} step={0.1} />
            )
          ) : null}
        </Box>
        {/* CAPACITÀ — si sceglie fra i valori che il catalogo dichiara per il modello */}
        <Box component="td" sx={cellTdSx}>
          {def.capacitaField && !hidden('capacita') ? (
            <CatalogValueCell control={control} base={base} catalogType={def.catalogType}
              campo={def.capacitaField} specKey={capacityKey(def.catalogType)} kind="number"
              disabled={capacitaBloccata} motivoBlocco="Compila prima la PS"
              min={0} max={100000} step={1} />
          ) : null}
        </Box>
        {/* TS (con la gronda che la stacca dalla capacità) */}
        <Box component="td" sx={{ ...cellTdSx, pl: `calc(${PAD_GRONDA} - ${PAD_CELLA})` }}>
          {def.ts && !hidden('ts') ? (
            <CatalogValueCell control={control} base={base} catalogType={def.catalogType}
              campo="ts" specKey="ts" kind="text" placeholder="°C / ÷" />
          ) : null}
        </Box>
        {/* CAT. */}
        <Box component="td" sx={cellTdSx}>{catCell()}</Box>
        {/* ANNO */}
        <Box component="td" sx={cellTdSx}><NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} /></Box>
        {/* N.F. */}
        <Box component="td" sx={cellTdSx}><TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" /></Box>
      </Box>
    </>
  )
}

/**
 * Pannello dei dettagli della riga aperta.
 *
 * Componente a sé perché deve osservare i valori della riga per tenere aggiornata la
 * completezza: l'hook non può stare dentro il ramo condizionale del genitore.
 */
const PannelloRiga = ({ control, dettaglio, onClose }: { control: EqRowProps['control']; dettaglio: DettaglioRiga; onClose: () => void }) => {
  const valori = useWatch({ control, name: dettaglio.base })

  return (
    <RowDetailPanel
      def={dettaglio.def}
      code={dettaglio.code}
      color={dettaglio.color}
      completezza={completezzaRiga(dettaglio.def, valori)}
      campi={dettaglio.def.extra.map((f) => (
        <ExtraField key={f.name} control={control} base={dettaglio.base} f={f} larghezza="100%" />
      ))}
      onClose={onClose}
      onDelete={dettaglio.onDelete ? () => { onClose(); dettaglio.onDelete!() } : null}
      append={dettaglio.append ? { label: dettaglio.append.label, onClick: () => { onClose(); dettaglio.append!.onClick() } } : null}
    />
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
  onSelect: (dettaglio: DettaglioRiga) => void
  /** Percorso della riga con i dettagli aperti, per evidenziarla. */
  selezione: string | null
}

/**
 * Recipiente con valvola di sicurezza obbligatoria e valvole aggiuntive appendibili
 * (S1.1 + S1.2, C1.2 + C1.3): un recipiente può averne più d'una e la relazione le
 * enumera tutte. Componente a sé perché `useFieldArray` non può stare in un ciclo.
 */
const ValveHostRows = ({ control, def, base, code, rowKey, depth, adv, ocr, ocrValvola, onDelete, ask, posizioni, afterRemove, uscita, onSelect, selezione }: ValveHostRowsProps) => {
  const aggiuntive = useFieldArray({ control, name: `${base}.valvole_aggiuntive` })
  const pos = posizioni(aggiuntive.fields.length + 1)

  // Le valvole non hanno codice proprio: l'identità è quella del recipiente che le porta,
  // mentre la provenienza dal catalogo si indicizza per posizione nell'impianto.
  const identity: RowIdentity = { path: `${base}.codice`, value: code }

  return (
    <>
      <EqRow control={control} def={def} base={base} code={code} identity={identity} rowKey={rowKey}
        onRowExit={uscita(def, base, rowKey, code)} depth={depth} adv={adv} ocr={ocr}
        onDelete={onDelete} onSelect={onSelect} selezionata={selezione === base}
        append={{ label: 'Valvola di sicurezza', onClick: () => aggiuntive.append(nuovaRiga(EQUIPMENT_DEFS.valvola, null)) }} />
      <EqRow control={control} def={EQUIPMENT_DEFS.valvola} base={`${base}.valvola_sicurezza`} code={pos[0]}
        identity={identity} rowKey={rowKeyOf(VALVOLE_ROW_PREFIX, pos[0])}
        onRowExit={uscita(EQUIPMENT_DEFS.valvola, `${base}.valvola_sicurezza`, rowKeyOf(VALVOLE_ROW_PREFIX, pos[0]), pos[0])}
        depth={depth + 1} adv={adv} ocr={ocrValvola} onDelete={null} append={null}
        onSelect={onSelect} selezionata={selezione === `${base}.valvola_sicurezza`} />
      {aggiuntive.fields.map((f, j) => (
        <EqRow key={f.id} control={control} def={EQUIPMENT_DEFS.valvola} base={`${base}.valvole_aggiuntive.${j}`}
          code={pos[j + 1]} identity={identity} rowKey={rowKeyOf(VALVOLE_ROW_PREFIX, pos[j + 1])}
          onRowExit={uscita(EQUIPMENT_DEFS.valvola, `${base}.valvole_aggiuntive.${j}`, rowKeyOf(VALVOLE_ROW_PREFIX, pos[j + 1]), pos[j + 1])}
          depth={depth + 1} adv={adv} ocr={ocrValvola}
          onSelect={onSelect} selezionata={selezione === `${base}.valvole_aggiuntive.${j}`}
          onDelete={() => ask('la valvola', pos[j + 1], () => { aggiuntive.remove(j); afterRemove() })} append={null} />
      ))}
    </>
  )
}

interface UnifiedEquipmentTableProps {
  control: Control<any>
  errors: any
  /** Completezza dell'insieme, già calcolata dal form. */
  completezza: Completezza
  righeComplete: { complete: number; totali: number }
  /** Azioni della barra strumenti che non appartengono alla tabella (batch OCR). */
  azioni?: ReactNode
}

export const UnifiedEquipmentTable = ({ control, completezza, righeComplete, azioni }: UnifiedEquipmentTableProps) => {
  const { showAdvancedFields: adv, showRecipienteFiltro, isTecnicoDM329 } = useTecnicoDM329Visibility()
  const { setValue, getValues } = useFormContext()
  const divergenza = useRowCatalogDivergence()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [pending, setPending] = useState<PendingDelete | null>(null)

  // Riga con i dettagli aperti. Sopra `lg` il pannello affianca la tabella e la
  // restringe; sotto, dove non ci sarebbe spazio per entrambi, esce come cassetto.
  const [dettaglio, setDettaglio] = useState<DettaglioRiga | null>(null)
  const theme = useTheme()
  const affiancato = useMediaQuery(theme.breakpoints.up('lg'))
  const chiudiDettaglio = () => setDettaglio(null)

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
    // Il pannello punta a un percorso posizionale: dopo un'eliminazione gli indici
    // scalano e quel percorso indica un'altra apparecchiatura. Si chiude.
    setDettaglio(null)

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
        if (codice) serbatoi.append(nuovaRiga(EQUIPMENT_DEFS.serbatoio, codice))
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

  /** Apertura e evidenziazione del pannello dettagli, uguali per ogni riga. */
  const sel = (base: string) => ({ onSelect: setDettaglio, selezionata: dettaglio?.base === base })
  const selValvole = { onSelect: setDettaglio, selezione: dettaglio?.base ?? null }

  sortedEntries(serbatoi.fields, serbatoiVals).forEach(({ f, i, code }) => {
    rows.push(<ValveHostRows key={`s-${f.id}`} control={control} def={EQUIPMENT_DEFS.serbatoio} base={`serbatoi.${i}`} code={code} rowKey={rowKeyOf('serbatoi', code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Serbatoi', equipmentIndex: i }}
      ocrValvola={{ equipmentType: 'Serbatoi', equipmentIndex: i, componentType: 'valvola_sicurezza' }}
      onDelete={() => ask('il serbatoio', code, () => { serbatoi.remove(i); dopoEliminazione() })}
      ask={ask}
      afterRemove={dopoEliminazione}
      uscita={uscita}
      {...selValvole}
      posizioni={(n) => codiciValvoleSerbatoio(code, n)} />)
  })

  sortedEntries(compressori.fields, compressoriVals).forEach(({ f, i, code }) => {
    const dIdx = (disoleatoriVals ?? disoleatori.fields).findIndex((d: any) => d?.compressore_associato === code)
    rows.push(<EqRow key={`c-${f.id}`} control={control} def={EQUIPMENT_DEFS.compressore} base={`compressori.${i}`} {...sel(`compressori.${i}`)} code={code} identity={identitaDi(`compressori.${i}`, code)} rowKey={rowKeyOf('compressori', code)} onRowExit={uscita(EQUIPMENT_DEFS.compressore, `compressori.${i}`, rowKeyOf('compressori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Compressori', equipmentIndex: i }}
      onDelete={() => ask('il compressore', code, () => { if (dIdx >= 0) disoleatori.remove(dIdx); compressori.remove(i); dopoEliminazione() })}
      append={dIdx === -1 ? { label: 'Disoleatore', onClick: () => { disoleatori.append(nuovaRiga(EQUIPMENT_DEFS.disoleatore, `${code}.1`, { compressore_associato: code })); setValue(`compressori.${i}.ha_disoleatore`, true) } } : null} />)
    if (dIdx >= 0) {
      rows.push(<ValveHostRows key={`c-${f.id}-d`} control={control} def={EQUIPMENT_DEFS.disoleatore} base={`disoleatori.${dIdx}`} code={`${code}.1`} rowKey={rowKeyOf('disoleatori', `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx }}
        ocrValvola={{ equipmentType: 'Disoleatori', equipmentIndex: dIdx, componentType: 'valvola_sicurezza' }}
        onDelete={() => ask('il disoleatore', `${code}.1`, () => { disoleatori.remove(dIdx); setValue(`compressori.${i}.ha_disoleatore`, false); dopoEliminazione() })}
        ask={ask}
        afterRemove={dopoEliminazione}
        uscita={uscita}
        {...selValvole}
        posizioni={(n) => codiciValvoleDisoleatore(`${code}.1`, n)} />)
    }
  })

  sortedEntries(essiccatori.fields, essiccatoriVals).forEach(({ f, i, code }) => {
    const sIdx = (scambiatoriVals ?? scambiatori.fields).findIndex((s: any) => s?.essiccatore_associato === code)
    rows.push(<EqRow key={`e-${f.id}`} control={control} def={EQUIPMENT_DEFS.essiccatore} base={`essiccatori.${i}`} {...sel(`essiccatori.${i}`)} code={code} identity={identitaDi(`essiccatori.${i}`, code)} rowKey={rowKeyOf('essiccatori', code)} onRowExit={uscita(EQUIPMENT_DEFS.essiccatore, `essiccatori.${i}`, rowKeyOf('essiccatori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Essiccatori', equipmentIndex: i }}
      onDelete={() => ask("l'essiccatore", code, () => { if (sIdx >= 0) scambiatori.remove(sIdx); essiccatori.remove(i); dopoEliminazione() })}
      append={sIdx === -1 ? { label: 'Scambiatore', onClick: () => { scambiatori.append(nuovaRiga(EQUIPMENT_DEFS.scambiatore, `${code}.1`, { essiccatore_associato: code })); setValue(`essiccatori.${i}.ha_scambiatore`, true) } } : null} />)
    if (sIdx >= 0) {
      rows.push(<EqRow key={`e-${f.id}-s`} control={control} def={EQUIPMENT_DEFS.scambiatore} base={`scambiatori.${sIdx}`} {...sel(`scambiatori.${sIdx}`)} code={`${code}.1`} identity={identitaDi(`scambiatori.${sIdx}`, `${code}.1`)} rowKey={rowKeyOf('scambiatori', `${code}.1`)} onRowExit={uscita(EQUIPMENT_DEFS.scambiatore, `scambiatori.${sIdx}`, rowKeyOf('scambiatori', `${code}.1`), `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Scambiatori', equipmentIndex: sIdx }}
        onDelete={() => ask('lo scambiatore', `${code}.1`, () => { scambiatori.remove(sIdx); setValue(`essiccatori.${i}.ha_scambiatore`, false); dopoEliminazione() })} append={null} />)
    }
  })

  sortedEntries(filtri.fields, filtriVals).forEach(({ f, i, code }) => {
    const rIdx = (recipientiVals ?? recipienti.fields).findIndex((r: any) => r?.filtro_associato === code)
    rows.push(<EqRow key={`f-${f.id}`} control={control} def={EQUIPMENT_DEFS.filtro} base={`filtri.${i}`} {...sel(`filtri.${i}`)} code={code} identity={identitaDi(`filtri.${i}`, code)} rowKey={rowKeyOf('filtri', code)} onRowExit={uscita(EQUIPMENT_DEFS.filtro, `filtri.${i}`, rowKeyOf('filtri', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Filtri', equipmentIndex: i }}
      onDelete={() => ask('il filtro', code, () => { if (rIdx >= 0) recipienti.remove(rIdx); filtri.remove(i); dopoEliminazione() })}
      append={(showRecipienteFiltro && rIdx === -1) ? { label: 'Recipiente', onClick: () => { recipienti.append(nuovaRiga(EQUIPMENT_DEFS.recipiente, `${code}.1`, { filtro_associato: code })); setValue(`filtri.${i}.ha_recipiente`, true) } } : null} />)
    if (rIdx >= 0 && showRecipienteFiltro) {
      rows.push(<EqRow key={`f-${f.id}-r`} control={control} def={EQUIPMENT_DEFS.recipiente} base={`recipienti_filtro.${rIdx}`} {...sel(`recipienti_filtro.${rIdx}`)} code={`${code}.1`} identity={identitaDi(`recipienti_filtro.${rIdx}`, `${code}.1`)} rowKey={rowKeyOf('recipienti_filtro', `${code}.1`)} onRowExit={uscita(EQUIPMENT_DEFS.recipiente, `recipienti_filtro.${rIdx}`, rowKeyOf('recipienti_filtro', `${code}.1`), `${code}.1`)} depth={1} adv={adv}
        ocr={{ equipmentType: 'Recipienti filtro', equipmentIndex: rIdx }}
        onDelete={() => ask('il recipiente', `${code}.1`, () => { recipienti.remove(rIdx); setValue(`filtri.${i}.ha_recipiente`, false); dopoEliminazione() })} append={null} />)
    }
  })

  sortedEntries(separatori.fields, separatoriVals).forEach(({ f, i, code }) => {
    rows.push(<EqRow key={`sep-${f.id}`} control={control} def={EQUIPMENT_DEFS.separatore} base={`separatori.${i}`} {...sel(`separatori.${i}`)} code={code} identity={identitaDi(`separatori.${i}`, code)} rowKey={rowKeyOf('separatori', code)} onRowExit={uscita(EQUIPMENT_DEFS.separatore, `separatori.${i}`, rowKeyOf('separatori', code), code)} depth={0} adv={adv}
      ocr={{ equipmentType: 'Separatori', equipmentIndex: i }}
      onDelete={() => ask('il separatore', code, () => { separatori.remove(i); dopoEliminazione() })} append={null} />)
  })

  const total = serbatoi.fields.length + compressori.fields.length + essiccatori.fields.length + filtri.fields.length + separatori.fields.length

  const tabella = (
    <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: `${radii.card}px`, minWidth: 0, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 0.75, px: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {righeComplete.complete} di {righeComplete.totali} complete
        </Typography>
        <CompletenessBar
          completezza={completezza}
          larghezza={150}
          etichetta={`${total} principali`}
        />
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          {azioni}
          {/* Contornato: l'unica azione a fondo pieno della pagina è «Completa scheda». */}
          <Button size="small" variant="outlined" color="primary" startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ borderColor: 'primary.main' }}>
            Nuova apparecchiatura
          </Button>
        </Box>
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

      {/* Il contenitore che scorre in orizzontale è uno scrollport anche in verticale:
          la testata agganciata si riferisce a lui, non alla pagina, e con un `top` pari
          all'altezza della barra scendeva di quei pixel *dentro* la tabella, coprendo la
          prima riga. Si aggancia quindi a `top: 0` del contenitore, e il contenitore
          prende un'altezza massima: così scorre lui e la testata resta davvero in vista
          invece di uscire di scena col resto della pagina. */}
      <Box
        sx={{
          overflow: 'auto',
          maxHeight: `calc(100vh - ${ALTEZZA_BARRA} - 150px)`,
          minHeight: 220,
        }}
      >
        <Box
          component="table"
          sx={{
            // Larghezze dichiarate e non calcolate sul contenuto: è quello che tiene
            // allineate le colonne fra righe di tipi diversi.
            borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
            minWidth: COLONNE.reduce((n, c) => n + c.w, 0),
            '& th': {
              position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', verticalAlign: 'bottom',
              whiteSpace: 'nowrap', lineHeight: 1.2,
              fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
              color: 'text.primary', bgcolor: 'background.paper',
              // Stesso rientro degli input sotto: è quello che tiene il titolo sull'asse
              // del proprio contenuto.
              p: `5px ${PAD_CELLA}`,
              borderBottom: '2px solid', borderColor: 'divider',
            },
            '& th.num': { textAlign: 'right' },
            // L'unità sotto il nome, in grigio: una riga sola per colonna invece di tre,
            // che allargavano il passo delle colonne strette.
            '& th u': { display: 'block', textDecoration: 'none', fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: 'text.disabled' },
          }}
        >
          <colgroup>
            {COLONNE.map((c, n) => <col key={n} style={{ width: c.w }} />)}
          </colgroup>
          <thead>
            <tr>
              <Box component="th" aria-label="stato di compilazione" sx={{ ...congelata(COLONNE[0].sticky!), zIndex: 3 }} />
              <Box component="th" aria-label="azioni" sx={{ ...congelata(COLONNE[1].sticky!), zIndex: 3 }} />
              <Box component="th" sx={{ ...congelata(COLONNE[2].sticky!), zIndex: 3 }}>Cod.</Box>
              <Box component="th" aria-label="aggiunta a catalogo" sx={{ ...congelata(COLONNE[3].sticky!), zIndex: 3, borderRight: '1px solid', borderRightColor: 'divider' }} />
              <th>Marca</th>
              <th>Modello</th>
              <th className="num">PS<u>bar</u></th>
              <th className="num">Capacità<u>l · l/min</u></th>
              <Box component="th" sx={{ pl: `${PAD_GRONDA} !important` }}>TS<u>°C</u></Box>
              <th>Cat.</th>
              <th className="num">Anno</th>
              <th>N° fabbrica</th>
            </tr>
          </thead>
          <tbody>
            {rows}
            {total === 0 && (
              <Box component="tr">
                <Box component="td" colSpan={COL_COUNT} sx={{ p: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
                  Nessuna apparecchiatura. Usa «Nuova apparecchiatura» per iniziare.
                </Box>
              </Box>
            )}
          </tbody>
        </Box>
      </Box>

    </Card>
  )

  const pannello = dettaglio ? (
    <PannelloRiga control={control} dettaglio={dettaglio} onClose={chiudiDettaglio} />
  ) : null

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
        {tabella}

        {/* Sopra `lg` il pannello affianca la tabella: si vede la riga mentre se ne
            compilano i dettagli. Sotto, la larghezza non basta per due colonne e la
            stessa cosa esce come cassetto. */}
        {affiancato && pannello && (
          <Card
            variant="outlined"
            sx={{
              width: 340, flex: 'none', borderRadius: `${radii.card}px`,
              position: 'sticky', top: `calc(${ALTEZZA_BARRA} + 8px)`,
              maxHeight: `calc(100vh - ${ALTEZZA_BARRA} - 24px)`,
            }}
          >
            {pannello}
          </Card>
        )}
      </Box>

      <Drawer
        anchor="right"
        open={!affiancato && !!pannello}
        onClose={chiudiDettaglio}
        PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}
      >
        {pannello}
      </Drawer>

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
    </>
  )
}
