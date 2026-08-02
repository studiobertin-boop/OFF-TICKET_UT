import { describe, expect, it } from 'vitest'
import { compareSpecs, extractUpdatedSpecs } from '@/utils/equipmentSpecsComparison'

/**
 * Il confronto scheda ↔ catalogo passa da `FORM_TO_CANONICAL`, la stessa mappa del motore di
 * verifica e delle migration. Prima esisteva un duplicato divergente in questo modulo: indicizzava
 * `ts_temperatura` mentre la tabella scrive `ts`, e ignorava valvole e recipienti filtro.
 */
describe('compareSpecs', () => {
  it('rileva la temperatura scritta dalla tabella nel campo `ts`', () => {
    const c = compareSpecs({ volume: 500, ps: 11, ts: '-10 ÷ +100' }, { ts: '-10 ÷ +120' } as any, 'Serbatoi')
    expect(c.hasChanges).toBe(true)
    expect(c.modifiedFields.ts).toEqual({ oldValue: '-10 ÷ +100', newValue: '-10 ÷ +120' })
  })

  it('non segnala nulla quando la scheda coincide col catalogo', () => {
    const form = { volume: 500, ps_pressione_max: 11, ts: '+100', categoria_ped: 'II' }
    const c = compareSpecs({ volume: 500, ps: 11, ts: '+100', categoria_ped: 'II' }, form as any, 'Serbatoi')
    expect(c.hasChanges).toBe(false)
    expect(c.modifiedFields).toEqual({})
  })

  it('legge le chiavi generiche dell import massivo senza proporle come campi nuovi', () => {
    // Riga di catalogo mai normalizzata: `pressione`/`temperatura` invece di `ps`/`ts`.
    const form = { volume: 500, ps_pressione_max: 11, ts: '+100' }
    const c = compareSpecs({ volume: '500', pressione: '11', temperatura: '+100' }, form as any, 'Serbatoi')
    expect(c.hasChanges).toBe(false)
  })

  it('copre le valvole, con i nomi di campo deprecati delle schede vecchie', () => {
    const c = compareSpecs(
      { ptar: 11, qmax: 3000, ts: '+50' },
      { pressione_taratura: 11, portata_max: 3500 } as any,
      'Valvole di sicurezza'
    )
    expect(c.modifiedFields.qmax).toEqual({ oldValue: 3000, newValue: 3500 })
  })

  it('a parità di destinazione vince il primo campo valorizzato', () => {
    // `volume_aria_scaricato` precede `portata_max` nella mappa.
    const c = compareSpecs(
      { ptar: 11, qmax: 3000 },
      { pressione_taratura: 11, volume_aria_scaricato: 3200, portata_max: 9999 } as any,
      'Valvole di sicurezza'
    )
    expect(c.modifiedFields.qmax).toEqual({ oldValue: 3000, newValue: 3200 })
  })

  it('non propone di riscrivere la pressione che identifica la variante', () => {
    // La colonna PS della scheda è la pressione massima: la macchina che a catalogo lavora a
    // 7,5 bar e ne ha 8 di targa si dichiara a 8, ed è la stessa riga, non una variante nuova.
    const c = compareSpecs(
      { pressione_esercizio: 7.5, pressione_max: 8, fad: 3160 },
      { pressione_max: 8, volume_aria_prodotto: 3160 } as any,
      'Compressori'
    )
    expect(c.suggestNewVariant).toBeUndefined()
    expect(c.hasChanges).toBe(false)
  })

  it('propone una nuova variante quando la pressione non è quella della riga', () => {
    const c = compareSpecs(
      { pressione_esercizio: 7.5, pressione_max: 8, fad: 3160 },
      { pressione_max: 13, volume_aria_prodotto: 2090 } as any,
      'Compressori'
    )
    expect(c.suggestNewVariant).toBe(true)
    expect(c.hasChanges).toBe(false)
  })

  it('la pressione di esercizio del catalogo non fa da sola una variante nuova', () => {
    // Il caso che faceva comparire a vuoto l'invito ad aggiungere a catalogo: la scheda
    // dichiara gli 11 bar di targa, la voce a catalogo lavora a 10 e di targa ne ha 11.
    const c = compareSpecs(
      { pressione_esercizio: 10, pressione_max: 11, fad: 255 },
      { pressione_max: 11, volume_aria_prodotto: 255 } as any,
      'Compressori'
    )
    expect(c.suggestNewVariant).toBeUndefined()
    expect(c.hasChanges).toBe(false)
  })

  it('tratta come nuovi i campi che il catalogo non ha', () => {
    const c = compareSpecs({ ps: 11 }, { volume: 500, ps_pressione_max: 11 } as any, 'Serbatoi')
    expect(c.newFields).toEqual({ volume: 500 })
    expect(extractUpdatedSpecs({} as any, 'Serbatoi', c)).toEqual({ volume: 500 })
  })

  it('non confronta i tipi senza dati tecnici', () => {
    expect(compareSpecs({}, { codice: 'F1' } as any, 'Filtri').hasChanges).toBe(false)
  })
})
