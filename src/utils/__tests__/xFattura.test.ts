import { describe, test, expect } from 'vitest'
import { countApparecchiCIVA, computeXFattura } from '../xFattura'
import type { SchedaDatiCompleta } from '@/types'

const serbatoio = (volume: number, ps: number) => ({ volume, ps_pressione_max: ps })

describe('computeXFattura', () => {
  test('1-3 apparecchiature CIVA → 1', () => {
    expect(computeXFattura(0)).toBe(1)
    expect(computeXFattura(1)).toBe(1)
    expect(computeXFattura(3)).toBe(1)
  })

  test('4-6 apparecchiature CIVA → 2', () => {
    expect(computeXFattura(4)).toBe(2)
    expect(computeXFattura(6)).toBe(2)
  })

  test('7-9 apparecchiature CIVA → 3, e così via', () => {
    expect(computeXFattura(7)).toBe(3)
    expect(computeXFattura(9)).toBe(3)
    expect(computeXFattura(10)).toBe(4)
  })
})

describe('countApparecchiCIVA', () => {
  test('scheda vuota o assente → 0', () => {
    expect(countApparecchiCIVA(undefined)).toBe(0)
    expect(countApparecchiCIVA(null)).toBe(0)
    expect(countApparecchiCIVA({ serbatoi: [] } as unknown as SchedaDatiCompleta)).toBe(0)
  })

  test('conta solo le apparecchiature classificate DICHIARAZIONE o VERIFICA', () => {
    const scheda = {
      // Sotto soglia CIVA (V<25L): esclusa
      serbatoi: [serbatoio(20, 5), serbatoio(500, 11)],
      // V≥50L, PS≤12bar, PS×V>8000: VERIFICA
      scambiatori: [serbatoio(1000, 11)],
      // Manca ps_pressione_max: esclusa (dato incompleto)
      disoleatori: [{ volume: 100 }],
      recipienti_filtro: []
    } as unknown as SchedaDatiCompleta

    expect(countApparecchiCIVA(scheda)).toBe(2)
  })

  test('somma su tutte le categorie di apparecchiature eleggibili', () => {
    const scheda = {
      serbatoi: [serbatoio(500, 11)],
      scambiatori: [serbatoio(500, 11)],
      disoleatori: [serbatoio(500, 11)],
      recipienti_filtro: [serbatoio(500, 11)]
    } as unknown as SchedaDatiCompleta

    expect(countApparecchiCIVA(scheda)).toBe(4)
  })
})
