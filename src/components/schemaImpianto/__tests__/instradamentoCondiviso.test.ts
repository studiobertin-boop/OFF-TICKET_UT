import { describe, it, expect } from 'vitest'
import { Position, type Edge, type Node } from '@xyflow/react'
import {
  makeCompressore,
  makeDatiImpianto,
  makeEssiccatore,
  makeScheda,
  makeSerbatoio,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '@/services/schemaImpianto/buildSchemaModel'
import { layoutSchema, quoteInstradamento } from '@/services/schemaImpianto/layout'
import { posizioneAncora } from '@/services/schemaImpianto/renderSvg'
import { instrada, type Punto } from '@/services/schemaImpianto/tratti'
import { ancoraDi, dimensioniDi } from '@/services/schemaImpianto/symbols'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import {
  capiDegliArchi,
  capiDellArco,
  flowALayout,
  fondiDatiArchi,
  layoutAFlow,
  polilineaDellArco,
  type CapiArco,
} from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'
import { LATO_HANDLE, latoDi, type SchemaNodeData } from '../SchemaNodeSymbol'

/**
 * Impianto con tutti e tre gli stili di tubazione: flessibile compressore→serbatoio,
 * mandata di linea serbatoio→essiccatore→utenze, condense verso la tanica.
 */
function layoutCompleto(): SchemaLayout {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
    essiccatori: [makeEssiccatore()],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
  return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
}

/**
 * Gli archi come `SchemaEditor` li passa alla tela: i tre elenchi degli hook fusi con quote e
 * capi. Qui i tre elenchi coincidono (nessun hook montato), ma il percorso dei dati è quello
 * vero — è l'unico modo perché il test provi ciò che la pagina disegna invece di una sua
 * ricostruzione a mano, che è esattamente l'errore per cui questo test restava verde mentre la
 * tela divergeva dal documento.
 */
function archiComeInEditor(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges } = layoutAFlow(layout)
  const layoutCorrente = flowALayout(nodes, edges)
  const fusi = fondiDatiArchi(
    edges,
    edges,
    edges,
    quoteInstradamento(layoutCorrente),
    capiDegliArchi(layoutCorrente)
  )
  return { nodes, edges: fusi }
}

/**
 * I capi come li passa react-flow: NON il centro dell'ancora ma il bordo esterno dell'handle
 * (`LATO_HANDLE` px, centrato sull'ancora) dal lato dichiarato in `position` — cioè il centro
 * spostato di metà handle. È la fonte sbagliata, quella che l'arco riceve in `sourceX`/`sourceY`
 * e che fino al 13-08-2026 disegnava la tela: serve qui per provare che non la si segue più.
 */
function capoComeReactFlow(node: Node, ancoraId: string): Punto {
  const { nodo } = node.data as SchemaNodeData
  const centro = posizioneAncora({ ...nodo, ...node.position }, ancoraId)
  const meta = LATO_HANDLE / 2
  switch (latoDi(ancoraDi(nodo, ancoraId)!, dimensioniDi(nodo))) {
    case Position.Left:
      return { x: centro.x - meta, y: centro.y }
    case Position.Right:
      return { x: centro.x + meta, y: centro.y }
    case Position.Top:
      return { x: centro.x, y: centro.y - meta }
    default:
      return { x: centro.x, y: centro.y + meta }
  }
}

function capiComeReactFlow(nodes: Node[], edge: Edge): CapiArco {
  return {
    da: capoComeReactFlow(nodes.find((n) => n.id === edge.source)!, edge.sourceHandle!),
    a: capoComeReactFlow(nodes.find((n) => n.id === edge.target)!, edge.targetHandle!),
  }
}

/** La polilinea che il documento disegna per quell'arco, dalle sue sole funzioni. */
function dalDocumento(layout: SchemaLayout, arcoId: string): Punto[] {
  const arco = layout.archi.find((a) => a.id === arcoId)!
  const nodo = (id: string) => layout.nodi.find((n) => n.id === id)!
  return instrada(
    arco.stile,
    posizioneAncora(nodo(arco.da.nodo), arco.da.ancora),
    posizioneAncora(nodo(arco.a.nodo), arco.a.ancora),
    arco.punti,
    quoteInstradamento(layout)
  )
}

describe('accordo fra la tela dell’editor e il documento', () => {
  it('per ogni arco, tela e documento producono la STESSA polilinea', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = archiComeInEditor(layout)

    expect(edges.length).toBeGreaterThan(2)
    for (const edge of edges) {
      const data = edge.data as SchemaEdgeData
      // Il ripiego passato qui è di proposito la fonte SBAGLIATA: se `capiDellArco` (o chi
      // riempie `data.capi`) tornasse a fidarsi delle coordinate degli handle, questo test
      // cadrebbe invece di restare verde come faceva prima del 13-08-2026.
      const dallaTela = polilineaDellArco(capiDellArco(data, capiComeReactFlow(nodes, edge)), data)
      expect(dallaTela, `arco ${edge.id} (${data.stile})`).toEqual(dalDocumento(layout, edge.id))
    }
  })

  /**
   * Prova che il test qui sopra discrimina davvero. Con i capi di react-flow — i soli che il
   * componente aveva prima di questo task — nessun arco combacia con il documento: lo scarto di
   * metà handle non resta ai capi, perché `rottaLinea` ricava `xMedia` da loro e `rottaFlessibile`
   * la discesa, e si propaga a ogni vertice intermedio.
   */
  it('con i capi di react-flow, invece, nessun arco combacia', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = archiComeInEditor(layout)

    const combacianti = edges.filter((edge) => {
      const data = edge.data as SchemaEdgeData
      const conCapiSbagliati = polilineaDellArco(capiComeReactFlow(nodes, edge), data)
      return JSON.stringify(conCapiSbagliati) === JSON.stringify(dalDocumento(layout, edge.id))
    })

    expect(combacianti.map((e) => e.id)).toEqual([])
  })

  it('i capi di un arco sono le ancore dei suoi due nodi, non i bordi degli handle', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = archiComeInEditor(layout)

    for (const edge of edges) {
      const capi = (edge.data as SchemaEdgeData).capi!
      const nodo = (id: string) => {
        const node = nodes.find((n) => n.id === id)!
        return { ...(node.data as SchemaNodeData).nodo, ...node.position }
      }
      expect(capi, `arco ${edge.id}`).toEqual({
        da: posizioneAncora(nodo(edge.source), edge.sourceHandle!),
        a: posizioneAncora(nodo(edge.target), edge.targetHandle!),
      })
      expect(capi, `arco ${edge.id}`).not.toEqual(capiComeReactFlow(nodes, edge))
    }
  })

  /**
   * L'unico caso che uccide da solo una mutazione precisa: se `polilineaDellArco` smettesse di
   * inoltrare i gomiti a `instrada` (`undefined` al posto di `data.punti`), il test qui sopra
   * resterebbe VERDE — gli archi che `buildSchemaModel` genera non hanno gomiti a mano, quindi
   * lì non c'è differenza — e cadrebbe solo questo. Verificato con la mutazione, non dedotto.
   *
   * Che non separi la versione ingenua da quella giusta è invece inevitabile per costruzione, e
   * non è un difetto: con dei gomiti imposti `instrada` esce subito su `polilineaConGomiti`, che
   * è esattamente ciò che faceva la tela di prima — su questo caso le due implementazioni
   * coincidono e devono coincidere.
   */
  it('i gomiti imposti a mano restano l’ultima parola anche sulla tela', () => {
    const layout = layoutCompleto()
    const flessibile = layout.archi.find((a) => a.stile === 'flessibile')!
    flessibile.punti = [{ x: 42, y: 42 }]
    const { edges } = archiComeInEditor(layout)
    const edge = edges.find((e) => e.id === flessibile.id)!

    const polilinea = polilineaDellArco({ da: { x: 0, y: 0 }, a: { x: 200, y: 200 } }, edge.data as SchemaEdgeData)
    expect(polilinea).toContainEqual({ x: 42, y: 42 })
  })
})
