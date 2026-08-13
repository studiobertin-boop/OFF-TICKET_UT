import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { TIPO_ARCO_FLOW, TIPO_NODO_FLOW, flowALayout, layoutAFlow } from '../conversioneFlow'
import type { SchemaNodeData } from '../SchemaNodeSymbol'

/** Layout minimo ma completo: due nodi, un arco con ancore vere, stile e gomiti imposti. */
function layoutDiProva(): SchemaLayout {
  return {
    nodi: [
      {
        id: 'S1',
        tipo: 'serbatoio',
        etichetta: 'Serbatoio ACME',
        orientamento: 'VERTICALE',
        gruppo: 'SALA_COMPRESSORI',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 100,
        y: 200,
      },
      {
        id: 'F1',
        tipo: 'filtro',
        etichetta: 'Filtro ACME',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'scheda',
        x: 400,
        y: 220,
      },
    ],
    archi: [
      {
        id: 'std-1',
        da: { nodo: 'S1', ancora: 'dx' },
        a: { nodo: 'F1', ancora: 'sx' },
        stile: 'flessibile',
        punti: [{ x: 300, y: 260 }],
        segni: [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }],
      },
    ],
    muro: null,
    testi: [],
  }
}

describe('layoutAFlow / flowALayout', () => {
  it('l\'andata e ritorno conserva ancore, punti e stile', () => {
    const layout = layoutDiProva()
    const { nodes, edges } = layoutAFlow(layout)
    const tornato = flowALayout(nodes, edges)

    expect(tornato.nodi).toEqual(layout.nodi)
    expect(tornato.archi).toEqual(layout.archi)
  })

  it('traduce le ancore negli handle di react-flow e non altrove', () => {
    const { nodes, edges } = layoutAFlow(layoutDiProva())

    expect(nodes.map((n) => n.type)).toEqual([TIPO_NODO_FLOW, TIPO_NODO_FLOW])
    expect(nodes.map((n) => n.position)).toEqual([
      { x: 100, y: 200 },
      { x: 400, y: 220 },
    ])
    expect(edges[0].type).toBe(TIPO_ARCO_FLOW)
    expect(edges[0].sourceHandle).toBe('dx')
    expect(edges[0].targetHandle).toBe('sx')
  })

  it('alla conferma vince `position`, non la copia dentro `data.nodo`', () => {
    // Nell'editor un trascinamento aggiorna SOLO `position` (applyNodeChanges); una copia
    // divergente in `data.nodo` è esattamente lo stato in cui il ramo precedente ha prodotto
    // tre difetti. Qui si fissa chi comanda.
    const { nodes, edges } = layoutAFlow(layoutDiProva())
    const spostati: Node[] = nodes.map((n) =>
      n.id === 'S1' ? { ...n, position: { x: 777, y: 888 } } : n
    )

    const tornato = flowALayout(spostati, edges)
    const s1 = tornato.nodi.find((n) => n.id === 'S1')!

    expect(s1.x).toBe(777)
    expect(s1.y).toBe(888)
  })

  it('conserva i campi non posizionali del nodo attraverso il giro', () => {
    const { nodes, edges } = layoutAFlow(layoutDiProva())
    const tornato = flowALayout(nodes, edges)
    const s1 = tornato.nodi.find((n) => n.id === 'S1')!

    expect(s1.etichetta).toBe('Serbatoio ACME')
    expect(s1.orientamento).toBe('VERTICALE')
    expect(s1.origine).toBe('scheda')
    expect((nodes[0].data as SchemaNodeData).nodo.id).toBe('S1')
  })

  it('l’andata e ritorno conserva anche i segni sulla tubazione', () => {
    const layout = layoutDiProva()
    const { nodes, edges } = layoutAFlow(layout)
    const tornato = flowALayout(nodes, edges)

    expect(tornato.archi[0].segni).toEqual(layout.archi[0].segni)
  })

  it('un arco senza segni torna senza segni, non con un array vuoto inventato', () => {
    const layout = layoutDiProva()
    delete layout.archi[0].segni
    const { nodes, edges } = layoutAFlow(layout)
    const tornato = flowALayout(nodes, edges)

    expect(tornato.archi[0].segni).toBeUndefined()
  })
})

describe('testi liberi fra layout e stato dell’editor', () => {
  const testo = { id: 'T1', x: 100, y: 200, contenuto: 'Nota\nsu due righe' }

  it('vanno e tornano identici', () => {
    const layout = { nodi: [], archi: [], muro: null, testi: [testo] }
    const flow = layoutAFlow(layout)
    expect(flow.testi).toEqual([testo])
    expect(flowALayout(flow.nodes, flow.edges, flow.testi).testi).toEqual([testo])
  })

  it('un layout senza testi produce una lista vuota, non undefined', () => {
    expect(layoutAFlow({ nodi: [], archi: [], muro: null }).testi).toEqual([])
  })

  it('chi non passa i testi non se li inventa', () => {
    expect(flowALayout([], []).testi).toEqual([])
  })
})
