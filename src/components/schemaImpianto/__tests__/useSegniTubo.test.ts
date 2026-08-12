import { describe, it, expect } from 'vitest'
import { segnoAggiunto, segniSenzaIndice } from '../useSegniTubo'

describe('segnoAggiunto', () => {
  it('aggiunge un segno a metà tratto con un id nuovo', () => {
    const risultato = segnoAggiunto([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.2 }], 'riduttore_pressione')
    expect(risultato).toHaveLength(2)
    expect(risultato[1]).toMatchObject({ tipo: 'riduttore_pressione', t: 0.5 })
    expect(risultato[1].id).not.toBe('v1')
  })

  it('parte da un arco senza segni', () => {
    const risultato = segnoAggiunto(undefined, 'valvola_intercettazione')
    expect(risultato).toHaveLength(1)
  })
})

describe('segniSenzaIndice', () => {
  it('toglie solo il segno all’indice indicato', () => {
    const segni = [
      { id: 'a', tipo: 'valvola_intercettazione' as const, t: 0.2 },
      { id: 'b', tipo: 'riduttore_pressione' as const, t: 0.6 },
    ]
    expect(segniSenzaIndice(segni, 0)).toEqual([segni[1]])
  })
})
