import { describe, test, expect } from 'vitest'
import { buildDescrizioneGenerale } from '../engine/descrizioneGenerale'
import {
  makeScheda,
  makeCompressore,
  makeSerbatoio,
  makeEssiccatore,
  makeFiltro,
  makeSeparatore,
  makeDatiImpianto,
  makeAdditionalInfo,
} from './fixtures'

describe('buildDescrizioneGenerale — sezioni principali', () => {
  test('pompaggio: singolare con 1 compressore, giri variabili', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
    })
    const model = buildDescrizioneGenerale(scheda, makeAdditionalInfo({ compressoriGiri: { C1: 'variabili' } }))
    expect(model.sezioni[0]).toBe(
      'Sezione di pompaggio costituita da n°1 compressore rotativo a vite a giri variabili tramite inverter'
    )
  })

  test('pompaggio: plurale con più compressori, giri fissi', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' }), makeCompressore({ codice: 'C2' })],
    })
    const model = buildDescrizioneGenerale(
      scheda,
      makeAdditionalInfo({ compressoriGiri: { C1: 'fissi', C2: 'fissi' } })
    )
    expect(model.sezioni[0]).toBe(
      'Sezione di pompaggio costituita da n°2 compressori rotativi a vite a giri fissi'
    )
  })

  test('accumulo e trattamento: plurali coerenti col conteggio', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ codice: 'S1' }), makeSerbatoio({ codice: 'S2' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      filtri: [makeFiltro({ codice: 'F1' }), makeFiltro({ codice: 'F2' })],
    })
    const model = buildDescrizioneGenerale(scheda, makeAdditionalInfo())
    expect(model.sezioni[1]).toBe(
      'Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°2 serbatoi polmone verticali'
    )
    expect(model.sezioni[2]).toBe(
      "Sezione trattamento aria costituita da n°1 essiccatore d'aria a ciclo frigorifero e n°2 filtri di linea"
    )
  })

  test('la riga separatore compare solo se esiste un separatore', () => {
    const senza = buildDescrizioneGenerale(makeScheda({ separatori: [] }), makeAdditionalInfo())
    expect(senza.sezioni.some((s) => s.includes('separatore acqua olio'))).toBe(false)

    const con = buildDescrizioneGenerale(
      makeScheda({ separatori: [makeSeparatore()] }),
      makeAdditionalInfo()
    )
    expect(con.sezioni.some((s) => s.includes('separatore acqua olio'))).toBe(true)
  })
})

describe('buildDescrizioneGenerale — area di installazione', () => {
  test('include gli attributi di area in base ai flag', () => {
    const model = buildDescrizioneGenerale(
      makeScheda({
        dati_impianto: makeDatiImpianto({ locale_dedicato: true, accesso_locale_vietato: true }),
      }),
      makeAdditionalInfo()
    )
    expect(model.fraseArea).toBe(
      "L'impianto è alloggiato entro un'area appositamente predisposta, accessibile solo al personale autorizzato, correttamente areata e lontana da sorgenti di calore."
    )
    expect(model.haLocaleDedicato).toBe(true)
    expect(model.paragrafoLocaleDedicato).not.toBe('')
  })

  test('senza flag: nessun attributo di area e nessun paragrafo locale dedicato', () => {
    const model = buildDescrizioneGenerale(
      makeScheda({
        dati_impianto: makeDatiImpianto({ locale_dedicato: false, accesso_locale_vietato: false }),
      }),
      makeAdditionalInfo()
    )
    expect(model.fraseArea).toBe(
      "L'impianto è alloggiato entro un'area correttamente areata e lontana da sorgenti di calore."
    )
    expect(model.haLocaleDedicato).toBe(false)
    expect(model.paragrafoLocaleDedicato).toBe('')
  })
})
