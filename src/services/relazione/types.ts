/**
 * Tipi per la generazione della relazione tecnica DM329.
 *
 * `RelazioneModel` è il "modello risolto": ogni sezione contiene già i testi
 * finali e i flag di presenza, così il template Word resta muto (nessuna logica).
 * Il modello cresce sezione per sezione man mano che l'engine viene implementato.
 */

// ============================================================================
// additional_info (colonna JSONB dm329_technical_data) — dati raccolti dallo
// step "Dati relazione", non presenti nella scheda dati.
// ============================================================================

export type TipoGiri = 'fissi' | 'variabili'

export interface AdditionalInfo {
  /** Descrizione attività ATECO (testo libero) */
  descrizioneAttivita?: string
  /** Giri per compressore: { C1: 'fissi' | 'variabili' } */
  compressoriGiri?: Record<string, TipoGiri>
  /** Codici apparecchiature sottoposte a verifica spessimetrica, es. ['C1','S2'] */
  spessimetrica?: string[]
  /** Collegamenti compressori→serbatoi: { C1: ['S1','S2'] } */
  collegamentiCompressoriSerbatoi?: Record<string, string[]>
  /** Motivo revisione documento (se presente ⇒ il documento è una revisione) */
  motivoRevisione?: string
}

// ============================================================================
// Sezione: PREMESSA + copertina
// ============================================================================

export interface PremessaModel {
  ragioneSociale: string
  /** Indirizzo sede legale formattato: "via n° civico, cap comune (provincia)" */
  sedeLegale: string
  /** Indirizzo sito produttivo formattato (= sede legale se coincidono) */
  sitoProduttivo: string
  descrizioneAttivita: string
  /** Clausola di ubicazione impianto usata nella premessa */
  ubicazione: string
  haRevisione: boolean
  motivoRevisione: string
  haSpessimetrica: boolean
}

// ============================================================================
// Sezione: DESCRIZIONE GENERALE DELL'IMPIANTO
// ============================================================================

export interface DescrizioneGeneraleModel {
  /** Righe elenco "sezioni principali", già risolte con plurali e giri */
  sezioni: string[]
  /** Frase "L'impianto è alloggiato entro un'area ..." già risolta con i flag */
  fraseArea: string
  haLocaleDedicato: boolean
  /** Paragrafo aggiuntivo sul locale dedicato ('' se non applicabile) */
  paragrafoLocaleDedicato: string
}

// ============================================================================
// Opzioni condivise dell'engine
// ============================================================================

export interface EngineOptions {
  /** Risolve la marca breve nel nome completo del costruttore (default: identità). */
  resolveCostruttore?: (marca?: string) => string
}

// ============================================================================
// Sezione: tabella "procedura DM329" (Dichiarazione / Verifica messa in servizio)
// ============================================================================

export interface ProceduraRow {
  pos: string
  descrizione: string
  costruttore: string
  modello: string
  nFabbrica: string
  dichiarazione: boolean
  verifica: boolean
}

// ============================================================================
// Sezione: tabella "caratteristiche apparecchiature"
// ============================================================================

export interface CaratteristicheRow {
  pos: string
  descrizione: string
  costruttore: string
  modello: string
  /** Capacità [l] / Aria producibile [l/min] / Portata scaricata [l/min] secondo il tipo */
  capacita: string
  /** Pressione massima [bar] o Pressione di taratura [bar] secondo il tipo */
  pressione: string
  /** Temperatura come range "min ÷ +TS" ('' se non applicabile) */
  temperatura: string
  categoria: string
  anno: string
  nFabbrica: string
}

// ============================================================================
// Sezione: tabelle di verifica valvole (portata + pressione)
// ============================================================================

export interface ValvolaConnessa {
  pos: string
  descrizione: string
  costruttore: string
  modello: string
}

export interface PortataValvolaRow {
  posValvola: string
  nFabbricaValvola: string
  /** Compressori la cui portata concorre alla portata da elaborare */
  connesse: ValvolaConnessa[]
  portataMax: string
  portataScaricata: string
  adeguato: boolean
}

export interface PressioneValvolaRow {
  posValvola: string
  nFabbricaValvola: string
  /** Recipiente (disoleatore/serbatoio) associato alla valvola */
  connesse: ValvolaConnessa[]
  psRecipiente: string
  pressioneTaratura: string
  adeguato: boolean
}

export interface ValvoleModel {
  portata: PortataValvolaRow[]
  pressione: PressioneValvolaRow[]
}

// ============================================================================
// Sezione: CLASSIFICAZIONE DELLE APPARECCHIATURE
// ============================================================================

export interface ClassificazioneBlocco {
  /** Alternativa selezionata 1..5 (0 se nessuna apparecchiatura del tipo) */
  alternativa: number
  /** Testo legale risolto (⚠️ da validare legalmente) */
  testo: string
}

export interface ClassificazioneModel {
  compressori: ClassificazioneBlocco
  essiccatori: ClassificazioneBlocco
  serbatoi: ClassificazioneBlocco
}

// ============================================================================
// Modello completo passato al template Word
// ============================================================================

export interface RelazioneModel {
  premessa: PremessaModel
  descrizioneGenerale: DescrizioneGeneraleModel
  caratteristiche: CaratteristicheRow[]
  procedura: ProceduraRow[]
  classificazione: ClassificazioneModel
  valvole: ValvoleModel
  allegati: string[]
  /** Dati di copertina/intestazione */
  dataSopralluogo: string
  nomeTecnico: string
}
