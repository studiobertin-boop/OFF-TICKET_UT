import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { sopraIlBordoSinistro } from '../posaNuoviOggetti'
import type { SchemaTestoLibero } from '@/services/schemaImpianto/types'

function nodo(id: string, x: number, y: number): Node {
  return { id, type: 'x', position: { x, y }, data: {} } as Node
}

function testo(x: number, y: number): SchemaTestoLibero {
  return { id: 'T1', x, y, contenuto: 'Nota' }
}

describe('sopraIlBordoSinistro', () => {
  it('incolonna il nuovo oggetto sul bordo sinistro del più a sinistra, sopra la cima', () => {
    const nodes = [nodo('C1', 200, 300), nodo('S1', 500, 260)]
    const posizione = sopraIlBordoSinistro(nodes, [])

    expect(posizione.x).toBe(200)
    // Sopra la cima del disegno, che è la quota minima fra i nodi (260), non quella del nodo
    // più a sinistra: un oggetto posato a 300 finirebbe di fianco al serbatoio, non sopra tutto.
    expect(posizione.y).toBeLessThan(260)
  })

  it('tiene conto delle annotazioni, che possono stare più a sinistra di ogni apparecchiatura', () => {
    const nodes = [nodo('C1', 200, 300)]
    expect(sopraIlBordoSinistro(nodes, [testo(80, 250)]).x).toBe(80)
  })

  it('su una tela vuota non produce coordinate negative', () => {
    const posizione = sopraIlBordoSinistro([], [])
    expect(posizione.x).toBeGreaterThanOrEqual(0)
    expect(posizione.y).toBeGreaterThanOrEqual(0)
  })

  it('non manda l’oggetto fuori dalla tela quando il disegno tocca il bordo alto', () => {
    // Un disegno che comincia a y=10 non lascia spazio sopra: si posa a zero, non a -150.
    expect(sopraIlBordoSinistro([nodo('C1', 40, 10)], []).y).toBe(0)
  })

  it('aggancia alla griglia, come ogni altra posa dell’editor', () => {
    const posizione = sopraIlBordoSinistro([nodo('C1', 207, 333)], [])
    expect(posizione.x % 10).toBe(0)
    expect(posizione.y % 10).toBe(0)
  })
})
