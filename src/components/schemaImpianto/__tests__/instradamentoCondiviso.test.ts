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
import { posizioneAncora, renderSvg } from '@/services/schemaImpianto/renderSvg'
import { instrada, percorso, polilineaConGomiti, type Punto } from '@/services/schemaImpianto/tratti'
import { ancoraDi, dimensioniDi, latoImposto } from '@/services/schemaImpianto/symbols'
import type { SchemaLayout, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
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
 * `layoutCompleto` con in più una giunzione: un ramo (S1 lato `dx` → giunzione lato `alto`)
 * arriva senza gomiti a mano, col capo di partenza spostato lateralmente rispetto al centro
 * della giunzione — la configurazione misurata in pagina che, senza il lato imposto, fa girare
 * la rotta a metà strada (`rottaLinea`) invece di entrare verticalmente e formare la T.
 */
function layoutConGiunzione(): SchemaLayout {
  const layout = layoutCompleto()
  const s1 = layout.nodi.find((n) => n.id === 'S1')!
  const pDa = posizioneAncora(s1, 'dx')
  const giunzione: SchemaNodoPosizionato = {
    id: 'M-G1',
    tipo: 'giunzione',
    etichetta: 'Giunzione',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'manuale',
    // Centro spostato di 140 in x e 160 in y rispetto a `pDa`: fuori dalla sua verticale, così
    // la rotta nativa e quella imboccata dal lato `alto` producono poligonali diverse.
    x: pDa.x + 140 - 12,
    y: pDa.y + 160 - 12,
  }
  layout.nodi.push(giunzione)
  layout.archi.push({
    id: 'ramo-giunzione',
    da: { nodo: s1.id, ancora: 'dx' },
    a: { nodo: giunzione.id, ancora: 'alto' },
    stile: 'standard',
  })
  return layout
}

/**
 * Gli archi come `SchemaEditor` li passa alla tela: i tre elenchi degli hook fusi con quote e
 * capi. Qui i tre elenchi coincidono (nessun hook montato), ma il percorso dei dati è quello
 * vero — è l'unico modo perché il test provi ciò che la pagina disegna invece di una sua
 * ricostruzione a mano, che è esattamente l'errore per cui questo test restava verde mentre la
 * tela divergeva dal documento.
 */
function archiComeInEditor(layout: SchemaLayout): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges, testi } = layoutAFlow(layout)
  const layoutCorrente = flowALayout(nodes, edges, testi)
  const fusi = fondiDatiArchi(
    edges,
    edges,
    edges,
    quoteInstradamento(layoutCorrente),
    capiDegliArchi(layoutCorrente),
    null
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

/**
 * La polilinea che il documento disegna per quell'arco, dalle sue sole funzioni — compresi i
 * lati imposti, risolti con `latoImposto` come fanno ora le tre `render*` di `renderSvg.ts`:
 * senza, questo modello smetterebbe di rappresentare fedelmente ciò che il documento disegna
 * per un arco che tocca una giunzione.
 */
function dalDocumento(layout: SchemaLayout, arcoId: string): Punto[] {
  const arco = layout.archi.find((a) => a.id === arcoId)!
  const nodo = (id: string) => layout.nodi.find((n) => n.id === id)!
  const da = nodo(arco.da.nodo)
  const a = nodo(arco.a.nodo)
  return instrada(
    arco.stile,
    posizioneAncora(da, arco.da.ancora),
    posizioneAncora(a, arco.a.ancora),
    arco.punti,
    quoteInstradamento(layout),
    { da: latoImposto(da, arco.da.ancora), a: latoImposto(a, arco.a.ancora) }
  )
}

/**
 * `d` di ogni `<path>` composto solo da comandi M/L nell'SVG reso — le tubazioni non ondulate
 * (`renderMandataLinea`, `renderLineaCondense`), che disegnano con `percorso`. I flessibili
 * escono da `ondula` con comandi Q e non compaiono qui: non serve distinguerli, la ricerca
 * successiva li esclude a monte scegliendo un arco non ondulato.
 */
function tracciatiLineari(svg: string): string[] {
  return [...svg.matchAll(/d="(M [\d.-]+ [\d.-]+(?: L [\d.-]+ [\d.-]+)+)"/g)].map((m) => m[1])
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

  /**
   * Il primo test di questo describe confronta la tela con `dalDocumento`, un MODELLO del
   * documento che richiama `instrada`+`posizioneAncora` direttamente: se `renderMandataLinea`
   * (o `renderLineaCondense`) smettesse di chiamare `instrada` e ricostruisse la polilinea a modo
   * suo, quel modello non se ne accorgerebbe e il test resterebbe verde. Qui si confronta invece
   * con l'SVG VERO, prodotto da `renderSvg`, su un arco non ondulato (uno `standard` o uno
   * `condensa`: i flessibili escono da `ondula`, che non emette M/L puri).
   */
  it('per un arco non ondulato, la polilinea della tela combacia col tracciato VERO reso da renderSvg', () => {
    const layout = layoutCompleto()
    const { nodes, edges } = archiComeInEditor(layout)
    const tracciati = tracciatiLineari(renderSvg(layout))

    const edge = edges.find((e) => (e.data as SchemaEdgeData).stile !== 'flessibile')!
    const data = edge.data as SchemaEdgeData
    const dallaTela = polilineaDellArco(capiDellArco(data, capiComeReactFlow(nodes, edge)), data)

    expect(tracciati, `arco ${edge.id} (${data.stile})`).toContain(percorso(dallaTela))
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
        lati: {
          da: latoImposto(nodo(edge.source), edge.sourceHandle!),
          a: latoImposto(nodo(edge.target), edge.targetHandle!),
        },
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
    // Uguaglianza piena, non solo "il gomito compare da qualche parte": `toContainEqual`
    // resterebbe verde anche se il gomito finisse al posto giusto ma il resto della polilinea
    // (capi, verso) fosse sbagliato.
    expect(polilinea).toEqual(polilineaConGomiti({ x: 0, y: 0 }, [{ x: 42, y: 42 }], { x: 200, y: 200 }))
  })

  /**
   * Il caso con una giunzione: un ramo arriva dal lato `alto`, senza gomiti a mano, col capo di
   * partenza fuori dalla verticale del centro del pallino (`layoutConGiunzione`). Confrontare
   * solo tela e documento fra loro NON basterebbe a provare che i lati sono davvero risolti: se
   * nessuno dei due li passasse a `instrada`, sbaglierebbero ALLO STESSO MODO — la rotta nativa
   * gira a metà strada — e resterebbero comunque d'accordo, verdi, senza formare la T. Il terzo
   * termine di paragone, `attesa`, è la rotta calcolata passando esplicitamente `latoImposto` a
   * `instrada`: è quello a rendere il confronto discriminante.
   *
   * E per lo stesso motivo per cui serve `dalDocumento` VERSUS l'SVG vero due test più sopra: un
   * confronto che passasse solo dal modello `dalDocumento` non si accorgerebbe se le `render*` di
   * `renderSvg.ts` smettessero di passare i lati a `instrada` — è la mutazione verificata nel
   * report di questo task, e senza `tracciati`/`renderSvg` qui sotto la suite restava verde.
   */
  it('un ramo che arriva su una giunzione dal lato imposto: tela e documento concordano sulla rotta imboccata', () => {
    const layout = layoutConGiunzione()
    const arco = layout.archi.find((a) => a.id === 'ramo-giunzione')!
    const nodo = (id: string) => layout.nodi.find((n) => n.id === id)!
    const da = nodo(arco.da.nodo)
    const a = nodo(arco.a.nodo)

    // La giunzione impone davvero un lato: se non lo facesse, questo test non proverebbe nulla
    // di diverso dal resto della suite.
    expect(latoImposto(a, arco.a.ancora)).toBe('alto')

    const attesa = instrada(
      arco.stile,
      posizioneAncora(da, arco.da.ancora),
      posizioneAncora(a, arco.a.ancora),
      arco.punti,
      quoteInstradamento(layout),
      { da: latoImposto(da, arco.da.ancora), a: latoImposto(a, arco.a.ancora) }
    )
    // La rotta imboccata è davvero diversa dalla rotta nativa (`rottaLinea`, senza lati):
    // altrimenti il confronto con `attesa` qui sotto non discriminerebbe nulla.
    const nativa = instrada(arco.stile, posizioneAncora(da, arco.da.ancora), posizioneAncora(a, arco.a.ancora), arco.punti, quoteInstradamento(layout))
    expect(attesa).not.toEqual(nativa)

    const { nodes, edges } = archiComeInEditor(layout)
    const edge = edges.find((e) => e.id === arco.id)!
    const data = edge.data as SchemaEdgeData
    const dallaTela = polilineaDellArco(capiDellArco(data, capiComeReactFlow(nodes, edge)), data)
    const dalDoc = dalDocumento(layout, arco.id)
    // L'SVG VERO, prodotto da `renderSvg` — non il modello `dalDocumento` — sull'arco
    // `ramo-giunzione` (stile `standard`, non ondulato: usa `percorso`, comandi M/L puri).
    const tracciati = tracciatiLineari(renderSvg(layout))

    expect(dallaTela, 'tela').toEqual(attesa)
    expect(dalDoc, 'documento (modello)').toEqual(attesa)
    expect(tracciati, 'documento (SVG vero)').toContain(percorso(attesa))
  })
})
