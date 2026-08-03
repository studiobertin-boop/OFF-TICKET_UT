import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import {
  etichettaValore,
  idsDaScrivere,
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
    expect(r).toEqual({
      daCompilare: [],
      daSostituire: [],
      giaUguali: [],
      nonApplicabili: [],
      daRipulire: [],
      chiaviDaRipulire: [],
    })
  })

  it('esclude dai giri le righe che non sono rotativi a vite', () => {
    const scroll = riga({ tipo_compressore: 'SCROLL' }, 'ESM 33')
    const r = ripartisciPerValore([scroll, riga({}, 'SK 22')], 'giri', 'fissi')
    expect(r.nonApplicabili.map(x => x.modello)).toEqual(['ESM 33'])
    expect(r.daCompilare.map(x => x.modello)).toEqual(['SK 22'])
    expect(r.daSostituire).toHaveLength(0)
    expect(r.giaUguali).toHaveLength(0)
  })

  it('la stessa riga scroll si compila normalmente sul tipo costruttivo', () => {
    const scroll = riga({ tipo_compressore: 'SCROLL' }, 'ESM 33')
    const r = ripartisciPerValore([scroll], 'tipo_compressore', 'VITE')
    expect(r.nonApplicabili).toHaveLength(0)
    expect(r.daSostituire.map(x => x.modello)).toEqual(['ESM 33'])
  })

  it('esclude dai giri anche una riga non applicabile che un valore ce l ha già', () => {
    // Uno scroll con i giri già scritti: il campo non si applica, e il fatto che porti
    // qualcosa non lo rende scrivibile. Senza questa prova la guardia potrebbe scivolare nel
    // solo ramo dei campi vuoti e la suite non se ne accorgerebbe.
    const scroll = riga({ tipo_compressore: 'SCROLL', giri: 'variabili' }, 'ESM 33')
    const r = ripartisciPerValore([scroll], 'giri', 'fissi')
    expect(r.nonApplicabili.map(x => x.modello)).toEqual(['ESM 33'])
    expect(r.daSostituire).toHaveLength(0)
    expect(r.daCompilare).toHaveLength(0)
    expect(r.giaUguali).toHaveLength(0)
    expect(idsDaScrivere(r)).toEqual([])
  })

  it('e nemmeno quando i giri già scritti coincidono con il valore chiesto', () => {
    const scroll = riga({ tipo_compressore: 'SCROLL', giri: 'fissi' }, 'ESM 33')
    const r = ripartisciPerValore([scroll], 'giri', 'fissi')
    expect(r.nonApplicabili.map(x => x.modello)).toEqual(['ESM 33'])
    expect(r.giaUguali).toHaveLength(0)
  })
})

describe('ripartisciPerValore — il verso opposto: la pulizia', () => {
  it('segnala i giri che il nuovo tipo costruttivo rende inapplicabili', () => {
    const r = ripartisciPerValore(
      [
        riga({ giri: 'variabili' }, 'ASD 32 SFC'),
        riga({ giri: 'fissi' }, 'SK 22'),
        riga({ fad: 2000 }, 'SM 10'),
      ],
      'tipo_compressore',
      'PISTONI'
    )
    expect(r.daCompilare).toHaveLength(3)
    expect(r.daRipulire.map(x => x.modello)).toEqual(['ASD 32 SFC', 'SK 22'])
    expect(r.chiaviDaRipulire).toEqual(['giri'])
  })

  it('non tocca niente quando il nuovo tipo lascia i giri applicabili', () => {
    const r = ripartisciPerValore(
      [riga({ giri: 'variabili' }, 'ASD 32 SFC')],
      'tipo_compressore',
      'VITE'
    )
    expect(r.daRipulire).toHaveLength(0)
    expect(r.chiaviDaRipulire).toEqual([])
  })

  it('non ripulisce le righe che non si scrivono', () => {
    // Ha già «a pistoni» e resta com'è: la regolazione giri che porta è sporcizia di prima,
    // e non è questa scrittura — che non avviene — a doverla togliere.
    const r = ripartisciPerValore(
      [riga({ tipo_compressore: 'PISTONI', giri: 'variabili' }, 'ABAC B24')],
      'tipo_compressore',
      'PISTONI'
    )
    expect(r.giaUguali.map(x => x.modello)).toEqual(['ABAC B24'])
    expect(r.daRipulire).toHaveLength(0)
    expect(r.chiaviDaRipulire).toEqual([])
  })

  it('scrivere i giri non rende inapplicabile nient altro', () => {
    const r = ripartisciPerValore([riga({ tipo_compressore: 'VITE' }, 'SK 22')], 'giri', 'fissi')
    expect(r.daCompilare).toHaveLength(1)
    expect(r.daRipulire).toHaveLength(0)
  })

  it('le righe da ripulire restano fra quelle che si scrivono', () => {
    const r = ripartisciPerValore(
      [riga({ giri: 'variabili' }, 'ASD 32 SFC')],
      'tipo_compressore',
      'SCROLL'
    )
    expect(idsDaScrivere(r)).toEqual(r.daCompilare.map(x => x.id))
    expect(r.daRipulire.map(x => x.id)).toEqual(idsDaScrivere(r))
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
    expect(t.righe[2]).toBe("1 riga ha già questo valore e resta com'è")
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

  it('nomina le righe che non sono rotativi a vite, senza contarle nell azione', () => {
    const rip = ripartisciPerValore(
      [riga({ tipo_compressore: 'SCROLL' }, 'ESM 33'), riga({}, 'SK 22')],
      'giri',
      'fissi'
    )
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.righe).toContain("1 riga non è un rotativo a vite e resta com'è")
    expect(t.azione).toBe('Applica a 1 riga')
  })

  it('la concordanza plurale vale anche sui non applicabili', () => {
    const rip = ripartisciPerValore(
      [
        riga({ tipo_compressore: 'SCROLL' }, 'ESM 33'),
        riga({ tipo_compressore: 'PISTONI' }, 'ABAC B24'),
      ],
      'giri',
      'fissi'
    )
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.righe).toEqual(['2 righe non sono rotativi a vite e restano come sono'])
    expect(t.applicabile).toBe(false)
  })

  it('dichiara la regolazione giri che il nuovo tipo costruttivo porta via', () => {
    const rip = ripartisciPerValore(
      [
        riga({ giri: 'variabili' }, 'ASD 32 SFC'),
        riga({ giri: 'fissi' }, 'SK 22 SFC'),
        riga({ fad: 2000 }, 'SM 10'),
      ],
      'tipo_compressore',
      'PISTONI'
    )
    const t = testoConferma(rip, 'tipo_compressore', 'PISTONI')
    expect(t.titolo).toBe('Tipo costruttivo → A pistoni')
    expect(t.righe[0]).toBe('3 righe hanno il campo vuoto e verranno compilate')
    expect(t.righe[1]).toBe(
      '2 righe portano un valore in «Regolazione giri» che con questa scelta non si applica più e verrà rimosso: ASD 32 SFC, SK 22 SFC'
    )
    expect(t.azione).toBe('Applica a 3 righe')
  })

  it('concorda al singolare anche la riga della pulizia', () => {
    const rip = ripartisciPerValore(
      [riga({ giri: 'variabili' }, 'ASD 32 SFC')],
      'tipo_compressore',
      'SCROLL'
    )
    const t = testoConferma(rip, 'tipo_compressore', 'SCROLL')
    expect(t.righe).toContain(
      '1 riga porta un valore in «Regolazione giri» che con questa scelta non si applica più e verrà rimosso: ASD 32 SFC'
    )
  })

  it('l azione annunciata e le righe da scrivere vengono dallo stesso calcolo', () => {
    // L'invariante per cui questa conferma esiste: se il pulsante contasse per conto suo,
    // il giorno in cui una delle due regole cambia annuncerebbe N e ne scriverebbe M.
    const casi: Array<[Parameters<typeof ripartisciPerValore>[0], 'giri' | 'tipo_compressore', string]> = [
      [[riga({}), riga({ giri: 'variabili' }), riga({ giri: 'fissi' })], 'giri', 'fissi'],
      [[riga({ tipo_compressore: 'SCROLL' }), riga({})], 'giri', 'variabili'],
      [[riga({ giri: 'variabili' }), riga({ tipo_compressore: 'PISTONI' })], 'tipo_compressore', 'PISTONI'],
      [[], 'giri', 'fissi'],
    ]

    for (const [righe, chiave, valore] of casi) {
      const rip = ripartisciPerValore(righe, chiave, valore)
      const t = testoConferma(rip, chiave, valore)
      const n = idsDaScrivere(rip).length
      expect(t.applicabile).toBe(n > 0)
      expect(t.azione).toBe(n === 0 ? 'Niente da applicare' : `Applica a ${n} ${n === 1 ? 'riga' : 'righe'}`)
    }
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
