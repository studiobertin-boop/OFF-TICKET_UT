import { describe, it, expect } from 'vitest'
import {
  areaAggiunta,
  areaRidimensionata,
  areeConScarto,
  areeConScritta,
  idAreaLibero,
  ingombroArea,
  puntoScritta,
  LATO_MINIMO_AREA,
} from '../aree'
import type { SchemaArea } from '../types'

function area(parziale: Partial<SchemaArea> = {}): SchemaArea {
  return {
    id: 'A1', x: 100, y: 100, larghezza: 300, altezza: 200, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 },
    ...parziale,
  }
}

describe('idAreaLibero', () => {
  it('salta gli id già in uso, anche dopo un buco', () => {
    expect(idAreaLibero([])).toBe('A1')
    expect(idAreaLibero([area({ id: 'A1' }), area({ id: 'A3' })])).toBe('A2')
  })
})

describe('areaAggiunta', () => {
  it('nasce 300×200 con scritta AREA, agganciata alla griglia', () => {
    const [nuova] = areaAggiunta([], 'A1', { x: 43, y: 58 })
    expect(nuova).toEqual({
      id: 'A1', x: 40, y: 60, larghezza: 300, altezza: 200, scritta: 'AREA', scartoScritta: { dx: 10, dy: 30 },
    })
  })

  it('non nasce a coordinate negative', () => {
    const [nuova] = areaAggiunta([], 'A1', { x: -80, y: -30 })
    expect(nuova.x).toBe(0)
    expect(nuova.y).toBe(0)
  })
})

describe('areaRidimensionata', () => {
  it('dall\'angolo in basso a destra tiene fermo quello in alto a sinistra', () => {
    expect(areaRidimensionata(area(), 'se', { x: 512, y: 347 })).toMatchObject({ x: 100, y: 100, larghezza: 410, altezza: 250 })
  })

  it('dall\'angolo in alto a sinistra tiene fermo quello in basso a destra', () => {
    expect(areaRidimensionata(area(), 'no', { x: 60, y: 80 })).toMatchObject({ x: 60, y: 80, larghezza: 340, altezza: 220 })
  })

  it('dagli angoli ne e so muove un lato per asse', () => {
    expect(areaRidimensionata(area(), 'ne', { x: 450, y: 50 })).toMatchObject({ x: 100, y: 50, larghezza: 350, altezza: 250 })
    expect(areaRidimensionata(area(), 'so', { x: 50, y: 400 })).toMatchObject({ x: 50, y: 100, larghezza: 350, altezza: 300 })
  })

  it('non scende sotto il lato minimo, anche trascinando oltre l\'angolo opposto', () => {
    const r = areaRidimensionata(area(), 'se', { x: 0, y: 0 })
    expect(r).toMatchObject({ x: 100, y: 100, larghezza: LATO_MINIMO_AREA, altezza: LATO_MINIMO_AREA })
    const n = areaRidimensionata(area(), 'no', { x: 900, y: 900 })
    expect(n).toMatchObject({ larghezza: LATO_MINIMO_AREA, altezza: LATO_MINIMO_AREA, x: 360, y: 260 })
  })

  it('non esce sopra o a sinistra dell\'origine', () => {
    expect(areaRidimensionata(area(), 'no', { x: -50, y: -50 })).toMatchObject({ x: 0, y: 0, larghezza: 400, altezza: 300 })
  })

  it('lascia intatti scritta e scarto: la scritta segue l\'angolo in alto a sinistra', () => {
    const r = areaRidimensionata(area(), 'no', { x: 60, y: 80 })
    expect(r.scritta).toBe('SALA')
    expect(r.scartoScritta).toEqual({ dx: 10, dy: 30 })
  })
})

describe('scritta dell\'area', () => {
  it('puntoScritta somma lo scarto all\'angolo', () => {
    expect(puntoScritta(area())).toEqual({ x: 110, y: 130 })
  })

  it('areeConScarto ricava lo scarto dalla posizione assoluta agganciata alla griglia', () => {
    const [r] = areeConScarto([area()], 'A1', { x: 247, y: 91 })
    expect(r.scartoScritta).toEqual({ dx: 150, dy: -10 })
  })

  it('areeConScarto non porta la scritta a coordinate negative', () => {
    const [r] = areeConScarto([area({ x: 20, y: 20 })], 'A1', { x: -100, y: -100 })
    expect(puntoScritta(r)).toEqual({ x: 0, y: 0 })
  })

  it('areeConScritta cambia solo la scritta dell\'area indicata', () => {
    const due = [area(), area({ id: 'A2' })]
    const r = areeConScritta(due, 'A2', 'REPARTO\n2')
    expect(r[0]).toBe(due[0])
    expect(r[1].scritta).toBe('REPARTO\n2')
  })
})

describe('ingombroArea', () => {
  it('senza scritta è il rettangolo', () => {
    expect(ingombroArea(area({ scritta: '' }))).toEqual({ destra: 400, basso: 300 })
  })

  it('una scritta che sporge allarga l\'ingombro', () => {
    const lunga = area({ scritta: 'X'.repeat(80), scartoScritta: { dx: 10, dy: 260 } })
    const i = ingombroArea(lunga)
    expect(i.destra).toBeGreaterThan(400)
    expect(i.basso).toBeGreaterThanOrEqual(360)
  })
})
