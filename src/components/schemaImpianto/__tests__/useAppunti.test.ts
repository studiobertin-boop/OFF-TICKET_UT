import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { selezioneIncollata, sorgenteDaStato, statoConIncollato } from '../useAppunti'
import type { StatoSelezionabile } from '../useSelezioneMultipla'
import { TIPO_NODO_FLOW } from '../conversioneFlow'

const nodoDati = (id: string, tipo: string) => ({
  id, tipo, etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'scheda',
})

function stato(): StatoSelezionabile {
  return {
    nodes: [
      { id: 'UTENZE', position: { x: 800, y: 60 }, data: { nodo: nodoDati('UTENZE', 'utenze') }, selected: true },
      { id: 'C1', position: { x: 40, y: 40 }, data: { nodo: nodoDati('C1', 'compressore') }, selected: true },
    ] as Node[],
    edges: [
      { id: 'e1', source: 'C1', target: 'UTENZE', selected: true, data: { stile: 'standard', segni: [{ id: 'f1', tipo: 'freccia_direzione', t: 0.4 }] } },
    ] as Edge[],
    testi: [{ id: 'T1', x: 10, y: 10, contenuto: 'a' }],
    aree: [],
    muroX: null,
  }
}

describe('sorgenteDaStato', () => {
  it('prende i nodi selezionati con la loro posizione, e testi/aree/frecce dalla selezione libera', () => {
    const s = sorgenteDaStato(stato(), [{ tipo: 'testo', id: 'T1' }, { tipo: 'freccia', arco: 'e1', segno: 'f1' }])
    expect(s.nodi.map((n) => [n.id, n.x, n.y])).toEqual([['UTENZE', 800, 60], ['C1', 40, 40]])
    expect(s.testi.map((t) => t.id)).toEqual(['T1'])
    expect(s.frecce.map((f) => f.id)).toEqual(['f1'])
  })
})

describe('statoConIncollato', () => {
  const esito = {
    nodi: [{ ...nodoDati('M-U1', 'utenze'), origine: 'manuale' as const, x: 820, y: 80 }] as never[],
    testi: [{ id: 'T2', x: 30, y: 30, contenuto: 'a' }],
    aree: [],
    frecce: [{ id: 'freccia-1', tipo: 'freccia_direzione' as const, t: 0.5 }],
    frecceSaltate: false,
  }

  it('aggiunge i nodi selezionati, deseleziona il resto e mette le frecce sul tubo bersaglio', () => {
    const libreria = {}
    const dopo = statoConIncollato(stato(), esito, 'e1', libreria)
    const nuovo = dopo.nodes.find((n) => n.id === 'M-U1')!
    expect(nuovo).toMatchObject({ type: TIPO_NODO_FLOW, position: { x: 820, y: 80 }, selected: true })
    expect((nuovo.data as { libreria: unknown }).libreria).toBe(libreria)
    expect(dopo.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['M-U1'])
    expect(dopo.edges.every((e) => !e.selected)).toBe(true)
    expect((dopo.edges[0].data as { segni: { id: string }[] }).segni.map((g) => g.id)).toEqual(['f1', 'freccia-1'])
    expect(dopo.testi.map((t) => t.id)).toEqual(['T1', 'T2'])
  })

  it('selezioneIncollata elenca testi, aree e frecce incollati', () => {
    expect(selezioneIncollata(esito, 'e1')).toEqual([
      { tipo: 'testo', id: 'T2' },
      { tipo: 'freccia', arco: 'e1', segno: 'freccia-1' },
    ])
  })
})
