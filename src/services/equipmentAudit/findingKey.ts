import type { RuleId } from './types'

/**
 * Identità delle segnalazioni.
 *
 * Archiviare una segnalazione perché valutata e ritenuta accettabile richiede
 * due chiavi distinte, non una:
 *
 *  - `findingKey` risponde a «è la stessa segnalazione?» e deve reggere nel
 *    tempo. È composta solo da regola e identificatori semantici (marca,
 *    modello), mai da UUID: se una riga viene fusa o ricreata l'archiviazione
 *    deve continuare a valere. Ed è indipendente dall'ordine in cui il motore
 *    ha incontrato le righe.
 *
 *  - `payloadHash` risponde a «i dati sono ancora quelli che ho valutato?».
 *    Copre i soli valori coinvolti: se qualcuno corregge una portata fra quelle
 *    archiviate, l'archiviazione decade e la segnalazione riemerge.
 */

/** FNV-1a a 32 bit: deterministico, senza dipendenze, sufficiente per un identificatore. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // Moltiplicazione per 16777619 senza perdita di precisione a 32 bit.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Serializzazione con chiavi ordinate: due oggetti equivalenti danno la stessa stringa. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
  return `{${entries.join(',')}}`
}

/**
 * Identità della segnalazione: regola + parti identificative, ordinate.
 *
 * Le parti vanno normalizzate dal chiamante (marca e modello in maiuscolo,
 * senza spaziatura superflua) così che una riscrittura cosmetica non generi
 * una segnalazione nuova.
 */
export function buildFindingKey(rule: RuleId, parts: string[]): string {
  const normalized = parts
    .map(p => (p ?? '').trim())
    .filter(p => p !== '')
    .sort()
  return [rule, ...normalized].join('|')
}

/** Hash dei soli valori la cui variazione deve far decadere l'archiviazione. */
export function buildPayloadHash(payload: unknown): string {
  return stableHash(stableStringify(payload))
}
