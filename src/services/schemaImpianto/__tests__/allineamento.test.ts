import { describe, it, expect } from 'vitest'
import { allinea, distribuisci } from '../allineamento'
import type { SchemaNodoPosizionato } from '../types'

function nodo(id: string, x: number, y: number): SchemaNodoPosizionato {
  return { id, tipo: 'essiccatore', etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'manuale', x, y }
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
})
