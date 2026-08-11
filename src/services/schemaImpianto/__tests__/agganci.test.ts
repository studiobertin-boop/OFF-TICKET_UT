import { describe, it, expect } from 'vitest'
import { tipoAggancioPerStile, ancoraAmmette, capoValido } from '../agganci'

describe('compatibilita degli agganci', () => {
  it('mandata rigida e flessibile chiedono entrambe un aggancio aria', () => {
    expect(tipoAggancioPerStile('standard')).toBe('aria')
    expect(tipoAggancioPerStile('flessibile')).toBe('aria')
    expect(tipoAggancioPerStile('condensa')).toBe('condensa')
  })

  it('un ancora di sola aria rifiuta una linea condense', () => {
    const ancora = { id: 'dx', x: 0, y: 0, accetta: ['aria' as const] }
    expect(ancoraAmmette(ancora, 'standard')).toBe(true)
    expect(ancoraAmmette(ancora, 'condensa')).toBe(false)
  })

  it('lo scarico del serbatoio accetta la condensa ma non la mandata', () => {
    const serbatoio = { tipo: 'serbatoio' as const, orientamento: 'VERTICALE' as const }
    expect(capoValido(serbatoio, 'basso-out', 'condensa')).toBe(true)
    expect(capoValido(serbatoio, 'basso-out', 'standard')).toBe(false)
    expect(capoValido(serbatoio, 'dx', 'standard')).toBe(true)
  })

  it('un ancora inesistente non e mai valida', () => {
    expect(capoValido({ tipo: 'tanica' as const }, 'inventata', 'condensa')).toBe(false)
  })
})
