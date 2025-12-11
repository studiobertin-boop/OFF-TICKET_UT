/**
 * Sezioni predefinite disponibili nel wizard per template DM329
 */

import type { PredefinedSection } from '../types/wizard';

export const PREDEFINED_SECTIONS: PredefinedSection[] = [
  // === INTESTAZIONE ===
  {
    id: 'intestazione_cliente',
    name: 'Intestazione Cliente',
    description: 'Nome e indirizzo completo del cliente',
    type: 'dynamic_text',
    category: 'intestazione',
    defaultConfig: {
      template_visual: 'Cliente {cliente.ragione_sociale}\n{cliente.sede_legale.via}, {cliente.sede_legale.civico}\n{cliente.sede_legale.cap} {cliente.sede_legale.citta} ({cliente.sede_legale.provincia})',
      field_mappings: [
        { placeholder: '{cliente.ragione_sociale}', path: 'cliente.ragione_sociale' },
        { placeholder: '{cliente.sede_legale.via}', path: 'cliente.sede_legale.via' },
        { placeholder: '{cliente.sede_legale.civico}', path: 'cliente.sede_legale.civico' },
        { placeholder: '{cliente.sede_legale.cap}', path: 'cliente.sede_legale.cap' },
        { placeholder: '{cliente.sede_legale.citta}', path: 'cliente.sede_legale.citta' },
        { placeholder: '{cliente.sede_legale.provincia}', path: 'cliente.sede_legale.provincia' }
      ],
      auto_variants: false
    },
    requiredData: ['cliente']
  },

  {
    id: 'intestazione_sito',
    name: 'Intestazione Sito Impianto',
    description: 'Indirizzo del sito dove è installato l\'impianto',
    type: 'dynamic_text',
    category: 'intestazione',
    defaultConfig: {
      template_visual: 'Sito produttivo in\n{sito_impianto.via}, {sito_impianto.civico}\n{sito_impianto.cap} {sito_impianto.citta} ({sito_impianto.provincia})',
      field_mappings: [
        { placeholder: '{sito_impianto.via}', path: 'sito_impianto.via' },
        { placeholder: '{sito_impianto.civico}', path: 'sito_impianto.civico' },
        { placeholder: '{sito_impianto.cap}', path: 'sito_impianto.cap' },
        { placeholder: '{sito_impianto.citta}', path: 'sito_impianto.citta' },
        { placeholder: '{sito_impianto.provincia}', path: 'sito_impianto.provincia' }
      ],
      auto_variants: false
    },
    requiredData: ['sito_impianto']
  },

  // === DESCRIZIONE ===
  {
    id: 'premessa',
    name: 'Premessa',
    description: 'Testo introduttivo standard per relazioni DM329',
    type: 'dynamic_text',
    category: 'descrizione',
    defaultConfig: {
      template_visual: 'La presente relazione tecnica si riferisce all\'impianto a pressione installato presso il sito produttivo di {cliente.ragione_sociale}. Essa, coerentemente alla vigente normativa di settore (PED 68/2014/UE, 29/2014/UE e D.M. 329/2004) è finalizzata a verificare la conformità dell\'impianto alle norme di sicurezza.',
      field_mappings: [
        { placeholder: '{cliente.ragione_sociale}', path: 'cliente.ragione_sociale' }
      ],
      auto_variants: false
    },
    requiredData: ['cliente']
  },

  {
    id: 'descrizione_generale',
    name: 'Descrizione Generale Impianto',
    description: 'Descrizione composizione impianto con varianti singolare/plurale automatiche',
    type: 'dynamic_text',
    category: 'descrizione',
    defaultConfig: {
      template_visual: 'L\'impianto è costituito dalle seguenti sezioni:\n- Sezione di pompaggio: {compressori.length} compressor{i/e}\n- Sezione di accumulo: {serbatoi.length} serbatoio/i\n- Sezione di trattamento: {essiccatori.length} essiccator{e/i}',
      field_mappings: [
        { placeholder: '{compressori.length}', path: 'compressori.length' },
        { placeholder: '{serbatoi.length}', path: 'serbatoi.length' },
        { placeholder: '{essiccatori.length}', path: 'essiccatori.length' }
      ],
      auto_variants: true
    },
    requiredData: ['compressori', 'serbatoi', 'essiccatori']
  },

  // === TABELLE ===
  {
    id: 'tabella_riepilogo',
    name: 'Tabella Riepilogo Apparecchiature',
    description: 'Tabella completa di tutte le apparecchiature (formato INAIL)',
    type: 'table',
    category: 'tabelle',
    defaultConfig: {
      data_source: 'apparecchiature',
      columns: [
        { field: 'codice', label: 'Pos.', visible: true, width: 10 },
        { field: 'tipo', label: 'Descrizione', visible: true },
        { field: 'marca_modello', label: 'Costruttore e Modello', visible: true, template: '{marca} {modello}' },
        { field: 'capacita', label: 'Capacità [l]', visible: true },
        { field: 'pressione', label: 'Pressione [bar]', visible: true },
        { field: 'categoria', label: 'Categoria', visible: true },
        { field: 'anno', label: 'Anno', visible: true },
        { field: 'numero_fabbrica', label: 'Num. fabbrica', visible: true }
      ],
      style: 'standard_inail',
      show_header: true,
      show_borders: true
    },
    requiredData: ['apparecchiature']
  },

  {
    id: 'tabella_compressori',
    name: 'Tabella Compressori',
    description: 'Tabella specifica solo compressori',
    type: 'table',
    category: 'tabelle',
    defaultConfig: {
      data_source: 'compressori',
      columns: [
        { field: 'codice', label: 'Pos.', visible: true },
        { field: 'marca', label: 'Marca', visible: true },
        { field: 'modello', label: 'Modello', visible: true },
        { field: 'volume_aria_prodotto', label: 'Produzione [l/min]', visible: true },
        { field: 'pressione_max', label: 'Pressione max [bar]', visible: true },
        { field: 'anno', label: 'Anno', visible: true }
      ],
      style: 'standard_inail',
      show_header: true,
      show_borders: true
    },
    requiredData: ['compressori']
  },

  {
    id: 'tabella_serbatoi',
    name: 'Tabella Serbatoi',
    description: 'Tabella specifica solo serbatoi con calcolo PS×V',
    type: 'table',
    category: 'tabelle',
    defaultConfig: {
      data_source: 'serbatoi',
      columns: [
        { field: 'codice', label: 'Pos.', visible: true },
        { field: 'marca_modello', label: 'Costruttore', visible: true, template: '{marca} {modello}' },
        { field: 'volume', label: 'Volume [l]', visible: true },
        { field: 'ps_pressione_max', label: 'PS [bar]', visible: true },
        { field: 'ps_x_volume', label: 'PS×V [bar·l]', visible: true },
        { field: 'categoria_ped', label: 'Cat. PED', visible: true }
      ],
      style: 'standard_inail',
      show_header: true,
      show_borders: true
    },
    requiredData: ['serbatoi']
  },

  {
    id: 'tabella_valvole',
    name: 'Tabella Valvole Sicurezza',
    description: 'Tabella valvole con calcolo portata',
    type: 'table',
    category: 'tabelle',
    defaultConfig: {
      data_source: 'valvole_sicurezza',
      columns: [
        { field: 'codice', label: 'Pos. valvola', visible: true },
        { field: 'numero_fabbrica', label: 'n.f. valvola', visible: true },
        { field: 'apparecchiature_connesse', label: 'App. connesse', visible: true },
        { field: 'portata_massima', label: 'Portata max [l/min]', visible: true },
        { field: 'portata_taratura', label: 'Portata scaricata [l/min]', visible: true },
        { field: 'adeguato', label: 'Adeguato', visible: true }
      ],
      style: 'standard_inail',
      show_header: true,
      show_borders: true
    },
    requiredData: ['valvole_sicurezza']
  },

  // === CALCOLI ===
  {
    id: 'calcolo_verifica_inail',
    name: 'Calcolo Verifica INAIL',
    description: 'Calcolo PS×V per determinare obbligo verifica periodica',
    type: 'calculation',
    category: 'calcoli',
    defaultConfig: {
      calculation_type: 'ps_x_volume',
      apply_to: 'serbatoi',
      show_verification_text: true,
      output_template: 'PS×V = {result} bar·litri. {verification_text}'
    },
    requiredData: ['serbatoi']
  },

  {
    id: 'tipo_verifica_dm329',
    name: 'Tipo Verifica DM329',
    description: 'Determinazione tipo verifica (quinquennale/decennale) in base a PS×V',
    type: 'calculation',
    category: 'calcoli',
    defaultConfig: {
      calculation_type: 'tipo_verifica',
      apply_to: 'serbatoi',
      show_verification_text: true
    },
    requiredData: ['serbatoi']
  },

  // === CONDIZIONALI ===
  {
    id: 'verifica_spessimetrica',
    name: 'Verifica Spessimetrica',
    description: 'Testo condizionale per apparecchiature sottoposte a spessimetrica',
    type: 'conditional',
    category: 'conclusioni',
    defaultConfig: {
      show_condition: {
        field: 'spessimetrica.length',
        operator: 'gt',
        value: 0
      },
      variants: [
        {
          condition: { field: 'spessimetrica.length', operator: 'eq', value: 1 },
          text: 'È stata eseguita verifica spessimetrica sull\'apparecchiatura {spessimetrica[0]} con esito conforme.'
        },
        {
          condition: { field: 'spessimetrica.length', operator: 'gt', value: 1 },
          text: 'Sono state eseguite verifiche spessimetriche su {spessimetrica.length} apparecchiature con esito conforme.'
        }
      ]
    },
    requiredData: ['spessimetrica']
  },

  {
    id: 'locale_dedicato',
    name: 'Locale Dedicato',
    description: 'Testo condizionale per presenza locale dedicato',
    type: 'conditional',
    category: 'descrizione',
    defaultConfig: {
      show_condition: {
        field: 'dati_impianto.locale_dedicato',
        operator: 'eq',
        value: true
      },
      variants: [
        {
          condition: null,
          text: 'L\'impianto è installato in locale dedicato conforme alla normativa vigente, con accesso limitato al personale autorizzato.'
        }
      ]
    },
    requiredData: ['dati_impianto']
  },

  // === CONCLUSIONI ===
  {
    id: 'conclusioni',
    name: 'Conclusioni',
    description: 'Testo conclusivo standard',
    type: 'dynamic_text',
    category: 'conclusioni',
    defaultConfig: {
      template_visual: 'In conclusione, l\'impianto risulta conforme alla normativa vigente in materia di attrezzature a pressione. Le verifiche eseguite confermano il corretto funzionamento e l\'adeguatezza delle misure di sicurezza adottate.',
      field_mappings: [],
      auto_variants: false
    },
    requiredData: []
  }
];

/**
 * Ottieni sezioni predefinite per tipo template
 */
export function getPredefinedSectionsByType(templateType: 'dm329_technical' | 'inail' | 'custom'): PredefinedSection[] {
  if (templateType === 'custom') {
    return PREDEFINED_SECTIONS; // Tutte disponibili
  }

  if (templateType === 'dm329_technical') {
    // Filtro sezioni specifiche per DM329
    return PREDEFINED_SECTIONS.filter(s =>
      ['intestazione_cliente', 'intestazione_sito', 'premessa',
        'descrizione_generale', 'tabella_riepilogo', 'tabella_serbatoi',
        'tabella_valvole', 'calcolo_verifica_inail', 'tipo_verifica_dm329',
        'verifica_spessimetrica', 'locale_dedicato', 'conclusioni'].includes(s.id)
    );
  }

  if (templateType === 'inail') {
    // Filtro sezioni specifiche per INAIL
    return PREDEFINED_SECTIONS.filter(s =>
      ['intestazione_cliente', 'intestazione_sito', 'tabella_riepilogo',
        'calcolo_verifica_inail', 'verifica_spessimetrica'].includes(s.id)
    );
  }

  return PREDEFINED_SECTIONS;
}
