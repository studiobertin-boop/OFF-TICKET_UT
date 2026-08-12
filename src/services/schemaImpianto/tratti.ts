/**
 * Geometria dei tratti di tubazione, condivisa da chi disegna: il render statico
 * (`renderSvg.ts`), l'editor (`SchemaEdgeTubazione.tsx`) e i campioni della legenda
 * (`symbols/index.ts`). Sta in un file suo perché `symbols` non può importare `renderSvg`
 * senza chiudere un ciclo, e perché è geometria pura, verificabile senza DOM.
 */

export interface Punto {
  x: number
  y: number
}

/** Mezzo periodo dell'onda del flessibile, in unità SVG. */
export const PASSO_ONDA = 5
/** Quanto l'onda si scosta dall'asse del tubo. */
export const AMPIEZZA_ONDA = 5

/**
 * Tracciato ondulato che segue una polilinea: convenzione CAD della tubazione flessibile.
 *
 * L'onda è perpendicolare alla direzione di ogni tratto e **riparte a ogni vertice**, così gli
 * spigoli restano netti come nei blocchi di riferimento invece di essere smussati da un'onda a
 * cavallo di due tratti. Il numero di mezzi periodi si adatta alla lunghezza e il passo si
 * ridistribuisce, perché il tratto deve finire esattamente sull'ancora e non a un'onda di
 * distanza: un tubo che non tocca il bocchello è un errore di disegno visibile.
 *
 * La polilinea passata resta la verità geometrica del percorso — chi calcola i varchi nel muro
 * continua a lavorare su quella, non su questo tracciato.
 */
export function ondula(punti: Punto[]): string {
  if (punti.length === 0) return ''
  const parti = [`M ${punti[0].x} ${punti[0].y}`]

  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1]
    const b = punti[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lunghezza = Math.hypot(dx, dy)
    // Due punti coincidenti (gomito posato sull'ancora): niente da ondulare, e dividere per
    // zero riempirebbe il tracciato di NaN.
    if (lunghezza === 0) continue

    const ux = dx / lunghezza
    const uy = dy / lunghezza
    // Perpendicolare alla direzione del tratto: è su questa che l'onda oscilla.
    const px = -uy
    const py = ux

    const mezziPeriodi = Math.max(1, Math.round(lunghezza / PASSO_ONDA))
    const passo = lunghezza / mezziPeriodi

    for (let k = 0; k < mezziPeriodi; k++) {
      const verso = k % 2 === 0 ? 1 : -1
      const inizio = k * passo
      const fine = inizio + passo
      const mezzo = inizio + passo / 2
      const cx = a.x + ux * mezzo + px * AMPIEZZA_ONDA * verso
      const cy = a.y + uy * mezzo + py * AMPIEZZA_ONDA * verso
      const ex = a.x + ux * fine
      const ey = a.y + uy * fine
      parti.push(`Q ${arrotonda(cx)} ${arrotonda(cy)} ${arrotonda(ex)} ${arrotonda(ey)}`)
    }
  }

  return parti.join(' ')
}

/** Due decimali bastano al disegno e tengono l'SVG leggibile nei test. */
function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}
