import { describe, it, expect } from 'vitest'
import { appuntoDa, esitoVuoto, incollaAppunto, SCARTO_INCOLLA, type Appunto } from '../appunti'
import { codiceManualeLibero } from '../codici'
import type { SchemaNodoPosizionato } from '../types'

function nodo(parziale: Partial<SchemaNodoPosizionato>): SchemaNodoPosizionato {
  return {
    id: 'X', tipo: 'giunzione', etichetta: 'TEE', gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [],
    origine: 'scheda', x: 100, y: 100, ...parziale,
  }
}

const utenze = nodo({ id: 'UTENZE', tipo: 'utenze', etichetta: 'Utenze azoto', x: 800, y: 60 })
const tee = nodo({ id: 'M-G1', origine: 'manuale', x: 300, y: 200 })
const compressore = nodo({ id: 'C1', tipo: 'compressore', etichetta: 'Compressore' })
const testo = { id: 'T1', x: 50, y: 50, contenuto: 'Nota' }
const area = { id: 'A1', x: 10, y: 10, larghezza: 300, altezza: 200, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } }
const freccia = { id: 's9', tipo: 'freccia_direzione' as const, t: 0.3, stileAValle: 'flessibile' as const }
const valvola = { id: 's1', tipo: 'valvola_intercettazione' as const, t: 0.5 }

const vuoto = (): Appunto => ({ nodi: [], testi: [], aree: [], frecce: [] })

describe('codiceManualeLibero', () => {
  it('prefissa M- e salta i codici usati', () => {
    expect(codiceManualeLibero('U', new Set())).toBe('M-U1')
    expect(codiceManualeLibero('G', new Set(['M-G1', 'M-G2']))).toBe('M-G3')
  })
})

describe('appuntoDa', () => {
  it('tiene utenze, TEE, testi, aree e frecce, e scarta il resto in silenzio', () => {
    const a = appuntoDa({ nodi: [utenze, tee, compressore], testi: [testo], aree: [area], frecce: [freccia, valvola] })!
    expect(a.nodi.map((n) => n.id)).toEqual(['UTENZE', 'M-G1'])
    expect(a.frecce.map((f) => f.id)).toEqual(['s9'])
    expect(a.testi).toEqual([testo])
    expect(a.aree).toEqual([area])
  })

  it('senza nulla di copiabile restituisce null, così l\'appunto precedente resta', () => {
    expect(appuntoDa({ ...vuoto(), nodi: [compressore], frecce: [valvola] })).toBeNull()
  })

  it('copia in profondità: cambiare l\'originale non cambia l\'appunto', () => {
    const originale = { ...area, scartoScritta: { dx: 10, dy: 30 } }
    const a = appuntoDa({ ...vuoto(), aree: [originale] })!
    originale.scartoScritta.dx = 99
    expect(a.aree[0].scartoScritta.dx).toBe(10)
  })
})

describe('incollaAppunto', () => {
  const contesto = (parziale = {}) => ({
    idNodi: new Set(['UTENZE', 'M-G1', 'C1', 'M-U1']),
    idTesti: new Set(['T1']),
    idAree: new Set(['A1']),
    segniBersaglio: null,
    ...parziale,
  })

  it('i nodi tornano manuali, scollegati, con codici nuovi e spostati di 20 per ripetizione', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [utenze, tee] })!
    const primo = incollaAppunto(a, contesto(), 1)
    expect(primo.nodi.map((n) => n.id)).toEqual(['M-U2', 'M-G2'])
    expect(primo.nodi.every((n) => n.origine === 'manuale')).toBe(true)
    expect(primo.nodi[0]).toMatchObject({ tipo: 'utenze', etichetta: 'Utenze azoto', x: 820, y: 80 })
    const terzo = incollaAppunto(a, contesto(), 3)
    expect(terzo.nodi[1]).toMatchObject({ x: 300 + 3 * SCARTO_INCOLLA, y: 200 + 3 * SCARTO_INCOLLA })
  })

  it('un codice scritto a mano sull\'originale non passa alla copia', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [{ ...tee, codice: 'TEE-A' }] })!
    expect('codice' in incollaAppunto(a, contesto(), 1).nodi[0]).toBe(false)
  })

  it('due nodi dello stesso tipo nello stesso incolla non collidono fra loro', () => {
    const a = appuntoDa({ ...vuoto(), nodi: [tee, { ...tee, id: 'M-G7' }] })!
    const ids = incollaAppunto(a, contesto(), 1).nodi.map((n) => n.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('testi e aree con id nuovi e lo stesso scarto', () => {
    const a = appuntoDa({ ...vuoto(), testi: [testo], aree: [area] })!
    const esito = incollaAppunto(a, contesto(), 1)
    expect(esito.testi).toEqual([{ id: 'T2', x: 70, y: 70, contenuto: 'Nota' }])
    expect(esito.aree[0]).toMatchObject({ id: 'A2', x: 30, y: 30, scritta: 'SALA', scartoScritta: { dx: 10, dy: 30 } })
  })

  it('senza un tubo bersaglio le frecce si saltano e lo si dice', () => {
    const a = appuntoDa({ ...vuoto(), testi: [testo], frecce: [freccia] })!
    const esito = incollaAppunto(a, contesto(), 1)
    expect(esito.frecce).toEqual([])
    expect(esito.frecceSaltate).toBe(true)
    expect(esito.testi).toHaveLength(1)
  })

  it('sul tubo bersaglio una freccia va a metà, più frecce si distribuiscono', () => {
    const una = incollaAppunto(appuntoDa({ ...vuoto(), frecce: [freccia] })!, contesto({ segniBersaglio: [valvola] }), 1)
    expect(una.frecce).toEqual([{ id: 'freccia-1', tipo: 'freccia_direzione', t: 0.5 }])
    const tre = incollaAppunto(
      appuntoDa({ ...vuoto(), frecce: [freccia, { ...freccia, id: 's10' }, { ...freccia, id: 's11' }] })!,
      contesto({ segniBersaglio: [{ ...freccia, id: 'freccia-1' }] }),
      1
    )
    expect(tre.frecce.map((f) => f.t)).toEqual([0.25, 0.5, 0.75])
    expect(tre.frecce.map((f) => f.id)).toEqual(['freccia-2', 'freccia-3', 'freccia-4'])
    expect(tre.frecceSaltate).toBe(false)
  })

  it('esitoVuoto', () => {
    const a = appuntoDa({ ...vuoto(), frecce: [freccia] })!
    expect(esitoVuoto(incollaAppunto(a, contesto(), 1))).toBe(true)
  })
})
