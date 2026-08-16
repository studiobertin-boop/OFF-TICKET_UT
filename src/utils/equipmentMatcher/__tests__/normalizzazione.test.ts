import { describe, test, expect } from 'vitest'
import {
  normalizzaMarcaStretta,
  normalizzaMarcaFamiglia,
  normalizzaModello,
  similarita,
} from '../normalizzazione'

describe('normalizzaMarcaStretta', () => {
  test('canonicalizza la forma societaria senza perderla', () => {
    expect(normalizzaMarcaStretta('SICC S.p.A.')).toBe('SICC SPA')
    expect(normalizzaMarcaStretta('SICC S.r.L.')).toBe('SICC SRL')
    expect(normalizzaMarcaStretta('SICC TECH s.r.l.')).toBe('SICC TECH SRL')
  })

  test('grafie diverse della stessa forma societaria convergono', () => {
    expect(normalizzaMarcaStretta('FIAC AIR COMPRESSORS S.p.A.'))
      .toBe(normalizzaMarcaStretta('FIAC AIR COMPRESSORS SPA'))
    expect(normalizzaMarcaStretta('BOTTARINI SPA')).toBe('BOTTARINI SPA')
  })

  test('SpA e Srl della stessa azienda restano distinguibili', () => {
    expect(normalizzaMarcaStretta('SICC S.p.A.')).not.toBe(normalizzaMarcaStretta('SICC S.r.L.'))
  })

  test('le parentetiche restano', () => {
    expect(normalizzaMarcaStretta('A.ARIA C S.r.l. (ABAC)')).toBe('A ARIA C SRL (ABAC)')
  })
})

describe('normalizzaMarcaFamiglia', () => {
  test('toglie la forma societaria', () => {
    expect(normalizzaMarcaFamiglia('SICC S.p.A.')).toBe('SICC')
    expect(normalizzaMarcaFamiglia('SICC S.r.L.')).toBe('SICC')
    expect(normalizzaMarcaFamiglia('SICC TECH s.r.l.')).toBe('SICC TECH')
  })

  test('toglie anche le parentetiche', () => {
    expect(normalizzaMarcaFamiglia('A.ARIA C S.r.l. (ABAC)')).toBe('A ARIA C')
  })

  test('SpA e Srl della stessa azienda diventano indistinguibili — è voluto', () => {
    expect(normalizzaMarcaFamiglia('SICC S.p.A.')).toBe(normalizzaMarcaFamiglia('SICC S.r.L.'))
  })
})

describe('normalizzaModello', () => {
  test('i separatori convergono su spazio singolo', () => {
    expect(normalizzaModello('500 - 12783')).toBe('500 12783')
    expect(normalizzaModello('500-12783')).toBe('500 12783')
    expect(normalizzaModello('500/12783')).toBe('500 12783')
    expect(normalizzaModello('500–12783')).toBe('500 12783')  // trattino lungo
    expect(normalizzaModello('500_12783')).toBe('500 12783')
    expect(normalizzaModello('2000  - 12784')).toBe('2000 12784')
  })

  test('maiuscole e spazi ai bordi', () => {
    expect(normalizzaModello('  fonocompact pro 270 f6s ')).toBe('FONOCOMPACT PRO 270 F6S')
  })

  test('modelli diversi restano diversi', () => {
    expect(normalizzaModello('500 - 12783')).not.toBe(normalizzaModello('725 - 12783'))
  })
})

describe('similarita', () => {
  test('stringhe identiche danno 1', () => {
    expect(similarita('500 12783', '500 12783')).toBe(1)
  })

  test('stringhe senza nulla in comune danno 0', () => {
    expect(similarita('ABCDEF', 'XYZWQ')).toBe(0)
  })

  test('stringhe simili stanno in mezzo, e sotto la soglia di certezza', () => {
    const s = similarita('500 12783', '725 12783')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  test('è simmetrica', () => {
    expect(similarita('FONOCOMPACT PRO 270 F6S', 'FONOCOMPACT PRO 270 F5 5S'))
      .toBe(similarita('FONOCOMPACT PRO 270 F5 5S', 'FONOCOMPACT PRO 270 F6S'))
  })

  test('stringa vuota dà 0 senza esplodere', () => {
    expect(similarita('', 'QUALCOSA')).toBe(0)
    expect(similarita('', '')).toBe(0)
  })
})
