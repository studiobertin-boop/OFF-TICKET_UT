/**
 * Code Generators - Generazione codice Handlebars per wizard
 *
 * Funzioni per generare sintassi corretta per:
 * - Loop {{#each}}
 * - Condizioni {{#if}}
 * - Tabelle HTML con loop
 */

import type { PlaceholderDefinition } from '../types/template';

export interface LoopCodeOptions {
  arrayPath: string;
  outputType: 'text' | 'table' | 'list';
  selectedFields: string[];
  customTemplate?: string;
}

export interface ConditionalCodeOptions {
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: string | number;
  trueContent: string;
  falseContent?: string;
}

/**
 * Genera codice per loop {{#each}}
 */
export function generateLoopCode(options: LoopCodeOptions): string {
  const { arrayPath, outputType, selectedFields, customTemplate } = options;

  if (outputType === 'text' && customTemplate) {
    // Testo custom
    return `{{#each ${arrayPath}}}
${customTemplate}
{{/each}}`;
  }

  if (outputType === 'list') {
    // Lista semplice
    const fieldsText = selectedFields.map(f => `{{this.${f}}}`).join(' - ');
    return `{{#each ${arrayPath}}}
- ${fieldsText}
{{/each}}`;
  }

  if (outputType === 'table') {
    // Tabella HTML
    return generateTableCode(arrayPath, selectedFields);
  }

  // Default: paragrafo per elemento
  const fieldsText = selectedFields.map(f => `{{this.${f}}}`).join(' ');
  return `{{#each ${arrayPath}}}
${fieldsText}
{{/each}}`;
}

/**
 * Genera codice per tabella HTML con loop
 */
export function generateTableCode(arrayPath: string, fields: string[]): string {
  // Header
  const headers = fields.map(f => {
    const label = f.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `    <th>${label}</th>`;
  }).join('\n');

  // Cells
  const cells = fields.map(f => `      <td>{{this.${f}}}</td>`).join('\n');

  return `<table>
  <thead>
    <tr>
${headers}
    </tr>
  </thead>
  <tbody>
    {{#each ${arrayPath}}}
    <tr>
${cells}
    </tr>
    {{/each}}
  </tbody>
</table>`;
}

/**
 * Genera codice per condizione {{#if}}
 */
export function generateConditionalCode(options: ConditionalCodeOptions): string {
  const { field, operator, value, trueContent, falseContent } = options;

  // Formatta valore (string con quote, number senza)
  const formattedValue = typeof value === 'string' ? `'${value}'` : value;

  // Genera condizione helper
  const condition = `${operator} ${field} ${formattedValue}`;

  if (falseContent) {
    // Con else
    return `{{#if (${condition})}}
${trueContent}
{{else}}
${falseContent}
{{/if}}`;
  } else {
    // Solo if
    return `{{#if (${condition})}}
${trueContent}
{{/if}}`;
  }
}

/**
 * Genera condizione "se array ha elementi"
 */
export function generateArrayExistsCondition(arrayPath: string, content: string, elseContent?: string): string {
  return generateConditionalCode({
    field: `${arrayPath}.length`,
    operator: 'gt',
    value: 0,
    trueContent: content,
    falseContent: elseContent
  });
}

/**
 * Estrae campi disponibili da un placeholder array
 */
export function getArrayFields(placeholder: PlaceholderDefinition): string[] {
  if (!placeholder.children || placeholder.children.length === 0) {
    return [];
  }

  return placeholder.children.map(child => {
    // Rimuovi il prefixo array (es. "serbatoi[].codice" -> "codice")
    const parts = child.path.split('[].');
    return parts.length > 1 ? parts[1] : child.path.split('.').pop() || child.path;
  });
}

/**
 * Valida sintassi Handlebars generata
 */
export function validateHandlebars(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check parentesi bilanciate
  const openBraces = (code.match(/\{\{/g) || []).length;
  const closeBraces = (code.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Parentesi graffe non bilanciate: ${openBraces} aperture, ${closeBraces} chiusure`);
  }

  // Check each/if apertura/chiusura
  const eachOpens = (code.match(/\{\{#each/g) || []).length;
  const eachCloses = (code.match(/\{\{\/each\}\}/g) || []).length;
  if (eachOpens !== eachCloses) {
    errors.push(`{{#each}} non chiusi correttamente: ${eachOpens} aperture, ${eachCloses} chiusure`);
  }

  const ifOpens = (code.match(/\{\{#if/g) || []).length;
  const ifCloses = (code.match(/\{\{\/if\}\}/g) || []).length;
  if (ifOpens !== ifCloses) {
    errors.push(`{{#if}} non chiusi correttamente: ${ifOpens} aperture, ${ifCloses} chiusure`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Operatori disponibili con label user-friendly
 */
export const OPERATORS = [
  { value: 'eq', label: 'uguale a (=)', example: 'eq field value' },
  { value: 'ne', label: 'diverso da (≠)', example: 'ne field value' },
  { value: 'gt', label: 'maggiore di (>)', example: 'gt field value' },
  { value: 'gte', label: 'maggiore o uguale (≥)', example: 'gte field value' },
  { value: 'lt', label: 'minore di (<)', example: 'lt field value' },
  { value: 'lte', label: 'minore o uguale (≤)', example: 'lte field value' }
] as const;
