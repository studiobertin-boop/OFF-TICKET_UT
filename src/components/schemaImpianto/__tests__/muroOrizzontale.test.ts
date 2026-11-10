import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { muroOrizzontaleDaOrdinata, ordinataPropostaMuroOrizzontale } from '@/services/schemaImpianto/layout'
import { deserializzaLayout, riconcilia, serializzaLayout } from '@/services/schemaImpianto/persistenza'
import { renderSvg, varchiDelMuro, varchiDelMuroOrizzontale } from '@/services/schemaImpianto/renderSvg'
import { chiaveElemento } from '@/services/schemaImpianto/selezione'
import { simboloMuroOrizzontale, SPESSORE_MURO } from '@/services/schemaImpianto/symbols'
import { ascisseAttraversamento } from '@/services/schemaImpianto/tratti'
import type { SchemaLayout, SchemaNodoPosizionato } from '@/services/schemaImpianto/types'
import { flowALayout, layoutAFlow } from '../conversioneFlow'
import { ordinataProposta, ordinataSpostata } from '../useMuro'
import { libereEsistenti, statoSenzaSelezione } from '../useSelezioneMultipla'

const nodo = (id: string, tipo: SchemaNodoPosizionato['tipo'], x: number, y: number): SchemaNodoPosizionato => ({
  id,
  tipo,
  etichetta: id,
  gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [],
  origine: 'manuale',
  x,
  y,
})

/** Due filtri uno sopra l'altro, uniti da un tubo che scende: il muro in mezzo va attraversato. */
function layoutSuDuePiani(muroY?: number): SchemaLayout {
  const nodi = [nodo('F1', 'filtro', 100, 100), nodo('F2', 'filtro', 400, 500)]
  return {
    nodi,
    archi: [{ id: 'a', da: { nodo: 'F1', ancora: 'dx' }, a: { nodo: 'F2', ancora: 'sx' }, stile: 'standard' }],
    muro: null,
    testi: [],
    ...(muroY === undefined ? {} : { muroOrizzontale: muroOrizzontaleDaOrdinata(muroY, nodi) }),
  }
}

describe('muro orizzontale: geometria', () => {
  it('la lunghezza segue le apparecchiature, e a sinistra non scende sotto zero', () => {
    const muro = muroOrizzontaleDaOrdinata(300, [nodo('F1', 'filtro', 10, 100), nodo('F2', 'filtro', 400, 500)])!
    expect(muro.y).toBe(300)
    expect(muro.xMin).toBe(0)
    expect(muro.xMax).toBe(400 + 110 + 30)
  })

  it('il terminale utenze non lo allunga, e senza apparecchiature non c’è muro', () => {
    const conUtenze = [nodo('F1', 'filtro', 100, 100), nodo('U', 'utenze', 900, 0)]
    expect(muroOrizzontaleDaOrdinata(300, conUtenze)!.xMax).toBe(100 + 110 + 30)
    expect(muroOrizzontaleDaOrdinata(300, [nodo('U', 'utenze', 900, 0)])).toBeNull()
  })

  it('nasce sotto il disegno, sulla griglia, e trascinato non sale sopra il bordo del foglio', () => {
    const nodi = [nodo('F1', 'filtro', 100, 105)]
    expect(ordinataPropostaMuroOrizzontale(nodi)).toBe(105 + 110 + 60)
    expect(ordinataProposta(nodi) % 10).toBe(0)
    expect(ordinataSpostata(-37)).toBe(0)
    expect(ordinataSpostata(123)).toBe(120)
  })

  it('si attraversa solo coi tratti verticali', () => {
    const punti = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 200 }, { x: 300, y: 200 }]
    expect(ascisseAttraversamento(punti, 100)).toEqual([50])
    // Un tubo che corre lungo il muro, alla sua quota, non lo attraversa.
    expect(ascisseAttraversamento(punti, 200)).toEqual([50])
    expect(ascisseAttraversamento([{ x: 0, y: 200 }, { x: 300, y: 200 }], 200)).toEqual([])
  })
})

describe('muro orizzontale: disegno', () => {
  it('si apre un varco dove la tubazione lo attraversa', () => {
    const layout = layoutSuDuePiani(300)
    const varchi = varchiDelMuroOrizzontale(layout)
    expect(varchi).toHaveLength(1)
    // Due tronconi: il muro è interrotto una volta.
    const svg = simboloMuroOrizzontale(300, 70, 540, varchi)
    expect(svg.match(/<rect /g)).toHaveLength(2)
    expect(svg).toContain(`height="${SPESSORE_MURO}"`)
    // Il verticale non c'è, e i suoi varchi restano vuoti.
    expect(varchiDelMuro(layout)).toEqual([])
  })

  it('compare nel documento, che si allunga per contenerlo', () => {
    const senza = renderSvg(layoutSuDuePiani())
    const basso = renderSvg(layoutSuDuePiani(900))
    expect(basso).toContain(simboloMuroOrizzontale(900, 70, 540, []))
    const altezza = (svg: string) => Number(/height="(\d+)"/.exec(svg)![1])
    expect(altezza(basso)).toBeGreaterThan(altezza(senza))
  })

  it('senza muro orizzontale il documento è quello di prima, byte per byte', () => {
    expect(renderSvg({ ...layoutSuDuePiani(), muroOrizzontale: null })).toBe(renderSvg(layoutSuDuePiani()))
  })
})

describe('muro orizzontale: salvataggio', () => {
  it('se ne salva la sola ordinata, e riletto ritrova la sua lunghezza', () => {
    const layout = layoutSuDuePiani(300)
    const salvato = serializzaLayout(layout)
    expect(salvato.muroY).toBe(300)
    expect(salvato).not.toHaveProperty('muroOrizzontale')
    expect(deserializzaLayout(salvato)!.muroOrizzontale).toEqual(layout.muroOrizzontale)
  })

  it('un salvataggio senza muro orizzontale si rilegge senza il campo', () => {
    const salvato = serializzaLayout(layoutSuDuePiani())
    expect(salvato).not.toHaveProperty('muroY')
    expect(deserializzaLayout(salvato)).not.toHaveProperty('muroOrizzontale')
  })

  it('la riconciliazione con la scheda lo conserva', () => {
    const layout = layoutSuDuePiani(300)
    const { layout: riconciliato } = riconcilia(layout, { nodi: [], archi: [] })
    expect(riconciliato.muroOrizzontale?.y).toBe(300)
  })
})

describe('muro orizzontale: editor', () => {
  it('attraversa il ponte fra tela e layout in tutti e due i versi', () => {
    const layout = layoutSuDuePiani(300)
    const { nodes, edges, testi, aree } = layoutAFlow(layout)
    expect(flowALayout(nodes, edges, testi, aree, null, {}, 300).muroOrizzontale).toEqual(layout.muroOrizzontale)
    expect(flowALayout(nodes, edges, testi, aree, null, {})).not.toHaveProperty('muroOrizzontale')
  })

  it('si seleziona e si cancella da solo, senza toccare il muro verticale', () => {
    const stato = { nodes: [] as Node[], edges: [] as Edge[], testi: [], aree: [], muroX: 500, muroY: 300 }
    expect(chiaveElemento({ tipo: 'muro-orizzontale' })).not.toBe(chiaveElemento({ tipo: 'muro' }))
    const dopo = statoSenzaSelezione(stato, [{ tipo: 'muro-orizzontale' }])
    expect(dopo.muroY).toBeNull()
    expect(dopo.muroX).toBe(500)
    expect(statoSenzaSelezione(stato, [{ tipo: 'muro' }])).toMatchObject({ muroX: null, muroY: 300 })
    // E dopo la cancellazione esce anche dalla selezione.
    expect(libereEsistenti(dopo, [{ tipo: 'muro-orizzontale' }, { tipo: 'muro' }])).toEqual([{ tipo: 'muro' }])
  })
})
