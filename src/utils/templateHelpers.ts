/**
 * Helper Handlebars custom per template DM329 e altri documenti
 */

import Handlebars from 'handlebars';
import type { HelperDefinition } from '../types/template';

/**
 * Registra tutti gli helper custom su Handlebars
 */
export function registerAllHelpers() {
  // Operatori di confronto
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('ne', (a, b) => a !== b);
  Handlebars.registerHelper('lt', (a, b) => a < b);
  Handlebars.registerHelper('lte', (a, b) => a <= b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('gte', (a, b) => a >= b);

  // Operatori logici
  Handlebars.registerHelper('and', (...args) => {
    // L'ultimo argomento è sempre l'oggetto options di Handlebars
    const values = args.slice(0, -1);
    return values.every(Boolean);
  });

  Handlebars.registerHelper('or', (...args) => {
    const values = args.slice(0, -1);
    return values.some(Boolean);
  });

  Handlebars.registerHelper('not', (value) => !value);

  // Operazioni matematiche
  Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper('subtract', (a, b) => Number(a) - Number(b));
  Handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
  Handlebars.registerHelper('divide', (a, b) => Number(a) / Number(b));
  Handlebars.registerHelper('round', (value, decimals = 2) =>
    Number(value).toFixed(decimals)
  );

  // Formattazione date
  Handlebars.registerHelper('formatDate', (date, format = 'dd/MM/yyyy') => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return format
      .replace('dd', day)
      .replace('MM', month)
      .replace('yyyy', String(year))
      .replace('yy', String(year).slice(-2));
  });

  // String helpers
  Handlebars.registerHelper('uppercase', (str) => String(str || '').toUpperCase());
  Handlebars.registerHelper('lowercase', (str) => String(str || '').toLowerCase());
  Handlebars.registerHelper('capitalize', (str) => {
    const s = String(str || '');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  });

  // Array helpers
  Handlebars.registerHelper('length', (arr) => (Array.isArray(arr) ? arr.length : 0));
  Handlebars.registerHelper('first', (arr) => (Array.isArray(arr) ? arr[0] : null));
  Handlebars.registerHelper('last', (arr) =>
    Array.isArray(arr) ? arr[arr.length - 1] : null
  );
  Handlebars.registerHelper('join', (arr, separator = ', ') =>
    Array.isArray(arr) ? arr.join(separator) : ''
  );

  // Helper specifici DM329

  /**
   * Calcola PS × V per verifica serbatoio DM329
   */
  Handlebars.registerHelper('psXvolume', (ps, volume) => {
    const psNum = Number(ps || 0);
    const volNum = Number(volume || 0);
    return psNum * volNum;
  });

  /**
   * Verifica se serbatoio richiede verifica (PS × V > 8000)
   */
  Handlebars.registerHelper('requiresVerifica', (ps, volume) => {
    const psNum = Number(ps || 0);
    const volNum = Number(volume || 0);
    return (psNum * volNum) > 8000;
  });

  /**
   * Verifica se disoleatore/scambiatore richiede verifica (V ≥ 25 E PS > 12)
   */
  Handlebars.registerHelper('requiresVerificaDM329', (volume, ps) => {
    const volNum = Number(volume || 0);
    const psNum = Number(ps || 0);
    return volNum >= 25 && psNum > 12;
  });

  /**
   * Determina tipo verifica per apparecchiatura
   * @returns 'VERIFICA' | 'DICHIARAZIONE' | 'ESCLUSO'
   */
  Handlebars.registerHelper('tipoVerifica', function(apparecchiatura) {
    if (!apparecchiatura) return 'ESCLUSO';

    const { tipo, volume, ps_pressione_max } = apparecchiatura;
    const vol = Number(volume || 0);
    const ps = Number(ps_pressione_max || 0);

    // Serbatoio
    if (tipo === 'serbatoio') {
      if (vol < 50) return 'ESCLUSO';
      if (ps * vol > 8000) return 'VERIFICA';
      return 'DICHIARAZIONE';
    }

    // Disoleatore, scambiatore, recipiente filtro
    if (['disoleatore', 'scambiatore', 'recipiente_filtro'].includes(tipo)) {
      if (vol < 25) return 'ESCLUSO';
      if (vol >= 25 && ps > 12) return 'VERIFICA';
      return 'DICHIARAZIONE';
    }

    // Compressore (sempre escluso Art. 1.3.L D.L. 93/2000)
    if (tipo === 'compressore') return 'ESCLUSO';

    return 'ESCLUSO';
  });

  /**
   * Array helpers avanzati
   */
  Handlebars.registerHelper('filter', function(array, property, value) {
    if (!Array.isArray(array)) return [];
    return array.filter(item => item[property] === value);
  });

  Handlebars.registerHelper('some', function(array, property, value) {
    if (!Array.isArray(array)) return false;
    return array.some(item => item[property] === value);
  });

  Handlebars.registerHelper('every', function(array, property, value) {
    if (!Array.isArray(array)) return false;
    return array.every(item => item[property] === value);
  });

  Handlebars.registerHelper('none', function(array, property, value) {
    if (!Array.isArray(array)) return true;
    return !array.some(item => item[property] === value);
  });

  /**
   * Helper condizionale per verifiche miste
   * Esempio: {{verificaMista serbatoi "requiresVerifica"}}
   */
  Handlebars.registerHelper('hasMixed', function(array, helperName) {
    if (!Array.isArray(array) || array.length === 0) return false;

    const helper = Handlebars.helpers[helperName];
    if (!helper) return false;

    const results = array.map(item =>
      helper(item.ps_pressione_max, item.volume)
    );

    const hasTrue = results.some(r => r === true);
    const hasFalse = results.some(r => r === false);

    return hasTrue && hasFalse;
  });

  Handlebars.registerHelper('allTrue', function(array, helperName) {
    if (!Array.isArray(array) || array.length === 0) return false;

    const helper = Handlebars.helpers[helperName];
    if (!helper) return false;

    return array.every(item =>
      helper(item.ps_pressione_max, item.volume) === true
    );
  });

  Handlebars.registerHelper('allFalse', function(array, helperName) {
    if (!Array.isArray(array) || array.length === 0) return false;

    const helper = Handlebars.helpers[helperName];
    if (!helper) return false;

    return array.every(item =>
      helper(item.ps_pressione_max, item.volume) === false
    );
  });

  /**
   * Helper per formattazione indirizzi
   */
  Handlebars.registerHelper('formatIndirizzo', function(indirizzo) {
    if (!indirizzo) return '';

    const parts = [];
    if (indirizzo.via) parts.push(indirizzo.via);
    if (indirizzo.civico || indirizzo.numero_civico) parts.push(indirizzo.civico || indirizzo.numero_civico);

    const street = parts.join(', ');

    const location = [];
    if (indirizzo.cap) location.push(indirizzo.cap);
    // Supporta sia 'citta' (vecchio) che 'comune' (nuovo)
    if (indirizzo.comune || indirizzo.citta) location.push(indirizzo.comune || indirizzo.citta);
    if (indirizzo.provincia) location.push(`(${indirizzo.provincia})`);

    const cityLine = location.join(' ');

    return [street, cityLine].filter(Boolean).join('\n');
  });

  /**
   * Helper per default values
   */
  Handlebars.registerHelper('default', (value, defaultValue) => {
    return value != null && value !== '' ? value : defaultValue;
  });

  /**
   * Helper debug per sviluppo
   */
  Handlebars.registerHelper('json', (obj) => {
    return JSON.stringify(obj, null, 2);
  });

  Handlebars.registerHelper('log', (...args) => {
    console.log('[Handlebars Debug]', ...args.slice(0, -1));
    return '';
  });

  /**
   * Helper per interruzione di pagina
   * Restituisce un marcatore speciale che verrà convertito in page break nel DOCX
   */
  Handlebars.registerHelper('pageBreak', () => {
    return '[PAGE_BREAK]';
  });
}

/**
 * Elenco helper disponibili per documentazione/autocomplete
 */
export const AVAILABLE_HELPERS: HelperDefinition[] = [
  {
    name: 'eq',
    description: 'Verifica uguaglianza',
    usage: '{{#if (eq value1 value2)}}...{{/if}}',
    parameters: ['a', 'b'],
    returnType: 'boolean',
    example: '{{#if (eq categoria "I")}}Categoria Prima{{/if}}'
  },
  {
    name: 'gt',
    description: 'Maggiore di (>)',
    usage: '{{#if (gt value 100)}}...{{/if}}',
    parameters: ['a', 'b'],
    returnType: 'boolean',
    example: '{{#if (gt volume 1000)}}Grande{{/if}}'
  },
  {
    name: 'gte',
    description: 'Maggiore o uguale (≥)',
    usage: '{{#if (gte volume 25)}}...{{/if}}',
    parameters: ['a', 'b'],
    returnType: 'boolean'
  },
  {
    name: 'lt',
    description: 'Minore di (<)',
    usage: '{{#if (lt value 50)}}...{{/if}}',
    parameters: ['a', 'b'],
    returnType: 'boolean'
  },
  {
    name: 'and',
    description: 'Operatore logico AND',
    usage: '{{#if (and condition1 condition2)}}...{{/if}}',
    parameters: ['...values'],
    returnType: 'boolean',
    example: '{{#if (and (gte volume 25) (gt ps 12))}}Verifica richiesta{{/if}}'
  },
  {
    name: 'or',
    description: 'Operatore logico OR',
    usage: '{{#if (or condition1 condition2)}}...{{/if}}',
    parameters: ['...values'],
    returnType: 'boolean'
  },
  {
    name: 'psXvolume',
    description: 'Calcola PS × Volume per DM329',
    usage: '{{psXvolume ps volume}}',
    parameters: ['ps', 'volume'],
    returnType: 'number',
    example: 'PS × V = {{psXvolume ps_pressione_max volume}}'
  },
  {
    name: 'requiresVerifica',
    description: 'Verifica se serbatoio richiede verifica (PS × V > 8000)',
    usage: '{{#if (requiresVerifica ps volume)}}...{{/if}}',
    parameters: ['ps', 'volume'],
    returnType: 'boolean',
    example: '{{#if (requiresVerifica ps_pressione_max volume)}}Verifica messa in servizio richiesta{{/if}}'
  },
  {
    name: 'requiresVerificaDM329',
    description: 'Verifica se apparecchiatura richiede verifica (V ≥ 25 E PS > 12)',
    usage: '{{#if (requiresVerificaDM329 volume ps)}}...{{/if}}',
    parameters: ['volume', 'ps'],
    returnType: 'boolean'
  },
  {
    name: 'tipoVerifica',
    description: 'Determina tipo verifica: VERIFICA | DICHIARAZIONE | ESCLUSO',
    usage: '{{tipoVerifica apparecchiatura}}',
    parameters: ['apparecchiatura'],
    returnType: 'string',
    example: '{{tipoVerifica this}}'
  },
  {
    name: 'formatDate',
    description: 'Formatta data',
    usage: '{{formatDate date "dd/MM/yyyy"}}',
    parameters: ['date', 'format'],
    returnType: 'string',
    example: 'Data: {{formatDate data_sopralluogo}}'
  },
  {
    name: 'formatIndirizzo',
    description: 'Formatta indirizzo completo',
    usage: '{{formatIndirizzo indirizzo}}',
    parameters: ['indirizzo'],
    returnType: 'string',
    example: '{{formatIndirizzo sede_impianto}}'
  },
  {
    name: 'uppercase',
    description: 'Converte in maiuscolo',
    usage: '{{uppercase string}}',
    parameters: ['string'],
    returnType: 'string'
  },
  {
    name: 'join',
    description: 'Unisce array con separatore',
    usage: '{{join array ", "}}',
    parameters: ['array', 'separator'],
    returnType: 'string',
    example: '{{join aria_aspirata ", "}}'
  },
  {
    name: 'length',
    description: 'Lunghezza array',
    usage: '{{length array}}',
    parameters: ['array'],
    returnType: 'number',
    example: 'Numero serbatoi: {{length serbatoi}}'
  },
  {
    name: 'default',
    description: 'Valore di default se vuoto',
    usage: '{{default value "N/A"}}',
    parameters: ['value', 'defaultValue'],
    returnType: 'any',
    example: '{{default nota "Nessuna nota"}}'
  },
  {
    name: 'round',
    description: 'Arrotonda numero',
    usage: '{{round value 2}}',
    parameters: ['value', 'decimals'],
    returnType: 'string'
  },
  {
    name: 'filter',
    description: 'Filtra array per proprietà',
    usage: '{{#each (filter array "prop" "value")}}...{{/each}}',
    parameters: ['array', 'property', 'value'],
    returnType: 'array'
  },
  {
    name: 'hasMixed',
    description: 'Verifica se array ha valori misti per un helper',
    usage: '{{#if (hasMixed serbatoi "requiresVerifica")}}...{{/if}}',
    parameters: ['array', 'helperName'],
    returnType: 'boolean'
  },
  {
    name: 'allTrue',
    description: 'Verifica se tutti gli elementi soddisfano un helper',
    usage: '{{#if (allTrue serbatoi "requiresVerifica")}}...{{/if}}',
    parameters: ['array', 'helperName'],
    returnType: 'boolean'
  },
  {
    name: 'pageBreak',
    description: 'Inserisce un\'interruzione di pagina nel documento DOCX',
    usage: '{{pageBreak}}',
    parameters: [],
    returnType: 'string',
    example: 'Testo prima {{pageBreak}} Testo dopo (su nuova pagina)'
  }
];
