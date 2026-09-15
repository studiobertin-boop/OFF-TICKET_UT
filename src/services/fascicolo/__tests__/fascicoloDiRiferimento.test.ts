import { describe, test, expect } from 'vitest'
import { codiceDelFascicolo } from '../fascicoloDiRiferimento'

const SCHEDA = {
  disoleatori: [{ codice: 'C1.1', compressore_associato: 'C1' }],
  scambiatori: [
    { codice: 'E1.1', essiccatore_associato: 'E1' },
    { codice: 'E2.1', essiccatore_associato: 'E2' },
    { codice: 'E2.2', essiccatore_associato: 'E2' },
  ],
  recipienti_filtro: [{ codice: 'F1.1', filtro_associato: 'F1' }],
}

describe('codiceDelFascicolo', () => {
  test('il fascicolo generato sulla collegata vale per lei', () => {
    expect(codiceDelFascicolo('E1.1', new Set(['E1.1']), SCHEDA)).toBe('E1.1')
    expect(codiceDelFascicolo('C1.1', new Set(['C1.1']), SCHEDA)).toBe('C1.1')
  })

  test('il fascicolo generato sulla principale vale per la sua unica collegata', () => {
    expect(codiceDelFascicolo('E1.1', new Set(['E1']), SCHEDA)).toBe('E1')
    expect(codiceDelFascicolo('C1.1', new Set(['C1']), SCHEDA)).toBe('C1')
    expect(codiceDelFascicolo('F1.1', new Set(['F1']), SCHEDA)).toBe('F1')
  })

  test('se ci sono entrambi, vince quello della collegata', () => {
    expect(codiceDelFascicolo('E1.1', new Set(['E1', 'E1.1']), SCHEDA)).toBe('E1.1')
  })

  test('con due scambiatori il fascicolo dell’essiccatore non vale per nessuno dei due', () => {
    expect(codiceDelFascicolo('E2.1', new Set(['E2']), SCHEDA)).toBeNull()
    expect(codiceDelFascicolo('E2.2', new Set(['E2']), SCHEDA)).toBeNull()
    expect(codiceDelFascicolo('E2.2', new Set(['E2', 'E2.2']), SCHEDA)).toBe('E2.2')
  })

  test('nessun fascicolo: null, anche per i serbatoi che non hanno principale', () => {
    expect(codiceDelFascicolo('E1.1', new Set(), SCHEDA)).toBeNull()
    expect(codiceDelFascicolo('S1', new Set(['S2']), SCHEDA)).toBeNull()
    expect(codiceDelFascicolo('S1', new Set(['S1']), SCHEDA)).toBe('S1')
  })

  test('il fascicolo di un’altra principale non conta', () => {
    expect(codiceDelFascicolo('E1.1', new Set(['E2']), SCHEDA)).toBeNull()
  })
})
