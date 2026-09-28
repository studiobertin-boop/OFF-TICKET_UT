import { describe, test, expect } from 'vitest'
import { certificazioneDaDirettive } from '../certificazione'

describe('certificazioneDaDirettive', () => {
  test.each([
    ['2014/29/UE'],
    ['Directive 2014/29/EU'],
    ['29/2014'],
    ['87/404/CEE'],
    ['Direttiva 87/404/CEE modificata dalla 90/488/CEE'],
    ['2009/105/CE'],
    ['D.Lgs. 311/91'],
    ['D.Lgs. 311/1991'],
  ])('%s → RSP', (citata) => {
    expect(certificazioneDaDirettive([citata])).toBe('RSP')
  })

  test.each([
    ['2014/68/UE'],
    ['PED 2014/68/EU'],
    ['68/2014'],
    ['97/23/CE'],
    ['Directive 97/23/EC'],
    ['D.Lgs. 93/2000'],
    ['D.Lgs 93/00'],
  ])('%s → PED', (citata) => {
    expect(certificazioneDaDirettive([citata])).toBe('PED')
  })

  test('più citazioni dello stesso regime restano coerenti', () => {
    expect(certificazioneDaDirettive(['97/23/CE', 'D.Lgs. 93/2000'])).toBe('PED')
    expect(certificazioneDaDirettive(['2014/29/UE', 'EN 286-1'])).toBe('RSP')
  })

  test('citazioni di entrambi i regimi: non si decide', () => {
    expect(certificazioneDaDirettive(['2014/29/UE', '2014/68/UE'])).toBeNull()
  })

  test('nessuna citazione riconoscibile', () => {
    expect(certificazioneDaDirettive([])).toBeNull()
    expect(certificazioneDaDirettive(['EN 13445', 'ISO 9001'])).toBeNull()
    expect(certificazioneDaDirettive(['2006/42/CE'])).toBeNull()
  })

  test('numeri dentro numeri più lunghi non contano', () => {
    expect(certificazioneDaDirettive(['2014/290'])).toBeNull()
    expect(certificazioneDaDirettive(['197/23'])).toBeNull()
  })

  test('in assenza di numeri valgono i nomi per esteso', () => {
    expect(certificazioneDaDirettive(['Simple Pressure Vessels Directive'])).toBe('RSP')
    expect(certificazioneDaDirettive(['Pressure Equipment Directive'])).toBe('PED')
    // Il numero vince sul nome: «PED» scritto per errore accanto a una direttiva RSP.
    expect(certificazioneDaDirettive(['PED', '2014/29/UE'])).toBe('RSP')
  })
})
