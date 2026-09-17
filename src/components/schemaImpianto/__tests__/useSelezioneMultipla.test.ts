import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  libereEsistenti,
  originiDelGruppo,
  selezioneVuota,
  statoConPosizioni,
  statoSenzaSelezione,
  type StatoSelezionabile,
} from '../useSelezioneMultipla'

function stato(): StatoSelezionabile {
  const nodes = [
    { id: 'C1', position: { x: 40, y: 40 }, data: {}, selected: true },
    { id: 'S1', position: { x: 300, y: 40 }, data: {}, selected: false },
    { id: 'G1', position: { x: 500, y: 40 }, data: {}, selected: false },
  ] as Node[]
  const edges = [
    { id: 'e1', source: 'C1', target: 'S1', data: { stile: 'standard' } },
    { id: 'e2', source: 'S1', target: 'G1', selected: true, data: { stile: 'standard' } },
    {
      id: 'e3', source: 'G1', target: 'S1',
      data: { stile: 'standard', segni: [{ id: 'f1', tipo: 'freccia_direzione', t: 0.3 }, { id: 'v1', tipo: 'valvola_intercettazione', t: 0.6 }] },
    },
  ] as Edge[]
  return {
    nodes,
    edges,
    testi: [{ id: 'T1', x: 10, y: 10, contenuto: 'a' }, { id: 'T2', x: 20, y: 20, contenuto: 'b' }],
    aree: [{ id: 'A1', x: 0, y: 0, larghezza: 300, altezza: 200, scritta: '', scartoScritta: { dx: 10, dy: 30 } }],
    muroX: 250,
  }
}

describe('originiDelGruppo e statoConPosizioni', () => {
  it('raccoglie nodi selezionati, testi e aree della selezione libera (non muro né frecce)', () => {
    const o = originiDelGruppo(stato(), [{ tipo: 'testo', id: 'T2' }, { tipo: 'area', id: 'A1' }, { tipo: 'muro' }, { tipo: 'freccia', arco: 'e3', segno: 'f1' }])
    expect(o).toEqual({ nodi: { C1: { x: 40, y: 40 } }, testi: { T2: { x: 20, y: 20 } }, aree: { A1: { x: 0, y: 0 } } })
  })

  it('scrive le posizioni e lascia identici gli oggetti non toccati', () => {
    const s = stato()
    const dopo = statoConPosizioni(s, { nodi: { C1: { x: 60, y: 60 } }, testi: { T2: { x: 5, y: 5 } }, aree: {} })
    expect(dopo.nodes[0].position).toEqual({ x: 60, y: 60 })
    expect(dopo.nodes[1]).toBe(s.nodes[1])
    expect(dopo.testi[0]).toBe(s.testi[0])
    expect(dopo.testi[1]).toMatchObject({ x: 5, y: 5 })
    expect(dopo.aree[0]).toBe(s.aree[0])
  })
})

describe('statoSenzaSelezione', () => {
  it('toglie in un colpo nodi con i loro tubi, archi, testi, aree, frecce e muro selezionati', () => {
    const dopo = statoSenzaSelezione(stato(), [
      { tipo: 'testo', id: 'T1' },
      { tipo: 'area', id: 'A1' },
      { tipo: 'freccia', arco: 'e3', segno: 'f1' },
      { tipo: 'muro' },
    ])
    expect(dopo.nodes.map((n) => n.id)).toEqual(['S1', 'G1'])
    // e1 cade con C1, e2 perché selezionato; e3 resta ma senza la freccia, con la valvola.
    expect(dopo.edges.map((e) => e.id)).toEqual(['e3'])
    expect((dopo.edges[0].data as { segni: { id: string }[] }).segni.map((g) => g.id)).toEqual(['v1'])
    expect(dopo.testi.map((t) => t.id)).toEqual(['T2'])
    expect(dopo.aree).toEqual([])
    expect(dopo.muroX).toBeNull()
  })

  it('selezioneVuota', () => {
    const s = stato()
    expect(selezioneVuota(s, [])).toBe(false)
    const senza = { ...s, nodes: s.nodes.map((n) => ({ ...n, selected: false })), edges: s.edges.map((e) => ({ ...e, selected: false })) }
    expect(selezioneVuota(senza, [])).toBe(true)
    expect(selezioneVuota(senza, [{ tipo: 'muro' }])).toBe(false)
  })
})

describe('libereEsistenti', () => {
  it('scarta ciò che non esiste più (un Ctrl+Z, un\'eliminazione dal dialogo)', () => {
    const s = { ...stato(), muroX: null }
    expect(
      libereEsistenti(s, [
        { tipo: 'testo', id: 'T1' },
        { tipo: 'testo', id: 'T9' },
        { tipo: 'area', id: 'A2' },
        { tipo: 'freccia', arco: 'e3', segno: 'f1' },
        { tipo: 'freccia', arco: 'e3', segno: 'v1' },
        { tipo: 'muro' },
      ])
    ).toEqual([{ tipo: 'testo', id: 'T1' }, { tipo: 'freccia', arco: 'e3', segno: 'f1' }])
  })
})
