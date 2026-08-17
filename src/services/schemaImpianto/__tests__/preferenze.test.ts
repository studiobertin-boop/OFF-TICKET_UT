import { describe, it, expect } from 'vitest'
import {
  contigui,
  famiglieDaScheda,
  improntaPreferenze,
  ordinaPerElenco,
  prossimoIdBypass,
  risolviPreferenze,
} from '../preferenze'
import type { SchemaNodo } from '../types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'

const nodo = (id: string, tipo: SchemaNodo['tipo'] = 'filtro'): SchemaNodo => ({
  id,
  tipo,
  etichetta: id,
  gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [],
  origine: 'scheda',
})

const stadi = [nodo('F1'), nodo('E1', 'essiccatore'), nodo('F2'), nodo('F3')]
const serbatoi = [nodo('S1', 'serbatoio'), nodo('S2', 'serbatoio')]
const compressori = [nodo('C1', 'compressore'), nodo('C2', 'compressore')]
const famiglie = { compressori, serbatoi, stadi }
const scaricaSempre = () => true

describe('famiglieDaScheda', () => {
  const scheda = {
    compressori: [{ codice: 'C1', marca: 'KAESER' }, { codice: 'C2' }],
    serbatoi: [
      { codice: 'S1', ubicazione: 'LINEA_DISTRIBUZIONE' },
      { codice: 'S2', ubicazione: 'SALA_COMPRESSORI' },
      { codice: 'S3' },
    ],
    essiccatori: [{ codice: 'E1' }],
    filtri: [
      { codice: 'F1', tipo: 'LINEA' },
      { codice: 'F2', tipo: 'PREFILTRO' },
    ],
    separatori: [{ codice: 'SEP1' }],
  } as unknown as SchedaDatiCompleta

  it('mette i serbatoi di sala prima di quelli in linea, senza mescolare il resto', () => {
    // S3 non dichiara l'ubicazione: vale sala compressori, come in `buildSerbatoioNodi`.
    expect(famiglieDaScheda(scheda).serbatoi.map((n) => n.id)).toEqual(['S2', 'S3', 'S1'])
  })

  it('ordina gli stadi come il generatore: prefiltri, essiccatori, filtri di linea, separatori', () => {
    expect(famiglieDaScheda(scheda).stadi.map((n) => n.id)).toEqual(['F2', 'E1', 'F1', 'SEP1'])
  })

  it('tiene i compressori nell’ordine di scheda e ne riporta la marca', () => {
    const compressori = famiglieDaScheda(scheda).compressori
    expect(compressori.map((n) => n.id)).toEqual(['C1', 'C2'])
    expect(compressori[0].etichetta).toBe('Compressore KAESER')
    expect(compressori[1].etichetta).toBe('Compressore')
  })

  it('regge una scheda vuota', () => {
    const vuota = famiglieDaScheda({} as SchedaDatiCompleta)
    expect(vuota.compressori).toEqual([])
    expect(vuota.serbatoi).toEqual([])
    expect(vuota.stadi).toEqual([])
  })
})

describe('ordinaPerElenco', () => {
  it('segue l’elenco e mette in coda chi non è nominato', () => {
    expect(ordinaPerElenco(stadi, ['F2', 'F1']).map((n) => n.id)).toEqual(['F2', 'F1', 'E1', 'F3'])
  })

  it('tiene fra loro l’ordine di default per chi non è nominato', () => {
    // E1 e F3 non sono nell'elenco: devono restare nell'ordine in cui arrivano, non invertirsi.
    expect(ordinaPerElenco(stadi, ['F2']).map((n) => n.id)).toEqual(['F2', 'F1', 'E1', 'F3'])
  })

  it('ignora un elenco che nomina chi non c’è', () => {
    expect(ordinaPerElenco(stadi, ['F9', 'E1']).map((n) => n.id)).toEqual(['E1', 'F1', 'F2', 'F3'])
  })

  it('senza elenco lascia l’ordine di default', () => {
    expect(ordinaPerElenco(stadi, undefined).map((n) => n.id)).toEqual(['F1', 'E1', 'F2', 'F3'])
  })
})

describe('contigui', () => {
  const ordine = ['F1', 'E1', 'F2', 'F3']

  it('riconosce un intervallo attaccato', () => {
    expect(contigui(['E1', 'F2'], ordine)).toBe(true)
  })

  it('riconosce un intervallo con un buco', () => {
    expect(contigui(['F1', 'F2'], ordine)).toBe(false)
  })

  it('non si fa ingannare dall’ordine in cui sono elencati', () => {
    expect(contigui(['F2', 'E1'], ordine)).toBe(true)
  })

  it('un solo elemento è sempre contiguo', () => {
    expect(contigui(['F2'], ordine)).toBe(true)
  })

  it('un elenco vuoto non è un intervallo', () => {
    expect(contigui([], ordine)).toBe(false)
  })
})

describe('prossimoIdBypass', () => {
  it('parte da bp1', () => {
    expect(prossimoIdBypass([])).toBe('bp1')
  })

  it('prende il primo intero libero, non il successivo del massimo', () => {
    expect(prossimoIdBypass([{ id: 'bp1' }, { id: 'bp3' }])).toBe('bp2')
  })

  it('non si confonde con un id che non segue la forma', () => {
    expect(prossimoIdBypass([{ id: 'bp1' }, { id: 'vecchio' }])).toBe('bp2')
  })
})

describe('risolviPreferenze', () => {
  it('senza preferenze usa i default', () => {
    const r = risolviPreferenze(undefined, famiglie, scaricaSempre)
    expect(r.ordineCompressori).toEqual(['C1', 'C2'])
    expect(r.ordineStadi).toEqual(['F1', 'E1', 'F2', 'F3'])
    expect(r.ordineSerbatoi).toEqual(['S1', 'S2'])
    expect([...r.condense].sort()).toEqual(['C1', 'C2', 'E1', 'F1', 'F2', 'F3', 'S1', 'S2'])
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual([])
  })

  it('riordina anche i compressori', () => {
    const r = risolviPreferenze({ ordineCompressori: ['C2'] }, famiglie, scaricaSempre)
    expect(r.ordineCompressori).toEqual(['C2', 'C1'])
  })

  it('il flag condense vale anche sui compressori', () => {
    const r = risolviPreferenze({ condense: { C1: false } }, famiglie, scaricaSempre)
    expect(r.condense.has('C1')).toBe(false)
    expect(r.condense.has('C2')).toBe(true)
  })

  it('una condensa spenta a mano vince sul default', () => {
    const r = risolviPreferenze({ condense: { F2: false } }, famiglie, scaricaSempre)
    expect(r.condense.has('F2')).toBe(false)
    expect(r.condense.has('F1')).toBe(true)
  })

  it('una condensa accesa a mano vince su un default negativo', () => {
    const r = risolviPreferenze({ condense: { F2: true } }, famiglie, () => false)
    expect([...r.condense]).toEqual(['F2'])
  })

  it('tiene un gruppo by-pass ancora contiguo', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] }, famiglie, scaricaSempre)
    expect(r.bypass).toEqual([{ id: 'bp1', stadi: ['E1', 'F2'] }])
    expect(r.bypassScartati).toEqual([])
  })

  it('riordina i membri del gruppo secondo l’ordine risolto', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['F2', 'E1'] }] }, famiglie, scaricaSempre)
    expect(r.bypass[0].stadi).toEqual(['E1', 'F2'])
  })

  it('scarta un gruppo che ha perso la contiguità e lo riporta', () => {
    // Riordinando gli stadi, E1 e F2 non sono più attaccati.
    const r = risolviPreferenze(
      { ordineStadi: ['E1', 'F1', 'F2', 'F3'], bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] },
      famiglie,
      scaricaSempre
    )
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual(['bp1'])
  })

  it('accorcia un gruppo che nomina un’apparecchiatura sparita', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F9'] }] }, famiglie, scaricaSempre)
    expect(r.bypass.map((g) => g.stadi)).toEqual([['E1']])
    expect(r.bypassScartati).toEqual([])
  })

  it('regge preferenze storte senza sollevare', () => {
    const storte = { ordineStadi: 'F1', condense: null, bypass: [{ id: 'bp1' }] } as never
    expect(() => risolviPreferenze(storte, famiglie, scaricaSempre)).not.toThrow()
  })
})

describe('improntaPreferenze', () => {
  it('non cambia quando l’ordine di due chiavi cambia', () => {
    const a = risolviPreferenze({ condense: { F1: true, F2: false } }, famiglie, scaricaSempre)
    const b = risolviPreferenze({ condense: { F2: false, F1: true } }, famiglie, scaricaSempre)
    expect(improntaPreferenze(a)).toBe(improntaPreferenze(b))
  })

  it('cambia quando cambia l’ordine degli stadi', () => {
    const a = risolviPreferenze(undefined, famiglie, scaricaSempre)
    const b = risolviPreferenze({ ordineStadi: ['F2'] }, famiglie, scaricaSempre)
    expect(improntaPreferenze(a)).not.toBe(improntaPreferenze(b))
  })
})
