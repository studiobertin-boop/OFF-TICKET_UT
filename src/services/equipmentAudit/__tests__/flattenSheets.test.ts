import { describe, expect, it } from 'vitest'
import { flattenSheetEquipment, type RawSheet } from '../flattenSheets'
import { EQUIPMENT_DATA_ESEMPIO } from './fixtures'

const sheet: RawSheet = {
  id: 'sheet-1',
  requestId: 'req-1',
  codicePratica: 'PR-2026-001',
  equipmentData: EQUIPMENT_DATA_ESEMPIO,
}

describe('appiattimento delle schede dati', () => {
  const refs = flattenSheetEquipment([sheet])

  it('raccoglie le apparecchiature degli array per tipo', () => {
    expect(refs.find(r => r.codice === 'S1')?.catalogType).toBe('Serbatoi')
    expect(refs.find(r => r.codice === 'C1')?.catalogType).toBe('Compressori')
  })

  it('estrae la valvola obbligatoria annidata nel serbatoio', () => {
    const v = refs.find(r => r.codice === 'S1.1')
    expect(v?.catalogType).toBe('Valvole di sicurezza')
    expect(v?.modello).toBe('TW3')
    expect(v?.path).toBe('serbatoi[0].valvola_sicurezza')
  })

  it('estrae anche le valvole aggiuntive', () => {
    const v = refs.find(r => r.codice === 'S1.2')
    expect(v?.modello).toBe('TA11')
    expect(v?.path).toBe('serbatoi[0].valvole_aggiuntive[0]')
  })

  it('traduce i campi del form nelle chiavi del catalogo', () => {
    expect(refs.find(r => r.codice === 'S1')?.values).toEqual({ volume: 500, ps: 11 })
    expect(refs.find(r => r.codice === 'S1.1')?.values).toEqual({ ptar: 11, qmax: 8415 })
  })

  it('accetta i campi deprecati delle schede più vecchie', () => {
    // `fad` è il nome storico di `volume_aria_prodotto`.
    expect(refs.find(r => r.codice === 'C1')?.values).toEqual({ fad: 2580, pressione_max: 15 })
  })

  it('scarta le righe vuote lasciate dal form', () => {
    expect(refs.find(r => r.codice === 'S2')).toBeUndefined()
  })

  it('conserva il riferimento alla pratica di provenienza', () => {
    expect(refs.every(r => r.codicePratica === 'PR-2026-001')).toBe(true)
    expect(refs.every(r => r.technicalDataId === 'sheet-1')).toBe(true)
  })

  it('regge schede vuote o malformate', () => {
    expect(flattenSheetEquipment([{ ...sheet, equipmentData: null }])).toEqual([])
    expect(flattenSheetEquipment([{ ...sheet, equipmentData: {} }])).toEqual([])
    expect(
      flattenSheetEquipment([{ ...sheet, equipmentData: { serbatoi: [null, 'spazzatura'] } }])
    ).toEqual([])
  })
})
