// scripts/lib/retroPracticeCode.test.ts
import { describe, it, expect } from 'vitest'
import { proposeAssignments, FetchedPractice, validateAssignments, ReviewedAssignment } from './retroPracticeCode'

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

  it('le integrazioni ereditano sala/progressivo/anno dal padre', () => {
    const input: FetchedPractice[] = [
      { ...base, request_id: 'p1', indirizzo: 'Via Roma 1', created_at: '2024-01-01T00:00:00Z' },
      { ...base, request_type: 'DM329-Integrazioni', request_id: 'i1', indirizzo: '', created_at: '2024-06-01T00:00:00Z' },
    ]
    const out = proposeAssignments(input)
    const integr = out.find(o => o.request_id === 'i1')!
    expect(integr.pratica_padre).toBe('p1')
    expect(integr.prop_sala_lettera).toBe('A')
    expect(integr.prop_progressivo).toBe(0)
    expect(integr.prop_anno).toBe(2024)
  })
})

const prim = (over: Partial<ReviewedAssignment>): ReviewedAssignment => ({
  request_id: 'r', request_type: 'DM329', customer_id: 'c1',
  sala_lettera: 'A', denominazione_sala: 'Sala', progressivo: 0, anno: 2025,
  indirizzo_impianto: 'Via Roma 1', pratica_padre: '', ...over,
})

describe('validateAssignments', () => {
  it('accetta una primaria valida', () => {
    const rep = validateAssignments([prim({ request_id: 'r1' })])
    expect(rep.errors).toEqual([])
    expect(rep.valid).toHaveLength(1)
  })

  it('rifiuta lettera non valida, progressivo/anno fuori range', () => {
    const rep = validateAssignments([
      prim({ request_id: 'r1', sala_lettera: 'a' }),
      prim({ request_id: 'r2', progressivo: 100 }),
      prim({ request_id: 'r3', anno: 1999 }),
    ])
    expect(rep.errors.map(e => e.request_id).sort()).toEqual(['r1', 'r2', 'r3'])
    expect(rep.valid).toHaveLength(0)
  })

  it('rifiuta due primarie con stesso (cliente, sala, progressivo)', () => {
    const rep = validateAssignments([
      prim({ request_id: 'r1', sala_lettera: 'A', progressivo: 0 }),
      prim({ request_id: 'r2', sala_lettera: 'A', progressivo: 0 }),
    ])
    expect(rep.errors.some(e => /duplicat/i.test(e.message))).toBe(true)
  })

  it('rifiuta integrazione il cui padre non è una primaria dello stesso cliente', () => {
    const rep = validateAssignments([
      prim({ request_id: 'p1', customer_id: 'c1' }),
      { request_id: 'i1', request_type: 'DM329-Integrazioni', customer_id: 'c2',
        sala_lettera: '', denominazione_sala: '', progressivo: 0, anno: 2025,
        indirizzo_impianto: '', pratica_padre: 'p1' },
    ])
    expect(rep.errors.some(e => e.request_id === 'i1')).toBe(true)
  })

  it('accetta integrazione con padre corretto', () => {
    const rep = validateAssignments([
      prim({ request_id: 'p1', customer_id: 'c1' }),
      { request_id: 'i1', request_type: 'DM329-Integrazioni', customer_id: 'c1',
        sala_lettera: '', denominazione_sala: '', progressivo: 0, anno: 2025,
        indirizzo_impianto: '', pratica_padre: 'p1' },
    ])
    expect(rep.errors).toEqual([])
    expect(rep.valid).toHaveLength(2)
  })
})
