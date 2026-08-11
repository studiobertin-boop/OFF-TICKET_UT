import { describe, test, expect } from 'vitest'
import { composeCodicePratica, nomeFileDichiarazioni, nomeFileFascicolo, nomeFileRelazione } from '../practiceCode'

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

describe('nomeFileFascicolo', () => {
  test('attacca il codice apparecchiatura alla prima parte del codice pratica', () => {
    expect(nomeFileFascicolo('602A_01-2026', 'E1', 'ESEMPIO S.P.A.'))
      .toBe('602A-E1_CERTIFICATI_MANUALI_FOTO_01-2026.pdf')
    expect(nomeFileFascicolo('123_00-2025', 'S2', 'ESEMPIO S.P.A.'))
      .toBe('123-S2_CERTIFICATI_MANUALI_FOTO_00-2025.pdf')
  })

  test('tiene il punto dei codici delle apparecchiature collegate', () => {
    // Il disoleatore del primo compressore è `C1.1`: il punto fa parte del codice,
    // non è l'estensione del file.
    expect(nomeFileFascicolo('602A_01-2026', 'C1.1', 'ESEMPIO S.P.A.'))
      .toBe('602A-C1.1_CERTIFICATI_MANUALI_FOTO_01-2026.pdf')
  })

  test('ripiega sulla ragione sociale quando la pratica non ha ancora un codice', () => {
    expect(nomeFileFascicolo('', 'E1', 'ESEMPIO S.P.A.')).toBe('Fascicolo_E1_ESEMPIO S.P.A..pdf')
    expect(nomeFileFascicolo('602A', 'E1', 'ESEMPIO S.P.A.')).toBe('Fascicolo_E1_ESEMPIO S.P.A..pdf')
  })

  test('non produce un nome vuoto nemmeno senza cliente', () => {
    expect(nomeFileFascicolo('', 'E1', '')).toBe('Fascicolo_E1_senza_cliente.pdf')
  })
})

describe('nomeFileDichiarazioni', () => {
  test('infila DICHIARAZIONI fra le due parti del codice pratica', () => {
    expect(nomeFileDichiarazioni('602A_00-2026', 'ESEMPIO S.P.A.')).toBe('602A_DICHIARAZIONI_00-2026.pdf')
    expect(nomeFileDichiarazioni('123_01-2025', 'ESEMPIO S.P.A.')).toBe('123_DICHIARAZIONI_01-2025.pdf')
  })

  test('ripiega sulla ragione sociale quando la pratica non ha ancora un codice', () => {
    expect(nomeFileDichiarazioni('', 'ESEMPIO S.P.A.')).toBe('Dichiarazioni_ESEMPIO S.P.A..pdf')
    expect(nomeFileDichiarazioni('602A', 'ESEMPIO S.P.A.')).toBe('Dichiarazioni_ESEMPIO S.P.A..pdf')
  })

  test('non produce un nome vuoto nemmeno senza cliente', () => {
    expect(nomeFileDichiarazioni('', '')).toBe('Dichiarazioni_senza_cliente.pdf')
  })
})
