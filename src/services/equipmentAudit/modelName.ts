/**
 * Parsing del nome modello.
 *
 * Metà del catalogo porta la pressione dentro il nome — `GA 18 (@10bar)`,
 * `CSD 125 (max15bar)`, `SK 25 SFC (8,5-11bar)`. Non è un duplicato della
 * pressione nei dati tecnici: è la pressione di ESERCIZIO a cui il costruttore
 * misura la portata, mentre `specs` porta la pressione MASSIMA della macchina.
 * Estrarla è il presupposto per confrontare fra loro le varianti di uno stesso
 * modello.
 *
 * Le forme presenti nei dati reali, tutte da reggere:
 *   GA 18 (@10bar)            CSC 100 (@13 bar)      spazio prima di «bar»
 *   CSD 125 (max15bar)        TA15 (@10,80bar)       decimale con virgola
 *   SK 25 SFC (8,5-11bar)     ASK 34 T SFC (11.5-15bar)   decimale con punto
 *   CSA 20 (@10bar)+TANK270   testo dopo la parentesi, da conservare
 *   810sGK (DN10 @14bar)      sigla nella stessa parentesi, da conservare
 */

export type PressurePattern = 'at' | 'max' | 'range' | 'plain'

export interface ParsedModello {
  raw: string
  /** Nome ripulito dalla pressione: `GA 18 (@10bar)` → `GA 18`. */
  base: string
  pattern: PressurePattern
  /**
   * Pressione di esercizio. Per i range è l'estremo SUPERIORE: è così che sono
   * già registrati i dati tecnici delle righe con range, e per le macchine a
   * giri variabili la portata di targa è dichiarata al massimo del campo.
   * `null` quando `pattern === 'plain'`.
   */
  pressioneEsercizio: number | null
  rangeMin?: number
  rangeMax?: number
}

/** Numero con virgola o punto decimale. */
const NUM = String.raw`\d+(?:[.,]\d+)?`

/**
 * Token di pressione dentro una parentesi: `@10bar`, `max15bar`, `8,5-11bar`,
 * `10,80 bar`. Il prefisso `@`/`max` e lo spazio prima di «bar» sono opzionali.
 */
const PRESSURE_TOKEN = new RegExp(
  String.raw`(@|max)?\s*(${NUM})\s*(?:-\s*(${NUM})\s*)?bar`,
  'i'
)

/**
 * Gruppo parentetico. La parentesi di chiusura è opzionale perché nei dati
 * esiste almeno un nome troncato (`H15N (@10bar`): meglio riconoscerlo che
 * lasciarlo fuori dai controlli.
 */
const PAREN_GROUP = /\(([^)]*)(?:\)|$)/g

function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Spazi multipli collassati, spazio superfluo prima di `+`, separatori a filo rimossi. */
function tidy(s: string): string {
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\+/g, '+')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/^[\s\-+]+/, '')
    .replace(/[\s\-+]+$/, '')
    .trim()
}

/**
 * Estrae la pressione dal nome del modello.
 *
 * Rimuove SOLO il token di pressione: se la parentesi contiene altro (`DN10`)
 * quel contenuto resta, perché è parte dell'identità del modello. Se la
 * parentesi conteneva solo la pressione, sparisce del tutto.
 *
 * È idempotente: `parseModello(parseModello(x).base).pattern === 'plain'`.
 */
export function parseModello(modello: string): ParsedModello {
  const raw = modello ?? ''

  let pattern: PressurePattern = 'plain'
  let pressioneEsercizio: number | null = null
  let rangeMin: number | undefined
  let rangeMax: number | undefined
  let found = false

  const base = raw.replace(PAREN_GROUP, (whole, inner: string) => {
    // Solo la prima parentesi con una pressione viene consumata.
    if (found) return whole
    const m = PRESSURE_TOKEN.exec(inner)
    if (!m) return whole

    found = true
    const [, prefix, first, second] = m
    const a = toNumber(first)
    const b = toNumber(second)

    if (b !== null && a !== null) {
      pattern = 'range'
      rangeMin = Math.min(a, b)
      rangeMax = Math.max(a, b)
      pressioneEsercizio = rangeMax
    } else {
      pattern = prefix?.toLowerCase() === 'max' ? 'max' : 'at'
      pressioneEsercizio = a
    }

    const residue = inner.replace(PRESSURE_TOKEN, '').trim()
    return residue ? `(${residue})` : ''
  })

  return {
    raw,
    base: tidy(base),
    pattern,
    pressioneEsercizio,
    ...(rangeMin !== undefined ? { rangeMin } : {}),
    ...(rangeMax !== undefined ? { rangeMax } : {}),
  }
}

export interface ParsedSerie {
  /** Prefisso alfabetico della serie: `AMD`, `ASK`, `CSDX`. Vuoto se il nome non ne ha. */
  famiglia: string
  /** Taglia nominale. `null` quando il nome non è nella forma «famiglia + numero». */
  numero: number | null
  /** Ciò che segue la taglia: `SFC`, `T SFC`, `VSD+`. */
  suffisso: string
}

/** `AIRCENTER 12 SFC` → { famiglia: 'AIRCENTER', numero: 12, suffisso: 'SFC' } */
const SERIE = new RegExp(String.raw`^([A-Za-z][A-Za-z.\-/]*)\s*(${NUM})\s*(.*)$`)

/**
 * Scompone un nome base in serie + taglia.
 *
 * Serve alla regola euristica sulle serie: dentro la stessa famiglia il numero
 * ordina le taglie, e la capacità deve crescere con esse. I nomi che non hanno
 * questa forma (`810sGK`, `PLH 4c`) restituiscono `numero: null` e vengono
 * ignorati dalla regola.
 */
export function parseSerie(base: string): ParsedSerie {
  const m = SERIE.exec((base ?? '').trim())
  if (!m) return { famiglia: '', numero: null, suffisso: '' }

  const [, famiglia, numero, suffisso] = m
  return {
    famiglia: famiglia.toUpperCase(),
    numero: toNumber(numero),
    suffisso: suffisso.trim().toUpperCase(),
  }
}

/** Chiave di confronto insensibile a maiuscole, punteggiatura e spaziatura. */
export function normalizeKey(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
