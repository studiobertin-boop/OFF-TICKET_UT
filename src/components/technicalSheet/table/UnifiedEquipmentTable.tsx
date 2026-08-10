import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useFieldArray, useFormContext, useWatch, type Control } from 'react-hook-form'
import {
  Box, Card, Typography, Button, Tooltip, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import { Add as AddIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { radii } from '@/theme/tokens'
import { CompletenessBar, CompletenessDot } from '@/components/common'
import { completezzaRiga, type Completezza } from '@/utils/schedaCompleteness'
import { ALTEZZA_BARRA } from '../TechnicalSheetHeader'
import { cellTdSx, PAD_CELLA, PAD_TITOLO_AZIONE } from './EquipmentCells'
import { useCellePrincipali } from './useCellePrincipali'
import { EquipmentDetailDialog, type DettaglioRiga } from './EquipmentDetailDialog'
import { codiciValvoleDisoleatore, codiciValvoleSerbatoio } from '@/utils/valvoleImpianto'
import { SingleOCRButton } from '../SingleOCRButton'
import { useTecnicoDM329Visibility } from '@/hooks/useTecnicoDM329Visibility'
import { readSpec } from '@/services/equipmentAudit'
import { rowKeyOf, useEquipmentCatalogContext } from '../EquipmentCatalogContext'
import { VALVOLE_ROW_PREFIX } from '@/hooks/useHydrateCatalogOrigini'
import { useRowExit } from './useRowExit'
import { useRowCatalogDivergence } from '@/hooks/useRowCatalogDivergence'
import { UpdateCatalogDialog } from '../UpdateCatalogDialog'
import type { EquipmentCatalogItem } from '@/types'
import { calculateCategoriaPED } from '@/utils/categoriaPedCalculator'
import { EQUIPMENT_LIMITS, type EquipmentCatalogType } from '@/types'
import { compareCodes, nextFreeCode, pruneSchedaRefs } from '@/utils/equipmentCodes'
import type { OCRExtractedData } from '@/types/ocr'
import {
  EQUIPMENT_DEFS, NEW_EQUIPMENT_KINDS, nuovaRiga,
  type EquipmentKind, type NewEquipmentKind, type EquipmentTypeDef,
} from './equipmentConfig'

/**
 * Colonne della tabella, con larghezza e allineamento dichiarati.
 *
 * Le larghezze non si calcolano sul contenuto: a `min-width: max-content` il passo delle
 * colonne cambiava da una riga all'altra e un numero di fabbrica lungo disallineava tutte
 * le altre. Le prime quattro restano agganciate a sinistra durante lo scorrimento.
 *
 * `conAzione` marca le colonne che mettono un pulsante a destra del valore: la loro
 * intestazione arretra di quella misura, altrimenti si appoggia al bordo della colonna
 * mentre le cifre finiscono venti pixel prima.
 */
interface ColDef {
  w: number
  sticky?: number
  titolo?: string
  unita?: string
  aria?: string
  align?: 'left' | 'right' | 'center'
  conAzione?: boolean
}

const COLONNE: ColDef[] = [
  { w: 34,  sticky: 0,   aria: 'stato di compilazione', align: 'center' },
  { w: 96,  sticky: 34,  aria: 'azioni' },
  { w: 92,  sticky: 130, titolo: 'Cod.' },
  { w: 32,  sticky: 222, aria: 'aggiunta a catalogo', align: 'center' },
  // Marca e modello: la cella le contiene entrambe, e a colonne troppo disuguali il
  // confine fra i due input non coincide con quello fra le due testate.
  { w: 168, titolo: 'Marca' },
  { w: 194, titolo: 'Modello' },
  { w: 74,  titolo: 'PS', unita: 'bar', align: 'right' },
  { w: 116, titolo: 'Capacità', unita: 'l · l/min', align: 'right', conAzione: true },
  { w: 130, titolo: 'TS', unita: '°C', align: 'center', conAzione: true },
  { w: 56,  titolo: 'Cat.' },
  { w: 62,  titolo: 'Anno', align: 'right' },
  { w: 150, titolo: 'N° fabbrica' },
]

const COL_COUNT = COLONNE.length
const LARGHEZZA_TABELLA = COLONNE.reduce((n, c) => n + c.w, 0)

/** Ascissa del primo montante del binario e passo di rientro per livello, in px. */
const BINARIO_X = 11
const RIENTRO_LIVELLO = 13

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

/**
 * Montante del binario che lega una riga collegata alla propria principale: uno per ogni
 * livello di annidamento, del colore dell'antenato cui appartiene.
 *
 * `continua` dice se sotto questa riga il ramo di quel livello prosegue: dove non prosegue
 * il montante si ferma a metà riga, e il gruppo si chiude invece di sembrare interrotto.
 */
interface Guida { color: string; continua: boolean }

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

interface EqRowProps {
  control: Control<any>
  def: EquipmentTypeDef
  base: string
  code: string
  /** Chiave della riga nella mappa delle provenienze dal catalogo. */
  rowKey: string
  /** Chiamata quando il fuoco lascia la riga: verifica lo scostamento dal catalogo. */
  onRowExit: () => void
  /** Applica al form i dati tecnici della voce scelta a catalogo. */
  onSelected: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
  /** Un montante per ogni livello di annidamento; vuoto per le righe principali. */
  guide: Guida[]
  adv: boolean
  ocr: OcrRef
  /** Posizione nell'elenco navigabile della finestra dei dettagli. */
  indice: number
  onSelect: (indice: number) => void
  selezionata: boolean
}

const EqRow = ({
  control, def, base, code, rowKey, onRowExit, onSelected, guide, adv, ocr, indice, onSelect, selezionata,
}: EqRowProps) => {
  const { setValue } = useFormContext()
  const rowExit = useRowExit(onRowExit)
  useAutoPed(control, base, def, adv)

  const color = KIND_COLOR[def.kind]
  const depth = guide.length

  // Completezza della riga: conteggio su valori già in memoria, nessuna scrittura.
  const valoriRiga = useWatch({ control, name: base })
  const completezza = completezzaRiga(def, valoriRiga)

  /**
   * Cella che ospita il «+» dell'autocomplete. È uno stato e non un ref perché il
   * portale ha bisogno di un nodo già montato: con un ref il primo render lo troverebbe
   * ancora nullo e il pulsante non comparirebbe finché la riga non cambia per altro.
   */
  const [cellaAggiunta, setCellaAggiunta] = useState<HTMLElement | null>(null)

  const celle = useCellePrincipali({
    control, def, base, adv, onSelected, contenitoreAggiunta: cellaAggiunta,
  })
  const modelloHidden = celle.nascosta('modello')

  const apri = () => onSelect(indice)

  /** Le celle agganciate seguono la riga anche nel colore di selezione. */
  const fondoCongelato = selezionata ? alpha(color, 0.16) : undefined

  /** Ultima riga del gruppo: chiude il blocco con il filetto pieno delle principali. */
  const chiudeGruppo = depth > 0 && guide.every((g) => !g.continua)

  /**
   * Stili delle celle della riga, in un oggetto solo.
   *
   * Tre condizioni indipendenti li toccano — selezione, appartenenza a un gruppo,
   * profondità — e scriverle come tre voci `'& > td'` separate significherebbe che
   * l'ultima cancella le precedenti: una riga collegata e selezionata perderebbe il
   * proprio fondo.
   */
  const stiliCella = {
    ...(selezionata ? { bgcolor: alpha(color, 0.12) } : {}),
    // Filetto interno più tenue fra le righe di uno stesso gruppo: il legame si vede
    // prima del confine.
    ...(depth > 0 && !chiudeGruppo
      ? { borderBottomColor: (t: any) => alpha(t.palette.divider, 0.45) }
      : {}),
    ...(depth > 0 ? { fontSize: '0.78rem' } : {}),
  }

  /**
   * Le righe collegate sono più basse e con un carattere più piccolo delle principali: si
   * leggono come un dettaglio della riga sopra invece che come apparecchiature di pari
   * grado. Si comprime solo il verticale — toccare i rientri orizzontali romperebbe
   * l'allineamento delle colonne fra righe di livello diverso.
   */
  const compressioneFiglia = depth > 0 ? {
    '& .MuiInputBase-input, & .MuiSelect-select, & .MuiAutocomplete-input': {
      fontSize: '0.78rem !important',
      paddingTop: '2px !important',
      paddingBottom: '2px !important',
    },
  } : {}

  return (
    <Box
      component="tr"
      {...rowExit}
      sx={{
        '&:hover > td': { bgcolor: alpha(color, 0.06) },
        '& > td': stiliCella,
        ...compressioneFiglia,
      }}
    >
      {/* STATO DI COMPILAZIONE */}
      <Box component="td" sx={{ ...cellTdSx, ...congelata(COLONNE[0].sticky!), bgcolor: fondoCongelato ?? 'background.paper', textAlign: 'center' }}>
        <CompletenessDot completezza={completezza} soggetto={code} />
      </Box>

      {/* AZIONI: dettagli e lettura targhetta. Il pulsante porta la parola «Dettagli» e non
          una sola freccia: era l'unica via al pannello di destra e nessuno la trovava.
          Eliminazione e apparecchiature collegate stanno nella finestra, dove c'è spazio per
          dire cosa fanno invece di affidarlo a due icone da 20px. */}
      <Box component="td" sx={{ ...cellTdSx, ...congelata(COLONNE[1].sticky!), bgcolor: fondoCongelato ?? 'background.paper', px: 0.25, whiteSpace: 'nowrap' }}>
        <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', '& .MuiIconButton-root': { p: 0.25 } }}>
          <Button
            size="small"
            variant={selezionata ? 'contained' : 'outlined'}
            onClick={apri}
            aria-label={`Dettagli di ${code}`}
            endIcon={<ChevronRightIcon />}
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

      {/* COD. — anche il codice apre i dettagli: è il modo più diretto di dire «questa riga».
          I montanti del binario scendono da qui: è la colonna dove il legame fra una
          collegata e la sua principale è leggibile senza spiegazioni. */}
      <Box
        component="td"
        sx={{
          // Niente `position: relative` qui: `congelata` la rende già `sticky`, che è
          // altrettanto un elemento posizionato — i montanti del binario si ancorano a
          // lei lo stesso, mentre `relative` le toglierebbe l'aggancio a sinistra.
          ...cellTdSx, ...congelata(COLONNE[2].sticky!),
          bgcolor: fondoCongelato ?? 'background.paper',
          pl: `${PAD_CELLA + depth * RIENTRO_LIVELLO}px`, pr: 0.5,
          whiteSpace: 'nowrap',
          fontWeight: depth === 0 ? 700 : 600,
          color: depth === 0 ? color : 'text.secondary',
          fontSize: depth === 0 ? '0.82rem' : '0.76rem',
        }}
      >
        {guide.map((g, l) => (
          <Fragment key={l}>
            <Box sx={{
              position: 'absolute', left: `${BINARIO_X + l * RIENTRO_LIVELLO}px`,
              top: 0, bottom: g.continua ? 0 : '50%', width: '1.5px',
              bgcolor: alpha(g.color, 0.45),
            }} />
            {l === depth - 1 && (
              <Box sx={{
                position: 'absolute', left: `${BINARIO_X + l * RIENTRO_LIVELLO}px`,
                top: 'calc(50% - 0.75px)', width: 9, height: '1.5px',
                bgcolor: alpha(g.color, 0.45),
              }} />
            )}
          </Fragment>
        ))}
        <Tooltip title={`Dettagli di ${code}`} placement="top">
          <Box
            component="button"
            type="button"
            onClick={apri}
            aria-label={`Dettagli di ${code}`}
            sx={{
              position: 'relative', p: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit',
              cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted',
              textUnderlineOffset: '3px', textDecorationColor: alpha(color, 0.5),
              '&:hover': { textDecorationStyle: 'solid', textDecorationColor: 'currentColor' },
            }}
          >
            {code}
          </Box>
        </Tooltip>
      </Box>

      {/* AGGIUNTA A CATALOGO: colonna propria, subito dopo il codice. Il pulsante
          arriva per portale dall'autocomplete, che sa se la voce manca a catalogo. */}
      <Box
        component="td"
        ref={setCellaAggiunta}
        sx={{ ...cellTdSx, ...congelata(COLONNE[3].sticky!), bgcolor: fondoCongelato ?? 'background.paper', textAlign: 'center', lineHeight: 0 }}
      />

      {/* MARCA / MOD. */}
      {modelloHidden ? (
        <>
          <Box component="td" sx={cellTdSx}>{celle.soloMarca}</Box>
          <Box component="td" sx={cellTdSx} />
        </>
      ) : (
        <Box component="td" colSpan={2} sx={cellTdSx}>
          {/* Nessun rientro sulla cella e i due autocomplete a metà esatta: così il
              confine fra Marca e Modello cade dove cade quello fra le due testate.
              Il rientro del testo lo mette l'autocomplete stesso (denseInputSx). */}
          <Box sx={{ '& > div': { display: 'flex', gap: 0 }, '& > div > .MuiAutocomplete-root': { flex: '1 1 0', minWidth: 0 } }}>
            {celle.marcaModello(true)}
          </Box>
        </Box>
      )}

      {/* PRESSIONE — viene prima della capacità: è la PS a determinare quale variante di
          modello si sta censendo, e quindi quale volume/FAD/Qmax il catalogo propone. */}
      <Box component="td" sx={cellTdSx}>{celle.ps}</Box>
      {/* CAPACITÀ — si sceglie fra i valori che il catalogo dichiara per il modello */}
      <Box component="td" sx={cellTdSx}>{celle.capacita}</Box>
      {/* TS */}
      <Box component="td" sx={cellTdSx}>{celle.ts}</Box>
      {/* CAT. */}
      <Box component="td" sx={cellTdSx}>{celle.cat}</Box>
      {/* ANNO */}
      <Box component="td" sx={cellTdSx}>{celle.anno}</Box>
      {/* N.F. */}
      <Box component="td" sx={cellTdSx}>{celle.nf}</Box>
    </Box>
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
  const { setOrigine } = useEquipmentCatalogContext()
  const divergenza = useRowCatalogDivergence()
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [pending, setPending] = useState<PendingDelete | null>(null)

  /**
   * Riga con i dettagli aperti, come posizione nell'elenco delle righe rese.
   *
   * Si tiene l'indice e non l'oggetto perché la finestra scorre da un'apparecchiatura
   * all'altra: con l'oggetto la freccia «successiva» non avrebbe da nessuna parte l'ordine
   * in cui le righe compaiono in tabella, che è l'ordine in cui ci si aspetta di scorrerle.
   */
  const [aperta, setAperta] = useState<number | null>(null)
  const chiudiDettaglio = () => setAperta(null)

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
    // La finestra punta a una posizione nell'elenco: dopo un'eliminazione l'elenco cambia
    // e quella posizione indica un'altra apparecchiatura. Si chiude.
    setAperta(null)

    const attuale = getValues() as Record<string, any>
    const { scheda, changed } = pruneSchedaRefs(attuale)
    if (!changed) return
    for (const [nome, fa] of Object.entries(fieldArrays)) {
      if (scheda[nome] !== attuale[nome]) fa.replace(scheda[nome] ?? [])
    }
  }

  /**
   * Valvole aggiuntive di un recipiente.
   *
   * Non passano da `useFieldArray`: vivono dentro un array già gestito da uno, e un secondo
   * field array annidato terrebbe l'elenco delle righe dentro il componente che lo monta —
   * mentre la finestra dei dettagli ha bisogno che l'elenco completo, valvole comprese, si
   * possa costruire qui, dove si sa in che ordine le righe compaiono.
   */
  const aggiuntiveDi = (recipiente: any): any[] => recipiente?.valvole_aggiuntive ?? []

  const appendiValvola = (base: string, correnti: any[]) =>
    setValue(`${base}.valvole_aggiuntive`, [...correnti, nuovaRiga(EQUIPMENT_DEFS.valvola, null)], { shouldDirty: true })

  const rimuoviValvola = (base: string, correnti: any[], j: number) => {
    setValue(`${base}.valvole_aggiuntive`, correnti.filter((_, k) => k !== j), { shouldDirty: true })
    dopoEliminazione()
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

  /**
   * Applica al form i dati tecnici della voce scelta a catalogo, e annota da dove vengono.
   *
   * L'annotazione è il termine di paragone per accorgersi, più tardi, che l'utente ha
   * scostato un valore dal default del catalogo, ed è la riga su cui riscrivere se decide di
   * riportarcelo. Si conserva la voce intera, non la sua pressione: due varianti dello stesso
   * modello possono dichiararne una uguale e si confonderebbero fra loro.
   *
   * Arriva sempre dopo una chiamata di rete: se nel frattempo un'eliminazione ha fatto scalare
   * gli indici, `base` non indica più quella riga e scrivere sporcherebbe quella subentrata.
   * Prima di scrivere si verifica che al percorso ci sia ancora il codice atteso.
   *
   * Per le valvole l'identità è quella del recipiente che le porta: la valvola non memorizza
   * un codice proprio, la sua posizione è calcolata.
   */
  const selettoreCatalogo =
    (def: EquipmentTypeDef, base: string, rowKey: string, identita: { path: string; value: string }) =>
      (specs: Record<string, any>, item?: EquipmentCatalogItem) => {
        if (getValues(identita.path) !== identita.value) return
        Object.entries(def.specsMap).forEach(([specKey, field]) => {
          const v = readSpec(def.catalogType, specs, specKey)
          if (v === null) return
          setValue(`${base}.${field}`, field === 'ts' ? String(v) : v)
        })
        if (!item) return
        setOrigine(rowKey, { catalogItem: item, appliedSpecs: (item.specs ?? {}) as Record<string, unknown> })
      }

  /** Handler di uscita dalla riga: verifica lo scostamento dai dati di catalogo. */
  const uscita = (def: EquipmentTypeDef, base: string, rowKey: string, code: string) => () =>
    divergenza.verificaRiga({ tipo: def.catalogType, base, rowKey, codice: code })

  /**
   * Righe della tabella e, in parallelo, l'elenco su cui la finestra dei dettagli scorre.
   *
   * I due nascono insieme perché devono avere lo stesso ordine: la freccia «successiva»
   * porta all'apparecchiatura che si vede sotto, non a quella che capita dopo nel modello dati.
   */
  const rows: ReactNode[] = []
  const voci: DettaglioRiga[] = []

  /** Aggiunge una riga alla tabella e la relativa voce all'elenco navigabile. */
  const aggiungiRiga = (args: {
    key: string
    def: EquipmentTypeDef
    base: string
    code: string
    rowKey: string
    guide: Guida[]
    ocr: OcrRef
    onDelete: (() => void) | null
    append: { label: string; onClick: () => void } | null
    /** Identità per le scritture asincrone; per le valvole è quella del recipiente. */
    identita: { path: string; value: string }
  }) => {
    const { key, def, base, code, rowKey, guide, ocr, onDelete, append, identita } = args
    const onSelected = selettoreCatalogo(def, base, rowKey, identita)
    const indice = voci.length
    voci.push({ def, base, code, color: KIND_COLOR[def.kind], onSelected, onDelete, append })
    rows.push(
      <EqRow
        key={key}
        control={control}
        def={def}
        base={base}
        code={code}
        rowKey={rowKey}
        onRowExit={uscita(def, base, rowKey, code)}
        onSelected={onSelected}
        guide={guide}
        adv={adv}
        ocr={ocr}
        indice={indice}
        onSelect={setAperta}
        selezionata={aperta === indice}
      />
    )
  }

  /**
   * Recipiente con valvola di sicurezza obbligatoria e valvole aggiuntive appendibili
   * (S1.1 + S1.2, C1.2 + C1.3): un recipiente può averne più d'una e la relazione le enumera
   * tutte. Le valvole scendono di un livello rispetto al recipiente che le porta.
   */
  const aggiungiRecipienteConValvole = (args: {
    key: string
    def: EquipmentTypeDef
    /** Nome dell'array della scheda, per la chiave delle provenienze dal catalogo. */
    arrayName: string
    base: string
    code: string
    valori: any
    guide: Guida[]
    ocr: OcrRef
    ocrValvola: OcrRef
    onDelete: () => void
    posizioni: (count: number) => string[]
  }) => {
    const { key, def, arrayName, base, code, valori, guide, ocr, ocrValvola, onDelete, posizioni } = args
    const aggiuntive = aggiuntiveDi(valori)
    const pos = posizioni(aggiuntive.length + 1)
    const identita = { path: `${base}.codice`, value: code }

    // Il recipiente porta sempre almeno la valvola principale: sotto di lui il ramo di
    // ogni antenato continua per forza.
    aggiungiRiga({
      key, def, base, code, rowKey: rowKeyOf(arrayName, code),
      guide: guide.map((g) => ({ ...g, continua: true })), ocr, onDelete, identita,
      append: { label: 'Valvola di sicurezza', onClick: () => appendiValvola(base, aggiuntive) },
    })

    /**
     * Le valvole scendono di un livello rispetto al recipiente. L'ultima chiude tutti i
     * rami in cui si trova — il proprio e quelli degli antenati — perché sotto di lei non
     * c'è più niente che appartenga a quel gruppo.
     */
    for (let j = 0; j <= aggiuntive.length; j++) {
      const prosegue = j < aggiuntive.length
      const codiceValvola = pos[j]
      aggiungiRiga({
        key: `${key}-v${j}`,
        def: EQUIPMENT_DEFS.valvola,
        base: j === 0 ? `${base}.valvola_sicurezza` : `${base}.valvole_aggiuntive.${j - 1}`,
        code: codiceValvola,
        rowKey: rowKeyOf(VALVOLE_ROW_PREFIX, codiceValvola),
        guide: [
          ...guide.map((g) => ({ ...g, continua: prosegue })),
          { color: KIND_COLOR[def.kind], continua: prosegue },
        ],
        ocr: ocrValvola,
        onDelete: j === 0 ? null : () => ask('la valvola', codiceValvola, () => rimuoviValvola(base, aggiuntive, j - 1)),
        append: null,
        identita,
      })
    }
  }

  // ── Ordine dell'impianto: compressori, serbatoi, essiccatori, filtri, altre.
  //    Non è l'ordine dei codici né quello del modello dati: è quello in cui l'aria
  //    attraversa la sala, ed è come il tecnico percorre l'impianto compilando.

  sortedEntries(compressori.fields, compressoriVals).forEach(({ f, i, code }) => {
    const dIdx = (disoleatoriVals ?? disoleatori.fields).findIndex((d: any) => d?.compressore_associato === code)
    const colore = KIND_COLOR.compressore
    aggiungiRiga({
      key: `c-${f.id}`, def: EQUIPMENT_DEFS.compressore, base: `compressori.${i}`, code,
      rowKey: rowKeyOf('compressori', code), guide: [],
      ocr: { equipmentType: 'Compressori', equipmentIndex: i },
      identita: { path: `compressori.${i}.codice`, value: code },
      onDelete: () => ask('il compressore', code, () => { if (dIdx >= 0) disoleatori.remove(dIdx); compressori.remove(i); dopoEliminazione() }),
      append: dIdx === -1
        ? { label: 'Disoleatore', onClick: () => { disoleatori.append(nuovaRiga(EQUIPMENT_DEFS.disoleatore, `${code}.1`, { compressore_associato: code })); setValue(`compressori.${i}.ha_disoleatore`, true) } }
        : null,
    })
    if (dIdx >= 0) {
      aggiungiRecipienteConValvole({
        key: `c-${f.id}-d`, def: EQUIPMENT_DEFS.disoleatore, arrayName: 'disoleatori',
        base: `disoleatori.${dIdx}`, code: `${code}.1`,
        valori: (disoleatoriVals ?? disoleatori.fields)[dIdx],
        guide: [{ color: colore, continua: true }],
        ocr: { equipmentType: 'Disoleatori', equipmentIndex: dIdx },
        ocrValvola: { equipmentType: 'Disoleatori', equipmentIndex: dIdx, componentType: 'valvola_sicurezza' },
        onDelete: () => ask('il disoleatore', `${code}.1`, () => { disoleatori.remove(dIdx); setValue(`compressori.${i}.ha_disoleatore`, false); dopoEliminazione() }),
        posizioni: (n) => codiciValvoleDisoleatore(`${code}.1`, n),
      })
    }
  })

  sortedEntries(serbatoi.fields, serbatoiVals).forEach(({ f, i, code }) => {
    aggiungiRecipienteConValvole({
      key: `s-${f.id}`, def: EQUIPMENT_DEFS.serbatoio, arrayName: 'serbatoi',
      base: `serbatoi.${i}`, code,
      valori: (serbatoiVals ?? serbatoi.fields)[i],
      guide: [],
      ocr: { equipmentType: 'Serbatoi', equipmentIndex: i },
      ocrValvola: { equipmentType: 'Serbatoi', equipmentIndex: i, componentType: 'valvola_sicurezza' },
      onDelete: () => ask('il serbatoio', code, () => { serbatoi.remove(i); dopoEliminazione() }),
      posizioni: (n) => codiciValvoleSerbatoio(code, n),
    })
  })

  sortedEntries(essiccatori.fields, essiccatoriVals).forEach(({ f, i, code }) => {
    const sIdx = (scambiatoriVals ?? scambiatori.fields).findIndex((s: any) => s?.essiccatore_associato === code)
    aggiungiRiga({
      key: `e-${f.id}`, def: EQUIPMENT_DEFS.essiccatore, base: `essiccatori.${i}`, code,
      rowKey: rowKeyOf('essiccatori', code), guide: [],
      ocr: { equipmentType: 'Essiccatori', equipmentIndex: i },
      identita: { path: `essiccatori.${i}.codice`, value: code },
      onDelete: () => ask("l'essiccatore", code, () => { if (sIdx >= 0) scambiatori.remove(sIdx); essiccatori.remove(i); dopoEliminazione() }),
      append: sIdx === -1
        ? { label: 'Scambiatore', onClick: () => { scambiatori.append(nuovaRiga(EQUIPMENT_DEFS.scambiatore, `${code}.1`, { essiccatore_associato: code })); setValue(`essiccatori.${i}.ha_scambiatore`, true) } }
        : null,
    })
    if (sIdx >= 0) {
      aggiungiRiga({
        key: `e-${f.id}-s`, def: EQUIPMENT_DEFS.scambiatore, base: `scambiatori.${sIdx}`, code: `${code}.1`,
        rowKey: rowKeyOf('scambiatori', `${code}.1`),
        guide: [{ color: KIND_COLOR.essiccatore, continua: false }],
        ocr: { equipmentType: 'Scambiatori', equipmentIndex: sIdx },
        identita: { path: `scambiatori.${sIdx}.codice`, value: `${code}.1` },
        onDelete: () => ask('lo scambiatore', `${code}.1`, () => { scambiatori.remove(sIdx); setValue(`essiccatori.${i}.ha_scambiatore`, false); dopoEliminazione() }),
        append: null,
      })
    }
  })

  sortedEntries(filtri.fields, filtriVals).forEach(({ f, i, code }) => {
    const rIdx = (recipientiVals ?? recipienti.fields).findIndex((r: any) => r?.filtro_associato === code)
    aggiungiRiga({
      key: `f-${f.id}`, def: EQUIPMENT_DEFS.filtro, base: `filtri.${i}`, code,
      rowKey: rowKeyOf('filtri', code), guide: [],
      ocr: { equipmentType: 'Filtri', equipmentIndex: i },
      identita: { path: `filtri.${i}.codice`, value: code },
      onDelete: () => ask('il filtro', code, () => { if (rIdx >= 0) recipienti.remove(rIdx); filtri.remove(i); dopoEliminazione() }),
      append: (showRecipienteFiltro && rIdx === -1)
        ? { label: 'Recipiente', onClick: () => { recipienti.append(nuovaRiga(EQUIPMENT_DEFS.recipiente, `${code}.1`, { filtro_associato: code })); setValue(`filtri.${i}.ha_recipiente`, true) } }
        : null,
    })
    if (rIdx >= 0 && showRecipienteFiltro) {
      aggiungiRiga({
        key: `f-${f.id}-r`, def: EQUIPMENT_DEFS.recipiente, base: `recipienti_filtro.${rIdx}`, code: `${code}.1`,
        rowKey: rowKeyOf('recipienti_filtro', `${code}.1`),
        guide: [{ color: KIND_COLOR.filtro, continua: false }],
        ocr: { equipmentType: 'Recipienti filtro', equipmentIndex: rIdx },
        identita: { path: `recipienti_filtro.${rIdx}.codice`, value: `${code}.1` },
        onDelete: () => ask('il recipiente', `${code}.1`, () => { recipienti.remove(rIdx); setValue(`filtri.${i}.ha_recipiente`, false); dopoEliminazione() }),
        append: null,
      })
    }
  })

  sortedEntries(separatori.fields, separatoriVals).forEach(({ f, i, code }) => {
    aggiungiRiga({
      key: `sep-${f.id}`, def: EQUIPMENT_DEFS.separatore, base: `separatori.${i}`, code,
      rowKey: rowKeyOf('separatori', code), guide: [],
      ocr: { equipmentType: 'Separatori', equipmentIndex: i },
      identita: { path: `separatori.${i}.codice`, value: code },
      onDelete: () => ask('il separatore', code, () => { separatori.remove(i); dopoEliminazione() }),
      append: null,
    })
  })

  const total = serbatoi.fields.length + compressori.fields.length + essiccatori.fields.length + filtri.fields.length + separatori.fields.length

  /** Voce aperta, con le azioni richiuse su «chiudi prima, poi agisci». */
  const dettaglio = aperta !== null && aperta < voci.length ? voci[aperta] : null
  const dettaglioConChiusura: DettaglioRiga | null = dettaglio && {
    ...dettaglio,
    onDelete: dettaglio.onDelete ? () => { chiudiDettaglio(); dettaglio.onDelete!() } : null,
    append: dettaglio.append ? { label: dettaglio.append.label, onClick: () => { chiudiDettaglio(); dettaglio.append!.onClick() } } : null,
  }

  return (
    <>
      <Card variant="outlined" sx={{ overflow: 'hidden', borderRadius: `${radii.card}px`, minWidth: 0 }}>
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
        <Box sx={{ overflow: 'auto', maxHeight: `calc(100vh - ${ALTEZZA_BARRA} - 190px)`, minHeight: 220 }}>
          <Box
            component="table"
            sx={{
              // Larghezze dichiarate e non calcolate sul contenuto: è quello che tiene
              // allineate le colonne fra righe di tipi diversi.
              borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
              minWidth: LARGHEZZA_TABELLA,
              '& th': {
                position: 'sticky', top: 0, zIndex: 2, verticalAlign: 'bottom',
                whiteSpace: 'nowrap', lineHeight: 1.2,
                fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
                color: 'text.primary', bgcolor: 'background.paper',
                p: `5px ${PAD_CELLA}px`,
                borderBottom: '2px solid', borderColor: 'divider',
              },
              // L'unità sotto il nome, in grigio: una riga sola per colonna invece di tre,
              // che allargavano il passo delle colonne strette.
              '& th u': { display: 'block', textDecoration: 'none', fontWeight: 400, letterSpacing: 0, textTransform: 'none', color: 'text.disabled' },
              // Bordi verticali fra le colonne: la lettura per colonna resta netta anche
              // dove i valori sono corti e distanti fra loro.
              '& td, & th': { borderRight: '1px solid', borderRightColor: (t: any) => alpha(t.palette.divider, 0.7) },
              '& td:last-of-type, & th:last-of-type': { borderRight: 0 },
            }}
          >
            <colgroup>
              {COLONNE.map((c, n) => <col key={n} style={{ width: c.w }} />)}
            </colgroup>
            <thead>
              <tr>
                {COLONNE.map((c, n) => (
                  <Box
                    component="th"
                    key={n}
                    aria-label={c.aria}
                    sx={{
                      ...(c.sticky !== undefined ? { ...congelata(c.sticky), zIndex: 3 } : {}),
                      textAlign: c.align ?? 'left',
                      // Il titolo arretra della larghezza del pulsante di riga: su una
                      // colonna a destra cade sopra l'ultima cifra, su una centrata sposta
                      // il proprio centro sopra il centro del valore.
                      ...(c.conAzione ? { pr: `${PAD_TITOLO_AZIONE}px !important` } : {}),
                    }}
                  >
                    {c.titolo}
                    {c.unita && <u>{c.unita}</u>}
                  </Box>
                ))}
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

      <EquipmentDetailDialog
        control={control}
        dettaglio={dettaglioConChiusura}
        adv={adv}
        posizione={{ indice: (aperta ?? 0) + 1, totale: voci.length }}
        onNaviga={(delta) => setAperta((n) => (n === null || voci.length === 0 ? n : (n + delta + voci.length) % voci.length))}
        onClose={chiudiDettaglio}
      />

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
