import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { SchemaNodo } from '@/services/schemaImpianto/types'
import { fondiDatiArchi, LIVELLO_ARCO_SUL_PROPRIO_NODO } from '../conversioneFlow'
import { vicinoAlPuntoDiLavoro } from '../posaNuoviOggetti'
import { haTerminali, ruotaTerminali } from '../ruotaTerminali'
import type { SchemaNodeData } from '../SchemaNodeSymbol'

function nodo(id: string, tipo: SchemaNodo['tipo'], x: number, y: number, extra: Partial<SchemaNodo> = {}): Node {
  const dati: SchemaNodo = {
    id,
    tipo,
    etichetta: tipo === 'utenze' ? 'Utenze\naria' : id,
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'manuale',
    ...extra,
  }
  return { id, type: 'simbolo', position: { x, y }, data: { nodo: dati, libreria: {} } satisfies SchemaNodeData }
}

const datiDi = (n: Node) => (n.data as SchemaNodeData).nodo
const attaccoSulFoglio = (n: Node) => {
  const a = ancoraDi(datiDi(n), 'in')!
  return { x: n.position.x + a.x, y: n.position.y + a.y }
}

describe('ruotaTerminali', () => {
  it('ruota di 90° alla volta e torna alla partenza dopo quattro pressioni', () => {
    const partenza = [nodo('U', 'utenze', 500, 200)]
    const ids = new Set(['U'])
    const giri = [partenza]
    for (let i = 0; i < 4; i++) giri.push(ruotaTerminali(giri[i], ids))
    expect(giri.slice(1).map((g) => datiDi(g[0]).rotazione)).toEqual([90, 180, 270, undefined])
    // Riportato dritto è indistinguibile da mai ruotato: stessa posizione, nessun campo in più.
    expect(giri[4][0].position).toEqual(partenza[0].position)
    expect('rotazione' in datiDi(giri[4][0])).toBe(false)
  })

  it('il perno è l’attacco: la tubazione che vi arriva non si muove', () => {
    let nodi = [nodo('U', 'utenze', 500, 200)]
    const fermo = attaccoSulFoglio(nodi[0])
    for (let i = 0; i < 4; i++) {
      nodi = ruotaTerminali(nodi, new Set(['U']))
      expect(attaccoSulFoglio(nodi[0]), `giro ${i + 1}`).toEqual(fermo)
      expect(nodi[0].position.x % 10, `giro ${i + 1}`).toBe(0)
      expect(nodi[0].position.y % 10, `giro ${i + 1}`).toBe(0)
    }
  })

  it('non tocca i nodi non indicati né quelli che non sono terminali', () => {
    const nodi = [nodo('U', 'utenze', 0, 0), nodo('U2', 'utenze', 300, 0), nodo('F1', 'filtro', 100, 100)]
    const ruotati = ruotaTerminali(nodi, new Set(['U', 'F1']))
    expect(datiDi(ruotati[0]).rotazione).toBe(90)
    expect(ruotati[1]).toBe(nodi[1])
    expect(ruotati[2]).toBe(nodi[2])
  })

  it('haTerminali dice se c’è qualcosa da ruotare', () => {
    expect(haTerminali([nodo('F1', 'filtro', 0, 0)])).toBe(false)
    expect(haTerminali([nodo('F1', 'filtro', 0, 0), nodo('U', 'utenze', 0, 0)])).toBe(true)
  })
})

describe('vicinoAlPuntoDiLavoro', () => {
  const vista = { x: 1000, y: 200, larghezza: 800, altezza: 600 }
  const tee = { larghezza: 20, altezza: 20 }

  it('posa accanto all’ultimo punto premuto, sulla griglia', () => {
    const p = vicinoAlPuntoDiLavoro({ x: 1403, y: 517 }, vista, tee, [])
    // Centro a (1433, 487): angolo a (1423, 477), alla griglia.
    expect(p).toEqual({ x: 1420, y: 480 })
  })

  it('senza un punto premuto, o con un punto uscito dall’inquadratura, posa al centro di ciò che si vede', () => {
    const centro = { x: 1390, y: 490 }
    expect(vicinoAlPuntoDiLavoro(null, vista, tee, [])).toEqual(centro)
    expect(vicinoAlPuntoDiLavoro({ x: 40, y: 40 }, vista, tee, [])).toEqual(centro)
  })

  it('non scende sotto zero', () => {
    const p = vicinoAlPuntoDiLavoro({ x: 5, y: 5 }, { x: -200, y: -200, larghezza: 600, altezza: 600 }, tee, [])
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
  })

  it('due TEE aggiunti di fila non si impilano', () => {
    const primo = vicinoAlPuntoDiLavoro(null, vista, tee, [])
    const secondo = vicinoAlPuntoDiLavoro(null, vista, tee, [nodo('G1', 'giunzione', primo.x, primo.y)])
    expect(secondo).not.toEqual(primo)
  })
})

describe('archi sul proprio nodo', () => {
  it('stanno sopra il simbolo, gli altri restano sotto', () => {
    const arco = (id: string, source: string, target: string) => ({ id, source, target, data: { stile: 'standard' as const } })
    const archi = [arco('a', 'F1', 'F1'), arco('b', 'F1', 'E1')]
    const quote = { yCollettore: 0, yCorsiaCondense: 0 }
    const fusi = fondiDatiArchi(archi, archi, archi, quote, new Map(), null)
    expect(fusi[0].zIndex).toBe(LIVELLO_ARCO_SUL_PROPRIO_NODO)
    expect(fusi[1].zIndex).toBeUndefined()
    // Niente ancore di riaggancio sopra gli attacchi del simbolo.
    expect(fusi[0].reconnectable).toBe(false)
    expect(fusi[1].reconnectable).toBeUndefined()
    // Sopra anche il nodo selezionato, che react-flow porta a 1000.
    expect(LIVELLO_ARCO_SUL_PROPRIO_NODO).toBeGreaterThan(1000)
  })
})
