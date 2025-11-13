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
  indirizzo_impianto: string
  denominazione_sala?: string
  locale_dedicato?: boolean
  locale_condiviso_con?: string
  aria_aspirata?: AriaAspirataOption[]
  raccolta_condense: RaccoltaCondenserOption[] // Obbligatorio
  accesso_locale_vietato?: boolean
  lontano_fonti_calore?: boolean
  fonti_calore_vicine?: string
  diametri_collegamenti_sala?: string
  diametri_linee_distribuzione?: string
}

// ============================================================================
// SEZIONE 3: SERBATOI (S1-S7)
// ============================================================================

export interface ValvolaSicurezza {
  marca?: string // OCR
  modello?: string // OCR
  n_fabbrica?: string // OCR
  diametro_pressione?: string // OCR - "Diametro e Pressione"
}

export interface Manometro {
  fondo_scala?: number // BAR (1 decimale, min 10, max 30)
  segno_rosso?: number // BAR (1 decimale, min 10, max 30)
}

export interface Serbatoio {
  codice: string // S1, S2, ... S7
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  volume?: number // litri (intero, min 50, max 5000)
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  finitura_interna?: string[]
  ancorato_terra?: boolean
  scarico?: string[]
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
  volume?: number // litri (intero, min 50, max 5000)
  pressione_max?: number // bar (1 decimale, min 10, max 30)
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
  pressione_max?: number // bar (1 decimale, min 10, max 30)
  ha_scambiatore?: boolean // Flag per relazione con scambiatore
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
  pressione_max?: number // bar (1 decimale, min 10, max 30)
  volume?: number // litri (intero, min 50, max 5000)
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 8: FILTRI (F1-F8)
// ============================================================================

export interface Filtro {
  codice: string // F1, F2, ... F8
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  n_fabbrica?: string // OCR
  anno?: number // intero (min 1980, max 2100)
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 9: SEPARATORI (SEP1-SEP3)
// ============================================================================

export interface Separatore {
  codice: string // SEP1, SEP2, SEP3
  marca?: string // Suggerimento DB + OCR
  modello?: string // Suggerimento DB + OCR
  foto_targhetta?: string
}

// ============================================================================
// SEZIONE 10: ALTRI APPARECCHI
// ============================================================================

export interface AltriApparecchi {
  descrizione?: string // Campo libero multiriga
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
