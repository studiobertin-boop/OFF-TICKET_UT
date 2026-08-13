import { describe, it, expect } from 'vitest'
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
import { instrada } from '@/services/schemaImpianto/tratti'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { SchemaLayout, SchemaNodo } from '@/services/schemaImpianto/types'
import { flowALayout, layoutAFlow, polilineaDellArco } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'

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

describe('accordo fra la tela dell’editor e il documento', () => {
  it('per ogni arco, tela e documento producono la STESSA polilinea', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = layoutAFlow(layout)

    // Lato editor: le quote nascono dal layout ricostruito dallo stato react-flow, e i due
    // capi dalla posizione del nodo più l'ancora — è ciò che react-flow passa come
    // sourceX/sourceY, perché `SchemaNodeSymbol` centra l'handle esattamente sull'ancora.
    const quote = quoteInstradamento(flowALayout(nodes, edges))
    const posizioneFlow = (nodoId: string, ancoraId: string) => {
      const node = nodes.find((n) => n.id === nodoId)!
      const { nodo } = node.data as { nodo: SchemaNodo }
      const ancora = ancoraDi(nodo, ancoraId)!
      return { x: node.position.x + ancora.x, y: node.position.y + ancora.y }
    }

    expect(edges.length).toBeGreaterThan(2)
    for (const edge of edges) {
      const arco = layout.archi.find((a) => a.id === edge.id)!
      const dalDocumento = instrada(
        arco.stile,
        posizioneAncora(layout.nodi.find((n) => n.id === arco.da.nodo)!, arco.da.ancora),
        posizioneAncora(layout.nodi.find((n) => n.id === arco.a.nodo)!, arco.a.ancora),
        arco.punti,
        quoteInstradamento(layout)
      )
      const dallaTela = polilineaDellArco(
        posizioneFlow(edge.source, edge.sourceHandle!),
        posizioneFlow(edge.target, edge.targetHandle!),
        { ...(edge.data as SchemaEdgeData), quote }
      )
      expect(dallaTela, `arco ${edge.id} (${arco.stile})`).toEqual(dalDocumento)
    }
  })

  it('i gomiti imposti a mano restano l’ultima parola anche sulla tela', () => {
    const layout = layoutCompleto()
    const flessibile = layout.archi.find((a) => a.stile === 'flessibile')!
    flessibile.punti = [{ x: 42, y: 42 }]
    const { nodes, edges } = layoutAFlow(layout)
    const quote = quoteInstradamento(flowALayout(nodes, edges))
    const edge = edges.find((e) => e.id === flessibile.id)!

    const polilinea = polilineaDellArco(
      { x: 0, y: 0 },
      { x: 200, y: 200 },
      { ...(edge.data as SchemaEdgeData), quote }
    )
    expect(polilinea).toContainEqual({ x: 42, y: 42 })
  })
})
