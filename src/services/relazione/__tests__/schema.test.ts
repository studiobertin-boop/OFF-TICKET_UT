import { describe, test, expect } from 'vitest'
import { additionalInfoSchema } from '../schema'

describe('additionalInfoSchema', () => {
  test('accetta un oggetto valido e applica i default', () => {
    const parsed = additionalInfoSchema.parse({ descrizioneAttivita: 'produzione' })
    expect(parsed.descrizioneAttivita).toBe('produzione')
    expect(parsed.compressoriGiri).toEqual({})
    expect(parsed.spessimetrica).toEqual([])
    expect(parsed.collegamentiCompressoriSerbatoi).toEqual({})
  })

  test('richiede la descrizione attività non vuota', () => {
    expect(additionalInfoSchema.safeParse({ descrizioneAttivita: '' }).success).toBe(false)
    expect(additionalInfoSchema.safeParse({}).success).toBe(false)
  })

  test('valida i valori dei giri (fissi|variabili)', () => {
    expect(
      additionalInfoSchema.safeParse({
        descrizioneAttivita: 'x',
        compressoriGiri: { C1: 'variabili' },
      }).success
    ).toBe(true)
    expect(
      additionalInfoSchema.safeParse({
        descrizioneAttivita: 'x',
        compressoriGiri: { C1: 'turbo' },
      }).success
    ).toBe(false)
  })
})
