import { describe, test, expect } from 'vitest'
import { parseCode, compareCodes, nextFreeCode, childCode } from '@/utils/equipmentCodes'

describe('parseCode', () => {
  test('riconosce i codici principali', () => {
    expect(parseCode('S1')).toEqual({ prefix: 'S', num: 1 })
    expect(parseCode('SEP12')).toEqual({ prefix: 'SEP', num: 12 })
  })

  test('riconosce i codici dei figli', () => {
    expect(parseCode('C1.1')).toEqual({ prefix: 'C', num: 1, sub: 1 })
  })

  test('rifiuta i valori non validi', () => {
    expect(parseCode(null)).toBeNull()
    expect(parseCode(undefined)).toBeNull()
    expect(parseCode('')).toBeNull()
    expect(parseCode('undefined.1')).toBeNull()
    expect(parseCode('s1')).toBeNull()
    expect(parseCode('S')).toBeNull()
    expect(parseCode(3)).toBeNull()
  })
})

describe('compareCodes', () => {
  test('ordina numericamente, non alfabeticamente', () => {
    expect(['S10', 'S2', 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', 'S10'])
  })

  test('mette il figlio dopo il padre', () => {
    expect(['C1.1', 'C1'].sort(compareCodes)).toEqual(['C1', 'C1.1'])
  })

  test('raggruppa per prefisso', () => {
    expect(['S1', 'C1'].sort(compareCodes)).toEqual(['C1', 'S1'])
  })

  test('manda in fondo i codici non validi', () => {
    expect(['S2', null, 'S1'].sort(compareCodes)).toEqual(['S1', 'S2', null])
  })
})

describe('nextFreeCode', () => {
  test('riempie il buco più basso', () => {
    expect(nextFreeCode('S', ['S1', 'S3'], 7)).toBe('S2')
  })

  test('parte da 1 su insieme vuoto', () => {
    expect(nextFreeCode('S', [], 7)).toBe('S1')
  })

  test('accoda quando non ci sono buchi', () => {
    expect(nextFreeCode('S', ['S1', 'S2'], 7)).toBe('S3')
  })

  test('ritorna null quando il tipo è saturo', () => {
    expect(nextFreeCode('SEP', ['SEP1', 'SEP2', 'SEP3'], 3)).toBeNull()
  })

  test('ignora i codici di altro prefisso', () => {
    expect(nextFreeCode('S', ['C1', 'C2'], 7)).toBe('S1')
  })

  test('ignora i codici dei figli: C1.1 non riserva il numero 1', () => {
    expect(nextFreeCode('C', ['C1.1'], 5)).toBe('C1')
  })

  test('tollera i valori non validi nella lista', () => {
    expect(nextFreeCode('S', [null, undefined, '', 'S1'], 7)).toBe('S2')
  })
})

describe('childCode', () => {
  test('deriva il codice del figlio dal padre', () => {
    expect(childCode('C3')).toBe('C3.1')
    expect(childCode('S1', 2)).toBe('S1.2')
  })
})
