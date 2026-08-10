/**
 * Ritaglio dello schema d'impianto al contenuto: funzioni pure, senza DOM, testabili in
 * Node con array di pixel costruiti a mano. Il glue DOM (canvas, Image, lettura PDF) vive
 * in `components/relazione/schemaImpiantoFile.ts`.
 */

/** Riquadro in pixel; `maxX`/`maxY` esclusivi (come in uno `slice`). */
export interface Riquadro {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Tolleranza di default: quanto un canale (0-255) può scostarsi dal colore di sfondo
 * prima di essere considerato contenuto. Tunable: da rivedere se il ritaglio in
 * produzione risultasse troppo o troppo poco aggressivo.
 */
const SOGLIA_DEFAULT = 24

interface ColoreRif {
  r: number
  g: number
  b: number
  a: number
}

/** Colore di sfondo campionato dai 4 angoli dell'immagine, mediati. */
function campionaSfondo(pixels: Uint8ClampedArray, larghezza: number, altezza: number): ColoreRif {
  const angoli = [
    0,
    (larghezza - 1) * 4,
    (altezza - 1) * larghezza * 4,
    ((altezza - 1) * larghezza + larghezza - 1) * 4,
  ]
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  for (const i of angoli) {
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    a += pixels[i + 3]
  }
  return { r: r / 4, g: g / 4, b: b / 4, a: a / 4 }
}

/**
 * Un pixel è "contenuto" se il suo alpha si scosta significativamente dallo sfondo
 * (copre gli sfondi trasparenti, tipici di un PDF vettoriale senza riempimento di
 * pagina) oppure, a parità di alpha, se un canale RGB si scosta oltre soglia (copre gli
 * sfondi bianchi/chiari delle immagini raster, tollerando l'antialiasing).
 */
function eContenuto(pixels: Uint8ClampedArray, i: number, rif: ColoreRif, soglia: number): boolean {
  const a = pixels[i + 3]
  if (Math.abs(a - rif.a) > soglia) return true
  if (a === 0) return false
  return (
    Math.abs(pixels[i] - rif.r) > soglia ||
    Math.abs(pixels[i + 1] - rif.g) > soglia ||
    Math.abs(pixels[i + 2] - rif.b) > soglia
  )
}

/**
 * Bounding box del contenuto rilevato, o `null` se l'immagine è vuota (nessun pixel
 * supera la soglia rispetto allo sfondo): in quel caso il chiamante non ritaglia nulla,
 * l'immagine intera resta il fallback non bloccante.
 */
export function riquadroContenuto(
  pixels: Uint8ClampedArray,
  larghezza: number,
  altezza: number,
  soglia: number = SOGLIA_DEFAULT
): Riquadro | null {
  if (larghezza <= 0 || altezza <= 0) return null
  const rif = campionaSfondo(pixels, larghezza, altezza)

  let minX = larghezza
  let minY = altezza
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) {
      const i = (y * larghezza + x) * 4
      if (eContenuto(pixels, i, rif, soglia)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return null
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }
}

/** Espande il riquadro del margine richiesto, con clamp ai bordi dell'immagine. */
export function riquadroConMargine(
  r: Riquadro,
  marginePx: number,
  larghezza: number,
  altezza: number
): Riquadro {
  return {
    minX: Math.max(0, r.minX - marginePx),
    minY: Math.max(0, r.minY - marginePx),
    maxX: Math.min(larghezza, r.maxX + marginePx),
    maxY: Math.min(altezza, r.maxY + marginePx),
  }
}
