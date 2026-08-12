import { describe, it, expect } from 'vitest'
import { allinea, distribuisci, guideDiAllineamento } from '../allineamento'
import type { SchemaNodoPosizionato } from '../types'

function nodo(id: string, x: number, y: number, tipo: SchemaNodoPosizionato['tipo'] = 'essiccatore'): SchemaNodoPosizionato {
  return { id, tipo, etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'manuale', x, y }
}

describe('allinea', () => {
  it('porta tutti sul bordo sinistro più a sinistra', () => {
    const esito = allinea([nodo('A', 100, 0), nodo('B', 40, 50), nodo('C', 300, 90)], 'sinistra')
    expect(esito.map((n) => n.x)).toEqual([40, 40, 40])
  })

  it(`non tocca l'altro asse`, () => {
    const esito = allinea([nodo('A', 100, 0), nodo('B', 40, 50)], 'sinistra')
    expect(esito.map((n) => n.y)).toEqual([0, 50])
  })

  it('con un solo nodo non cambia nulla', () => {
    const uno = [nodo('A', 100, 30)]
    expect(allinea(uno, 'destra')).toEqual(uno)
  })

  it('porta tutti sul bordo destro più a destra', () => {
    // essiccatore (110×110) a x=100, compressore (160×150) a x=200
    // Bordo destro massimo: max(100+110, 200+160) = 360
    // essiccatore finisce a: 360-110=250, compressore finisce a: 360-160=200
    const esito = allinea([nodo('A', 100, 0, 'essiccatore'), nodo('B', 200, 50, 'compressore')], 'destra')
    expect(esito.map((n) => n.x)).toEqual([250, 200])
  })

  it('porta tutti sul bordo alto più in alto', () => {
    // essiccatore a y=100, compressore a y=200
    // Bordo alto minimo: min(100, 200) = 100
    const esito = allinea([nodo('A', 0, 100, 'essiccatore'), nodo('B', 50, 200, 'compressore')], 'alto')
    expect(esito.map((n) => n.y)).toEqual([100, 100])
  })

  it('porta tutti sul bordo basso più in basso', () => {
    // essiccatore (110×110) a y=100, compressore (160×150) a y=200
    // Bordo basso massimo: max(100+110, 200+150) = 350
    // essiccatore finisce a: 350-110=240, compressore finisce a: 350-150=200
    const esito = allinea([nodo('A', 0, 100, 'essiccatore'), nodo('B', 50, 200, 'compressore')], 'basso')
    expect(esito.map((n) => n.y)).toEqual([240, 200])
  })

  it('porta tutti al centro orizzontale', () => {
    // essiccatore (110×110) a x=0, compressore (160×150) a x=100
    // Centro X = (0+55 + 100+80) / 2 = 235/2 = 117.5
    // essiccatore: round(117.5-55) = round(62.5) = 63, compressore: round(117.5-80) = round(37.5) = 38
    const esito = allinea([nodo('A', 0, 0, 'essiccatore'), nodo('B', 100, 0, 'compressore')], 'centroX')
    expect(esito.map((n) => n.x)).toEqual([63, 38])
  })

  it('porta tutti al centro verticale', () => {
    // essiccatore (110×110) a y=0, compressore (160×150) a y=100
    // Centro Y = (0+55 + 100+75) / 2 = 230/2 = 115
    // essiccatore: 115-55=60, compressore: 115-75=40
    const esito = allinea([nodo('A', 0, 0, 'essiccatore'), nodo('B', 0, 100, 'compressore')], 'centroY')
    expect(esito.map((n) => n.y)).toEqual([60, 40])
  })
})

describe('distribuisci', () => {
  it(`spaziatura uguale fra il primo e l'ultimo, che restano fermi`, () => {
    const esito = distribuisci([nodo('A', 0, 0), nodo('B', 10, 0), nodo('C', 300, 0)], 'orizzontale')
    expect(esito.map((n) => n.x)).toEqual([0, 150, 300])
  })

  it('con meno di tre nodi non cambia nulla', () => {
    const due = [nodo('A', 0, 0), nodo('B', 100, 0)]
    expect(distribuisci(due, 'orizzontale')).toEqual(due)
  })

  it('ordina per coordinate anche se input non è ordinato, preservando ordine array in output', () => {
    // Input: A(300), B(0), C(10) — disordinato
    // Ordinati per x: B(0), C(10), A(300)
    // Passo = (300-0)/(3-1) = 150
    // Posizioni: 0, 150, 300
    // Output nell'ordine originale [A, B, C]: [300, 0, 150]
    const esito = distribuisci([nodo('A', 300, 0), nodo('B', 0, 0), nodo('C', 10, 0)], 'orizzontale')
    expect(esito.map((n) => n.x)).toEqual([300, 0, 150])
  })
})

describe('guideDiAllineamento', () => {
  it('segnala i bordi sinistri in riga', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 102, 400)])
    expect(guide).toContainEqual({ orientamento: 'verticale', quota: 102 })
  })

  it('segnala i bordi superiori in riga', () => {
    const guide = guideDiAllineamento(nodo('A', 0, 100), [nodo('B', 400, 102)])
    expect(guide).toContainEqual({ orientamento: 'orizzontale', quota: 102 })
  })

  it('tace quando nessun riferimento coincide', () => {
    expect(guideDiAllineamento(nodo('A', 0, 0), [nodo('B', 500, 500)])).toEqual([])
  })

  it('non ripete la stessa quota per più vicini', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 100, 300), nodo('C', 100, 600)])
    const verticali = guide.filter((g) => g.orientamento === 'verticale' && g.quota === 100)
    expect(verticali).toHaveLength(1)
  })
})
