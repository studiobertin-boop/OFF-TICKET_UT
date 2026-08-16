import { describe, it, expect } from 'vitest'
import { risolviLibreria, taraturaDi } from '../libreria'

const permanente = { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'sx', x: 0, y: 130, accetta: ['aria' as const] }] }
const diPratica = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [{ id: 'sx', x: 30, y: 130, accetta: ['aria' as const] }] }

describe('risoluzione dei tre strati', () => {
  it('senza tarature non risolve nulla: il default di fabbrica resta intatto', () => {
    expect(taraturaDi(risolviLibreria({}, {}), 'compressore')).toBeUndefined()
  })

  it('la taratura permanente vale quando la pratica non ne ha una sua', () => {
    expect(taraturaDi(risolviLibreria({ compressore: permanente }, {}), 'compressore')).toEqual(permanente)
  })

  it('la taratura di pratica vince su quella permanente', () => {
    const risolta = risolviLibreria({ compressore: permanente }, { compressore: diPratica })
    expect(taraturaDi(risolta, 'compressore')).toEqual(diPratica)
  })

  it('sostituisce per intero invece di fondere campo per campo', () => {
    // diPratica non dichiara ancore diverse per numero, ma le sue coordinate sono le
    // sole che devono sopravvivere: se qualcuno fondesse i campi, qui tornerebbe
    // l'ancora a x=0 della permanente insieme alla traslazione della pratica — uno stato
    // che nessuno ha mai visto sullo schermo.
    const risolta = risolviLibreria({ compressore: permanente }, { compressore: diPratica })
    expect(taraturaDi(risolta, 'compressore')!.ancore[0].x).toBe(30)
  })

  it('un simbolo tarato non tocca gli altri', () => {
    const risolta = risolviLibreria({ compressore: permanente }, {})
    expect(taraturaDi(risolta, 'tanica')).toBeUndefined()
  })
})
