/**
 * Banco del Blocco 3: misura quanto un impianto cambia da capo a fondo.
 *
 * Ogni lato costruisce la catena INTERA (scheda → layoutSchema → renderSvg). Confrontare
 * due renderSvg sullo stesso layout misurerebbe zero proprio dove il Blocco 3 lavora di
 * più — le dimensioni dei simboli, che entrano nel layout prima del disegno.
 */
import { describe, it, expect } from 'vitest'
import { layoutSchema } from '../layout'
import { renderSvg } from '../renderSvg'
import { buildSchemaModel } from '../buildSchemaModel'
import { makeScheda, makeCompressore, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'

function catena(scheda: ReturnType<typeof makeScheda>): string {
  return renderSvg(
    layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
  )
}

describe('banco del Blocco 3', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: true })],
    serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
  })

  it('la catena intera è deterministica: due passate danno lo stesso SVG', () => {
    expect(catena(scheda)).toBe(catena(scheda))
  })

  it('DISCRIMINA: un cambiamento negli ingombri arriva fino all SVG', () => {
    // Prova che il banco vede ciò che deve vedere. Senza questo test, un banco montato
    // troppo a valle resterebbe verde per tutto il blocco e non lo saprebbe nessuno.
    const primaDelCambio = catena(scheda)
    const conSerbatoioOrizzontale = catena(
      makeScheda({
        compressori: [makeCompressore({ ha_disoleatore: true })],
        serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      })
    )
    expect(conSerbatoioOrizzontale).not.toBe(primaDelCambio)
  })
})
