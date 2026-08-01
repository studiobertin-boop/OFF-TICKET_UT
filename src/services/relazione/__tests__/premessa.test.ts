import { describe, test, expect } from 'vitest'
import { buildPremessa } from '../engine/premessa'
import { makeCustomer, makeAdditionalInfo, makePratica } from './fixtures'

const additionalInfo = makeAdditionalInfo()

describe('buildPremessa — anagrafica', () => {
  test('formatta la sede legale come "via n° civico, cap comune (provincia)"', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica(),
      additionalInfo,
    })
    expect(premessa.ragioneSociale).toBe('ACME S.r.l.')
    expect(premessa.sedeLegale).toBe('Via Roma n° 10, 31020 San Polo di Piave (TV)')
  })

  test('preferisce la descrizione attività di additional_info, con fallback sul cliente', () => {
    const daInfo = buildPremessa({
      customer: makeCustomer({ descrizione_attivita: 'attività cliente' }),
      pratica: makePratica(),
      additionalInfo: makeAdditionalInfo({ descrizioneAttivita: 'attività confermata' }),
    })
    expect(daInfo.descrizioneAttivita).toBe('attività confermata')

    const fallback = buildPremessa({
      customer: makeCustomer({ descrizione_attivita: 'attività cliente' }),
      pratica: makePratica(),
      additionalInfo: makeAdditionalInfo({ descrizioneAttivita: undefined }),
    })
    expect(fallback.descrizioneAttivita).toBe('attività cliente')
  })
})

describe('buildPremessa — ubicazione impianto', () => {
  test('impianto presso la sede legale', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({ impiantoUgualeSedeLegale: true }),
      additionalInfo,
    })
    expect(premessa.ubicazione).toBe('ubicato presso la medesima sede sociale')
    expect(premessa.sitoProduttivo).toBe(premessa.sedeLegale)
  })

  test('impianto in indirizzo diverso dalla sede legale', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({
        impiantoUgualeSedeLegale: false,
        indirizzoImpianto: 'Via Industria 5, 31100 Treviso (TV)',
      }),
      additionalInfo,
    })
    expect(premessa.ubicazione).toBe('ubicato in Via Industria 5, 31100 Treviso (TV)')
    expect(premessa.sitoProduttivo).toBe('Via Industria 5, 31100 Treviso (TV)')
  })

  test('aggiunge la denominazione della sala quando valorizzata', () => {
    const premessa = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({
        impiantoUgualeSedeLegale: false,
        indirizzoImpianto: 'Via Toscana 14, Paese (TV)',
        denominazioneSala: 'Padernello Principale',
      }),
      additionalInfo,
    })
    expect(premessa.ubicazione).toBe(
      'ubicato in Via Toscana 14, Paese (TV) ed individuato come Padernello Principale'
    )
  })

  test('ripiega sulla sede legale se l’indirizzo impianto non è dichiarato', () => {
    // 79 pratiche in produzione sono in questo stato: senza indirizzo il documento non
    // deve produrre una clausola tronca. Il preflight segnala il dato mancante a parte.
    const premessa = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({ impiantoUgualeSedeLegale: false, indirizzoImpianto: null }),
      additionalInfo,
    })
    expect(premessa.ubicazione).toBe('ubicato presso la medesima sede sociale')
    expect(premessa.sitoProduttivo).toBe(premessa.sedeLegale)
  })
})

describe('buildPremessa — revisione e spessimetriche', () => {
  test('è una revisione quando il progressivo del codice pratica supera lo zero', () => {
    const prima = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({ progressivo: 0 }),
      additionalInfo,
    })
    expect(prima.haRevisione).toBe(false)

    const revisione = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica({ progressivo: 2 }),
      additionalInfo,
    })
    expect(revisione.haRevisione).toBe(true)
  })

  test('ha spessimetrica solo se almeno una apparecchiatura è elencata', () => {
    const senza = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica(),
      additionalInfo: makeAdditionalInfo({ spessimetrica: [] }),
    })
    expect(senza.haSpessimetrica).toBe(false)

    const con = buildPremessa({
      customer: makeCustomer(),
      pratica: makePratica(),
      additionalInfo: makeAdditionalInfo({ spessimetrica: ['C1'] }),
    })
    expect(con.haSpessimetrica).toBe(true)
  })
})
