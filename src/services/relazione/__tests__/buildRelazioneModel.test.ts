import { describe, test, expect } from 'vitest'
import { buildRelazioneModel } from '../buildRelazioneModel'
import {
  makeScheda,
  makeCustomer,
  makeAdditionalInfo,
  makeCompressore,
  makePratica,
} from './fixtures'

describe('buildRelazioneModel', () => {
  test('assembla tutte le sezioni del modello', () => {
    const model = buildRelazioneModel({
      scheda: makeScheda(),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer(),
      pratica: makePratica(),
    })

    expect(model.premessa.ragioneSociale).toBe('ACME S.r.l.')
    expect(model.descrizioneGenerale.sezioni.length).toBeGreaterThan(0)
    // Il numero di righe varia: quella sull'accesso riservato compare solo se il flag
    // è attivo, e la fixture non lo imposta.
    expect(model.condizioniInstallazione.length).toBeGreaterThan(0)
    expect(model.fluidi.righe.length).toBeGreaterThan(0)
    expect(model.caratteristiche.length).toBeGreaterThan(0)
    expect(model.esiti.length).toBeGreaterThan(0)
    expect(model.protezioni.serbatoi.length).toBeGreaterThan(0)
    expect(model.tubazioni.escluse).toBe(true)
    expect(model.riqualificazione.length).toBeGreaterThan(0)
    expect(model.valvole.portata.length + model.valvole.pressione.length).toBeGreaterThan(0)
    expect(model.allegati.length).toBeGreaterThan(0)
  })

  test('la riqualificazione periodica resta coerente con la tabella degli esiti', () => {
    const model = buildRelazioneModel({
      scheda: makeScheda(),
      additionalInfo: makeAdditionalInfo(),
      customer: makeCustomer(),
      pratica: makePratica(),
    })
    // Nessuna scadenza può riferirsi a una posizione che non compare fra gli esiti.
    const posEsiti = new Set(model.esiti.map((e) => e.pos))
    expect(model.riqualificazione.every((r) => posEsiti.has(r.pos))).toBe(true)
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
      pratica: makePratica(),
      resolveCostruttore: (m) => (m === 'KAESER' ? 'KAESER KOMPRESSOREN SE' : m ?? ''),
    })

    expect(model.caratteristiche.find((r) => r.pos === 'C1')!.costruttore).toBe(
      'KAESER KOMPRESSOREN SE'
    )
    expect(model.esiti.find((r) => r.pos === 'C1')!.costruttore).toBe('KAESER KOMPRESSOREN SE')
  })
})
