import { describe, test, expect } from 'vitest'
import { classificaDaNome } from '../euristica'
import type { ContestoFascicolo } from '../types'

const CONTESTO: ContestoFascicolo = {
  apparecchiatura: { codice: 'C1.1', tipo: 'disoleatore', marca: 'ALUP', modello: 'D50', n_fabbrica: '12345' },
  valvole: [{ codice: 'C1.2', tipo: 'valvola', marca: 'BESA', pressione: 11 }],
  principale: { codice: 'C1', tipo: 'compressore', marca: 'ALUP', modello: 'SCK 25', n_fabbrica: '98765' },
}

const nome = (n: string, immagine = false) => classificaDaNome({ id: n, nome: n, immagine }, CONTESTO)

describe('classificaDaNome', () => {
  test('riconosce un certificato dalle parole con cui lo si intitola', () => {
    expect(nome('dichiarazione_conformita.pdf').ruoli).toEqual(['CERT_APPARECCHIATURA'])
    expect(nome('Certificato CE.pdf').ruoli).toEqual(['CERT_APPARECCHIATURA'])
  })

  test('riconosce le istruzioni', () => {
    expect(nome('manuale uso e manutenzione.pdf').ruoli).toEqual(['ISTR_APPARECCHIATURA'])
    expect(nome('libretto_istruzioni.pdf').ruoli).toEqual(['ISTR_APPARECCHIATURA'])
  })

  test('un file che si annuncia come entrambi copre entrambi i ruoli', () => {
    expect(nome('certificato e istruzioni.pdf').ruoli)
      .toEqual(['CERT_APPARECCHIATURA', 'ISTR_APPARECCHIATURA'])
  })

  test('attribuisce alla valvola i documenti che la nominano', () => {
    const esito = nome('certificato valvola sicurezza.pdf')
    expect(esito.ruoli).toEqual(['CERT_VALVOLA'])
    expect(esito.valvola).toBe('C1.2')
  })

  test('attribuisce all’apparecchiatura principale i documenti che portano i suoi dati', () => {
    // Il nome cita il modello del compressore, non quello del disoleatore.
    expect(nome('dichiarazione CE SCK 25.pdf').ruoli).toEqual(['CERT_PRINCIPALE'])
    expect(nome('targhetta C1.jpg', true).ruoli).toEqual(['FOTO_TARGHETTA_PRINCIPALE'])
  })

  test('una foto senza altri indizi è la targhetta dell’apparecchiatura', () => {
    expect(nome('IMG_2049.jpg', true).ruoli).toEqual(['FOTO_TARGHETTA'])
  })

  test('un PDF che dice targhetta è la foto, non un certificato', () => {
    expect(nome('foto targhetta serbatoio.pdf').ruoli).toEqual(['FOTO_TARGHETTA'])
  })

  test('un nome che non dice niente resta senza ruolo, da assegnare a mano', () => {
    const esito = nome('scan0001.pdf')
    expect(esito.ruoli).toEqual([])
    expect(esito.confidenza).toBe(0)
  })

  test('dichiara sempre di essere una supposizione', () => {
    expect(nome('certificato.pdf').origine).toBe('euristica')
    expect(nome('certificato.pdf').motivazione).toBeTruthy()
  })

  test('senza apparecchiatura principale non attribuisce nulla a un’apparecchiatura che non c’è', () => {
    const solo: ContestoFascicolo = { ...CONTESTO, principale: null }
    const esito = classificaDaNome({ id: 'x', nome: 'dichiarazione CE SCK 25.pdf', immagine: false }, solo)
    expect(esito.ruoli).toEqual(['CERT_APPARECCHIATURA'])
  })
})
