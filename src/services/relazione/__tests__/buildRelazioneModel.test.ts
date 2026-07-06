import { describe, test, expect } from 'vitest'
import { buildRelazioneModel } from '../buildRelazioneModel'
import { makeScheda, makeCustomer, makeAdditionalInfo, makeCompressore } from './fixtures'

describe('buildRelazioneModel', () => {
  test('assembla tutte le sezioni del modello', () => {
    const model = buildRelazioneModel({
      scheda: makeScheda(),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer(),
    })

    expect(model.premessa.ragioneSociale).toBe('ACME S.r.l.')
    expect(model.descrizioneGenerale.sezioni.length).toBeGreaterThan(0)
    expect(model.caratteristiche.length).toBeGreaterThan(0)
    expect(model.procedura.length).toBeGreaterThan(0)
    expect(model.classificazione.compressori.alternativa).toBeGreaterThan(0)
    expect(model.valvole.portata.length + model.valvole.pressione.length).toBeGreaterThan(0)
    expect(model.allegati.length).toBeGreaterThan(0)
  })

  test('propaga il resolver del costruttore a tutte le tabelle', () => {
    const model = buildRelazioneModel({
      scheda: makeScheda({
        compressori: [makeCompressore({ codice: 'C1', marca: 'KAESER', ha_disoleatore: false })],
        disoleatori: [],
        serbatoi: [],
        essiccatori: [],
        scambiatori: [],
        filtri: [],
      }),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer(),
      resolveCostruttore: (m) => (m === 'KAESER' ? 'KAESER KOMPRESSOREN SE' : m ?? ''),
    })

    expect(model.caratteristiche.find((r) => r.pos === 'C1')!.costruttore).toBe(
      'KAESER KOMPRESSOREN SE'
    )
    expect(model.procedura.find((r) => r.pos === 'C1')!.costruttore).toBe('KAESER KOMPRESSOREN SE')
  })
})
