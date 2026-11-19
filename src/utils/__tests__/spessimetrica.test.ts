import { describe, it, expect } from 'vitest'
import { codiciSpessimetrica } from '../spessimetrica'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'

describe('codiciSpessimetrica', () => {
  it('conta NS1 come un recipiente', () => {
    const scheda = {
      serbatoi: [{ codice: 'S1', spessimetrica: true }],
      serbatoi_generatore: [{ codice: 'NS1', spessimetrica: true }, { codice: 'NS2' }],
    } as unknown as SchedaDatiCompleta
    expect(codiciSpessimetrica(scheda)).toEqual(['S1', 'NS1'])
  })

  it('con gli array nuovi assenti dà l\'elenco di oggi', () => {
    const scheda = { disoleatori: [{ codice: 'C1.1', spessimetrica: true }] } as unknown as SchedaDatiCompleta
    expect(codiciSpessimetrica(scheda)).toEqual(['C1.1'])
  })
})
