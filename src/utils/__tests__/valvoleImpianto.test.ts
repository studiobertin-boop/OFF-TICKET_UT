import { describe, test, expect } from 'vitest'
import { elencaValvole } from '@/utils/valvoleImpianto'

const valvola = (n: string) => ({ marca: 'M', modello: n }) as any

describe('elencaValvole con i serbatoi interni del generatore', () => {
  test('NS1 con valvola principale e una aggiuntiva dà NS1.1 e NS1.2', () => {
    const out = elencaValvole({
      serbatoi_generatore: [
        {
          codice: 'NS1',
          generatore_associato: 'N1',
          valvola_sicurezza: valvola('a'),
          valvole_aggiuntive: [valvola('b')],
        },
      ],
    } as any)
    expect(out.map((v) => v.pos)).toEqual(['NS1.1', 'NS1.2'])
    expect(out.every((v) => v.recipiente === 'NS1')).toBe(true)
  })

  test('le valvole dei serbatoi interni seguono quelle dei serbatoi, per generatore', () => {
    const out = elencaValvole({
      serbatoi: [{ codice: 'S1', valvola_sicurezza: valvola('s') }],
      generatori_azoto: [{ codice: 'N1' }, { codice: 'N2' }],
      serbatoi_generatore: [
        { codice: 'NS2', generatore_associato: 'N2', valvola_sicurezza: valvola('x') },
        { codice: 'NS1', generatore_associato: 'N1', valvola_sicurezza: valvola('y') },
      ],
    } as any)
    expect(out.map((v) => v.pos)).toEqual(['S1.1', 'NS1.1', 'NS2.1'])
  })

  test('una scheda senza i due array dà lo stesso elenco di sempre', () => {
    const out = elencaValvole({
      serbatoi: [{ codice: 'S1', valvola_sicurezza: valvola('s') }],
    } as any)
    expect(out.map((v) => v.pos)).toEqual(['S1.1'])
  })
})

describe('elencaValvole: serbatoi interni fuori ordine', () => {
  test('a parità di generatore si ordina per numero NS', () => {
    const out = elencaValvole({
      serbatoi_generatore: [
        { codice: 'NS4', generatore_associato: 'N2', valvola_sicurezza: valvola('d') },
        { codice: 'NS1', generatore_associato: 'N1', valvola_sicurezza: valvola('a') },
        { codice: 'NS3', generatore_associato: 'N1', valvola_sicurezza: valvola('c') },
        { codice: 'NS2', generatore_associato: 'N1', valvola_sicurezza: valvola('b') },
      ],
    } as any)
    expect(out.map((v) => v.pos)).toEqual(['NS1.1', 'NS2.1', 'NS3.1', 'NS4.1'])
  })
})
