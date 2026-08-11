import { describe, it, expect } from 'vitest'
import { chiaveSimbolo } from '../types'

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
