/**
 * Schema dati disponibili per template DM329 e altri documenti
 * Usato per autocomplete e validazione
 */

import type { TemplateDataSchema, PlaceholderDefinition } from '../types/template';
import { AVAILABLE_HELPERS } from './templateHelpers';

/**
 * Placeholder disponibili per template DM329 Relazione Tecnica
 */
export const DM329_PLACEHOLDERS: PlaceholderDefinition[] = [
  // Cliente
  {
    path: 'cliente',
    type: 'object',
    description: 'Dati del cliente',
    children: [
      {
        path: 'cliente.ragione_sociale',
        type: 'string',
        description: 'Ragione sociale azienda',
        example: 'ACME S.p.A.'
      },
      {
        path: 'cliente.sede_legale',
        type: 'object',
        description: 'Indirizzo sede legale',
        children: [
          { path: 'cliente.sede_legale.via', type: 'string', example: 'Via Roma' },
          { path: 'cliente.sede_legale.civico', type: 'string', example: '10' },
          { path: 'cliente.sede_legale.cap', type: 'string', example: '20100' },
          { path: 'cliente.sede_legale.citta', type: 'string', example: 'Milano' },
          { path: 'cliente.sede_legale.provincia', type: 'string', example: 'MI' }
        ]
      }
    ]
  },

  // Sito impianto
  {
    path: 'sito_impianto',
    type: 'object',
    description: 'Indirizzo impianto',
    children: [
      { path: 'sito_impianto.via', type: 'string', example: 'Via delle Industrie' },
      { path: 'sito_impianto.civico', type: 'string', example: '25' },
      { path: 'sito_impianto.cap', type: 'string', example: '20020' },
      { path: 'sito_impianto.citta', type: 'string', example: 'Arese' },
      { path: 'sito_impianto.provincia', type: 'string', example: 'MI' }
    ]
  },

  // Dati generali
  {
    path: 'data_sopralluogo',
    type: 'string (date)',
    description: 'Data sopralluogo tecnico',
    example: '2024-12-01'
  },
  {
    path: 'nome_tecnico',
    type: 'string',
    description: 'Nome tecnico che ha eseguito il sopralluogo',
    example: 'Ing. Mario Rossi'
  },
  {
    path: 'descrizione_attivita',
    type: 'string',
    description: 'Descrizione attività aziendale (ATECO)',
    example: 'Fabbricazione di prodotti in plastica'
  },

  // Dati impianto
  {
    path: 'dati_impianto',
    type: 'object',
    description: 'Caratteristiche impianto aria compressa',
    children: [
      {
        path: 'dati_impianto.locale_dedicato',
        type: 'boolean',
        description: 'Locale dedicato ai compressori'
      },
      {
        path: 'dati_impianto.accesso_locale_vietato',
        type: 'boolean',
        description: 'Accesso vietato ai non addetti'
      },
      {
        path: 'dati_impianto.aria_aspirata',
        type: 'array',
        description: 'Origine aria aspirata',
        example: ['Esterno', 'Interno']
      },
      {
        path: 'dati_impianto.raccolta_condense',
        type: 'array',
        description: 'Sistema raccolta condense',
        example: ['Disoleatori', 'Separatori']
      },
      {
        path: 'dati_impianto.lontano_materiale_infiammabile',
        type: 'boolean'
      }
    ]
  },

  // Serbatoi
  {
    path: 'serbatoi',
    type: 'array',
    description: 'Elenco serbatoi aria compressa',
    children: [
      { path: 'serbatoi[].codice', type: 'string', example: 'S1' },
      { path: 'serbatoi[].marca', type: 'string', example: 'Atlas Copco' },
      { path: 'serbatoi[].modello', type: 'string', example: 'LV 500' },
      { path: 'serbatoi[].volume', type: 'number', description: 'Volume litri', example: 500 },
      { path: 'serbatoi[].ps_pressione_max', type: 'number', description: 'PS bar', example: 13 },
      { path: 'serbatoi[].ps_x_volume', type: 'number (calculated)', description: 'PS × V', example: 6500 },
      { path: 'serbatoi[].ts_temperatura', type: 'number', description: 'TS °C', example: 80 },
      { path: 'serbatoi[].categoria_ped', type: 'string', example: 'II' },
      { path: 'serbatoi[].anno', type: 'number', example: 2015 },
      { path: 'serbatoi[].numero_fabbrica', type: 'string', example: '12345/2015' },
      { path: 'serbatoi[].scarico', type: 'string', example: 'AUTOMATICO' },
      { path: 'serbatoi[].finitura_interna', type: 'string', example: 'ZINCATO' },
      { path: 'serbatoi[].ancorato_terra', type: 'boolean' }
    ]
  },

  // Compressori
  {
    path: 'compressori',
    type: 'array',
    description: 'Elenco compressori',
    children: [
      { path: 'compressori[].codice', type: 'string', example: 'C1' },
      { path: 'compressori[].marca', type: 'string', example: 'Kaeser' },
      { path: 'compressori[].modello', type: 'string', example: 'ASD 37' },
      { path: 'compressori[].volume_aria_prodotto', type: 'number', description: 'FAD l/min', example: 3700 },
      { path: 'compressori[].pressione_max', type: 'number', description: 'bar', example: 13 },
      { path: 'compressori[].anno', type: 'number', example: 2018 },
      { path: 'compressori[].numero_fabbrica', type: 'string', example: 'A12345' },
      { path: 'compressori[].tipo_giri', type: 'string', description: 'fissi | variabili', example: 'variabili (inverter)' }
    ]
  },

  // Disoleatori
  {
    path: 'disoleatori',
    type: 'array',
    description: 'Disoleatori associati ai compressori',
    children: [
      { path: 'disoleatori[].codice', type: 'string', example: 'C1.1' },
      { path: 'disoleatori[].compressore_associato', type: 'string', example: 'C1' },
      { path: 'disoleatori[].marca', type: 'string', example: 'Kaeser' },
      { path: 'disoleatori[].modello', type: 'string', example: 'OSD 35' },
      { path: 'disoleatori[].volume', type: 'number', example: 35 },
      { path: 'disoleatori[].ps_pressione_max', type: 'number', example: 16 },
      { path: 'disoleatori[].categoria_ped', type: 'string', example: 'I' }
    ]
  },

  // Essiccatori
  {
    path: 'essiccatori',
    type: 'array',
    description: 'Essiccatori aria',
    children: [
      { path: 'essiccatori[].codice', type: 'string', example: 'E1' },
      { path: 'essiccatori[].marca', type: 'string', example: 'Pneumatech' },
      { path: 'essiccatori[].modello', type: 'string', example: 'PD 100' },
      { path: 'essiccatori[].volume_aria_trattata', type: 'number', description: 'Q l/min', example: 1000 },
      { path: 'essiccatori[].ps_pressione_max', type: 'number', example: 16 },
      { path: 'essiccatori[].anno', type: 'number', example: 2019 }
    ]
  },

  // Scambiatori
  {
    path: 'scambiatori',
    type: 'array',
    description: 'Scambiatori termici associati ad essiccatori',
    children: [
      { path: 'scambiatori[].codice', type: 'string', example: 'E1.1' },
      { path: 'scambiatori[].essiccatore_associato', type: 'string', example: 'E1' },
      { path: 'scambiatori[].volume', type: 'number', example: 30 },
      { path: 'scambiatori[].ps_pressione_max', type: 'number', example: 16 }
    ]
  },

  // Filtri
  {
    path: 'filtri',
    type: 'array',
    description: 'Filtri aria',
    children: [
      { path: 'filtri[].codice', type: 'string', example: 'F1' },
      { path: 'filtri[].marca', type: 'string', example: 'Parker' },
      { path: 'filtri[].modello', type: 'string', example: 'HF 20' },
      { path: 'filtri[].anno', type: 'number', example: 2020 }
    ]
  },

  // Recipienti filtro
  {
    path: 'recipienti_filtro',
    type: 'array',
    description: 'Recipienti associati ai filtri',
    children: [
      { path: 'recipienti_filtro[].codice', type: 'string', example: 'F1.1' },
      { path: 'recipienti_filtro[].filtro_associato', type: 'string', example: 'F1' },
      { path: 'recipienti_filtro[].volume', type: 'number', example: 20 },
      { path: 'recipienti_filtro[].ps_pressione_max', type: 'number', example: 16 }
    ]
  },

  // Separatori
  {
    path: 'separatori',
    type: 'array',
    description: 'Separatori condense',
    children: [
      { path: 'separatori[].codice', type: 'string', example: 'SEP1' },
      { path: 'separatori[].marca', type: 'string', example: 'Bekomat' },
      { path: 'separatori[].modello', type: 'string', example: '12' },
      { path: 'separatori[].anno', type: 'number', example: 2020 }
    ]
  },

  // Valvole di sicurezza
  {
    path: 'valvole_sicurezza',
    type: 'array',
    description: 'Valvole di sicurezza',
    children: [
      { path: 'valvole_sicurezza[].codice', type: 'string', example: 'S1' },
      { path: 'valvole_sicurezza[].numero_fabbrica', type: 'string', example: 'VS-123' },
      { path: 'valvole_sicurezza[].pressione_taratura', type: 'number', description: 'Ptar bar', example: 13 },
      { path: 'valvole_sicurezza[].volume_aria_scaricato', type: 'number', description: 'Qmax l/min', example: 5000 },
      { path: 'valvole_sicurezza[].portata_max_elaborabile', type: 'number', description: 'kg/h', example: 300 },
      { path: 'valvole_sicurezza[].portata_scaricata', type: 'number', description: 'kg/h', example: 250 },
      { path: 'valvole_sicurezza[].apparecchiatura_protetta', type: 'string', example: 'Serbatoio S1' },
      { path: 'valvole_sicurezza[].ps_recipiente', type: 'number', example: 13 }
    ]
  },

  // Collegamenti
  {
    path: 'collegamenti_compressori_serbatoi',
    type: 'object',
    description: 'Mappatura compressori → serbatoi collegati',
    example: { 'C1': ['S1', 'S2'], 'C2': ['S3'] }
  },

  // Spessimetrica
  {
    path: 'spessimetrica',
    type: 'array',
    description: 'Codici apparecchiature sottoposte a verifica ultrasonica',
    example: ['S1', 'C1.1']
  },

  // Flags
  {
    path: 'flags',
    type: 'object',
    description: 'Flags condizionali per sezioni documento',
    children: [
      { path: 'flags.locale_dedicato', type: 'boolean' },
      { path: 'flags.accesso_vietato', type: 'boolean' },
      { path: 'flags.verifiche_spessimetriche', type: 'boolean' },
      { path: 'flags.revisione_dichiarata', type: 'boolean' }
    ]
  },

  // Apparecchiature aggregate
  {
    path: 'apparecchiature',
    type: 'array',
    description: 'Lista completa di tutte le apparecchiature aggregate',
    children: [
      { path: 'apparecchiature[].codice', type: 'string' },
      { path: 'apparecchiature[].tipo', type: 'string', example: 'serbatoio | compressore | disoleatore' },
      { path: 'apparecchiature[].descrizione', type: 'string' },
      { path: 'apparecchiature[].marca_modello', type: 'string' },
      { path: 'apparecchiature[].capacita', type: 'string' },
      { path: 'apparecchiature[].pressione', type: 'string' },
      { path: 'apparecchiature[].temperatura', type: 'string' },
      { path: 'apparecchiature[].categoria', type: 'string' },
      { path: 'apparecchiature[].anno', type: 'string' },
      { path: 'apparecchiature[].numero_fabbrica', type: 'string' },
      { path: 'apparecchiature[].richiede_verifica', type: 'boolean' }
    ]
  }
];

/**
 * Schema completo per template DM329
 */
export const DM329_DATA_SCHEMA: TemplateDataSchema = {
  name: 'DM329 Relazione Tecnica',
  description: 'Schema dati per generazione relazione tecnica DM329/2004',
  placeholders: DM329_PLACEHOLDERS,
  helpers: AVAILABLE_HELPERS
};

/**
 * Ottiene placeholder flat list per autocomplete
 */
export function getFlatPlaceholders(schema: PlaceholderDefinition[]): string[] {
  const result: string[] = [];

  function traverse(items: PlaceholderDefinition[]) {
    for (const item of items) {
      result.push(item.path);
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(schema);
  return result;
}

/**
 * Cerca placeholder per path
 */
export function findPlaceholder(
  path: string,
  schema: PlaceholderDefinition[]
): PlaceholderDefinition | null {
  for (const item of schema) {
    if (item.path === path) return item;
    if (item.children) {
      const found = findPlaceholder(path, item.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Valida che tutti i placeholder usati in un template esistano
 */
export function validatePlaceholders(
  templateContent: string,
  schema: PlaceholderDefinition[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Regex per trovare placeholder {{path}} o {{#helper path}}
  const placeholderRegex = /\{\{[#\/]?\s*([a-zA-Z_][\w.[\]]*)/g;

  const flatPaths = getFlatPlaceholders(schema);
  const helperNames = AVAILABLE_HELPERS.map(h => h.name);

  let match;
  while ((match = placeholderRegex.exec(templateContent)) !== null) {
    const path = match[1];

    // Ignora helper conosciuti
    if (helperNames.includes(path)) continue;

    // Ignora keywords Handlebars
    if (['if', 'each', 'unless', 'with', 'else', 'this'].includes(path)) continue;

    // Rimuovi indici array [0] per matching
    const normalizedPath = path.replace(/\[\d+\]/g, '[]');

    if (!flatPaths.includes(normalizedPath) && !flatPaths.some(p => p.startsWith(normalizedPath + '.'))) {
      errors.push(`Placeholder non trovato: {{${path}}}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Costruisce un albero gerarchico da placeholder flat per TreeView
 */
export interface PlaceholderTreeNode {
  id: string;
  label: string;
  path: string;
  type: string;
  description?: string;
  example?: any;
  children?: PlaceholderTreeNode[];
  isArray?: boolean;
}

export function buildPlaceholderTree(
  schema: PlaceholderDefinition[]
): PlaceholderTreeNode[] {
  const buildNode = (item: PlaceholderDefinition): PlaceholderTreeNode => {
    const node: PlaceholderTreeNode = {
      id: item.path,
      label: item.path.split('.').pop() || item.path,
      path: item.path,
      type: item.type,
      description: item.description,
      example: item.example,
      isArray: item.type.includes('array')
    };

    if (item.children && item.children.length > 0) {
      node.children = item.children.map(buildNode);
    }

    return node;
  };

  return schema.map(buildNode);
}

/**
 * Cerca un placeholder per path nell'albero
 */
export function searchPlaceholderByPath(
  path: string,
  schema: PlaceholderDefinition[]
): PlaceholderDefinition | null {
  for (const item of schema) {
    if (item.path === path) return item;
    if (item.children) {
      const found = searchPlaceholderByPath(path, item.children);
      if (found) return found;
    }
  }
  return null;
}
