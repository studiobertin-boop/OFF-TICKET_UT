import { describe, test, expect } from 'vitest'
import { buildValvole } from '../engine/valvole'
import {
  makeScheda,
  makeCompressore,
  makeDisoleatore,
  makeSerbatoio,
  makeValvola,
  makeAdditionalInfo,
} from './fixtures'

function scenario() {
  return makeScheda({
    compressori: [
      makeCompressore({ codice: 'C1', volume_aria_prodotto: 8350, ha_disoleatore: true }),
      makeCompressore({ codice: 'C2', volume_aria_prodotto: 5600, ha_disoleatore: true }),
    ],
    disoleatori: [
      makeDisoleatore({
        codice: 'C1.1',
        compressore_associato: 'C1',
        ps_pressione_max: 16,
        valvola_sicurezza: makeValvola({ n_fabbrica: '759924/6', volume_aria_scaricato: 10518, pressione_taratura: 14 }),
      }),
      makeDisoleatore({
        codice: 'C2.1',
        compressore_associato: 'C2',
        ps_pressione_max: 16,
        valvola_sicurezza: makeValvola({ n_fabbrica: '759924/2', volume_aria_scaricato: 10518, pressione_taratura: 14 }),
      }),
    ],
    serbatoi: [
      makeSerbatoio({
        codice: 'S1',
        ps_pressione_max: 11.5,
        valvola_sicurezza: makeValvola({ n_fabbrica: '484725/7', volume_aria_scaricato: 32142, pressione_taratura: 10.8 }),
      }),
    ],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
  })
}

describe('buildValvole — tabella portata', () => {
  test('valvola di disoleatore: portata max = portata del compressore associato', () => {
    const { portata } = buildValvole(scenario(), makeAdditionalInfo())
    const c12 = portata.find((r) => r.posValvola === 'C1.2')!
    expect(c12.portataMax).toBe('8350')
    expect(c12.portataScaricata).toBe('10518')
    expect(c12.adeguato).toBe(true)
    expect(c12.connesse.map((a) => a.pos)).toEqual(['C1'])
  })

  test('valvola di serbatoio: portata max = somma dei compressori collegati', () => {
    const { portata } = buildValvole(
      scenario(),
      makeAdditionalInfo({ collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'] } })
    )
    const s11 = portata.find((r) => r.posValvola === 'S1.1')!
    expect(s11.portataMax).toBe('13950') // 8350 + 5600
    expect(s11.connesse.map((a) => a.pos)).toEqual(['C1', 'C2'])
    expect(s11.adeguato).toBe(true) // 13950 <= 32142
  })

  test('"Adeguato" è falso quando la portata da elaborare supera quella scaricata', () => {
    const scheda = scenario()
    scheda.serbatoi[0].valvola_sicurezza.volume_aria_scaricato = 10000
    const { portata } = buildValvole(
      scheda,
      makeAdditionalInfo({ collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'] } })
    )
    const s11 = portata.find((r) => r.posValvola === 'S1.1')!
    expect(s11.adeguato).toBe(false) // 13950 > 10000
  })
})

describe('buildValvole — tabella pressione', () => {
  test('confronta pressione di taratura con PS del recipiente associato', () => {
    const { pressione } = buildValvole(scenario(), makeAdditionalInfo())

    const c12 = pressione.find((r) => r.posValvola === 'C1.2')!
    expect(c12.psRecipiente).toBe('16')
    expect(c12.pressioneTaratura).toBe('14')
    expect(c12.adeguato).toBe(true) // 14 <= 16

    const s11 = pressione.find((r) => r.posValvola === 'S1.1')!
    expect(s11.psRecipiente).toBe('11,5')
    expect(s11.pressioneTaratura).toBe('10,8')
    expect(s11.adeguato).toBe(true) // 10.8 <= 11.5
  })

  test('la connessa in tabella pressione è il recipiente (disoleatore/serbatoio)', () => {
    const { pressione } = buildValvole(scenario(), makeAdditionalInfo())
    expect(pressione.find((r) => r.posValvola === 'C1.2')!.connesse[0].pos).toBe('C1.1')
    expect(pressione.find((r) => r.posValvola === 'S1.1')!.connesse[0].pos).toBe('S1')
  })
})
