import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import { etichettaVariante, raggruppaVarianti, testoAvvisoVariante } from '@/utils/equipmentVarianti'

/**
 * I numeri sono quelli di produzione, verificati sulle brochure KAESER:
 * SK 22 ha tre varianti con pressioni di lavoro 7,5/10/13 e massime 8/11/15;
 * ASD 50 SFC ne ha tre di cui due condividono la massima di 13 bar.
 */
let seq = 0
const riga = (specs: Record<string, unknown>): EquipmentCatalogItem =>
  ({
    id: `r${++seq}`,
    tipo: 'Compressori',
    tipo_apparecchiatura: 'Compressori',
    marca: 'KAESER KOMPRESSOREN SE',
    modello: 'SK 22',
    specs,
    is_active: true,
    is_user_defined: false,
    usage_count: 0,
    created_at: '',
    updated_at: '',
  }) as EquipmentCatalogItem

describe('raggruppaVarianti', () => {
  it('indicizza per la pressione dichiarata alla scheda', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 }),
      riga({ pressione_esercizio: 7.5, pressione_max: 8, fad: 2000 }),
      riga({ pressione_esercizio: 13, pressione_max: 15, fad: 1320 }),
    ])
    expect(v.map(x => x.value)).toEqual([8, 11, 15])
    expect(v.map(x => x.variante)).toEqual([7.5, 10, 13])
  })

  it('tiene distinte due varianti che condividono la massima — ASD 50 SFC', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 7.5, pressione_max: 8.5, fad: 5270 }),
      riga({ pressione_esercizio: 10, pressione_max: 13, fad: 4580 }),
      riga({ pressione_esercizio: 13, pressione_max: 13, fad: 3820 }),
    ])
    expect(v).toHaveLength(3)
    expect(v.map(x => [x.value, x.variante])).toEqual([[8.5, 7.5], [13, 10], [13, 13]])
  })

  it('collassa le righe quasi-duplicate tenendo quella piu completa', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_max: 10 }),
      riga({ pressione_esercizio: 10, pressione_max: 10, fad: 1000 }),
    ])
    expect(v).toHaveLength(1)
    expect(v[0].item.specs?.fad).toBe(1000)
  })

  it('scarta le righe senza alcuna pressione', () => {
    expect(raggruppaVarianti('Compressori', [riga({ fad: 1000 })])).toEqual([])
  })

  it('legge le chiavi generiche dell import per gli altri tipi', () => {
    const serbatoio = {
      ...riga({ pressione: '11', volume: '500' }),
      tipo_apparecchiatura: 'Serbatoi',
    } as EquipmentCatalogItem
    const v = raggruppaVarianti('Serbatoi', [serbatoio])
    expect(v.map(x => x.value)).toEqual([11])
  })
})

describe('etichettaVariante', () => {
  it('accosta la portata alla pressione, con la virgola decimale', () => {
    const [a] = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 7.5, pressione_max: 8.5, fad: 5270 }),
    ])
    expect(etichettaVariante('Compressori', a)).toBe('8,5 bar · 5270 l/min')
  })

  it('distingue a video due varianti alla stessa pressione', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 10, pressione_max: 13, fad: 4580 }),
      riga({ pressione_esercizio: 13, pressione_max: 13, fad: 3820 }),
    ])
    expect(v.map(x => etichettaVariante('Compressori', x))).toEqual([
      '13 bar · 4580 l/min',
      '13 bar · 3820 l/min',
    ])
  })

  it('resta la sola pressione quando la capacita manca', () => {
    const [a] = raggruppaVarianti('Compressori', [riga({ pressione_max: 11 })])
    expect(etichettaVariante('Compressori', a)).toBe('11 bar')
  })

  it('usa l unita del tipo — litri sui serbatoi', () => {
    const serbatoio = {
      ...riga({ ps: 11, volume: 500 }),
      tipo_apparecchiatura: 'Serbatoi',
    } as EquipmentCatalogItem
    const [a] = raggruppaVarianti('Serbatoi', [serbatoio])
    expect(etichettaVariante('Serbatoi', a)).toBe('11 bar · 500 l')
  })
})

describe('testoAvvisoVariante', () => {
  it('elenca le varianti esistenti e annuncia quella nuova', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'SK 22',
      pressioniEsistenti: [11, 8, 15],
      nuova: 9,
    })
    expect(a?.titolo).toBe('Variante nuova di un modello già a catalogo')
    expect(a?.corpo).toBe(
      'A catalogo KAESER KOMPRESSOREN SE SK 22 esiste già in 3 varianti: 8, 11 e 15 bar. ' +
        'Stai per aggiungerne una a 9 bar.'
    )
  })

  it('al singolare non parla di varianti', () => {
    const a = testoAvvisoVariante({
      marca: 'CECCATO ARIA COMPRESSA S.R.L.',
      modello: 'CSA 10',
      pressioniEsistenti: [8],
      nuova: 13,
    })
    expect(a?.corpo).toBe(
      'A catalogo CECCATO ARIA COMPRESSA S.R.L. CSA 10 esiste già a 8 bar. ' +
        'Stai per aggiungerne una a 13 bar.'
    )
  })

  it('tiene la virgola decimale', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'ASD 50',
      pressioniEsistenti: [8.5, 12, 15],
      nuova: 10.5,
    })
    expect(a?.corpo).toContain('8,5, 12 e 15 bar')
    expect(a?.corpo).toContain('a 10,5 bar')
  })

  it('regge la pressione nuova non ancora scritta', () => {
    const a = testoAvvisoVariante({
      marca: 'KAESER KOMPRESSOREN SE',
      modello: 'SK 22',
      pressioniEsistenti: [8, 11],
      nuova: null,
    })
    expect(a?.corpo).toContain("Stai per aggiungerne un'altra.")
  })

  it('tace quando il modello non e a catalogo: non c e nulla da segnalare', () => {
    expect(
      testoAvvisoVariante({ marca: 'ACME', modello: 'X1', pressioniEsistenti: [], nuova: 8 })
    ).toBeNull()
  })
})
