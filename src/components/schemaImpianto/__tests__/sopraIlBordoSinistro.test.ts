import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { sopraIlBordoSinistro } from '../posaNuoviOggetti'
import type { SchemaTestoLibero } from '@/services/schemaImpianto/types'

function nodo(id: string, x: number, y: number): Node {
  // `data.nodo` non è decorativo: quando sopra non c'è spazio la posa legge l'ingombro vero del
  // disegno per andargli accanto, e l'ingombro lo dà il nodo di schema, non la sola posizione.
  return {
    id,
    type: 'x',
    position: { x, y },
    data: {
      nodo: {
        id,
        tipo: 'serbatoio',
        etichetta: id,
        orientamento: 'VERTICALE',
        gruppo: 'SALA_COMPRESSORI',
        valvoleSicurezza: [],
        origine: 'scheda',
      },
    },
  } as unknown as Node
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

  // Fino al 17-08-2026 la posa si schiacciava a zero e l'oggetto nasceva addosso a quelli
  // esistenti. Sotto zero non si può andare: `dimensioniLayout` misura il disegno solo dal bordo
  // in giù, e un nodo a ordinata negativa verrebbe tagliato nel documento.
  it('quando sopra non c’è spazio si posa a destra di tutto, alla quota della cima', () => {
    const nodes = [nodo('C1', 40, 10), nodo('S1', 300, 10)]
    const posizione = sopraIlBordoSinistro(nodes, [])

    expect(posizione.y).toBe(10)
    expect(posizione.x).toBeGreaterThan(300)
  })

  it('quando sopra lo spazio c’è, resta incolonnato a sinistra', () => {
    const nodes = [nodo('C1', 200, 400), nodo('S1', 500, 400)]
    const posizione = sopraIlBordoSinistro(nodes, [])

    expect(posizione.x).toBe(200)
    expect(posizione.y).toBeLessThan(400)
  })

  it('anche la posa a destra aggancia alla griglia', () => {
    const posizione = sopraIlBordoSinistro([nodo('C1', 47, 13)], [])
    expect(posizione.x % 10).toBe(0)
    expect(posizione.y % 10).toBe(0)
  })

  it('aggancia alla griglia, come ogni altra posa dell’editor', () => {
    const posizione = sopraIlBordoSinistro([nodo('C1', 207, 333)], [])
    expect(posizione.x % 10).toBe(0)
    expect(posizione.y % 10).toBe(0)
  })
})
