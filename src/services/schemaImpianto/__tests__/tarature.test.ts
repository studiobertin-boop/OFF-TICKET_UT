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

  it('scarta una scala nulla, negativa o non finita', () => {
    // Il caso concreto da cui `taraturaValida` esiste per difendere: `controScalaTesti`
    // (symbols/index.ts) calcola `1 / sx` per ogni scritta del simbolo. Con `sx: 0` ne esce
    // `Infinity` dentro un `transform`; con `NaN` un `transform` che il browser scarta in blocco,
    // e la scritta sparisce senza un errore da nessuna parte. `typeof === 'number'` da solo li
    // lasciava passare tutti e tre.
    const corpo = (scala: unknown) => ({ dx: 0, dy: 0, sx: scala, sy: 1, ancore: [] })

    expect(taratureDaRighe([{ chiave: 'compressore', taratura: corpo(0) }])).toEqual({})
    expect(taratureDaRighe([{ chiave: 'compressore', taratura: corpo(-1) }])).toEqual({})
    expect(taratureDaRighe([{ chiave: 'compressore', taratura: corpo(Number.NaN) }])).toEqual({})
    expect(taratureDaRighe([{ chiave: 'compressore', taratura: corpo(Number.POSITIVE_INFINITY) }])).toEqual({})
  })

  it('scarta una traslazione o una coordinata di ancora non finita', () => {
    expect(
      taratureDaRighe([{ chiave: 'compressore', taratura: { dx: Number.NaN, dy: 0, sx: 1, sy: 1, ancore: [] } }])
    ).toEqual({})
    expect(
      taratureDaRighe([
        {
          chiave: 'compressore',
          taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'a', x: Number.NaN, y: 0, accetta: ['aria'] }] },
        },
      ])
    ).toEqual({})
  })

  it('righe vuote producono una libreria vuota', () => {
    expect(taratureDaRighe([])).toEqual({})
  })
})
