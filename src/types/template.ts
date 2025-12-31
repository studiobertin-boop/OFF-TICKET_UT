/**
 * Types per il sistema di template per documenti (relazioni tecniche, etc.)
 */

// import type { WizardConfig } from './wizard'; // Wizard rimosso temporaneamente

// Tipologie di template supportate
export type TemplateType = 'dm329_technical' | 'inail' | 'custom';

// Formato output supportato
export type TemplateFormat = 'docx' | 'pdf';

// Modalità editor template
export type TemplateEditorMode = 'visual_wizard' | 'advanced';

// Tipo di sezione nel template
export type SectionType = 'paragraph' | 'table' | 'custom' | 'heading' | 'conditional';

/**
 * Metadata del documento (margini, font, etc.)
 */
export interface TemplateMetadata {
  pageMargins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  defaultFont?: string;
  defaultFontSize?: number;
}

/**
 * Stile per tabelle
 */
export interface TableStyle {
  headerBackgroundColor?: string;
  width?: string;
  borders?: boolean;
  cellPadding?: number;
}

/**
 * Definizione di una sezione del template
 */
export interface TemplateSection {
  id: string;
  title: string;
  enabled: boolean;
  type: SectionType;
  template: string | TableTemplate | ConditionalBlock[];
  order?: number;
}

/**
 * Blocco condizionale con varianti multiple
 * Permette di definire testi alternativi basati su condizioni
 */
export interface ConditionalBlock {
  id: string;
  type: 'conditional';
  showCondition?: BlockCondition;  // Condizione per mostrare l'intero blocco (opzionale)
  variants: BlockVariant[];         // Varianti di testo alternative
  defaultVariantId?: string;        // ID variante di default (se nessuna condizione match)
}

/**
 * Condizione per blocchi/varianti
 * Valuta un campo rispetto a un valore
 */
export interface BlockCondition {
  field: string;                    // Path del campo, es: "compressori.length", "serbatoi[0].volume"
  operator: ConditionOperator;
  value: any;                       // Valore da confrontare
  logicalOperator?: 'AND' | 'OR';  // Per condizioni multiple (futuro)
  subConditions?: BlockCondition[]; // Per condizioni annidate (futuro)
}

/**
 * Operatori supportati per le condizioni
 */
export type ConditionOperator =
  | 'eq'        // uguale (===)
  | 'ne'        // diverso (!==)
  | 'gt'        // maggiore (>)
  | 'gte'       // maggiore o uguale (>=)
  | 'lt'        // minore (<)
  | 'lte'       // minore o uguale (<=)
  | 'contains'  // contiene (array.includes)
  | 'isEmpty'   // vuoto/null/undefined
  | 'isNotEmpty'; // non vuoto

/**
 * Variante di testo per blocco condizionale
 * Ogni variante ha una condizione e un contenuto Handlebars
 */
export interface BlockVariant {
  id: string;
  label: string;                    // Es: "Singolare", "Plurale", "Nessuno"
  condition?: BlockCondition;       // Condizione per questa variante
  content: string;                  // Testo template Handlebars
  isDefault?: boolean;              // Se true, usata quando nessuna condizione match
}

/**
 * Template specifico per tabelle
 */
export interface TableTemplate {
  headers: string[];
  rows: string; // Template Handlebars per le righe
  style?: TableStyle;
}

/**
 * Contenuto completo del template (salvato nel campo JSONB)
 */
export interface TemplateContent {
  format: TemplateFormat;
  metadata?: TemplateMetadata;
  sections: TemplateSection[];
  partials?: Record<string, string>; // Named partials Handlebars
  helpers?: Record<string, string>;  // Custom helpers (serializzati come stringhe)
}

/**
 * Template completo (riga database)
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: TemplateType;
  content: TemplateContent;
  is_active: boolean;
  version: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  required_data_schema?: Record<string, any>;
  // Campi wizard
  editor_mode?: TemplateEditorMode;
  wizard_config?: any; // WizardConfig temporaneamente rimosso
}

/**
 * Versione storica di un template
 */
export interface ReportTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  content: TemplateContent;
  changed_by?: string;
  change_description?: string;
  created_at: string;
}

/**
 * Input per creare/aggiornare un template
 */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  template_type: TemplateType;
  content: TemplateContent;
  required_data_schema?: Record<string, any>;
}

/**
 * Input per aggiornare un template esistente
 */
export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: TemplateContent;
  is_active?: boolean;
  change_description?: string; // Descrizione modifica per versioning
}

/**
 * Opzioni per il rendering
 */
export interface RenderOptions {
  templateId?: string;        // ID template da DB
  templateContent?: TemplateContent; // Oppure contenuto diretto
  data: Record<string, any>;  // Dati da inserire nel template
  format?: TemplateFormat;    // Override formato output
}

/**
 * Risultato della validazione template
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Placeholder disponibile per autocomplete
 */
export interface PlaceholderDefinition {
  path: string;              // es: "cliente.ragione_sociale"
  type: string;              // es: "string", "number", "array"
  description?: string;
  example?: any;
  children?: PlaceholderDefinition[]; // Per oggetti nidificati
}

/**
 * Schema dei dati disponibili per un tipo di template
 */
export interface TemplateDataSchema {
  name: string;
  description?: string;
  placeholders: PlaceholderDefinition[];
  helpers: HelperDefinition[];
}

/**
 * Definizione di un helper Handlebars disponibile
 */
export interface HelperDefinition {
  name: string;
  description: string;
  usage: string;             // es: "{{#if (gt value 100)}}...{{/if}}"
  parameters: string[];
  returnType?: string;
  example?: string;
}

/**
 * Dati intermedi dopo rendering Handlebars (prima di convertire in DOCX)
 */
export interface RenderedData {
  sections: RenderedSection[];
  metadata?: TemplateMetadata;
}

/**
 * Sezione renderizzata
 */
export interface RenderedSection {
  id: string;
  title: string;
  type: SectionType;
  content: string | RenderedTable;
}

/**
 * Tabella renderizzata
 */
export interface RenderedTable {
  headers: string[];
  rows: string[][];
  style?: TableStyle;
}

/**
 * Filtri per listare template
 */
export interface TemplateListFilters {
  template_type?: TemplateType;
  is_active?: boolean;
  search?: string; // Ricerca per nome/descrizione
}
