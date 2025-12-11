/**
 * Utility per valutare condizioni di blocchi condizionali
 */

import type { BlockCondition, ConditionOperator } from '../types/template';

/**
 * Ottiene il valore di un campo da un oggetto usando un path (es: "cliente.ragione_sociale")
 */
function getFieldValue(data: any, fieldPath: string): any {
  if (!fieldPath) return undefined;

  // Split path per navigare oggetti annidati
  const parts = fieldPath.split('.');
  let value = data;

  for (const part of parts) {
    // Gestisci array indices (es: "serbatoi[0].volume")
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, index] = arrayMatch;
      value = value?.[arrayName]?.[parseInt(index, 10)];
    } else {
      value = value?.[part];
    }

    if (value === undefined || value === null) {
      return undefined;
    }
  }

  return value;
}

/**
 * Valuta un singolo operatore
 */
function evaluateOperator(
  fieldValue: any,
  operator: ConditionOperator,
  compareValue: any
): boolean {
  switch (operator) {
    case 'eq':
      return fieldValue === compareValue;

    case 'ne':
      return fieldValue !== compareValue;

    case 'gt':
      return Number(fieldValue) > Number(compareValue);

    case 'gte':
      return Number(fieldValue) >= Number(compareValue);

    case 'lt':
      return Number(fieldValue) < Number(compareValue);

    case 'lte':
      return Number(fieldValue) <= Number(compareValue);

    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      if (typeof fieldValue === 'string') {
        return fieldValue.includes(String(compareValue));
      }
      return false;

    case 'isEmpty':
      return (
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    case 'isNotEmpty':
      return !(
        fieldValue === null ||
        fieldValue === undefined ||
        fieldValue === '' ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );

    default:
      console.warn(`Operatore sconosciuto: ${operator}`);
      return false;
  }
}

/**
 * Valuta una condizione completa (con supporto per sub-condizioni future)
 */
export function evaluateCondition(
  condition: BlockCondition,
  data: any
): boolean {
  // Ottieni valore del campo
  const fieldValue = getFieldValue(data, condition.field);

  // Valuta condizione principale
  const mainResult = evaluateOperator(fieldValue, condition.operator, condition.value);

  // Se ci sono sub-condizioni, valutale ricorsivamente
  if (condition.subConditions && condition.subConditions.length > 0) {
    const subResults = condition.subConditions.map(subCond =>
      evaluateCondition(subCond, data)
    );

    // Combina con operatore logico
    if (condition.logicalOperator === 'AND') {
      return mainResult && subResults.every(r => r);
    } else if (condition.logicalOperator === 'OR') {
      return mainResult || subResults.some(r => r);
    }
  }

  return mainResult;
}

/**
 * Helper per debugging: converte una condizione in stringa leggibile
 */
export function conditionToString(condition: BlockCondition, depth: number = 0): string {
  const operatorLabels: Record<ConditionOperator, string> = {
    eq: '=',
    ne: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    contains: 'contiene',
    isEmpty: 'è vuoto',
    isNotEmpty: 'non è vuoto'
  };

  const operator = operatorLabels[condition.operator] || condition.operator;
  const indent = '  '.repeat(depth);

  // Condizione principale
  let mainStr = '';
  if (condition.operator === 'isEmpty' || condition.operator === 'isNotEmpty') {
    mainStr = `${condition.field} ${operator}`;
  } else {
    mainStr = `${condition.field} ${operator} ${JSON.stringify(condition.value)}`;
  }

  // Se ci sono sub-condizioni, aggiungile
  if (condition.subConditions && condition.subConditions.length > 0) {
    const logicalOp = condition.logicalOperator || 'AND';
    const subStrings = condition.subConditions.map(sub =>
      conditionToString(sub, depth + 1)
    );

    if (depth === 0) {
      // Root level - formato multi-riga
      return `${mainStr}\n${indent}${logicalOp}\n${subStrings.join(`\n${indent}${logicalOp}\n`)}`;
    } else {
      // Nested - formato inline con parentesi
      return `(${mainStr} ${logicalOp} ${subStrings.join(` ${logicalOp} `)})`;
    }
  }

  return mainStr;
}

/**
 * Test rapido per validare condizioni durante sviluppo
 */
export function testCondition(
  condition: BlockCondition,
  data: any
): { result: boolean; fieldValue: any; description: string } {
  const fieldValue = getFieldValue(data, condition.field);
  const result = evaluateCondition(condition, data);
  const description = conditionToString(condition);

  return {
    result,
    fieldValue,
    description
  };
}
