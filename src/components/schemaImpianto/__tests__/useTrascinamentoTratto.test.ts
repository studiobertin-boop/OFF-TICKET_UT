import { describe, it, expect } from 'vitest'
import { indiceTrattoPiuVicino } from '../useTrascinamentoTratto'

describe('indiceTrattoPiuVicino', () => {
  it('trova il tratto orizzontale quando il clic cade su di esso', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 50, y: 0 })).toBe(0)
  })

  it('trova il tratto verticale quando il clic cade su quello', () => {
    const full = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    expect(indiceTrattoPiuVicino(full, { x: 100, y: 80 })).toBe(1)
  })
})
