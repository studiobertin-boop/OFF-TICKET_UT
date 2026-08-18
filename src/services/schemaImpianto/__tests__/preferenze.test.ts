import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeDisoleatore,
  makeFiltro,
  makeScheda,
  makeSerbatoio,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import {
  contigui,
  famiglieDaScheda,
  improntaPreferenze,
  ordinaPerElenco,
  preferenzeRisolteDaScheda,
  preferenzeDaRiapplicare,
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
    const r = risolviPreferenze(undefined, famiglie)
    expect(r.ordineCompressori).toEqual(['C1', 'C2'])
    expect(r.ordineStadi).toEqual(['F1', 'E1', 'F2', 'F3'])
    expect(r.ordineSerbatoi).toEqual(['S1', 'S2'])
    // Niente C1/C2: sono compressori senza disoleatore, e la condensa esce da li' (`scaricaCondensa`).
    expect([...r.condense].sort()).toEqual(['E1', 'F1', 'F2', 'F3', 'S1', 'S2'])
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual([])
  })

  it('riordina anche i compressori', () => {
    const r = risolviPreferenze({ ordineCompressori: ['C2'] }, famiglie)
    expect(r.ordineCompressori).toEqual(['C2', 'C1'])
  })

  it('il flag condense vale anche sui compressori', () => {
    // Questi compressori non hanno disoleatore, quindi il default (`scaricaCondensa`) dice no:
    // e' la scelta esplicita ad accenderli. Fino al 18-08-2026 il default arrivava da un
    // parametro, e il test poteva fingere una regola che il disegno non usava.
    const r = risolviPreferenze({ condense: { C1: true } }, famiglie)
    expect(r.condense.has('C1')).toBe(true)
    expect(r.condense.has('C2')).toBe(false)
  })

  it('una condensa spenta a mano vince su un default positivo', () => {
    const r = risolviPreferenze({ condense: { F2: false } }, famiglie)
    expect(r.condense.has('F2')).toBe(false)
    expect(r.condense.has('F1')).toBe(true)
  })

  it('una condensa accesa a mano vince su un default negativo', () => {
    // Il default negativo vero: un compressore senza disoleatore.
    const r = risolviPreferenze({ condense: { C2: true } }, famiglie)
    expect(r.condense.has('C2')).toBe(true)
    expect(r.condense.has('C1')).toBe(false)
  })

  it('tiene un gruppo by-pass ancora contiguo', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] }, famiglie)
    expect(r.bypass).toEqual([{ id: 'bp1', stadi: ['E1', 'F2'] }])
    expect(r.bypassScartati).toEqual([])
  })

  it('riordina i membri del gruppo secondo l’ordine risolto', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['F2', 'E1'] }] }, famiglie)
    expect(r.bypass[0].stadi).toEqual(['E1', 'F2'])
  })

  it('scarta un gruppo che ha perso la contiguità e lo riporta', () => {
    // Riordinando gli stadi, E1 e F2 non sono più attaccati.
    const r = risolviPreferenze(
      { ordineStadi: ['E1', 'F1', 'F2', 'F3'], bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] },
      famiglie
    )
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual(['bp1'])
  })

  it('accorcia un gruppo che nomina un’apparecchiatura sparita', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F9'] }] }, famiglie)
    expect(r.bypass.map((g) => g.stadi)).toEqual([['E1']])
    expect(r.bypassScartati).toEqual([])
  })

  it('regge preferenze storte senza sollevare', () => {
    const storte = { ordineStadi: 'F1', condense: null, bypass: [{ id: 'bp1' }] } as never
    expect(() => risolviPreferenze(storte, famiglie)).not.toThrow()
  })
})

describe('improntaPreferenze', () => {
  it('non cambia quando l’ordine di due chiavi cambia', () => {
    const a = risolviPreferenze({ condense: { F1: true, F2: false } }, famiglie)
    const b = risolviPreferenze({ condense: { F2: false, F1: true } }, famiglie)
    expect(improntaPreferenze(a)).toBe(improntaPreferenze(b))
  })

  it('cambia quando cambia l’ordine degli stadi', () => {
    const a = risolviPreferenze(undefined, famiglie)
    const b = risolviPreferenze({ ordineStadi: ['F2'] }, famiglie)
    expect(improntaPreferenze(a)).not.toBe(improntaPreferenze(b))
  })
})

describe('la regola di default delle condense è una sola', () => {
  /** Due compressori, uno solo col disoleatore da cui la condensa esce davvero. */
  const schedaDueCompressori = () =>
    makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1', ha_disoleatore: true }),
        makeCompressore({ codice: 'C2', ha_disoleatore: false }),
      ],
      disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

  it('la famiglia porta il disoleatore, o la regola non saprebbe su cosa decidere', () => {
    const famiglieVere = famiglieDaScheda(schedaDueCompressori())
    expect(famiglieVere.compressori.find((n) => n.id === 'C1')?.accessorio?.codice).toBe('C1.1')
    expect(famiglieVere.compressori.find((n) => n.id === 'C2')?.accessorio).toBeUndefined()
  })

  it('chi il pannello mostra spuntato è chi il generatore collega al pozzo', () => {
    // Il confronto che conta: non una funzione con se stessa, ma le due strade che il Blocco 1
    // aveva lasciato divergere — la spunta mostrata in finestra e l'arco disegnato.
    const scheda = schedaDueCompressori()
    const risolte = preferenzeRisolteDaScheda(scheda, undefined)

    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'] },
    })
    const collegati = new Set(model.archi.filter((a) => a.stile === 'condensa').map((a) => a.da.nodo))

    expect([...risolte.condense].sort()).toEqual([...collegati].sort())
    // E in concreto: C2 non ha disoleatore, quindi non compare da nessuna delle due parti.
    expect(risolte.condense.has('C1')).toBe(true)
    expect(risolte.condense.has('C2')).toBe(false)
  })

  it('la scelta esplicita dell’operatore vince sulla regola', () => {
    const scheda = schedaDueCompressori()
    const risolte = preferenzeRisolteDaScheda(scheda, { condense: { C1: false, C2: true } })
    expect(risolte.condense.has('C1')).toBe(false)
    expect(risolte.condense.has('C2')).toBe(true)
  })
})

describe('preferenzeDaRiapplicare', () => {
  const famiglie = { compressori, serbatoi, stadi }
  const risolte = risolviPreferenze({}, famiglie)

  it('e falso quando l impronta salvata e quella di adesso combaciano', () => {
    expect(preferenzeDaRiapplicare(improntaPreferenze(risolte), risolte)).toBe(false)
  })

  it('e vero quando cambia l ordine', () => {
    const altre = risolviPreferenze({ ordineStadi: ['F3', 'F1', 'E1', 'F2'] }, famiglie)
    expect(preferenzeDaRiapplicare(improntaPreferenze(risolte), altre)).toBe(true)
  })

  it('e vero quando cambia una spunta delle condense', () => {
    const altre = risolviPreferenze({ condense: { F1: false } }, famiglie)
    expect(preferenzeDaRiapplicare(improntaPreferenze(risolte), altre)).toBe(true)
  })

  it('e vero quando nasce o cade un gruppo by-pass', () => {
    const conGruppo = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] }, famiglie)
    expect(preferenzeDaRiapplicare(improntaPreferenze(risolte), conGruppo)).toBe(true)
    expect(preferenzeDaRiapplicare(improntaPreferenze(conGruppo), risolte)).toBe(true)
  })

  it('e falso quando il layout salvato non porta nessuna impronta', () => {
    // Il caso di ogni pratica salvata prima che il campo esistesse: non si annuncia un
    // cambiamento che non si sa se c'e' stato.
    const altre = risolviPreferenze({ ordineStadi: ['F3', 'F1', 'E1', 'F2'] }, famiglie)
    expect(preferenzeDaRiapplicare(undefined, altre)).toBe(false)
  })

  it('e falso quando l impronta salvata e una stringa vuota', () => {
    // Difensivo: `schemaLayout` arriva da `additional_info`, che Zod dichiara permissivo.
    expect(preferenzeDaRiapplicare('', risolte)).toBe(false)
  })
})
