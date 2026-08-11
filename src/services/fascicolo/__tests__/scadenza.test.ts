import { describe, test, expect } from 'vitest'
import {
  dataCancellazione, statoScadenza,
  GIORNI_DOPO_CHIUSURA, GIORNI_SENZA_MOVIMENTO, GIORNI_PREAVVISO,
  type MovimentoPratica,
} from '../scadenza'

const ADESSO = new Date('2026-08-11T12:00:00Z')

/** Data ISO di N giorni fa rispetto ad ADESSO. */
const giorniFa = (n: number) => new Date(ADESSO.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

/** Pratica con lo stato dato, ferma da `fermaDa` giorni sia di stato sia di modifiche. */
const pratica = (stato: string, fermaDa: number, modificataDa = fermaDa): MovimentoPratica => ({
  stato,
  ultimoCambioStato: giorniFa(fermaDa),
  aggiornataIl: giorniFa(modificataDa),
  creataIl: giorniFa(fermaDa + 400),
})

/** Giorni che mancano alla cancellazione, arrotondati come fa statoScadenza. */
const mancano = (p: MovimentoPratica) => statoScadenza(p, ADESSO).giorniMancanti

describe('dataCancellazione', () => {
  test('una pratica chiusa scade 30 giorni dopo il passaggio in 7-CHIUSA', () => {
    expect(mancano(pratica('7-CHIUSA', 29))).toBe(1)
    expect(mancano(pratica('7-CHIUSA', 30))).toBe(0)
    expect(mancano(pratica('7-CHIUSA', 31))).toBe(-1)
  })

  test('«ARCHIVIATA NON FINITA» conta come chiusa, spazi compresi', () => {
    expect(statoScadenza(pratica('ARCHIVIATA NON FINITA', 31), ADESSO).scaduta).toBe(true)
    expect(statoScadenza(pratica('ARCHIVIATA NON FINITA', 29), ADESSO).scaduta).toBe(false)
  })

  test('COMPLETATA non avvia il conto dei 30 giorni: resta sotto i soli 180', () => {
    expect(statoScadenza(pratica('COMPLETATA', 31), ADESSO).scaduta).toBe(false)
    expect(mancano(pratica('COMPLETATA', 31))).toBe(GIORNI_SENZA_MOVIMENTO - 31)
  })

  test('una pratica viva scade dopo 180 giorni di immobilità', () => {
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 179))).toBe(1)
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 180))).toBe(0)
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 181))).toBe(-1)
  })

  test('una modifica senza cambio di stato sposta in avanti i 180 giorni', () => {
    // Ferma di stato da 179 giorni ma ritoccata ieri: il conto riparte da ieri.
    expect(mancano(pratica('4-DOCUMENTI_PRONTI', 179, 1))).toBe(GIORNI_SENZA_MOVIMENTO - 1)
  })

  test('su una pratica chiusa vince il minimo: ritoccarla non allunga i 30 giorni', () => {
    expect(mancano(pratica('7-CHIUSA', 29, 0))).toBe(1)
  })

  test('riaperta, torna sotto i soli 180 giorni', () => {
    expect(statoScadenza(pratica('1-INCARICO_RICEVUTO', 0), ADESSO).scaduta).toBe(false)
    expect(mancano(pratica('1-INCARICO_RICEVUTO', 0))).toBe(GIORNI_SENZA_MOVIMENTO)
  })

  test('senza righe di storia si ripiega sulla data di creazione', () => {
    const senzaStoria: MovimentoPratica = {
      stato: '7-CHIUSA',
      ultimoCambioStato: null,
      aggiornataIl: null,
      creataIl: giorniFa(45),
    }
    expect(statoScadenza(senzaStoria, ADESSO).scaduta).toBe(true)
    expect(mancano(senzaStoria)).toBe(GIORNI_DOPO_CHIUSURA - 45)
  })

  test('il preavviso si accende negli ultimi 7 giorni e non dopo la scadenza', () => {
    expect(statoScadenza(pratica('7-CHIUSA', 22), ADESSO).inPreavviso).toBe(false)
    expect(statoScadenza(pratica('7-CHIUSA', 23), ADESSO).inPreavviso).toBe(true)
    expect(statoScadenza(pratica('7-CHIUSA', 30), ADESSO).inPreavviso).toBe(true)
    expect(statoScadenza(pratica('7-CHIUSA', 31), ADESSO).inPreavviso).toBe(false)
  })

  test('GIORNI_PREAVVISO è la soglia dichiarata, non un numero scritto altrove', () => {
    const alLimite = pratica('7-CHIUSA', GIORNI_DOPO_CHIUSURA - GIORNI_PREAVVISO)
    expect(statoScadenza(alLimite, ADESSO).giorniMancanti).toBe(GIORNI_PREAVVISO)
    expect(statoScadenza(alLimite, ADESSO).inPreavviso).toBe(true)
  })

  test('dataCancellazione ritorna una data, non solo un conteggio', () => {
    const p = pratica('7-CHIUSA', 10)
    const attesa = new Date(Date.parse(p.ultimoCambioStato!) + GIORNI_DOPO_CHIUSURA * 24 * 60 * 60 * 1000)
    expect(dataCancellazione(p).toISOString()).toBe(attesa.toISOString())
  })

  test('giorniMancanti è 0, non -0, quando scaduta da pochi secondi', () => {
    // Math.round produce -0 quando il valore è negativo ma < 0.5 in valore assoluto.
    // Questo accade quando una pratica è scaduta da poche ore (< 12 ore).
    const adesso = new Date('2026-08-11T12:00:01Z') // 1 secondo dopo i 30 giorni
    const p: MovimentoPratica = {
      stato: '7-CHIUSA',
      ultimoCambioStato: '2026-07-12T12:00:00Z', // Esattamente 30 giorni prima di adesso
      aggiornataIl: null,
      creataIl: '2025-12-12T12:00:00Z',
    }
    const stato = statoScadenza(p, adesso)
    // Object.is distingue 0 da -0
    expect(Object.is(stato.giorniMancanti, 0)).toBe(true)
    expect(stato.scaduta).toBe(true)
    expect(stato.inPreavviso).toBe(true)
  })
})
