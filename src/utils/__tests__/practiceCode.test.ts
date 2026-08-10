import { describe, test, expect } from 'vitest'
import { composeCodicePratica, nomeFileRelazione } from '../practiceCode'

describe('nomeFileRelazione', () => {
  test('infila RELAZIONE fra le due parti del codice pratica', () => {
    expect(nomeFileRelazione('602A_00-2026', 'ESEMPIO S.P.A.')).toBe('602A_RELAZIONE_00-2026.docx')
    expect(nomeFileRelazione('123_01-2025', 'ESEMPIO S.P.A.')).toBe('123_RELAZIONE_01-2025.docx')
  })

  test('parte dal codice che l’app mostra in testata, senza ricomporlo per conto suo', () => {
    const codice = composeCodicePratica({
      clientCode: '602',
      sala_lettera: 'A',
      progressivo: 0,
      anno: 2026,
      clientSalaCount: 2,
    })
    expect(nomeFileRelazione(codice, 'ESEMPIO S.P.A.')).toBe('602A_RELAZIONE_00-2026.docx')
  })

  test('ripiega sulla ragione sociale quando la pratica non ha ancora un codice', () => {
    // Senza ripiego i dati vecchi darebbero file chiamati tutti `_RELAZIONE_.docx`.
    expect(nomeFileRelazione('', 'ESEMPIO S.P.A.')).toBe('Relazione_ESEMPIO S.P.A..docx')
    expect(nomeFileRelazione('602A', 'ESEMPIO S.P.A.')).toBe('Relazione_ESEMPIO S.P.A..docx')
  })

  test('non produce un nome vuoto nemmeno senza cliente', () => {
    expect(nomeFileRelazione('', '')).toBe('Relazione_senza_cliente.docx')
  })
})
