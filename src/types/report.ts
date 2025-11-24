/**
 * Interfacce TypeScript per la generazione della Relazione Tecnica DM329
 */

import { Customer } from './index';
import { DM329TechnicalData } from './index';
import { Request } from './index';

/**
 * Input aggiuntivo fornito dall'utente tramite modal pre-generazione
 */
export interface ReportGenerationInput {
  // Descrizione attività o codice ATECO
  descrizioneAttivita: string;

  // Tipo di giri per ciascun compressore: 'fissi' | 'variabili'
  // Key: codice compressore (es. 'C1', 'C2')
  compressoriGiri: Record<string, 'fissi' | 'variabili'>;

  // Array di codici apparecchiature sottoposte a spessimetrica
  // Es. ['C1.1', 'S2', 'E1.1']
  spessimetrica: string[];

  // Collegamenti tra compressori e serbatoi
  // Key: codice compressore (es. 'C1')
  // Value: array di codici serbatoi collegati (es. ['S1', 'S2'])
  collegamentiCompressoriSerbatoi: Record<string, string[]>;
}

/**
 * Dati completi per la generazione della relazione tecnica
 */
export interface RelazioneTecnicaData {
  // Dati del cliente
  cliente: Customer;

  // Dati della scheda tecnica DM329
  technicalData: DM329TechnicalData;

  // Dati della richiesta
  request: Request;

  // Informazioni aggiuntive fornite dall'utente
  additionalInfo: ReportGenerationInput;
}

/**
 * Tipo di verifica richiesta per un'apparecchiatura
 */
export type TipoVerifica = 'dichiarazione' | 'verifica' | 'esclusa';

/**
 * Info sulla verifica richiesta per un'apparecchiatura
 */
export interface VerificaInfo {
  tipo: TipoVerifica;
  motivazione: string; // Spiegazione del perché (es. "PS × V = 10000 > 8000")
}

/**
 * Apparecchiatura formattata per la relazione tecnica
 */
export interface ApparecchiaturaFormattata {
  posizione: string; // Es. "C1", "S1.1", "E1"
  descrizione: string;
  costruttore: string;
  modello: string;
  capacita?: string | number; // Litri per serbatoi, l/min per compressori
  pressioneMassima?: number;
  pressioneTaratura?: number;
  temperatura?: string;
  categoria?: string;
  anno?: number | string;
  numeroFabbrica?: string;
  verificaInfo?: VerificaInfo;
}

/**
 * Raggruppamento apparecchiature per la tabella verifiche
 */
export interface RaggruppamentoVerifica {
  apparecchiature: ApparecchiaturaFormattata[];
  tipoVerifica: TipoVerifica;
}

/**
 * Configurazione flags per placeholder condizionali
 */
export interface PlaceholderFlags {
  localeDedicato: boolean;
  accessoVietato: boolean;
  ariaAspirataPulita: boolean;
  revisioneDiChiarata: boolean;
  motivoRevisione?: string;
  verificheSpessimetriche: boolean;
  listaApparecchiatureSpessimetriche?: string[]; // Es. ["C1.1", "S2"]
}

/**
 * Contesto per la sostituzione dei placeholder
 */
export interface PlaceholderContext {
  // Dati cliente
  ragioneSociale: string;
  sedeLegaleVia: string;
  sedeLegaleCivico: string;
  sedeLegaleCap: string;
  sedeLegaleCitta: string;
  sedeLegaleProvincia: string;

  // Dati sede impianto
  sedeImpiantoVia: string;
  sedeImpiantoCivico: string;
  sedeImpiantoCap: string;
  sedeImpiantoCitta: string;
  sedeImpiantoProvincia: string;

  // Info aggiuntive
  descrizioneAttivita: string;

  // Conteggi apparecchiature
  numeroCompressori: number;
  numeroSerbatoi: number;
  numeroEssiccatori: number;
  numeroFiltri: number;
  numeroSeparatori: number;

  // Flags
  flags: PlaceholderFlags;

  // Apparecchiature formattate
  apparecchiature: ApparecchiaturaFormattata[];
}
