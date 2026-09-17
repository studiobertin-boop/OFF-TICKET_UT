import { describe, it, expect } from 'vitest'
import {
  chiaveElemento,
  elementiNelRiquadro,
  gruppoVuoto,
  posizioniSpostate,
  riquadroDaPunti,
  selezioneDopoPressione,
  type ElementoLibero,
} from '../selezione'

const T1: ElementoLibero = { tipo: 'testo', id: 'T1' }
const A1: ElementoLibero = { tipo: 'area', id: 'A1' }
const F1: ElementoLibero = { tipo: 'freccia', arco: 'e1', segno: 's1' }

describe('chiaveElemento', () => {
  it('distingue tipo e identità', () => {
    const chiavi = [T1, A1, F1, { tipo: 'muro' } as ElementoLibero, { tipo: 'testo', id: 'A1' } as ElementoLibero].map(chiaveElemento)
    expect(new Set(chiavi).size).toBe(5)
  })
})

describe('selezioneDopoPressione', () => {
  it('senza Ctrl su un elemento nuovo lo seleziona da solo', () => {
    expect(selezioneDopoPressione([T1, A1], F1, false)).toEqual([F1])
  })

  it('senza Ctrl su un elemento già selezionato tiene il gruppo, per poterlo trascinare', () => {
    const gruppo = [T1, A1]
    expect(selezioneDopoPressione(gruppo, { tipo: 'area', id: 'A1' }, false)).toBe(gruppo)
  })

  it('con Ctrl aggiunge o toglie', () => {
    expect(selezioneDopoPressione([T1], A1, true)).toEqual([T1, A1])
    expect(selezioneDopoPressione([T1, A1], { tipo: 'testo', id: 'T1' }, true)).toEqual([A1])
  })
})

describe('riquadro', () => {
  it('riquadroDaPunti normalizza il verso del trascinamento', () => {
    expect(riquadroDaPunti({ x: 300, y: 50 }, { x: 100, y: 250 })).toEqual({ sinistra: 100, alto: 50, destra: 300, basso: 250 })
  })

  it('prende solo ciò che ci sta tutto dentro', () => {
    const r = riquadroDaPunti({ x: 0, y: 0 }, { x: 500, y: 500 })
    const esito = elementiNelRiquadro(r, {
      testi: [
        { id: 'T1', x: 100, y: 100, contenuto: 'dentro' },
        { id: 'T2', x: 480, y: 100, contenuto: 'sporge a destra' },
      ],
      aree: [
        { id: 'A1', x: 50, y: 50, larghezza: 200, altezza: 200, scritta: 'X', scartoScritta: { dx: 10, dy: 30 } },
        { id: 'A2', x: 400, y: 400, larghezza: 200, altezza: 200, scritta: 'X', scartoScritta: { dx: 10, dy: 30 } },
      ],
      frecce: [
        { arco: 'e1', segno: 's1', punto: { x: 250, y: 250 } },
        { arco: 'e1', segno: 's2', punto: { x: 700, y: 250 } },
      ],
    })
    expect(esito).toEqual([
      { tipo: 'testo', id: 'T1' },
      { tipo: 'area', id: 'A1' },
      { tipo: 'freccia', arco: 'e1', segno: 's1' },
    ])
  })

  it('un testo la cui prima riga sporge sopra il riquadro resta fuori', () => {
    const r = riquadroDaPunti({ x: 0, y: 100 }, { x: 500, y: 500 })
    expect(elementiNelRiquadro(r, { testi: [{ id: 'T1', x: 50, y: 105, contenuto: 'a' }], aree: [], frecce: [] })).toEqual([])
  })

  it('il muro non entra mai: non è fra i contenuti che il riquadro guarda', () => {
    const r = riquadroDaPunti({ x: -1e6, y: -1e6 }, { x: 1e6, y: 1e6 })
    expect(elementiNelRiquadro(r, { testi: [], aree: [], frecce: [] })).toEqual([])
  })
})

describe('posizioniSpostate', () => {
  const origini = {
    nodi: { C1: { x: 40, y: 185 } },
    testi: { T1: { x: 100, y: 100 } },
    aree: { A1: { x: 10, y: 10 } },
  }

  it('sposta tutto dello stesso scarto e aggancia la posizione risultante alla griglia', () => {
    expect(posizioniSpostate(origini, 20, 30)).toEqual({
      nodi: { C1: { x: 60, y: 220 } },
      testi: { T1: { x: 120, y: 130 } },
      aree: { A1: { x: 30, y: 40 } },
    })
  })

  it('nodi e aree non vanno sotto zero; i testi seguono la regola di sempre', () => {
    const p = posizioniSpostate(origini, -200, -200)
    expect(p.nodi.C1).toEqual({ x: -160, y: 0 })
    expect(p.aree.A1).toEqual({ x: 0, y: 0 })
    expect(p.testi.T1).toEqual({ x: -100, y: -100 })
  })

  it('gruppoVuoto', () => {
    expect(gruppoVuoto({ nodi: {}, testi: {}, aree: {} })).toBe(true)
    expect(gruppoVuoto(origini)).toBe(false)
  })
})
