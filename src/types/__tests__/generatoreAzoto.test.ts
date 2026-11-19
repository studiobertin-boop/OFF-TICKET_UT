import { describe, test, expect } from 'vitest'
import {
  ARRAY_RECIPIENTI,
  MAX_SERBATOI_PER_GENERATORE,
  descrizioneSerbatoioGeneratore,
  puoAggiungereSerbatoioGeneratore,
  serbatoiDelGeneratore,
} from '@/types/technicalSheet'

const ns = (codice: string, gen: string) => ({ codice, generatore_associato: gen }) as any

describe('helper del generatore di azoto', () => {
  test('descrizioneSerbatoioGeneratore cita il codice del generatore', () => {
    expect(descrizioneSerbatoioGeneratore(ns('NS1', 'N2'))).toBe('Serbatoio interno generatore di azoto N2')
  })

  test('ARRAY_RECIPIENTI elenca i cinque array dei recipienti', () => {
    expect([...ARRAY_RECIPIENTI]).toEqual([
      'serbatoi', 'disoleatori', 'scambiatori', 'recipienti_filtro', 'serbatoi_generatore',
    ])
  })

  test('serbatoiDelGeneratore filtra per generatore e tollera l\'array assente', () => {
    const scheda: any = { serbatoi_generatore: [ns('NS1', 'N1'), ns('NS2', 'N2'), ns('NS3', 'N1')] }
    expect(serbatoiDelGeneratore(scheda, 'N1').map((s) => s.codice)).toEqual(['NS1', 'NS3'])
    expect(serbatoiDelGeneratore({} as any, 'N1')).toEqual([])
  })

  test('puoAggiungereSerbatoioGeneratore è falso a 8 serbatoi su N1 e vero su N2 vuoto', () => {
    const serbatoi = Array.from({ length: MAX_SERBATOI_PER_GENERATORE }, (_, i) => ns(`NS${i + 1}`, 'N1'))
    const scheda: any = { serbatoi_generatore: serbatoi }
    expect(puoAggiungereSerbatoioGeneratore(scheda, 'N1')).toBe(false)
    expect(puoAggiungereSerbatoioGeneratore(scheda, 'N2')).toBe(true)
  })

  test('puoAggiungereSerbatoioGeneratore è falso a 24 serbatoi complessivi', () => {
    const serbatoi = ['N1', 'N2', 'N3'].flatMap((g, gi) =>
      Array.from({ length: 8 }, (_, i) => ns(`NS${gi * 8 + i + 1}`, g))
    )
    expect(puoAggiungereSerbatoioGeneratore({ serbatoi_generatore: serbatoi } as any, 'N3')).toBe(false)
  })

  test('senza serbatoi si può aggiungere', () => {
    expect(puoAggiungereSerbatoioGeneratore({} as any, 'N1')).toBe(true)
  })
})
