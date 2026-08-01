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

// La convenzione delle posizioni valvola è condivisa con la scheda dati: vive in
// utils/valvoleImpianto e si riesporta qui per i moduli dell'engine.
export {
  codiciValvoleSerbatoio,
  codiciValvoleDisoleatore,
  valvoleDi,
} from '@/utils/valvoleImpianto'

/** Codice della valvola principale di un serbatoio: Sx → Sx.1. */
export function codiceValvolaSerbatoio(serbatoioCodice: string): string {
  return `${serbatoioCodice}.1`
}

/** Codice della valvola principale di un disoleatore: Cx.1 → Cx.2. */
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
  const ultimo = items[items.length - 1]
  // Eufonia: "ed uno", "ed essiccatori" — la d davanti a vocale, come nelle relazioni.
  const congiunzione = /^[aeiouAEIOU]/.test(ultimo) ? 'ed' : 'e'
  return `${items.slice(0, -1).join(', ')} ${congiunzione} ${ultimo}`
}

/**
 * Descrizione del serbatoio: dipende dal fluido contenuto e dall'orientamento.
 * Vive qui perché la usano §4 (caratteristiche), §5.2 (esiti), §5.3 (protezioni) e
 * §6.2 (valvole): duplicarla ha già prodotto un documento che chiamava lo stesso
 * recipiente "aria verticale" in una tabella e "azoto verticale" in un'altra.
 */
export function descrizioneSerbatoio(s: {
  fluido?: string
  fluido_altro?: string
  orientamento?: string
}): string {
  const fluido =
    s.fluido === 'AZOTO'
      ? 'azoto'
      : s.fluido === 'ALTRO'
        ? (s.fluido_altro?.trim().toLowerCase() ?? '')
        : 'aria'
  const orientamento = s.orientamento === 'ORIZZONTALE' ? 'orizzontale' : 'verticale'
  return ['Serbatoio', fluido, orientamento].filter(Boolean).join(' ')
}

const NUMERI_IN_LETTERE = [
  'zero',
  'uno',
  'due',
  'tre',
  'quattro',
  'cinque',
  'sei',
  'sette',
  'otto',
]

/**
 * Numero in lettere per gli elenchi discorsivi ("di cui uno a giri fissi e due a giri
 * variabili"). Oltre la scala delle apparecchiature previste ripiega sulla cifra.
 */
export function numeroInLettere(n: number): string {
  return NUMERI_IN_LETTERE[n] ?? String(n)
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
