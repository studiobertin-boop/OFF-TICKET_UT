import { describe, expect, it } from 'vitest'
import { schedeDati } from '../rules/schedeDati'
import { OPTIONS_BASE, OPTIONS_TUTTO, input, row, sheetRef } from './fixtures'

const CATALOGO = () => [
  row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40', { fad: 2580, pressione_max: 15 }),
  row('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { volume: '500', pressione: '11' }),
]

const esegui = (sheets: ReturnType<typeof sheetRef>[], catalog = CATALOGO()) =>
  schedeDati(input(catalog, { sheets, options: OPTIONS_TUTTO }))

describe('confronto fra schede dati e catalogo', () => {
  it('non gira se non richiesto', () => {
    const sheets = [sheetRef('Compressori', 'IGNOTA', 'XY-1')]
    expect(schedeDati(input(CATALOGO(), { sheets, options: OPTIONS_BASE }))).toEqual([])
  })

  it('segnala un modello censito in pratica ma assente dal catalogo', () => {
    const f = esegui([sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'F26KA', { fad: 1200 })])
    expect(f).toHaveLength(1)
    expect(f[0].rule).toBe('SCHEDA_MODELLO_ASSENTE')
    expect(f[0].scope).toBe('scheda')
  })

  it('propone di crearlo a catalogo con i dati della pratica e il nome ripulito', () => {
    const f = esegui([sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'F26KA (@10bar)', { fad: 1200 })])
    expect(f[0].fix).toEqual({
      kind: 'create_row',
      row: {
        tipoApparecchiatura: 'Compressori',
        marca: 'KAESER KOMPRESSOREN SE',
        modello: 'F26KA',
        specs: { fad: 1200 },
      },
    })
  })

  it('raggruppa in una sola segnalazione le pratiche che citano lo stesso modello', () => {
    const f = esegui([
      sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'F26KA', {}, { etichettaPratica: 'PR-1' }),
      sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'F26KA', {}, {
        etichettaPratica: 'PR-2',
        technicalDataId: 'sheet-2',
      }),
    ])
    expect(f).toHaveLength(1)
    expect(f[0].entities).toHaveLength(2)
    expect(f[0].detail).toContain('2 pratiche')
  })

  it('riconosce il modello anche se la pratica ne scrive la variante con pressione', () => {
    expect(esegui([sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40 (@13bar)')])).toEqual([])
  })

  it('distingue la marca scritta diversamente da un modello mancante', () => {
    const f = esegui([sheetRef('Compressori', 'Kaeser Kompressoren SE', 'XY-9')])
    expect(f[0].rule).toBe('SCHEDA_MARCA_NON_NORMALIZZATA')
    // Il modulo governa il catalogo, non le pratiche: la correzione resta manuale.
    expect(f[0].fix.kind).toBe('manual')
  })

  it('segnala i valori della pratica che non coincidono col catalogo', () => {
    const f = esegui([sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40', { fad: 2600 })])
    expect(f).toHaveLength(1)
    expect(f[0].rule).toBe('SCHEDA_SPECS_DIVERGENTI')
    expect(f[0].fix).toEqual({
      kind: 'set_specs',
      rowId: expect.any(String),
      patch: { fad: 2600 },
    })
  })

  it('non aggiorna il catalogo se le pratiche si contraddicono fra loro', () => {
    const f = esegui([
      sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40', { fad: 2600 }, { etichettaPratica: 'PR-1' }),
      sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40', { fad: 2700 }, {
        etichettaPratica: 'PR-2',
        technicalDataId: 'sheet-2',
      }),
    ])
    expect(f[0].fix.kind).toBe('manual')
    expect(f[0].detail).toContain('non concordano')
  })

  it('confronta anche i dati a catalogo rimasti in formato vecchio', () => {
    const f = esegui([
      sheetRef('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { volume: 600 }, { kind: 'serbatoio' }),
    ])
    expect(f[0].rule).toBe('SCHEDA_SPECS_DIVERGENTI')
    expect(f[0].detail).toContain('500')
  })

  it('non confronta i campi di testo, che a catalogo sono spesso intervalli', () => {
    const catalog = [row('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { volume: 500, ts: '-10 ÷ +120' })]
    const f = esegui([sheetRef('Serbatoi', 'SICC TECH s.r.l.', 'SC 500', { ts: 119 })], catalog)
    expect(f).toEqual([])
  })

  it('ignora le righe di scheda senza marca o modello', () => {
    expect(esegui([sheetRef('Compressori', null, 'ASD 40'), sheetRef('Compressori', 'KAESER', null)])).toEqual([])
  })

  it('non si pronuncia quando più varianti potrebbero corrispondere', () => {
    const catalog = [
      row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40 (@10bar)', { fad: 3000, pressione: '10' }),
      row('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40 (@13bar)', { fad: 2580, pressione: '13' }),
    ]
    expect(esegui([sheetRef('Compressori', 'KAESER KOMPRESSOREN SE', 'ASD 40', { fad: 9999 })], catalog))
      .toEqual([])
  })
})
