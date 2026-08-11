import { describe, test, expect } from 'vitest'
import { risolviSitoProduttivo } from '../sitoProduttivo'

describe('risolviSitoProduttivo', () => {
  test('usa l’indirizzo libero quando dichiarato esplicitamente diverso dalla sede legale', () => {
    const risultato = risolviSitoProduttivo({
      impiantoUgualeSedeLegale: false,
      indirizzoImpianto: 'Via Leonardo Da Vinci, n.3 - 31021 Mogliano Veneto (TV)',
      customer: { via: 'Via Sede', numero_civico: '1', cap: '31100', comune: 'Treviso', provincia: 'TV' },
    })
    expect(risultato).toBe('Via Leonardo Da Vinci, n.3 - 31021 Mogliano Veneto (TV)')
  })

  test('usa la sede legale del cliente quando impianto e sede coincidono', () => {
    const risultato = risolviSitoProduttivo({
      impiantoUgualeSedeLegale: true,
      indirizzoImpianto: null,
      customer: { via: 'Via Esempio', numero_civico: '1', cap: '31013', comune: 'Codognè', provincia: 'TV' },
    })
    expect(risultato).toBe('Via Esempio n.1 - 31013 Codognè (TV)')
  })

  test('ripiega sulla sede legale quando l’indirizzo impianto manca, anche senza il flag esplicito', () => {
    const risultato = risolviSitoProduttivo({
      impiantoUgualeSedeLegale: null,
      indirizzoImpianto: '',
      customer: { via: 'Via Esempio', numero_civico: '1', cap: '31013', comune: 'Codognè', provincia: 'TV' },
    })
    expect(risultato).toBe('Via Esempio n.1 - 31013 Codognè (TV)')
  })

  test('senza cliente e senza indirizzo libero restituisce una stringa vuota, non un’eccezione', () => {
    expect(risolviSitoProduttivo({ impiantoUgualeSedeLegale: true, indirizzoImpianto: null, customer: null })).toBe('')
  })
})
