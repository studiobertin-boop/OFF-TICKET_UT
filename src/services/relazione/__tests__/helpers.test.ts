import { describe, test, expect } from 'vitest'
import { etichettaModello, formatNumberIT, plurale } from '../helpers'

describe('formatNumberIT', () => {
  test('usa la virgola come separatore decimale, senza separatore delle migliaia', () => {
    expect(formatNumberIT(8350)).toBe('8350')
    expect(formatNumberIT(18390)).toBe('18390')
    expect(formatNumberIT(11.5)).toBe('11,5')
    expect(formatNumberIT(10.8)).toBe('10,8')
  })

  test('restituisce stringa vuota per valori non definiti', () => {
    expect(formatNumberIT(undefined)).toBe('')
    expect(formatNumberIT(null)).toBe('')
  })
})

describe('plurale', () => {
  test('sceglie la forma singolare per 1 e la forma plurale per molti', () => {
    expect(plurale(1, 'compressore', 'compressori')).toBe('compressore')
    expect(plurale(3, 'compressore', 'compressori')).toBe('compressori')
  })

  test('usa il plurale anche per zero elementi', () => {
    expect(plurale(0, 'essiccatore', 'essiccatori')).toBe('essiccatori')
  })
})

describe('etichettaModello', () => {
  test('antepone l’etichetta al modello', () => {
    expect(etichettaModello('CSD 90 SFC')).toBe('Modello: CSD 90 SFC')
  })

  test('tace quando il modello non è censito, invece di lasciare l’etichetta orfana', () => {
    expect(etichettaModello('')).toBe('')
    expect(etichettaModello('   ')).toBe('')
    expect(etichettaModello(undefined)).toBe('')
    expect(etichettaModello(null)).toBe('')
  })
})
