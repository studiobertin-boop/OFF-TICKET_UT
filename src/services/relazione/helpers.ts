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
 * Modello etichettato per le colonne «Costruttore e modello» di §4 e §5.2, dove il nome
 * del costruttore sta sulla prima riga della cella e il modello sulla seconda: senza
 * etichetta le due righe si leggono come un'unica denominazione.
 *
 * L'etichetta la mette il motore e non il template, perché è condizionata: di
 * un'attrezzatura senza modello a catalogo la cella riporta il solo costruttore, e un
 * «Modello:» orfano sarebbe peggio della riga mancante.
 */
export function etichettaModello(modello: string | null | undefined): string {
  const testo = (modello ?? '').trim()
  return testo ? `Modello: ${testo}` : ''
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
 * Formatta la temperatura per la tabella delle caratteristiche.
 *
 * Il TS lo scrive il tecnico nella scheda dati, nel campo `ts`, precompilato dal
 * catalogo quando il modello è già censito. È testo libero: se contiene solo un numero
 * si antepone il minimo convenzionale del tipo, come nelle relazioni storiche
 * («-10 ÷ +120»); se il tecnico ha già scritto un intervallo lo si riporta tal quale,
 * perché è una sua scelta esplicita e non va riscritta.
 *
 * `tsLegacy` è il vecchio campo numerico `ts_temperatura`, usato dai form per tipo
 * ritirati: serve a non perdere la temperatura sulle schede compilate prima.
 */
/**
 * «-10 ÷ +120» → «-10÷+120». La spaziatura attorno al separatore è una scelta tipografica
 * del documento, non un dato: si normalizza anche quando l'intervallo l'ha scritto a mano
 * il tecnico, che altrimenti dovrebbe ricordarsene ogni volta.
 */
function senzaSpaziAttornoAlSeparatore(intervallo: string): string {
  return intervallo.replace(/\s*÷\s*/g, '÷')
}

export function formatTemperatura(
  minConvenzionale: number,
  ts: string | null | undefined,
  tsLegacy?: number | null
): string {
  const scritto = (ts ?? '').trim()
  if (scritto) {
    // Un intervallo si riconosce dalla presenza di un separatore o di un secondo segno.
    const eIntervallo = /[÷\-–—]/.test(scritto.replace(/^[-–—]/, ''))
    return eIntervallo ? senzaSpaziAttornoAlSeparatore(scritto) : `${minConvenzionale}÷+${scritto}`
  }
  if (tsLegacy === null || tsLegacy === undefined || Number.isNaN(tsLegacy)) {
    return ''
  }
  return `${minConvenzionale}÷+${formatNumberIT(tsLegacy)}`
}
