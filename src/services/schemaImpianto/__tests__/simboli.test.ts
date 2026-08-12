import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'
import { REGISTRO_SIMBOLI, definizioneDi, ancoraDi, simboloDi } from '../symbols'
import { capoValido } from '../agganci'

describe('chiaveSimbolo', () => {
  it('distingue le due varianti del serbatoio', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'VERTICALE' })).toBe('serbatoio:VERTICALE')
    expect(chiaveSimbolo({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' })).toBe('serbatoio:ORIZZONTALE')
  })

  it('assume il serbatoio verticale quando l’orientamento manca', () => {
    expect(chiaveSimbolo({ tipo: 'serbatoio' })).toBe('serbatoio:VERTICALE')
  })

  it('per gli altri tipi la chiave è il tipo stesso', () => {
    expect(chiaveSimbolo({ tipo: 'compressore' })).toBe('compressore')
    expect(chiaveSimbolo({ tipo: 'tanica' })).toBe('tanica')
  })
})

describe('registro dei simboli', () => {
  it('ogni definizione dichiara almeno un’ancora, con identificativi distinti', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      expect(def.ancore.length, chiave).toBeGreaterThan(0)
      const ids = def.ancore.map((a) => a.id)
      expect(new Set(ids).size, chiave).toBe(ids.length)
    }
  })

  it('ogni ancora accetta almeno un tipo e cade dentro il riquadro d’ingombro', () => {
    for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
      for (const a of def.ancore) {
        expect(a.accetta.length, `${chiave}/${a.id}`).toBeGreaterThan(0)
        expect(a.x, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.x, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.larghezza)
        expect(a.y, `${chiave}/${a.id}`).toBeGreaterThanOrEqual(0)
        expect(a.y, `${chiave}/${a.id}`).toBeLessThanOrEqual(def.dimensioni.altezza)
      }
    }
  })

  it('il serbatoio orizzontale ha ancore diverse dal verticale', () => {
    const v = ancoraDi({ tipo: 'serbatoio', orientamento: 'VERTICALE' }, 'sx')
    const o = ancoraDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }, 'sx')
    expect(v).toBeDefined()
    expect(o).toBeDefined()
    expect(v).not.toEqual(o)
  })

  it('definizioneDi risolve la variante del nodo', () => {
    expect(definizioneDi({ tipo: 'serbatoio', orientamento: 'ORIZZONTALE' }).dimensioni.larghezza).toBe(150)
    expect(definizioneDi({ tipo: 'tanica' }).dimensioni.larghezza).toBe(80)
  })
})

describe('simbolo «Alle utenze»', () => {
  const utenze = {
    id: 'UTENZE',
    tipo: 'utenze' as const,
    etichetta: 'Utenze aria',
    gruppo: 'LINEA_DISTRIBUZIONE' as const,
    valvoleSicurezza: [],
    origine: 'scheda' as const,
  }

  it('disegna la scritta che il nodo porta, non una cablata nel codice', () => {
    expect(simboloDi(utenze)).toContain('>Utenze aria</text>')
    expect(simboloDi({ ...utenze, etichetta: 'Utenze azoto' })).toContain('>Utenze azoto</text>')
  })

  it('disegna il codolo tratteggiato e la punta di freccia piena', () => {
    const svg = simboloDi(utenze)
    // Tratteggio come le altre linee di servizio del disegno.
    expect(svg).toContain('stroke-dasharray="10 7"')
    // La punta è un triangolo pieno, non un marker: nell'editor il simbolo vive in un <svg>
    // suo, dove i <defs> di renderSvg non esistono e un marker-end non verrebbe disegnato.
    expect(svg).toContain('fill="#000"')
    expect(svg).not.toContain('marker-end')
  })

  it('dichiara una sola ancora, in basso al codolo, che accetta aria', () => {
    const def = definizioneDi(utenze)
    expect(def.ancore).toEqual([{ id: 'in', x: 12, y: 120, accetta: ['aria'] }])
    expect(def.dimensioni).toEqual({ larghezza: 190, altezza: 120 })
  })

  it('l’ancora accetta l’aria e rifiuta la condensa', () => {
    expect(capoValido(utenze, 'in', 'standard')).toBe(true)
    expect(capoValido(utenze, 'in', 'flessibile')).toBe(true)
    expect(capoValido(utenze, 'in', 'condensa')).toBe(false)
  })
})
