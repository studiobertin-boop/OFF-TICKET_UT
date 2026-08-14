import { describe, expect, it } from 'vitest'
import { Position } from '@xyflow/react'
import { REGISTRO_SIMBOLI, presaDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora } from '@/services/schemaImpianto/types'
import { latoDi } from '../SchemaNodeSymbol'

const RIQUADRO = { larghezza: 100, altezza: 60 }

describe('presaDi', () => {
  // Il caso di ogni simbolo esistente: nessuna presa dichiarata, si afferra sull'ancora.
  it('senza presa dichiarata restituisce l’ancora', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 6, y: 49, accetta: ['aria'] }
    expect(presaDi(ancora)).toEqual({ x: 6, y: 49 })
  })

  it('con la presa dichiarata restituisce quella, non l’ancora', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 12, y: 12, accetta: ['aria'], presa: { x: 0, y: 12 } }
    expect(presaDi(ancora)).toEqual({ x: 0, y: 12 })
  })

  // Il valore restituito non deve essere l'oggetto `presa` stesso né l'ancora: chi lo riceve
  // lo usa per costruire uno stile, e una mutazione accidentale corromperebbe il registro,
  // che è un modulo condiviso da documento ed editor.
  it('non restituisce l’oggetto del registro', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 12, y: 12, accetta: ['aria'], presa: { x: 0, y: 12 } }
    expect(presaDi(ancora)).not.toBe(ancora.presa)
  })
})

describe('latoDi', () => {
  // La deduzione di sempre, che deve restare intatta per tutti i simboli senza `lato`.
  it('senza lato dichiarato deduce il bordo più vicino', () => {
    expect(latoDi({ id: 'sx', x: 6, y: 30, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Left)
    expect(latoDi({ id: 'dx', x: 94, y: 30, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Right)
    expect(latoDi({ id: 'alto', x: 50, y: 4, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Top)
    expect(latoDi({ id: 'basso', x: 50, y: 56, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Bottom)
  })

  // Il lato dichiarato vince anche quando la deduzione direbbe altro: è il caso della
  // giunzione, dove le quattro ancore coincidono e la deduzione è degenere.
  it('il lato dichiarato vince sulla deduzione', () => {
    // Annotata, non dedotta: senza il tipo esplicito `accetta` diventerebbe `string[]`, che
    // non è assegnabile a `SchemaTipoAggancio[]` — la costante non ha un tipo contestuale
    // come lo hanno gli argomenti passati direttamente a `latoDi`.
    const alCentro: SchemaAncora = { id: 'x', x: 50, y: 30, accetta: ['aria'] }
    expect(latoDi({ ...alCentro, lato: 'basso' }, RIQUADRO)).toBe(Position.Bottom)
    expect(latoDi({ ...alCentro, lato: 'dx' }, RIQUADRO)).toBe(Position.Right)
    expect(latoDi({ ...alCentro, lato: 'alto' }, RIQUADRO)).toBe(Position.Top)
    expect(latoDi({ ...alCentro, lato: 'sx' }, RIQUADRO)).toBe(Position.Left)
  })
})

describe('il registro dei simboli', () => {
  // Regola del registro: la deduzione di `latoDi` lavora sull'ANCORA, non sulla presa —
  // quindi un attacco che dichiara una presa altrove senza dichiarare il lato finirebbe
  // appoggiato al lato sbagliato, in silenzio.
  it('ogni ancora che dichiara una presa dichiara anche il lato', () => {
    const conPresa = Object.values(REGISTRO_SIMBOLI).flatMap((d) => d.ancore.filter((a) => a.presa))
    expect(conPresa.every((a) => Boolean(a.lato))).toBe(true)
  })

  // Il caso che il lato esplicito esiste per risolvere: le quattro ancore coincidono, quindi
  // la deduzione le appoggerebbe tutte allo stesso lato e i quattro handle finirebbero
  // sovrapposti — con `connectionMode` Strict, tre attacchi su quattro diventerebbero
  // irraggiungibili.
  it('i quattro attacchi della giunzione finiscono su quattro lati diversi', () => {
    const dim = REGISTRO_SIMBOLI.giunzione.dimensioni
    const lati = REGISTRO_SIMBOLI.giunzione.ancore.map((a) => latoDi(a, dim))
    expect(new Set(lati).size).toBe(4)
    expect(lati).toEqual([Position.Left, Position.Right, Position.Top, Position.Bottom])
  })
})
