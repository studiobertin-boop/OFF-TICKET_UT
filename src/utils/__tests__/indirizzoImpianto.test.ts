import { describe, it, expect } from 'vitest'
import { risolviIndirizzoImpianto } from '../indirizzoImpianto'

describe('risolviIndirizzoImpianto', () => {
  it('restituisce l indirizzo della richiesta', () => {
    expect(risolviIndirizzoImpianto('Via Bianchi 7, Mogliano Veneto'))
      .toBe('Via Bianchi 7, Mogliano Veneto')
  })

  it('restituisce stringa vuota quando la fonte e nulla o assente', () => {
    expect(risolviIndirizzoImpianto(null)).toBe('')
    expect(risolviIndirizzoImpianto(undefined)).toBe('')
    expect(risolviIndirizzoImpianto()).toBe('')
  })

  it('tratta una stringa di soli spazi come assente', () => {
    expect(risolviIndirizzoImpianto('   ')).toBe('')
  })

  it('rimuove gli spazi ai bordi', () => {
    expect(risolviIndirizzoImpianto('  Via Roma 1  ')).toBe('Via Roma 1')
  })
})
