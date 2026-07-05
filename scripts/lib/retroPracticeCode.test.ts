// scripts/lib/retroPracticeCode.test.ts
import { describe, it, expect } from 'vitest'
import { proposeAssignments, FetchedPractice } from './retroPracticeCode'

const base = {
  request_type: 'DM329' as const,
  customer_id: 'c1',
  codice_cliente: '527',
  cliente: 'ACME',
  title: 't',
  status: '3-MAIL_CLIENTE_INVIATA',
}

describe('proposeAssignments', () => {
  it('assegna lettere diverse a indirizzi diversi dello stesso cliente, in ordine di data', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'r2', indirizzo: 'Via Roma 1', created_at: '2024-05-01T00:00:00Z' },
      { ...base, request_id: 'r1', indirizzo: 'Via Milano 2', created_at: '2024-01-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input)
    const byId = Object.fromEntries(out.map(o => [o.request_id, o]))
    expect(byId['r1'].prop_sala_lettera).toBe('A') // indirizzo più vecchio
    expect(byId['r2'].prop_sala_lettera).toBe('B')
    expect(byId['r1'].prop_progressivo).toBe(0)
    expect(byId['r2'].prop_progressivo).toBe(0)
  })

  it('stesso indirizzo => stessa lettera, progressivo incrementale per data', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'r1', indirizzo: 'Via Roma 1', created_at: '2023-01-01T00:00:00Z' },
      { ...base, request_id: 'r2', indirizzo: 'via  roma 1', created_at: '2024-01-01T00:00:00Z' },
      { ...base, request_id: 'r3', indirizzo: 'VIA ROMA 1', created_at: '2025-01-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input).sort((a, b) => a.prop_progressivo - b.prop_progressivo)
    expect(out.map(o => [o.request_id, o.prop_sala_lettera, o.prop_progressivo])).toEqual([
      ['r1', 'A', 0],
      ['r2', 'A', 1],
      ['r3', 'A', 2],
    ])
    expect(out[2].prop_anno).toBe(2025)
  })

  it('le integrazioni non ricevono lettera e propongono la primaria più recente dello stesso cliente come padre', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'p1', indirizzo: 'Via Roma 1', created_at: '2024-01-01T00:00:00Z' },
      { ...base, request_type: 'DM329-Integrazioni', request_id: 'i1', indirizzo: '', created_at: '2024-06-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input)
    const integr = out.find(o => o.request_id === 'i1')!
    expect(integr.prop_sala_lettera).toBe('')
    expect(integr.pratica_padre).toBe('p1')
  })
})
