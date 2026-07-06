import { describe, test, expect } from 'vitest'
import { buildCaratteristiche } from '../engine/caratteristiche'
import {
  makeScheda,
  makeCompressore,
  makeDisoleatore,
  makeSerbatoio,
  makeScambiatore,
  makeEssiccatore,
  makeValvola,
} from './fixtures'

const soloCompressore = () =>
  makeScheda({
    compressori: [makeCompressore({ codice: 'C1', volume_aria_prodotto: 8350, pressione_max: 12 })],
    disoleatori: [
      makeDisoleatore({
        codice: 'C1.1',
        compressore_associato: 'C1',
        volume: 75,
        ps_pressione_max: 16,
        ts_temperatura: 120,
        categoria_ped: 'III',
        valvola_sicurezza: makeValvola({
          n_fabbrica: '759924/6',
          volume_aria_scaricato: 10518,
          pressione_taratura: 14,
          ts_temperatura: 200,
        }),
      }),
    ],
    serbatoi: [],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
  })

describe('buildCaratteristiche', () => {
  test('compressore: colonna capacità = aria producibile (FAD), pressione = pressione massima, temperatura vuota', () => {
    const rows = buildCaratteristiche(soloCompressore())
    const c1 = rows.find((r) => r.pos === 'C1')!
    expect(c1.capacita).toBe('8350')
    expect(c1.pressione).toBe('12')
    expect(c1.temperatura).toBe('')
  })

  test('disoleatore: capacità = volume, temperatura = "-10 ÷ +120", categoria dal PED', () => {
    const rows = buildCaratteristiche(soloCompressore())
    const d = rows.find((r) => r.pos === 'C1.1')!
    expect(d.capacita).toBe('75')
    expect(d.temperatura).toBe('-10 ÷ +120')
    expect(d.categoria).toBe('III')
  })

  test('valvola: capacità = portata scaricata, pressione = pressione di taratura', () => {
    const rows = buildCaratteristiche(soloCompressore())
    const v = rows.find((r) => r.pos === 'C1.2')!
    expect(v.capacita).toBe('10518')
    expect(v.pressione).toBe('14')
    expect(v.temperatura).toBe('-10 ÷ +200')
  })

  test('scambiatore: temperatura con minimo convenzionale -20', () => {
    const rows = buildCaratteristiche(
      makeScheda({
        compressori: [],
        disoleatori: [],
        serbatoi: [],
        essiccatori: [makeEssiccatore({ codice: 'E1', ha_scambiatore: true })],
        scambiatori: [
          makeScambiatore({ codice: 'E1.1', essiccatore_associato: 'E1', ts_temperatura: 120 }),
        ],
        filtri: [],
      })
    )
    const s = rows.find((r) => r.pos === 'E1.1')!
    expect(s.temperatura).toBe('-20 ÷ +120')
  })

  test('mantiene l\'ordine canonico compressori → serbatoi → essiccatori', () => {
    const rows = buildCaratteristiche(
      makeScheda({
        compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
        disoleatori: [],
        serbatoi: [makeSerbatoio({ codice: 'S1' })],
        essiccatori: [makeEssiccatore({ codice: 'E1', ha_scambiatore: false })],
        scambiatori: [],
        filtri: [],
      })
    )
    expect(rows.map((r) => r.pos)).toEqual(['C1', 'S1', 'S1.1', 'E1'])
  })
})
