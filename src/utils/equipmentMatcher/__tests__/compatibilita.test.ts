import { describe, test, expect } from 'vitest'
import { confrontaSpecs, eCompatibile, haConferme } from '../compatibilita'
import { SERBATOI_SICC, COMPRESSORI_CECCATO, FILTRI } from './fixtures'

const serbatoio500Tech = SERBATOI_SICC.find((r) => r.id === 'sicc-tech-500')!
const compressoreAbac = COMPRESSORI_CECCATO.find((r) => r.id === 'abac-fono-270')!

describe('confrontaSpecs — serbatoio', () => {
  test('volume e PS uguali confermano', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'volume')?.esito).toBe('conferma')
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(true)
  })

  test('volume diverso diverge', () => {
    const c = confrontaSpecs('serbatoio', { volume: 725, pressione_max: 11 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'volume')?.esito).toBe('diverge')
    expect(eCompatibile(c)).toBe(false)
  })

  test('PS oltre la tolleranza diverge', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11.5 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('diverge')
    expect(eCompatibile(c)).toBe(false)
  })

  test('PS dentro la tolleranza di ±0,05 bar conferma', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11.02 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
  })

  test('un dato non letto non contraddice, ma non conferma', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('non_letto')
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(true)   // il volume conferma
  })

  test('targhetta muta sui dati tecnici: compatibile ma senza conferme', () => {
    const c = confrontaSpecs('serbatoio', {}, serbatoio500Tech)
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(false)
  })

  test('TS non entra mai nel confronto: l\'OCR non lo estrae', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11 }, serbatoio500Tech)
    expect(c.some((x) => x.campo === 'ts')).toBe(false)
  })
})

describe('confrontaSpecs — compressore', () => {
  test('la PS si confronta con specs.pressione_max, non con specs.ps', () => {
    const c = confrontaSpecs('compressore', { pressione_max: 11 }, compressoreAbac)
    expect(c.find((x) => x.campo === 'pressione_max')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
  })

  test('il volume letto non si confronta: l\'OCR del compressore non estrae il FAD', () => {
    const c = confrontaSpecs('compressore', { pressione_max: 11, volume: 999 }, compressoreAbac)
    expect(c.some((x) => x.campo === 'fad')).toBe(false)
    expect(eCompatibile(c)).toBe(true)
  })
})

describe('confrontaSpecs — filtro', () => {
  test('nessun campo confrontabile: compatibile e senza conferme', () => {
    const c = confrontaSpecs('filtro', { pressione_max: 16 }, FILTRI[0])
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(false)
  })
})
