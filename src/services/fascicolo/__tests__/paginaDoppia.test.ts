import { describe, test, expect } from 'vitest'
import { ePaginaDoppia, rettagliMeta } from '../paginaDoppia'

describe('ePaginaDoppia', () => {
  test('riconosce due A4 verticali affiancati', () => {
    // Due A4 (595.28×841.89) affiancati in orizzontale: 1190.56×841.89.
    expect(ePaginaDoppia(1190.56, 841.89)).toBe(true)
  })

  test('riconosce il rapporto ISO esatto, a qualunque scala', () => {
    expect(ePaginaDoppia(2 * Math.SQRT2, 2)).toBe(true)
    expect(ePaginaDoppia(200 * Math.SQRT2, 200)).toBe(true)
  })

  test('accetta fino al bordo della tolleranza dell\'8%, rifiuta appena oltre', () => {
    const base = Math.SQRT2
    expect(ePaginaDoppia(2, base * 1.079)).toBe(true)
    expect(ePaginaDoppia(2, base * 1.081)).toBe(false)
  })

  test('una pagina verticale non è mai doppia', () => {
    expect(ePaginaDoppia(595, 842)).toBe(false)
  })

  test('una pagina quadrata non è doppia', () => {
    expect(ePaginaDoppia(1000, 1000)).toBe(false)
  })

  test('una pagina orizzontale con proporzioni lontane da √2 non è doppia', () => {
    // Uno schema panoramico 2:1, non due pagine affiancate.
    expect(ePaginaDoppia(1000, 500)).toBe(false)
  })
})

describe('rettagliMeta', () => {
  test('divide a metà in verticale, sinistra poi destra', () => {
    const [sinistra, destra] = rettagliMeta(1190, 842)

    expect(sinistra).toEqual({ sx: 0, sy: 0, sw: 595, sh: 842 })
    expect(destra).toEqual({ sx: 595, sy: 0, sw: 595, sh: 842 })
  })

  test('gestisce larghezze dispari senza perdere pixel ai bordi', () => {
    const [sinistra, destra] = rettagliMeta(1191, 842)

    expect(sinistra.sx).toBe(0)
    expect(sinistra.sw).toBe(595.5)
    expect(destra.sx).toBe(595.5)
    expect(destra.sx + destra.sw).toBe(1191)
  })
})
