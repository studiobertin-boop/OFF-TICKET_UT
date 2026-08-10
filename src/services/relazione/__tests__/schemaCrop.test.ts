import { describe, test, expect } from 'vitest'
import { riquadroContenuto, riquadroConMargine } from '../schemaCrop'

type RGBA = [number, number, number, number]

function immaginePiena(larghezza: number, altezza: number, colore: RGBA = [255, 255, 255, 255]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(larghezza * altezza * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = colore[0]
    pixels[i + 1] = colore[1]
    pixels[i + 2] = colore[2]
    pixels[i + 3] = colore[3]
  }
  return pixels
}

function disegnaRettangolo(
  pixels: Uint8ClampedArray,
  larghezza: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colore: RGBA
): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * larghezza + x) * 4
      pixels[i] = colore[0]
      pixels[i + 1] = colore[1]
      pixels[i + 2] = colore[2]
      pixels[i + 3] = colore[3]
    }
  }
}

describe('riquadroContenuto', () => {
  test('trova il rettangolo di contenuto in posizione nota', () => {
    const larghezza = 10
    const altezza = 10
    const pixels = immaginePiena(larghezza, altezza)
    disegnaRettangolo(pixels, larghezza, 4, 4, 6, 6, [0, 0, 0, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 4, minY: 4, maxX: 6, maxY: 6 })
  })

  test('rileva il contenuto su sfondo trasparente (caso PDF)', () => {
    const larghezza = 8
    const altezza = 8
    const pixels = immaginePiena(larghezza, altezza, [0, 0, 0, 0])
    disegnaRettangolo(pixels, larghezza, 2, 3, 5, 6, [10, 10, 10, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 2, minY: 3, maxX: 5, maxY: 6 })
  })

  test('immagine completamente vuota non produce un riquadro', () => {
    const pixels = immaginePiena(5, 5)
    expect(riquadroContenuto(pixels, 5, 5)).toBeNull()
  })

  test('la soglia tollera un piccolo scarto cromatico dello sfondo', () => {
    const larghezza = 6
    const altezza = 6
    const pixels = immaginePiena(larghezza, altezza, [250, 250, 250, 255])
    // Rumore sotto soglia: non deve comparire nel riquadro.
    const i = (1 * larghezza + 1) * 4
    pixels[i] = 240
    pixels[i + 1] = 245
    pixels[i + 2] = 248
    // Contenuto vero, ben oltre soglia.
    disegnaRettangolo(pixels, larghezza, 3, 3, 5, 5, [0, 0, 0, 255])
    expect(riquadroContenuto(pixels, larghezza, altezza)).toEqual({ minX: 3, minY: 3, maxX: 5, maxY: 5 })
  })
})

describe('riquadroConMargine', () => {
  test('espande simmetricamente entro i limiti dell\'immagine', () => {
    const r = { minX: 4, minY: 4, maxX: 6, maxY: 6 }
    expect(riquadroConMargine(r, 2, 10, 10)).toEqual({ minX: 2, minY: 2, maxX: 8, maxY: 8 })
  })

  test('non sconfina quando il contenuto tocca già un bordo', () => {
    const r = { minX: 0, minY: 0, maxX: 3, maxY: 3 }
    expect(riquadroConMargine(r, 5, 10, 10)).toEqual({ minX: 0, minY: 0, maxX: 8, maxY: 8 })
  })
})
