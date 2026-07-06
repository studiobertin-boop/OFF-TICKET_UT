import { describe, test, expect } from 'vitest'
import { buildProceduraDM329 } from '../engine/proceduraDM329'
import {
  makeScheda,
  makeCompressore,
  makeDisoleatore,
  makeSerbatoio,
  makeEssiccatore,
  makeScambiatore,
  makeFiltro,
  makeRecipienteFiltro,
  makeSeparatore,
  makeValvola,
} from './fixtures'

describe('buildProceduraDM329 — compressori', () => {
  test('compressore senza disoleatore: una sola riga, nessun flag', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const righe = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('C'))
    expect(righe).toHaveLength(1)
    expect(righe[0]).toMatchObject({ pos: 'C1', dichiarazione: false, verifica: false })
  })

  test('compressore con disoleatore: gruppo C1/C1.1/C1.2 tutto in Verifica', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: true })],
      disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const righe = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('C'))
    expect(righe.map((r) => r.pos)).toEqual(['C1', 'C1.1', 'C1.2'])
    expect(righe.every((r) => r.verifica === true && r.dichiarazione === false)).toBe(true)
  })
})

describe('buildProceduraDM329 — serbatoi', () => {
  test('serbatoio con PS×V > 8000 → Verifica (serbatoio + valvola)', () => {
    const scheda = makeScheda({
      compressori: [],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ codice: 'S1', volume: 2000, ps_pressione_max: 11.5 })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const righe = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('S'))
    expect(righe.map((r) => r.pos)).toEqual(['S1', 'S1.1'])
    expect(righe.every((r) => r.verifica === true && r.dichiarazione === false)).toBe(true)
  })

  test('serbatoio con PS×V ≤ 8000 → Dichiarazione (serbatoio + valvola)', () => {
    const scheda = makeScheda({
      compressori: [],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ codice: 'S1', volume: 270, ps_pressione_max: 11 })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const righe = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('S'))
    expect(righe.every((r) => r.dichiarazione === true && r.verifica === false)).toBe(true)
  })
})

describe('buildProceduraDM329 — essiccatori e filtri', () => {
  test('essiccatore con scambiatore → Verifica su entrambi; filtro con recipiente → Verifica', () => {
    const scheda = makeScheda({
      compressori: [],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [makeEssiccatore({ codice: 'E1', ha_scambiatore: true })],
      scambiatori: [makeScambiatore({ codice: 'E1.1', essiccatore_associato: 'E1' })],
      filtri: [makeFiltro({ codice: 'F1', ha_recipiente: true })],
      recipienti_filtro: [makeRecipienteFiltro({ codice: 'F1.1', filtro_associato: 'F1' })],
    })
    const righeE = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('E'))
    expect(righeE.map((r) => r.pos)).toEqual(['E1', 'E1.1'])
    expect(righeE.every((r) => r.verifica === true)).toBe(true)

    const righeF = buildProceduraDM329(scheda).filter((r) => r.pos.startsWith('F'))
    expect(righeF.map((r) => r.pos)).toEqual(['F1', 'F1.1'])
    expect(righeF.every((r) => r.verifica === true)).toBe(true)
  })

  test('filtro senza recipiente e separatore: nessun flag', () => {
    const scheda = makeScheda({
      compressori: [],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [makeFiltro({ codice: 'F1', ha_recipiente: false })],
      recipienti_filtro: [],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
    })
    const righe = buildProceduraDM329(scheda)
    const f1 = righe.find((r) => r.pos === 'F1')!
    const sep = righe.find((r) => r.pos === 'SEP1')!
    expect(f1).toMatchObject({ dichiarazione: false, verifica: false })
    expect(sep).toMatchObject({ dichiarazione: false, verifica: false })
  })
})

describe('buildProceduraDM329 — costruttore risolto', () => {
  test('usa il resolver per il nome completo del costruttore', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', marca: 'KAESER', ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const righe = buildProceduraDM329(scheda, {
      resolveCostruttore: (marca) => (marca === 'KAESER' ? 'KAESER KOMPRESSOREN SE' : marca ?? ''),
    })
    expect(righe.find((r) => r.pos === 'C1')!.costruttore).toBe('KAESER KOMPRESSOREN SE')
  })
})
