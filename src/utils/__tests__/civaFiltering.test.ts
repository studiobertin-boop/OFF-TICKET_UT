import { describe, it, expect } from 'vitest'
import { filterCIVAEquipment, extractManufacturerNames } from '../civaFiltering'
import { descrizioneSerbatoioGeneratore } from '@/types/technicalSheet'
import type { SchedaDatiCompleta } from '@/types'

const costruttore = { id: 'm1', name: 'ACME' } as any
const costruttori = new Map<string, any>([['ACME', costruttore]])

const ns1 = {
  codice: 'NS1',
  generatore_associato: 'N1',
  marca: 'ACME',
  modello: 'X',
  n_fabbrica: '123',
  volume: 270,
  ps_pressione_max: 11,
} as any

describe('CIVA: serbatoi interni del generatore di azoto', () => {
  it('NS1 con adempimento compare fra le apparecchiature con costruttore e descrizione', () => {
    const r = filterCIVAEquipment({ serbatoi_generatore: [ns1] } as unknown as SchedaDatiCompleta, costruttori)
    const tutte = [...r.dichiarazioni, ...r.verifiche]
    expect(tutte).toHaveLength(1)
    expect(tutte[0].codice).toBe('NS1')
    expect(tutte[0].manufacturer).toBe(costruttore)
    expect(tutte[0].descrizione).toBe(descrizioneSerbatoioGeneratore(ns1))
    expect(tutte[0].descrizione).toBe('Serbatoio interno generatore di azoto N1')
    expect(tutte[0].parentCodice).toBe('N1')
  })

  it('NS1 senza adempimento (sotto soglia) non compare', () => {
    const r = filterCIVAEquipment(
      { serbatoi_generatore: [{ ...ns1, volume: 20 }] } as unknown as SchedaDatiCompleta,
      costruttori
    )
    expect(r.dichiarazioni).toHaveLength(0)
    expect(r.verifiche).toHaveLength(0)
  })

  it('le marche dei serbatoi interni entrano nell\'elenco dei costruttori da caricare', () => {
    expect(extractManufacturerNames({ serbatoi_generatore: [ns1] } as unknown as SchedaDatiCompleta)).toEqual(['ACME'])
  })

  it('con gli array nuovi assenti il risultato è quello di sempre', () => {
    const base = { serbatoi: [{ codice: 'S1', marca: 'ACME', volume: 500, ps_pressione_max: 11 }] } as any
    const r = filterCIVAEquipment(base as SchedaDatiCompleta, costruttori)
    expect([...r.dichiarazioni, ...r.verifiche].map((a) => a.codice)).toEqual(['S1'])
    expect(extractManufacturerNames(base)).toEqual(['ACME'])
  })
})
