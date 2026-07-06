/**
 * Helper puri per la generazione della relazione tecnica DM329.
 *
 * Nessuna logica di business qui: solo formattazione e supporto linguistico.
 */

/**
 * Formatta un numero secondo la convenzione italiana:
 * virgola come separatore decimale, nessun separatore delle migliaia.
 * Restituisce stringa vuota per valori non definiti.
 */
export function formatNumberIT(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ''
  }
  return String(value).replace('.', ',')
}

/**
 * Restituisce la forma singolare quando count === 1, altrimenti la forma plurale
 * (lo zero usa il plurale, come nell'uso comune italiano).
 */
export function plurale(count: number, singolare: string, plurale: string): string {
  return count === 1 ? singolare : plurale
}

/**
 * Codice della valvola di sicurezza di un serbatoio: Sx → Sx.1.
 */
export function codiceValvolaSerbatoio(serbatoioCodice: string): string {
  return `${serbatoioCodice}.1`
}

/**
 * Codice della valvola di sicurezza di un disoleatore: il disoleatore è Cx.1,
 * la sua valvola è Cx.2 (secondo posto sotto il compressore Cx).
 */
export function codiceValvolaDisoleatore(disoleatoreCodice: string): string {
  const base = disoleatoreCodice.split('.')[0]
  return `${base}.2`
}

/**
 * Unisce una lista in italiano: ['C1'] → "C1"; ['C1','C2'] → "C1 e C2";
 * ['C1','C2','C3'] → "C1, C2 e C3".
 */
export function joinConLaE(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/**
 * Formatta la temperatura come range "min ÷ +TS" usando un minimo convenzionale
 * per tipo apparecchio (il modello scheda salva solo il TS massimo).
 * Restituisce stringa vuota se il TS non è definito.
 */
export function formatTemperatura(
  minConvenzionale: number,
  ts: number | null | undefined
): string {
  if (ts === null || ts === undefined || Number.isNaN(ts)) {
    return ''
  }
  return `${minConvenzionale} ÷ +${formatNumberIT(ts)}`
}
