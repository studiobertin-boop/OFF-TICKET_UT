import { describe, test, expect } from 'vitest'
import { buildPremessa } from '../engine/premessa'
import { makeCustomer, makeDatiImpianto, makeAdditionalInfo } from './fixtures'

describe('buildPremessa', () => {
  test('formatta la sede legale come "via n° civico, cap comune (provincia)"', () => {
    const premessa = buildPremessa({
      customer: makeCustomer({
        via: 'Via Roma',
        numero_civico: '10',
        cap: '31020',
        comune: 'San Polo di Piave',
        provincia: 'TV',
      }),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo(),
    })

    expect(premessa.sedeLegale).toBe('Via Roma n° 10, 31020 San Polo di Piave (TV)')
  })

  test('quando sede impianto = sede legale, ubicazione usa la medesima sede e sito = sede legale', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto({ sede_imp_uguale_legale: true }),
      additionalInfo: makeAdditionalInfo(),
    })

    expect(premessa.ubicazione).toBe('ubicato presso la medesima sede sociale')
    expect(premessa.sitoProduttivo).toBe(premessa.sedeLegale)
  })

  test('quando sede impianto differisce, ubicazione e sito produttivo usano l\'indirizzo impianto', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto({
        sede_imp_uguale_legale: false,
        sede_impianto: 'Via Industria 5, 31100 Treviso (TV)',
      }),
      additionalInfo: makeAdditionalInfo(),
    })

    expect(premessa.ubicazione).toBe('ubicato in Via Industria 5, 31100 Treviso (TV)')
    expect(premessa.sitoProduttivo).toBe('Via Industria 5, 31100 Treviso (TV)')
  })

  test('è una revisione quando additional_info.motivoRevisione è valorizzato', () => {
    const senza = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ motivoRevisione: undefined }),
    })
    expect(senza.haRevisione).toBe(false)

    const con = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ motivoRevisione: 'sostituzione valvole' }),
    })
    expect(con.haRevisione).toBe(true)
    expect(con.motivoRevisione).toBe('sostituzione valvole')
  })

  test('ha spessimetrica solo se almeno una apparecchiatura è elencata', () => {
    const senza = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ spessimetrica: [] }),
    })
    expect(senza.haSpessimetrica).toBe(false)

    const con = buildPremessa({
      customer: makeCustomer(),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ spessimetrica: ['C1'] }),
    })
    expect(con.haSpessimetrica).toBe(true)
  })

  test('preferisce la descrizione attività di additional_info, con fallback sul cliente', () => {
    const daInfo = buildPremessa({
      customer: makeCustomer({ descrizione_attivita: 'attività cliente' }),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ descrizioneAttivita: 'attività confermata' }),
    })
    expect(daInfo.descrizioneAttivita).toBe('attività confermata')

    const fallback = buildPremessa({
      customer: makeCustomer({ descrizione_attivita: 'attività cliente' }),
      datiImpianto: makeDatiImpianto(),
      additionalInfo: makeAdditionalInfo({ descrizioneAttivita: undefined }),
    })
    expect(fallback.descrizioneAttivita).toBe('attività cliente')
  })
})
