/**
 * Tipi TypeScript per Template Wizard
 * Sistema guidato per creazione template senza codice
 */

/**
 * Tipo di sezione nel wizard
 */
export type WizardSectionType =
  | 'dynamic_text'
  | 'table'
  | 'calculation'
  | 'conditional'
  | 'custom_code';

/**
 * Operatori per condizioni
 */
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

/**
 * Stili tabella predefiniti
 */
export type TableStyle = 'standard_inail' | 'compact' | 'detailed';

/**
 * Tipi di calcolo DM329
 */
export type CalculationType = 'ps_x_volume' | 'categoria_ped' | 'tipo_verifica';

/**
 * Fonte dati per tabelle e calcoli
 */
export type DataSource =
  | 'compressori'
  | 'serbatoi'
  | 'valvole_sicurezza'
  | 'disoleatori'
  | 'essiccatori'
  | 'scambiatori'
  | 'recipienti_filtro'
  | 'apparecchiature';

/**
 * Mapping placeholder visuale → campo dati
 */
export interface FieldMapping {
  placeholder: string; // es: "{cliente.ragione_sociale}"
  path: string;        // es: "cliente.ragione_sociale"
}

/**
 * Condizione per blocchi condizionali
 */
export interface BlockCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number;
}

/**
 * Variante di testo condizionale
 */
export interface TextVariant {
  condition: BlockCondition | null; // null = default
  text: string;
}

/**
 * Configurazione colonna tabella
 */
export interface TableColumn {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  template?: string; // es: "{marca} {modello}"
}

/**
 * Formattazione condizionale cella
 */
export interface ConditionalFormatting {
  column: string;
  condition: BlockCondition;
  format: {
    color?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

/**
 * Config sezione: Testo Dinamico
 */
export interface DynamicTextConfig {
  title?: string;
  template_visual: string; // es: "Cliente {cliente.ragione_sociale}..."
  field_mappings: FieldMapping[];
  auto_variants: boolean; // Gestione automatica singolare/plurale
  variants?: TextVariant[];
  show_condition?: BlockCondition; // Condizione visibilità sezione
}

/**
 * Config sezione: Tabella
 */
export interface TableConfig {
  data_source: DataSource;
  columns: TableColumn[];
  style: TableStyle;
  show_header: boolean;
  show_borders: boolean;
  zebra_striping?: boolean;
  conditional_formatting?: ConditionalFormatting[];
}

/**
 * Config sezione: Calcolo DM329
 */
export interface CalculationConfig {
  calculation_type: CalculationType;
  apply_to: DataSource;
  apply_to_item?: string; // Codice specifico (es: "S1")
  show_verification_text: boolean;
  output_template?: string; // es: "PS×V = {result} bar·litri"
}

/**
 * Config sezione: Condizionale
 */
export interface ConditionalConfig {
  show_condition?: BlockCondition;
  variants: TextVariant[];
}

/**
 * Config sezione: Codice Custom (fallback per casi complessi)
 */
export interface CustomCodeConfig {
  handlebars_code: string;
  description?: string;
}

/**
 * Union type per config sezioni
 */
export type SectionConfig =
  | DynamicTextConfig
  | TableConfig
  | CalculationConfig
  | ConditionalConfig
  | CustomCodeConfig;

/**
 * Sezione del wizard
 */
export interface WizardSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  type: WizardSectionType;
  config: SectionConfig;
}

/**
 * Configurazione completa wizard
 */
export interface WizardConfig {
  steps: {
    sections: WizardSection[];
  };
  metadata: {
    created_with_wizard: boolean;
    wizard_version: string;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    estimated_time_minutes: number;
  };
}

/**
 * Stato wizard durante editing
 */
export interface WizardState {
  // Step 1: Base Config
  name: string;
  description: string;
  template_type: 'dm329_technical' | 'inail' | 'custom';

  // Step 2: Section Selection
  selectedSections: string[]; // IDs sezioni predefinite selezionate

  // Step 3: Section Configuration
  sections: WizardSection[];

  // UI State
  currentStep: number;
  isDirty: boolean;
  validationErrors: Record<string, string>;
}

/**
 * Sezione predefinita disponibile nel wizard
 */
export interface PredefinedSection {
  id: string;
  name: string;
  description: string;
  type: WizardSectionType;
  category: 'intestazione' | 'descrizione' | 'tabelle' | 'calcoli' | 'conclusioni';
  defaultConfig: SectionConfig;
  requiredData: string[]; // Campi dati richiesti per questa sezione
}

/**
 * Risultato validazione wizard
 */
export interface WizardValidationResult {
  valid: boolean;
  errors: Array<{
    section_id?: string;
    field?: string;
    message: string;
  }>;
}

/**
 * Opzioni salvataggio template wizard
 */
export interface SaveWizardTemplateOptions {
  saveAsDraft?: boolean;
  activate?: boolean;
  createNewVersion?: boolean;
  change_description?: string;
}
