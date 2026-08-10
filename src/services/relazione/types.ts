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

import type { EsitoDM329 } from '@/utils/dm329Classification'

// Il tipo vive col resto del modello della scheda: `giri` è una proprietà costruttiva del
// compressore a catalogo, e il layer relazione non deve esserne la fonte.
export type { TipoGiri } from '@/types/technicalSheet'
import type { TipoGiri } from '@/types/technicalSheet'

export interface AdditionalInfo {
  /** Descrizione attività ATECO (testo libero) */
  descrizioneAttivita?: string
  /**
   * Giri per compressore: { C1: 'fissi' | 'variabili' }.
   *
   * Ripiego: il dato autorevole è `specs.giri` della voce di catalogo, riportato nella scheda.
   * Qui restano solo i compressori per cui il catalogo non lo sa ancora, e la risposta viene
   * comunque riscritta a catalogo.
   */
  compressoriGiri?: Record<string, TipoGiri>
  /** Codici apparecchiature sottoposte a verifica spessimetrica, es. ['C1','S2'] */
  spessimetrica?: string[]
  /** Collegamenti compressori→serbatoi: { C1: ['S1','S2'] } */
  collegamentiCompressoriSerbatoi?: Record<string, string[]>
}

// ============================================================================
// Sezione: PREMESSA + copertina
// ============================================================================

/**
 * Dati del codice pratica (tabella `requests`): unica sorgente dell'ubicazione
 * dell'impianto e del progressivo di revisione. Le stesse informazioni erano duplicate
 * nella scheda dati; la duplicazione è stata rimossa.
 */
export interface PraticaInfo {
  /** 0 = prima emissione, 1,2,… = revisioni */
  progressivo?: number | null
  denominazioneSala?: string | null
  impiantoUgualeSedeLegale?: boolean | null
  indirizzoImpianto?: string | null
}

export interface PremessaModel {
  ragioneSociale: string
  /** Indirizzo sede legale formattato: "via n° civico, cap comune (provincia)" */
  sedeLegale: string
  /** Come sopra ma con la località a capo: la copertina la vuole su due righe. */
  sedeLegaleCopertina: string
  /** Indirizzo sito produttivo formattato (= sede legale se coincidono) */
  sitoProduttivo: string
  /** Variante di copertina; se l'indirizzo è testo libero resta su una riga. */
  sitoProduttivoCopertina: string
  descrizioneAttivita: string
  /** Clausola di ubicazione impianto. Senza la sala: quella ha un run proprio, in corsivo. */
  ubicazione: string
  /** Regola la clausola «ed individuato come …» in §1. */
  haDenominazioneSala: boolean
  /** Denominazione della sala già virgolettata; il corsivo lo mette il template. */
  denominazioneSala: string
  /** Numero di revisione desunto dal codice pratica ('0' alla prima emissione). */
  numeroRevisione: string
  /** «prima emissione» alla revisione 0, altrimenti vuota: la compila il tecnico. */
  notaRevisione: string
  /**
   * Falso quando l'ubicazione non è stata dichiarata da nessuna parte e la clausola
   * ripiega sulla sede legale. Il documento resta leggibile, ma l'affermazione non
   * poggia su un dato: lo segnala il preflight.
   */
  ubicazioneDichiarata: boolean
  /** Vero se il progressivo del codice pratica è oltre lo zero */
  haRevisione: boolean
  haSpessimetrica: boolean
}

// ============================================================================
// Sezione: DESCRIZIONE GENERALE DELL'IMPIANTO
// ============================================================================

export interface DescrizioneGeneraleModel {
  /**
   * Righe elenco "sezioni principali", già risolte con plurali, tipi e ubicazioni.
   * Le condizioni di installazione sono passate alla tabella §2.2 e i paragrafi
   * invarianti al template: qui resta solo ciò che dipende dalla configurazione.
   */
  sezioni: string[]
}

// ============================================================================
// Opzioni condivise dell'engine
// ============================================================================

export interface EngineOptions {
  /** Risolve la marca breve nel nome completo del costruttore (default: identità). */
  resolveCostruttore?: (marca?: string) => string
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
  /**
   * False quando al recipiente non è collegato alcun compressore: il confronto di
   * portata non è definito e la colonna esito riporta "n.a." anziché una spunta.
   */
  applicabile: boolean
  /**
   * Falso quando manca la portata del compressore o quella scaricata dalla valvola.
   * Senza questo flag il confronto `0 ≤ 0` dichiarerebbe adeguata una valvola di cui
   * non si sa nulla: una spunta è un'affermazione, non l'assenza di dati.
   */
  datiCompleti: boolean
  /** Compressori la cui portata concorre alla portata da elaborare */
  connesse: ValvolaConnessa[]
  portataMax: string
  /**
   * Testo della cella «portata massima da elaborare»: il solo totale con un compressore,
   * la somma scomposta ("8000 + 4920 = 12920") quando ne concorrono più d'uno. Un unico
   * campo perché il totale nudo accanto alla somma che lo produce era una ripetizione.
   */
  portataMaxTesto: string
  portataScaricata: string
  adeguato: boolean
}

export interface PressioneValvolaRow {
  posValvola: string
  nFabbricaValvola: string
  /** Falso quando manca la PS del recipiente o la pressione di taratura della valvola. */
  datiCompleti: boolean
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
// Sezione: §5.2 tabella degli esiti DM 329/2004
// ============================================================================

export interface EsitoRow {
  pos: string
  /**
   * Posizione del capogruppo: le righe che condividono questo valore formano un gruppo
   * (compressore + disoleatore + valvole, serbatoio + valvole, essiccatore + scambiatore,
   * filtro + recipiente). Stato INAIL e verifica di integrità sono proprietà del gruppo,
   * non della singola riga, e le celle vengono fuse verticalmente in fase di render.
   */
  gruppo: string
  apparecchiatura: string
  costruttore: string
  modello: string
  /**
   * Verdetto grezzo, non renderizzato dal template: lo consumano la tabella di
   * riqualificazione periodica (§7.2) e il preflight di completezza.
   */
  esito: EsitoDM329 | null
  /**
   * Vero per i recipienti in pressione. Serve al preflight per distinguere
   * `esito: null` «non classificabile per dati mancanti» da `esito: null`
   * «non è un recipiente, quindi non ha un esito proprio» (valvole e non recipienti).
   */
  recipiente: boolean
  /** Vuoti quando l'apparecchiatura non è un recipiente o quando V < 25 l */
  volume: string
  ps: string
  psPerV: string
  categoria: string
  /** Etichetta leggibile dell'adempimento */
  adempimento: string
  /** Riferimento normativo che giustifica l'adempimento */
  riferimento: string
  /** '' · "Già immatricolato n.m. …" · "Nuova richiesta" */
  statoInail: string
  verificaIntegrita: boolean
}

// ============================================================================
// Sezione: §2.2 condizioni di installazione
// ============================================================================

export interface CondizioneRow {
  requisito: string
  /** Esito e, accodata col trattino, l'eventuale precisazione: la tabella ha due colonne */
  esito: string
  /** Se vero il template evidenzia la riga: richiede una valutazione del redattore */
  evidenzia: boolean
}

// ============================================================================
// Sezione: §3 fluidi di processo
// ============================================================================

export interface FluidoRow {
  circuito: string
  fluido: string
  /** Gruppo ai sensi dell'art. 3 D.lgs. 93/2000 ('' se non asseribile) */
  gruppo: string
  provenienza: string
}

export interface FluidiModel {
  righe: FluidoRow[]
  /**
   * True quando l'aria aspirata è dichiarata non pulita. Il template rende in
   * giallo la frase «priva di sostanze nocive» invece di riscriverla: la
   * valutazione resta al redattore, l'automatismo si limita a segnalarla.
   */
  evidenziaNocive: boolean
}

// ============================================================================
// Sezione: §5.3 sistemi di protezione e controllo
// ============================================================================

export interface ValvolaProtezione {
  pos: string
  nFabbrica: string
}

/** Tabella 1 di §5.3 — serbatoi, con tutti i presidi rilevati. */
export interface ProtezioneRow {
  pos: string
  apparecchiatura: string
  valvole: ValvolaProtezione[]
  scaricoCondensa: string
  finituraInterna: string
  ancoraggio: string
  manometro: string
}

/**
 * Tabella 2 di §5.3 — altre apparecchiature soggette al DM329 (disoleatori,
 * scambiatori, recipienti filtro). Di questi presidi si rilevano solo valvole e
 * manometro: scarico condensa, finitura e ancoraggio non sono dati della scheda.
 */
export interface ProtezioneAltraRow {
  pos: string
  apparecchiatura: string
  valvole: ValvolaProtezione[]
  manometro: string
}

export interface ProtezioniModel {
  serbatoi: ProtezioneRow[]
  altre: ProtezioneAltraRow[]
  /**
   * Il template avvolge in questo flag l'intestazione e la tabella delle altre
   * apparecchiature: un impianto senza di esse non deve mostrare un titolo con sotto
   * una tabella vuota. Serve un booleano perché un `{#altre}` ripeterebbe il blocco
   * una volta per riga.
   */
  haAltre: boolean
}

// ============================================================================
// Sezione: §5.4 nota sulle tubazioni
// ============================================================================

export interface TubazioniModel {
  /** True se il DN massimo rilevato resta entro la soglia di esclusione (80 mm) */
  escluse: boolean
  /** DN massimo rilevato, '' se non dichiarato */
  dnMassimo: string
}

// ============================================================================
// Sezione: §7.2 scadenze di riqualificazione periodica
// ============================================================================

export interface RiqualificazioneRow {
  pos: string
  apparecchiatura: string
  categoria: string
  verificaFunzionamento: string
  verificaIntegrita: string
}

// ============================================================================
// Modello completo passato al template Word
// ============================================================================

/**
 * §2.3 — schema d'impianto scelto dal redattore al momento della generazione.
 *
 * Non viene salvato da nessuna parte: la relazione si compone interamente nel browser,
 * quindi i byte vanno dal file scelto direttamente dentro il .docx senza passare dal
 * server. Conseguenza voluta: nessuno spazio occupato su Storage, ma lo schema va
 * riselezionato a ogni rigenerazione.
 */
export interface SchemaImpianto {
  /** Byte dell'immagine, nel formato originale (PNG, JPEG, …). */
  dati: Uint8Array
  /** Dimensioni native, misurate alla selezione: servono a conservare le proporzioni. */
  larghezzaPx: number
  altezzaPx: number
  /** Nome del file scelto, per il riepilogo nel dialog. */
  nomeFile?: string
}

// ============================================================================
// Preflight di completezza (vedi preflight.ts)
// ============================================================================

export interface Segnalazione {
  /** `errore`: il documento sarebbe incompleto o falso. `avviso`: da sapere, non da correggere per forza. */
  livello: 'errore' | 'avviso'
  /** Codice stabile, indipendente dalla formulazione del messaggio. */
  codice: string
  messaggio: string
  /** Posizioni delle apparecchiature interessate, es. ['S1', 'C1.2']. */
  posizioni?: string[]
}

export interface RelazioneModel {
  premessa: PremessaModel
  descrizioneGenerale: DescrizioneGeneraleModel
  /** §2.2 — condizioni di installazione */
  condizioniInstallazione: CondizioneRow[]
  /** §3 — fluidi di processo */
  fluidi: FluidiModel
  caratteristiche: CaratteristicheRow[]
  /** §5.2 — tabella degli esiti DM329 */
  esiti: EsitoRow[]
  /** §5.3 — sistemi di protezione e controllo (due tabelle) */
  protezioni: ProtezioniModel
  /** §5.4 — esito della verifica sui diametri delle tubazioni */
  tubazioni: TubazioniModel
  /** §7.2 — scadenze di riqualificazione periodica */
  riqualificazione: RiqualificazioneRow[]
  valvole: ValvoleModel
  allegati: string[]
  /** §2.3 — immagine dello schema, assente se il redattore non ne ha scelta una */
  schemaImpianto?: SchemaImpianto
}
