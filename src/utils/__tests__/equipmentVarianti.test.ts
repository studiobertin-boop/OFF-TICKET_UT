import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import {
  etichettaVariante, raggruppaVarianti, scegliVarianteSalvata, stessaVoceCatalogo, testoAvvisoVariante,
} from '@/utils/equipmentVarianti'

/**
 * I numeri sono quelli di produzione, verificati sulle brochure KAESER:
 * SK 22 ha tre varianti con pressioni di lavoro 7,5/10/13 e massime 8/11/15;
 * SK 19 ne ha due che condividono la massima di 11 bar, con portate distinte
 * (1855 e 1680 l/min).
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

  it('tiene distinte due varianti che condividono la massima — SK 19', () => {
    const v = raggruppaVarianti('Compressori', [
      riga({ pressione_esercizio: 7.5, pressione_max: 11, fad: 1855 }),
      riga({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 }),
    ])
    expect(v).toHaveLength(2)
    expect(v.map(x => [x.value, x.variante])).toEqual([[11, 7.5], [11, 10]])
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

describe('scegliVarianteSalvata', () => {
  /** Le due righe di SK 19: stessa massima di 11 bar, portate diverse. */
  const sk19 = [
    riga({ pressione_esercizio: 7.5, pressione_max: 11, fad: 1855 }),
    riga({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 }),
  ]

  it('con una riga sola non sta a guardare i valori: la provenienza e quella', () => {
    const sola = [riga({ pressione_esercizio: 7.5, pressione_max: 8, fad: 2000 })]
    // Il tecnico ha scostato la portata: e proprio lo scostamento che si vuole poter rilevare.
    expect(scegliVarianteSalvata('Compressori', sola, { pressione: 8, capacita: 1900 })).toBe(sola[0])
  })

  it('sceglie per pressione quando la pressione basta', () => {
    const sk22 = [
      riga({ pressione_esercizio: 7.5, pressione_max: 8, fad: 2000 }),
      riga({ pressione_esercizio: 10, pressione_max: 11, fad: 1680 }),
      riga({ pressione_esercizio: 13, pressione_max: 15, fad: 1320 }),
    ]
    expect(scegliVarianteSalvata('Compressori', sk22, { pressione: 11, capacita: null })).toBe(sk22[1])
  })

  it('dove la pressione non distingue, distingue la portata — SK 19', () => {
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: 11, capacita: 1855 })).toBe(sk19[0])
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: 11, capacita: 1680 })).toBe(sk19[1])
  })

  it('senza portata compilata non indovina: meglio nessuna provenienza', () => {
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: 11, capacita: null })).toBeNull()
  })

  it('con una portata che non e di nessuna delle due non indovina', () => {
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: 11, capacita: 1700 })).toBeNull()
  })

  it('la portata da sola basta anche se la pressione della scheda e vuota', () => {
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: null, capacita: 1680 })).toBe(sk19[1])
  })

  it('una pressione che non e di nessuna candidata non fa ripiegare sulla prima', () => {
    expect(scegliVarianteSalvata('Compressori', sk19, { pressione: 9, capacita: 1855 })).toBeNull()
  })

  it('senza candidate non c e nulla da scegliere', () => {
    expect(scegliVarianteSalvata('Compressori', [], { pressione: 11, capacita: 1855 })).toBeNull()
  })

  it('legge la capacita col nome giusto per il tipo — qmax sulle valvole', () => {
    const valvole = [
      riga({ ptar: 11, qmax: 2500 }),
      riga({ ptar: 11, qmax: 4000 }),
    ]
    expect(scegliVarianteSalvata('Valvole di sicurezza', valvole, { pressione: 11, capacita: 4000 }))
      .toBe(valvole[1])
  })
})

describe('stessaVoceCatalogo', () => {
  /**
   * Il caso reale che la guardia esiste per intercettare: la riga è stata precompilata da
   * KAESER SK 19, poi il tecnico ha corretto il modello in ASD 37 SFC dall'autocomplete — che
   * per i tipi indicizzati per variante non richiama `handleSelected` — e la provenienza è
   * rimasta quella di SK 19.
   */
  const sk19 = { ...riga({ pressione_esercizio: 7.5, pressione_max: 11, fad: 1855 }), modello: 'SK 19' }

  it('riconosce la voce quando marca e modello coincidono', () => {
    expect(stessaVoceCatalogo(sk19, 'KAESER KOMPRESSOREN SE', 'SK 19')).toBe(true)
  })

  it('rifiuta un modello diverso — SK 19 corretto in ASD 37 SFC', () => {
    expect(stessaVoceCatalogo(sk19, 'KAESER KOMPRESSOREN SE', 'ASD 37 SFC')).toBe(false)
  })

  it('rifiuta una marca diversa a parita di modello', () => {
    expect(stessaVoceCatalogo(sk19, 'ATLAS COPCO', 'SK 19')).toBe(false)
  })

  it('non si fa ingannare da maiuscole e spaziatura diverse', () => {
    expect(stessaVoceCatalogo(sk19, '  kaeser   kompressoren se', 'sk19')).toBe(true)
  })
})
