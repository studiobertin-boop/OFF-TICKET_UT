import { describe, expect, it, vi } from 'vitest'

// `taratureDaRighe` è pura e non tocca la rete, ma il modulo importa `supabase` in testa (lo
// usano le altre due funzioni esportate): senza questo mock il solo import fallirebbe qui nei
// test per mancanza delle variabili d'ambiente, che in produzione ci sono sempre.
vi.mock('../../supabase', () => ({ supabase: {} }))

import { taratureDaRighe } from '../tarature'

describe('taratureDaRighe', () => {
  it('accetta una riga con corpo e chiave riconosciuti', () => {
    const risolte = taratureDaRighe([
      { chiave: 'compressore', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] } },
    ])
    expect(risolte.compressore).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] })
  })

  it('scarta le righe il cui corpo non è una taratura', () => {
    // La colonna è JSONB: nessun vincolo di forma la protegge. Una riga scritta a mano o
    // rimasta da una versione precedente non deve far cadere l'editor.
    const risolte = taratureDaRighe([
      { chiave: 'compressore', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] } },
      { chiave: 'tanica', taratura: { sx: 'due' } },
      { chiave: 'ignoto:XYZ', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] } },
    ])
    expect(Object.keys(risolte)).toEqual(['compressore'])
  })

  it('scarta un\'ancora malformata dentro un corpo altrimenti valido', () => {
    const risolte = taratureDaRighe([
      { chiave: 'compressore', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'a', x: 0 }] } },
    ])
    expect(risolte.compressore).toBeUndefined()
  })

  it('righe vuote producono una libreria vuota', () => {
    expect(taratureDaRighe([])).toEqual({})
  })
})
