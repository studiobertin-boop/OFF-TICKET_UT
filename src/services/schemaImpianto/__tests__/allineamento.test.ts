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
    // essiccatore (110×110) a x=100, compressore (129×129, Task 4 — quadrato) a x=200
    // Bordo destro massimo: max(100+110, 200+129) = 329
    // essiccatore finisce a: 329-110=219, compressore finisce a: 329-129=200
    const esito = allinea([nodo('A', 100, 0, 'essiccatore'), nodo('B', 200, 50, 'compressore')], 'destra')
    expect(esito.map((n) => n.x)).toEqual([219, 200])
  })

  it('porta tutti sul bordo alto più in alto', () => {
    // essiccatore a y=100, compressore a y=200
    // Bordo alto minimo: min(100, 200) = 100
    const esito = allinea([nodo('A', 0, 100, 'essiccatore'), nodo('B', 50, 200, 'compressore')], 'alto')
    expect(esito.map((n) => n.y)).toEqual([100, 100])
  })

  it('porta tutti sul bordo basso più in basso', () => {
    // essiccatore (110×110) a y=100, compressore (129×129, Task 4) a y=200
    // Bordo basso massimo: max(100+110, 200+129) = 329
    // essiccatore finisce a: 329-110=219, compressore finisce a: 329-129=200
    const esito = allinea([nodo('A', 0, 100, 'essiccatore'), nodo('B', 50, 200, 'compressore')], 'basso')
    expect(esito.map((n) => n.y)).toEqual([219, 200])
  })

  it('porta tutti al centro orizzontale', () => {
    // essiccatore (110×110) a x=0, compressore (129×129, Task 4) a x=100
    // Centro X = (0+55 + 100+64.5) / 2 = 219.5/2 = 109.75
    // essiccatore: round(109.75-55) = round(54.75) = 55, compressore: round(109.75-64.5) = round(45.25) = 45
    const esito = allinea([nodo('A', 0, 0, 'essiccatore'), nodo('B', 100, 0, 'compressore')], 'centroX')
    expect(esito.map((n) => n.x)).toEqual([55, 45])
  })

  it('porta tutti al centro verticale', () => {
    // essiccatore (110×110) a y=0, compressore (129×129, Task 4) a y=100
    // Centro Y = (0+55 + 100+64.5) / 2 = 219.5/2 = 109.75
    // essiccatore: round(109.75-55)=55, compressore: round(109.75-64.5)=45
    const esito = allinea([nodo('A', 0, 0, 'essiccatore'), nodo('B', 0, 100, 'compressore')], 'centroY')
    expect(esito.map((n) => n.y)).toEqual([55, 45])
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
    // Bordo sinistro (100), centro (155) e bordo destro (210) di A sono tutti e tre in riga
    // sia con B sia con C: tre quote distinte attese, non una sola. Filtrare a monte su
    // `quota === 100` (come faceva questo test) lascerebbe passare anche
    // un'implementazione che restituisse sempre un solo elemento in assoluto.
    const verticali = guide.filter((g) => g.orientamento === 'verticale')
    expect(verticali.map((g) => g.quota).sort((a, b) => a - b)).toEqual([100, 155, 210])
  })

  // Fissano il valore esatto della tolleranza (5px): senza questi due, un'implementazione
  // con una tolleranza qualunque (anche molto più larga) passerebbe comunque tutti gli
  // altri casi, che usano scarti di 0, 2 o 500px.
  it('segnala ancora un allineamento al limite della tolleranza (scarto di 5px)', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 105, 400)])
    expect(guide).toContainEqual({ orientamento: 'verticale', quota: 105 })
  })

  it('non segnala più un allineamento appena oltre la tolleranza (scarto di 6px)', () => {
    const guide = guideDiAllineamento(nodo('A', 100, 0), [nodo('B', 106, 400)])
    expect(guide.some((g) => g.orientamento === 'verticale')).toBe(false)
  })
})
