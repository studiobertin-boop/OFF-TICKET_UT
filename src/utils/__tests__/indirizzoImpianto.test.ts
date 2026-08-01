import { describe, it, expect } from 'vitest'
import { risolviIndirizzoImpianto } from '../indirizzoImpianto'

describe('risolviIndirizzoImpianto', () => {
  it('usa requests.indirizzo_impianto quando valorizzato', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: 'Via Bianchi 7, Mogliano Veneto',
      indirizzoSchedaLegacy: 'VIA VECCHIA 1',
      sedeImpiantoLegacy: 'VIA VECCHISSIMA 2',
    })).toBe('Via Bianchi 7, Mogliano Veneto')
  })

  it('ripiega sulla colonna legacy della scheda quando la richiesta e vuota', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: '   ',
      indirizzoSchedaLegacy: 'VIA E.FERMI 75, 36028 ROSSANO V.TO, (VI)',
      sedeImpiantoLegacy: 'VIA VECCHISSIMA 2',
    })).toBe('VIA E.FERMI 75, 36028 ROSSANO V.TO, (VI)')
  })

  it('ripiega su dati_impianto.sede_impianto quando gli altri due sono vuoti', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: null,
      indirizzoSchedaLegacy: undefined,
      sedeImpiantoLegacy: 'VIA SCHIAVONESCA 89, 31030 CASELLE D\'ALTIVOLE, (TV)',
    })).toBe('VIA SCHIAVONESCA 89, 31030 CASELLE D\'ALTIVOLE, (TV)')
  })

  it('restituisce stringa vuota quando non c\'e nessuna fonte', () => {
    expect(risolviIndirizzoImpianto({})).toBe('')
  })

  it('rimuove gli spazi ai bordi del valore scelto', () => {
    expect(risolviIndirizzoImpianto({ indirizzoRichiesta: '  Via Roma 1  ' })).toBe('Via Roma 1')
  })
})
