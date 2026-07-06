import { describe, test, expect } from 'vitest'
import { buildAllegati } from '../engine/allegati'
import { makeAdditionalInfo } from './fixtures'

describe('buildAllegati', () => {
  test('include sempre attestazioni e manuali', () => {
    const voci = buildAllegati(makeAdditionalInfo({ spessimetrica: [] }))
    expect(voci).toHaveLength(2)
    expect(voci[0]).toContain('Attestazioni di conformità')
    expect(voci[1]).toContain("Manuali d'uso e manutenzione")
  })

  test('aggiunge la voce verifiche di integrità solo con spessimetrica', () => {
    const voci = buildAllegati(makeAdditionalInfo({ spessimetrica: ['C1.1'] }))
    expect(voci).toHaveLength(3)
    expect(voci[2]).toContain('Verifiche di integrità')
  })
})
