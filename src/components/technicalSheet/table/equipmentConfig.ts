import type { EquipmentCatalogType } from '@/types'
import {
  FLUIDO_LABELS, FLUIDO_OPTIONS, ORIENTAMENTO_LABELS, ORIENTAMENTO_OPTIONS,
  TIPO_COMPRESSORE_LABELS, TIPO_COMPRESSORE_OPTIONS, TIPO_FILTRO_LABELS, TIPO_FILTRO_OPTIONS,
  TIPO_GIRI_LABELS,
  UBICAZIONE_SERBATOIO_LABELS, UBICAZIONE_SERBATOIO_OPTIONS,
} from '@/types/technicalSheet'

/**
 * Configurazione per la TABELLA UNICA della scheda dati DM329.
 * Ogni tipo di apparecchiatura dichiara come si mappa sulle colonne condivise
 * (Marca, Modello, Capacità, Pressione, TS, Cat. PED, Anno, N.F.), quali campi
 * extra mostra nella riga espandibile, come si precompila dal catalogo e quale
 * eventuale apparecchiatura collegata può appendere.
 */

export type EquipmentKind =
  | 'serbatoio' | 'compressore' | 'disoleatore' | 'essiccatore'
  | 'scambiatore' | 'filtro' | 'recipiente' | 'separatore' | 'valvola'

export interface ExtraFieldDef {
  name: string // path relativo alla base della riga
  label: string
  /**
   * `multi` = selezione multipla con opzioni calcolate dai valori correnti del form
   * (vedi `optionsFrom`): le valvole censite non sono una lista statica.
   */
  kind: 'text' | 'number' | 'select' | 'check' | 'multi' | 'readonly'
  options?: readonly string[]
  /** Resa compatta del valore selezionato (es. finitura ZINCATO → «Z»). */
  display?: Record<string, string>
  /** Testo esteso delle voci di menu; se assente si mostra il valore grezzo. */
  labels?: Record<string, string>
  /** Valore applicato dal motore quando il campo è vuoto: mostrato in grigio al posto di «—». */
  emptyLabel?: string
  /** Il campo compare solo quando un altro campo della stessa riga vale `equals`. */
  showIf?: { field: string; equals: string }
  /** Sorgente delle opzioni dinamiche per `kind: 'multi'`. */
  optionsFrom?: 'valvole'
  min?: number
  max?: number
  step?: number
}

/** Chiavi delle colonne condivise che possono essere nascoste a tecnicoDM329. */
export type AdvKey = 'modello' | 'capacita' | 'pressione' | 'ts' | 'cat'

export interface EquipmentTypeDef {
  kind: EquipmentKind
  label: string
  prefix: string // per generazione codice (S, C, E, F, SEP)
  catalogType: EquipmentCatalogType
  capacitaField?: string // es. 'volume', 'volume_aria_prodotto'
  pressioneField?: string // es. 'ps_pressione_max', 'pressione_max', 'pressione_taratura'
  ts: boolean // colonna TS (testo libero)
  cat: false | 'edit' | 'IV'
  autoPed: boolean // Cat. PED calcolata da PS × Capacità
  extra: ExtraFieldDef[]
  specsMap: Record<string, string> // chiave specs catalogo -> path relativo
  childKind?: EquipmentKind // apparecchiatura collegata appendibile
  mandatoryValvola?: boolean // valvola di sicurezza sempre presente (serbatoio, disoleatore)
  adv?: AdvKey[] // colonne nascoste a tecnicoDM329
  roleHidden?: boolean // intera riga nascosta a tecnicoDM329 (recipiente filtro)
}

export const FINITURA_OPTIONS = ['VERNICIATO', 'ZINCATO', 'VITROFLEX', 'ALTRO'] as const
export const SCARICO_OPTIONS = ['AUTOMATICO', 'MANUALE', 'ASSENTE'] as const
export const FINITURA_ABBR: Record<string, string> = { VERNICIATO: 'V', ZINCATO: 'Z', VITROFLEX: 'VF', ALTRO: 'A' }
export const SCARICO_ABBR: Record<string, string> = { AUTOMATICO: 'A', MANUALE: 'M', ASSENTE: '—' }

const NOTE_EXTRA: ExtraFieldDef = { name: 'note', label: 'Note', kind: 'text' }
/**
 * Le apparecchiature senza valvola propria (scambiatore, recipiente filtro) sono protette
 * da valvole poste altrove: il legame è dichiarato, non deducibile dalla scheda.
 */
const VALVOLE_PROTEZIONE_EXTRA: ExtraFieldDef = {
  name: 'valvole_protezione', label: 'Protetto dalle valvole', kind: 'multi', optionsFrom: 'valvole',
}
const DENUNCIA_EXTRA: ExtraFieldDef[] = [
  { name: 'gia_denunciato', label: 'Già denunciato', kind: 'check' },
  { name: 'matricola_inail', label: 'Matr. INAIL', kind: 'text' },
]

export const EQUIPMENT_DEFS: Record<EquipmentKind, EquipmentTypeDef> = {
  serbatoio: {
    kind: 'serbatoio', label: 'Serbatoio', prefix: 'S', catalogType: 'Serbatoi',
    capacitaField: 'volume', pressioneField: 'ps_pressione_max', ts: true, cat: 'edit', autoPed: true,
    extra: [
      { name: 'orientamento', label: 'Orientamento', kind: 'select', options: ORIENTAMENTO_OPTIONS, display: ORIENTAMENTO_LABELS, labels: ORIENTAMENTO_LABELS, emptyLabel: 'Verticale' },
      { name: 'ubicazione', label: 'Ubicazione', kind: 'select', options: UBICAZIONE_SERBATOIO_OPTIONS, display: UBICAZIONE_SERBATOIO_LABELS, labels: UBICAZIONE_SERBATOIO_LABELS, emptyLabel: 'Sala compressori' },
      { name: 'ubicazione_altro', label: 'Quale posizione', kind: 'text', showIf: { field: 'ubicazione', equals: 'ALTRO' } },
      { name: 'fluido', label: 'Fluido', kind: 'select', options: FLUIDO_OPTIONS, display: FLUIDO_LABELS, labels: FLUIDO_LABELS, emptyLabel: 'Aria' },
      { name: 'fluido_altro', label: 'Quale fluido', kind: 'text', showIf: { field: 'fluido', equals: 'ALTRO' } },
      { name: 'finitura_interna', label: 'Finitura', kind: 'select', options: FINITURA_OPTIONS, display: FINITURA_ABBR },
      { name: 'scarico', label: 'Scarico', kind: 'select', options: SCARICO_OPTIONS, display: SCARICO_ABBR },
      { name: 'ancorato_terra', label: 'Ancorato a terra', kind: 'check' },
      { name: 'manometro.fondo_scala', label: 'Man. fondo scala', kind: 'number', min: 10, max: 30, step: 0.1 },
      { name: 'manometro.segno_rosso', label: 'Man. segno rosso', kind: 'number', min: 10, max: 30, step: 0.1 },
      NOTE_EXTRA, ...DENUNCIA_EXTRA,
    ],
    specsMap: { volume: 'volume', ps: 'ps_pressione_max', ts: 'ts', categoria_ped: 'categoria_ped' },
    mandatoryValvola: true,
    adv: ['modello', 'pressione', 'ts', 'cat'],
  },
  compressore: {
    kind: 'compressore', label: 'Compressore', prefix: 'C', catalogType: 'Compressori',
    capacitaField: 'volume_aria_prodotto', pressioneField: 'pressione_max', ts: false, cat: false, autoPed: false,
    extra: [
      // Il tipo è proprietà costruttiva del modello: viaggia col catalogo (specsMap).
      { name: 'tipo', label: 'Tipo', kind: 'select', options: TIPO_COMPRESSORE_OPTIONS, display: TIPO_COMPRESSORE_LABELS, labels: TIPO_COMPRESSORE_LABELS, emptyLabel: 'Rotativo a vite' },
      // Proprietà costruttiva del modello: si modifica dal catalogo, non da qui. La colonna
      // non è praticabile — la tabella ne ha già dieci strette e il valore è testuale e lungo.
      { name: 'giri', label: 'Giri', kind: 'readonly', display: TIPO_GIRI_LABELS, emptyLabel: 'non a catalogo' },
      { name: 'silenziato', label: 'Silenziato', kind: 'check' },
      NOTE_EXTRA,
    ],
    // `tipo_compressore` e non `tipo`: in `equipment_catalog` la colonna `tipo` è già
    // il tipo di apparecchiatura («Compressori»), qui si parla di tipologia costruttiva.
    // La pressione sta sotto `pressione_max`, come la scrivono il dialog di
    // inserimento e l'indice unico delle varianti: `ps` è il nome usato dai
    // recipienti e sui compressori non è mai stato valorizzato.
    specsMap: { fad: 'volume_aria_prodotto', pressione_max: 'pressione_max', tipo_compressore: 'tipo', giri: 'giri' },
    childKind: 'disoleatore',
    adv: ['capacita'],
  },
  disoleatore: {
    kind: 'disoleatore', label: 'Disoleatore', prefix: 'C', catalogType: 'Disoleatori',
    capacitaField: 'volume', pressioneField: 'ps_pressione_max', ts: true, cat: 'edit', autoPed: false,
    extra: [NOTE_EXTRA, ...DENUNCIA_EXTRA],
    specsMap: { volume: 'volume', ps: 'ps_pressione_max', ts: 'ts', categoria_ped: 'categoria_ped' },
    mandatoryValvola: true,
    adv: ['pressione', 'ts', 'cat'],
  },
  essiccatore: {
    kind: 'essiccatore', label: 'Essiccatore', prefix: 'E', catalogType: 'Essiccatori',
    capacitaField: 'volume_aria_trattata', pressioneField: 'ps_pressione_max', ts: false, cat: false, autoPed: false,
    extra: [NOTE_EXTRA],
    specsMap: { q: 'volume_aria_trattata', ps: 'ps_pressione_max' },
    childKind: 'scambiatore',
    adv: ['capacita', 'pressione'],
  },
  scambiatore: {
    kind: 'scambiatore', label: 'Scambiatore', prefix: 'E', catalogType: 'Scambiatori',
    capacitaField: 'volume', pressioneField: 'ps_pressione_max', ts: true, cat: 'edit', autoPed: true,
    extra: [VALVOLE_PROTEZIONE_EXTRA, NOTE_EXTRA, ...DENUNCIA_EXTRA],
    specsMap: { volume: 'volume', ps: 'ps_pressione_max', ts: 'ts', categoria_ped: 'categoria_ped' },
    adv: ['capacita', 'pressione', 'ts', 'cat'],
  },
  filtro: {
    kind: 'filtro', label: 'Filtro', prefix: 'F', catalogType: 'Filtri',
    ts: false, cat: false, autoPed: false,
    extra: [
      { name: 'tipo', label: 'Tipo', kind: 'select', options: TIPO_FILTRO_OPTIONS, display: TIPO_FILTRO_LABELS, labels: TIPO_FILTRO_LABELS, emptyLabel: 'Filtro di linea' },
      NOTE_EXTRA,
    ],
    specsMap: {},
    childKind: 'recipiente',
  },
  recipiente: {
    kind: 'recipiente', label: 'Recipiente filtro', prefix: 'F', catalogType: 'Recipienti filtro',
    capacitaField: 'volume', pressioneField: 'ps_pressione_max', ts: true, cat: 'edit', autoPed: true,
    extra: [VALVOLE_PROTEZIONE_EXTRA, NOTE_EXTRA, ...DENUNCIA_EXTRA],
    specsMap: { volume: 'volume', ps: 'ps_pressione_max', ts: 'ts', categoria_ped: 'categoria_ped' },
    roleHidden: true,
  },
  separatore: {
    kind: 'separatore', label: 'Separatore', prefix: 'SEP', catalogType: 'Separatori',
    ts: false, cat: false, autoPed: false,
    extra: [NOTE_EXTRA],
    specsMap: {},
  },
  valvola: {
    kind: 'valvola', label: 'Valvola di sicurezza', prefix: '', catalogType: 'Valvole di sicurezza',
    capacitaField: 'volume_aria_scaricato', pressioneField: 'pressione_taratura', ts: true, cat: 'IV', autoPed: false,
    extra: [{ name: 'diametro', label: 'Diametro', kind: 'text' }],
    specsMap: { ptar: 'pressione_taratura', ts: 'ts', qmax: 'volume_aria_scaricato', diametro: 'diametro' },
    adv: ['capacita', 'ts', 'cat'],
  },
}

/** Tipi selezionabili dal pulsante "Nuova apparecchiatura". */
export const NEW_EQUIPMENT_KINDS = [
  'serbatoio', 'compressore', 'essiccatore', 'filtro', 'separatore',
] as const satisfies readonly EquipmentKind[]

/** Solo i tipi creabili: chi ne indicizza l'insieme deve coprirli tutti, verificato dal compilatore. */
export type NewEquipmentKind = (typeof NEW_EQUIPMENT_KINDS)[number]

/**
 * Nome dell'array della scheda per ogni tipo.
 * Le valvole non ne hanno uno proprio: vivono dentro il recipiente che le porta.
 */
export const KIND_ARRAY: Record<EquipmentKind, string> = {
  serbatoio: 'serbatoi', compressore: 'compressori', disoleatore: 'disoleatori',
  essiccatore: 'essiccatori', scambiatore: 'scambiatori', filtro: 'filtri',
  recipiente: 'recipienti_filtro', separatore: 'separatori', valvola: '',
}
