import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import {
  etichettaValore,
  modelliDa,
  ripartisciPerValore,
  soloCompressori,
  testoConferma,
} from '@/utils/modificaMassiva'

/**
 * I numeri sono quelli di produzione al 2026-08-03: 485 righe di compressore hanno
 * `giri` vuoto, 141 valgono «variabili» (backfill verificato modello per modello) e 6
 * valgono «fissi». È la sovrapposizione fra questi tre gruppi che la ripartizione deve
 * saper raccontare prima di scrivere.
 */
let seq = 0
const riga = (
  specs: Record<string, unknown>,
  modello = 'SK 22',
  tipo: string = 'Compressori'
): EquipmentCatalogItem =>
  ({
    id: `r${++seq}`,
    tipo,
    tipo_apparecchiatura: tipo,
    marca: 'KAESER KOMPRESSOREN SE',
    modello,
    specs,
    is_active: true,
    is_user_defined: false,
    usage_count: 0,
    created_at: '',
    updated_at: '',
  }) as EquipmentCatalogItem

describe('ripartisciPerValore', () => {
  it('separa i vuoti, i diversi e i già uguali', () => {
    const r = ripartisciPerValore(
      [
        riga({ fad: 2000 }, 'SK 22'),
        riga({ fad: 1680, giri: 'variabili' }, 'ASD 32 SFC'),
        riga({ fad: 1320, giri: 'fissi' }, 'SK 25'),
      ],
      'giri',
      'fissi'
    )
    expect(r.daCompilare.map(x => x.modello)).toEqual(['SK 22'])
    expect(r.daSostituire.map(x => x.modello)).toEqual(['ASD 32 SFC'])
    expect(r.giaUguali.map(x => x.modello)).toEqual(['SK 25'])
  })

  it('tratta la stringa vuota come campo da compilare', () => {
    const r = ripartisciPerValore([riga({ giri: '' })], 'giri', 'fissi')
    expect(r.daCompilare).toHaveLength(1)
    expect(r.daSostituire).toHaveLength(0)
  })

  it('funziona anche sulla tipologia costruttiva', () => {
    const r = ripartisciPerValore(
      [riga({}), riga({ tipo_compressore: 'PISTONI' })],
      'tipo_compressore',
      'VITE'
    )
    expect(r.daCompilare).toHaveLength(1)
    expect(r.daSostituire).toHaveLength(1)
  })

  it('regge una selezione vuota', () => {
    const r = ripartisciPerValore([], 'giri', 'fissi')
    expect(r).toEqual({ daCompilare: [], daSostituire: [], giaUguali: [] })
  })
})

describe('etichettaValore', () => {
  it('usa le etichette del contratto canonico, non il valore memorizzato', () => {
    expect(etichettaValore('giri', 'fissi')).toBe('a giri fissi')
    expect(etichettaValore('giri', 'variabili')).toBe('a giri variabili (inverter)')
    expect(etichettaValore('tipo_compressore', 'VITE')).toBe('Rotativo a vite')
  })

  it('ripiega sul valore quando l etichetta non c è', () => {
    expect(etichettaValore('giri', 'ignoto')).toBe('ignoto')
  })
})

describe('modelliDa', () => {
  it('elenca i modelli senza ripeterli', () => {
    expect(modelliDa([riga({}, 'SK 22'), riga({}, 'SK 22'), riga({}, 'SK 25')])).toBe('SK 22, SK 25')
  })

  it('tronca oltre il massimo e dice quanti restano', () => {
    const righe = ['A', 'B', 'C', 'D', 'E'].map(m => riga({}, m))
    expect(modelliDa(righe, 3)).toBe('A, B, C e altri 2')
  })
})

describe('testoConferma', () => {
  it('racconta i tre gruppi e conta solo le righe che tocca', () => {
    const rip = ripartisciPerValore(
      [riga({}), riga({}), riga({ giri: 'variabili' }, 'ASD 32 SFC'), riga({ giri: 'fissi' })],
      'giri',
      'fissi'
    )
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.titolo).toBe('Regolazione giri → a giri fissi')
    expect(t.righe[0]).toBe('2 righe hanno il campo vuoto e verranno compilate')
    expect(t.righe[1]).toBe(
      '1 riga ha già «a giri variabili (inverter)» e verrà sostituita: ASD 32 SFC'
    )
    expect(t.righe[2]).toBe('1 riga ha già questo valore e resta com è')
    expect(t.azione).toBe('Applica a 3 righe')
    expect(t.applicabile).toBe(true)
  })

  it('tace sui gruppi vuoti', () => {
    const rip = ripartisciPerValore([riga({}), riga({})], 'giri', 'fissi')
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.righe).toHaveLength(1)
    expect(t.azione).toBe('Applica a 2 righe')
  })

  it('non è applicabile quando non c è niente da fare', () => {
    const rip = ripartisciPerValore([riga({ giri: 'fissi' })], 'giri', 'fissi')
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.applicabile).toBe(false)
    expect(t.azione).toBe('Niente da applicare')
  })
})

describe('soloCompressori', () => {
  it('riconosce una selezione omogenea', () => {
    expect(soloCompressori([riga({}), riga({})])).toBe(true)
  })

  it('rifiuta una selezione mista', () => {
    expect(soloCompressori([riga({}), riga({}, 'ABC', 'Serbatoi')])).toBe(false)
  })

  it('una selezione vuota non è una selezione di compressori', () => {
    expect(soloCompressori([])).toBe(false)
  })
})
