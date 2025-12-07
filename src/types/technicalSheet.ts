/**
 * Types per SCHEDA DATI DM329
 * Struttura dati per form raccolta informazioni sala compressori
 */

// ============================================================================
// SEZIONE 1: DATI GENERALI
// ============================================================================

export interface DatiGenerali {
  data_sopralluogo: string // Formato gg/mm/aaaa
  nome_tecnico: string
  cliente: string // Suggerimento da DB
  note_generali?: string
}

// ============================================================================
// SEZIONE 2: DATI IMPIANTO
// ============================================================================

export type AriaAspirataOption = 'Pulita' | 'Vapori' | 'Acidi' | 'Polveri' | 'Umidità' | 'Altro'
export type RaccoltaCondenserOption = 'Nessuna' | 'separatore' | 'tanica' | 'altro'

export interface DatiImpianto {
  sede_imp_uguale_legale: boolean // Se true, sede_impianto = sede_legale (readonly)
  sede_impianto: string // Autocomplete indirizzo - Obbligatorio se sede_imp_uguale_legale = false
  indirizzo_impianto: string // DEPRECATED - mantenuto per retrocompatibilità
  denominazione_sala?: string
  locale_dedicato?: boolean
  locale_condiviso_con?: string
  aria_aspirata?: AriaAspirataOption[]
  raccolta_condense: RaccoltaCondenserOption[] // Obbligatorio
  accesso_locale_vietato?: boolean
  lontano_fonti_calore?: boolean
  lontano_materiale_infiammabile?: boolean // NUOVO - Obbligatorio
  fonti_calore_materiali_infiammabili?: string // Rinominato da fonti_calore_vicine
  fonti_calore_vicine?: string // DEPRECATED - mantenuto per retrocompatibilità
  diametri_collegamenti_sala?: string
  diametri_linee_distribuzione?: string
}

// ============================================================================
// SEZIONE 3: SERBATOI (S1-S7)
// ============================================================================

export type FinituraInternaOption = 'VERNICIATO' | 'ZINCATO' | 'VITROFLEX' | 'ALTRO'
export type ScaricoOption = 'AUTOMATICO' | 'MANUALE' | 'ASSENTE'
export type CategoriaPED = 'I' | 'II' | 'III' | 'IV'

export interface ValvolaSicurezza {
  marca?: string // OCR
  modello?: string // OCR
  n_fabbrica?: string // OCR
  anno?: number // NUOVO - intero (min 1980, max 2100)
  diametro?: string // Testo libero
  pressione_taratura?: number // RINOMINATO da pressione - Ptar (bar) - 1 decimale (min 0, max 100000)
  pressione?: number // DEPRECATED - mantenuto per retrocompatibilità
  ts_temperatura?: number // NUOVO - TS (°C) - intero (min 50, max 250) - NON visibile a tecnicoDM329
  temperatura_max?: number // DEPRECATED - mantenuto per retrocompatibilità - TS (°C) - intero (min 0, max 500)
  volume_aria_scaricato?: number // NUOVO - Qmax (l/min) - intero (min 100, max 100000) - NON visibile a tecnicoDM329
  portata_max?: number // DEPRECATED - mantenuto per retrocompatibilità - Qmax (l/min) - intero (min 0, max 100000)
  categoria_ped?: CategoriaPED // NUOVO - Sempre "IV" readonly - NON visibile a tecnicoDM329
}

export interface Manometro {
  fondo_scala?: number // BAR (1 decimale, min 10, max 30)
  segno_rosso?: number // BAR (1 decimale, min 10, max 30)
}

export interface Serbatoio {
  codice: string // S1, S2, ... S7
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR - NON visibile a tecnicoDM329
  volume?: number // litri (intero, min 50, max 5000)
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  ps_pressione_max?: number // NUOVO - PS (bar) - 1 decimale (min 3.0, max 50.0) - NON visibile a tecnicoDM329
  ts_temperatura?: number // NUOVO - TS (°C) - intero (min 50, max 250) - NON visibile a tecnicoDM329
  categoria_ped?: CategoriaPED // NUOVO - Select I/II/III/IV - NON visibile a tecnicoDM329
  finitura_interna?: FinituraInternaOption // Select singola
  ancorato_terra?: boolean
  scarico?: ScaricoOption // Select singola
  note?: string
  valvola_sicurezza: ValvolaSicurezza // OBBLIGATORIA
  manometro?: Manometro
  foto_targhetta?: string // URL o base64
}

// ============================================================================
// SEZIONE 4: COMPRESSORI (C1-C5)
// ============================================================================

export interface Compressore {
  codice: string // C1, C2, ... C5
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  materiale_n?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  pressione_max?: number // bar (1 decimale, min 10, max 30)
  volume_aria_prodotto?: number // FAD (l/min) - intero (min 0, max 100000) - NON visibile a tecnicoDM329
  fad?: number // DEPRECATED - mantenuto per retrocompatibilità - FAD (l/min) - Volume d'aria prodotto - intero (min 0, max 100000)
  note?: string
  ha_disoleatore?: boolean // Flag per relazione con disoleatore
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 5: DISOLEATORI (C1.1-C5.1) - DIPENDENTI DA COMPRESSORI
// ============================================================================

export interface Disoleatore {
  codice: string // C1.1, C2.1, ... C5.1
  compressore_associato: string // C1, C2, ... C5
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  volume?: number // litri (intero, min 50, max 5000)
  ps_pressione_max?: number // NUOVO - PS (bar) - 1 decimale (min 3.0, max 50.0) - NON visibile a tecnicoDM329
  pressione_max?: number // DEPRECATED - mantenuto per retrocompatibilità - bar (1 decimale, min 10, max 30)
  ts_temperatura?: number // NUOVO - TS (°C) - intero (min 50, max 250) - NON visibile a tecnicoDM329
  categoria_ped?: CategoriaPED // NUOVO - Select I/II/III/IV - NON visibile a tecnicoDM329
  note?: string
  valvola_sicurezza: ValvolaSicurezza // OBBLIGATORIA
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 6: ESSICCATORI (E1-E4)
// ============================================================================

export interface Essiccatore {
  codice: string // E1, E2, E3, E4
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  ps_pressione_max?: number // NUOVO - PS (bar) - 1 decimale (min 3.0, max 50.0) - NON visibile a tecnicoDM329
  pressione_max?: number // DEPRECATED - mantenuto per retrocompatibilità - bar (1 decimale, min 10, max 30)
  volume_aria_trattata?: number // Q (l/min) - Volume d'aria trattata - intero (min 0, max 100000) - NON visibile a tecnicoDM329
  ha_scambiatore?: boolean // Flag per relazione con scambiatore
  note?: string
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 7: SCAMBIATORI (E1.1-E4.1) - DIPENDENTI DA ESSICCATORI
// ============================================================================

export interface Scambiatore {
  codice: string // E1.1, E2.1, E3.1, E4.1
  essiccatore_associato: string // E1, E2, E3, E4
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  ps_pressione_max?: number // NUOVO - PS (bar) - 1 decimale (min 3.0, max 50.0) - NON visibile a tecnicoDM329
  pressione_max?: number // DEPRECATED - mantenuto per retrocompatibilità - bar (1 decimale, min 10, max 30)
  ts_temperatura?: number // NUOVO - TS (°C) - intero (min 50, max 250) - NON visibile a tecnicoDM329
  temperatura_max?: number // DEPRECATED - mantenuto per retrocompatibilità - TS (°C) - Temperatura massima ammissibile - intero (min 0, max 500)
  volume?: number // litri (intero, min 50, max 5000) - NON visibile a tecnicoDM329
  categoria_ped?: CategoriaPED // NUOVO - Select I/II/III/IV - NON visibile a tecnicoDM329 - Calcolato da PS × Volume
  note?: string
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 8: FILTRI (F1-F8)
// ============================================================================

export interface RecipienteFiltro {
  codice: string // F1.1, F2.1, ... F8.1
  filtro_associato: string // F1, F2, ... F8
  marca?: string // Suggerimento DB + OCR - NON visibile a tecnicoDM329
  modello?: string // Suggerimento DB + OCR - NON visibile a tecnicoDM329
  n_fabbrica?: string // OCR - NON visibile a tecnicoDM329
  anno?: number // intero (min 1980, max 2100) - NON visibile a tecnicoDM329
  ps_pressione_max?: number // PS (bar) - 1 decimale (min 3.0, max 50.0) - NON visibile a tecnicoDM329
  ts_temperatura?: number // TS (°C) - intero (min 50, max 250) - NON visibile a tecnicoDM329
  volume?: number // litri (intero, min 50, max 5000) - NON visibile a tecnicoDM329
  note?: string // NON visibile a tecnicoDM329
  foto_targhetta?: string // NON visibile a tecnicoDM329
}

export interface Filtro {
  codice: string // F1, F2, ... F8
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  note?: string
  ha_recipiente?: boolean // Flag per relazione con recipiente filtro
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 9: SEPARATORI (SEP1-SEP3)
// ============================================================================

export interface Separatore {
  codice: string // SEP1, SEP2, SEP3
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  note?: string
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 10: ALTRI APPARECCHI
// ============================================================================

export interface AltriApparecchi {
  marca?: string // Suggerimento DB
  modello?: string // Suggerimento DB
  n_fabbrica?: string
  anno?: number // intero (min 1980, max 2100)
  note?: string
  descrizione?: string // DEPRECATED - mantenuto per retrocompatibilità - Campo libero multiriga
}

// ============================================================================
// STRUTTURA COMPLETA SCHEDA DATI
// ============================================================================

export interface SchedaDatiCompleta {
  // Metadata
  id_scheda?: string
  data_creazione?: string
  data_ultima_modifica?: string
  stato: 'bozza' | 'completa'

  // Sezioni
  dati_generali: DatiGenerali
  dati_impianto: DatiImpianto
  serbatoi: Serbatoio[] // max 7
  compressori: Compressore[] // max 5
  disoleatori: Disoleatore[] // max 5 (dipendenti da compressori)
  essiccatori: Essiccatore[] // max 4
  scambiatori: Scambiatore[] // max 4 (dipendenti da essiccatori)
  filtri: Filtro[] // max 8
  recipienti_filtro: RecipienteFiltro[] // max 8 (dipendenti da filtri)
  separatori: Separatore[] // max 3
  altri_apparecchi?: AltriApparecchi
}

// ============================================================================
// CONFIGURAZIONE LIMITI APPARECCHIATURE
// ============================================================================

export const EQUIPMENT_LIMITS = {
  serbatoi: { min: 1, max: 7, prefix: 'S' },
  compressori: { min: 1, max: 5, prefix: 'C' },
  disoleatori: { min: 0, max: 5, prefix: 'C', suffix: '.1' }, // Dipendenti
  essiccatori: { min: 1, max: 4, prefix: 'E' },
  scambiatori: { min: 0, max: 4, prefix: 'E', suffix: '.1' }, // Dipendenti
  filtri: { min: 1, max: 8, prefix: 'F' },
  recipienti_filtro: { min: 0, max: 8, prefix: 'F', suffix: '.1' }, // Dipendenti da filtri
  separatori: { min: 1, max: 3, prefix: 'SEP' },
} as const

// ============================================================================
// HELPER TYPES PER VALIDAZIONE
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  section: string
  field?: string
  equipment_code?: string
  message: string
  type: 'required' | 'dependency' | 'range' | 'format'
}

// ============================================================================
// OPZIONI SELECT/MULTISELECT
// ============================================================================

export const ARIA_ASPIRATA_OPTIONS: AriaAspirataOption[] = [
  'Pulita',
  'Vapori',
  'Acidi',
  'Polveri',
  'Umidità',
  'Altro',
]

export const RACCOLTA_CONDENSE_OPTIONS: RaccoltaCondenserOption[] = [
  'Nessuna',
  'separatore',
  'tanica',
  'altro',
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Genera codice automatico per apparecchiatura
 */
export const generateEquipmentCode = (
  prefix: string,
  index: number,
  suffix?: string
): string => {
  return `${prefix}${index}${suffix || ''}`
}

/**
 * Verifica se un compressore ha un disoleatore associato
 */
export const hasDisoleatore = (
  compressoreCodice: string,
  disoleatori: Disoleatore[]
): boolean => {
  return disoleatori.some((d) => d.compressore_associato === compressoreCodice)
}

/**
 * Verifica se un essiccatore ha uno scambiatore associato
 */
export const hasScambiatore = (
  essiccatoreCodice: string,
  scambiatori: Scambiatore[]
): boolean => {
  return scambiatori.some((s) => s.essiccatore_associato === essiccatoreCodice)
}

/**
 * Verifica se un filtro ha un recipiente associato
 */
export const hasRecipienteFiltro = (
  filtroCodice: string,
  recipienti: RecipienteFiltro[]
): boolean => {
  return recipienti.some((r) => r.filtro_associato === filtroCodice)
}

/**
 * Calcola percentuale completamento sezione
 */
export const calculateSectionCompletion = (
  section: any,
  requiredFields: string[]
): number => {
  if (!section) return 0

  const filledFields = requiredFields.filter((field) => {
    const value = section[field]
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'boolean') return true
    return value !== null && value !== undefined && value !== ''
  }).length

  return Math.round((filledFields / requiredFields.length) * 100)
}
