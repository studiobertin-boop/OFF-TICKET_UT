import { describe, test, expect } from 'vitest'
import {
  buildBillingReportRow,
  classifyBillingReportGroup,
  sortBillingReportRows,
  type BillingReportRow,
} from '../billingReportRows'

describe('classifyBillingReportGroup', () => {
  test('tipo non-DM329 va sempre in ALTRO, senza sigla OFF/CAC', () => {
    expect(classifyBillingReportGroup('Verifica Impianto', 'off')).toEqual({
      group: 'ALTRO',
      offCacDisplay: '',
    })
    expect(classifyBillingReportGroup('Verifica Impianto', null)).toEqual({
      group: 'ALTRO',
      offCacDisplay: '',
    })
  })

  test('DM329 con off_cac="off" va in DM329_OFF', () => {
    expect(classifyBillingReportGroup('DM329', 'off')).toEqual({
      group: 'DM329_OFF',
      offCacDisplay: 'OFF',
    })
  })

  test('DM329-Integrazioni con off_cac="cac" va in DM329_CAC', () => {
    expect(classifyBillingReportGroup('DM329-Integrazioni', 'cac')).toEqual({
      group: 'DM329_CAC',
      offCacDisplay: 'CAC',
    })
  })

  test('DM329 senza off_cac valorizzato finisce fra le OFF con "???"', () => {
    expect(classifyBillingReportGroup('DM329', undefined)).toEqual({
      group: 'DM329_OFF',
      offCacDisplay: '???',
    })
    expect(classifyBillingReportGroup('DM329', '')).toEqual({
      group: 'DM329_OFF',
      offCacDisplay: '???',
    })
  })
})

describe('buildBillingReportRow', () => {
  test('applica il default 1 a x_fattura quando assente', () => {
    const row = buildBillingReportRow({
      id: '1',
      requestTypeName: 'DM329',
      codicePratica: '602A_00-2026',
      customerName: 'Rossi Srl',
      closedDate: '2026-08-01',
      offCac: 'off',
    })
    expect(row.xFattura).toBe(1)
  })

  test('conserva il valore esplicito di x_fattura', () => {
    const row = buildBillingReportRow({
      id: '1',
      requestTypeName: 'DM329',
      codicePratica: '',
      customerName: 'Rossi Srl',
      closedDate: '2026-08-01',
      xFattura: 4,
      offCac: 'cac',
    })
    expect(row.xFattura).toBe(4)
  })
})

describe('sortBillingReportRows', () => {
  const row = (over: Partial<BillingReportRow>): BillingReportRow => ({
    id: over.id || Math.random().toString(),
    requestTypeName: 'Verifica',
    codicePratica: '',
    customerName: 'Zeta',
    closedDate: '2026-08-01',
    xFattura: 1,
    offCacDisplay: '',
    group: 'ALTRO',
    ...over,
  })

  test('mette prima ALTRO, poi DM329_OFF, poi DM329_CAC', () => {
    const rows = [
      row({ id: 'cac', group: 'DM329_CAC', requestTypeName: 'DM329' }),
      row({ id: 'off', group: 'DM329_OFF', requestTypeName: 'DM329' }),
      row({ id: 'altro', group: 'ALTRO', requestTypeName: 'Verifica' }),
    ]
    const sorted = sortBillingReportRows(rows)
    expect(sorted.map(r => r.id)).toEqual(['altro', 'off', 'cac'])
  })

  test('dentro lo stesso blocco ordina per tipo pratica e poi per cliente', () => {
    const rows = [
      row({ id: 'b-zeta', requestTypeName: 'Verifica B', customerName: 'Zeta' }),
      row({ id: 'a-mario', requestTypeName: 'Verifica A', customerName: 'Mario' }),
      row({ id: 'a-anna', requestTypeName: 'Verifica A', customerName: 'Anna' }),
    ]
    const sorted = sortBillingReportRows(rows)
    expect(sorted.map(r => r.id)).toEqual(['a-anna', 'a-mario', 'b-zeta'])
  })

  test('non muta l\'array originale', () => {
    const rows = [row({ id: '1', customerName: 'B' }), row({ id: '2', customerName: 'A' })]
    const original = [...rows]
    sortBillingReportRows(rows)
    expect(rows).toEqual(original)
  })
})
