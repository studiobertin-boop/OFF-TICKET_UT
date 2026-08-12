/**
 * Riconoscimento delle pagine "doppie": un foglio orizzontale che in realtà contiene due
 * pagine verticali affiancate, tipico di alcuni certificati sorgente (es. SICC).
 *
 * Puro calcolo su numeri, senza dipendenze dal DOM: la parte che tocca canvas/pdf-lib per
 * l'estrazione vera vive in `dividiPagineDoppie.ts`.
 */

/** Rapporto larghezza/altezza di un foglio ISO 216 (A4, A5, ...): √2. */
const RAPPORTO_ISO = Math.SQRT2

/**
 * Vero se una pagina larghezza×altezza è probabilmente due pagine verticali affiancate in
 * orizzontale, secondo la stessa relazione geometrica con cui la serie ISO 216 costruisce
 * ogni formato raddoppiando quello immediatamente più piccolo (A3 orizzontale = due A4
 * verticali affiancati, e così via) — funziona a qualunque scala, senza assumere dimensioni
 * assolute.
 */
export function ePaginaDoppia(larghezza: number, altezza: number, tolleranza = 0.08): boolean {
  if (larghezza <= altezza) return false
  const rapporto = altezza / (larghezza / 2)
  return Math.abs(rapporto - RAPPORTO_ISO) / RAPPORTO_ISO <= tolleranza
}

/** Ritaglio in pixel: origine e dimensioni dentro il bitmap sorgente. */
export interface Rettaglio {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * Le due metà — sinistra e destra, in quest'ordine — di un bitmap larghezza×altezza già
 * riconosciuto come pagina doppia.
 */
export function rettagliMeta(larghezza: number, altezza: number): [Rettaglio, Rettaglio] {
  const meta = larghezza / 2
  return [
    { sx: 0, sy: 0, sw: meta, sh: altezza },
    { sx: meta, sy: 0, sw: larghezza - meta, sh: altezza },
  ]
}
