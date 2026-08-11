import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeDisoleatore,
  makeEssiccatore,
  makeFiltro,
  makeScheda,
  makeSeparatore,
  makeSerbatoio,
  makeValvola,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel, puoGenerareSchema } from '../buildSchemaModel'

describe('buildSchemaModel', () => {
  // Caso di riferimento: DOCUMENTAZIONE/relazione/schema.png — un compressore, un serbatoio
  // orizzontale, collegamento flessibile fra i due.
  it('replica lo schema minimo compressore → serbatoio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.map((n) => n.id)).toEqual(['C1', 'S1'])
    expect(model.nodi.find((n) => n.id === 'S1')?.orientamento).toBe('ORIZZONTALE')
    expect(model.archi).toHaveLength(1)
    expect(model.archi[0]).toMatchObject({ da: 'C1', a: 'S1', stile: 'flessibile' })
  })

  it('disegna il disoleatore come accessorio del compressore, non come nodo a sé', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.map((n) => n.id)).not.toContain('C1.1')
    const compressore = model.nodi.find((n) => n.id === 'C1')
    expect(compressore?.accessorio?.codice).toBe('C1.1')
    // La valvola del disoleatore segue la convenzione Cx.2 di utils/valvoleImpianto.
    expect(compressore?.accessorio?.valvoleSicurezza.map((v) => v.codice)).toEqual(['C1.2'])
  })

  it('riporta tutte le valvole di sicurezza del serbatoio, principale e aggiuntive', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ valvole_aggiuntive: [makeValvola({ modello: 'TA21' })] })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const serbatoio = model.nodi.find((n) => n.id === 'S1')
    expect(serbatoio?.valvoleSicurezza.map((v) => v.codice)).toEqual(['S1.1', 'S1.2'])
  })

  it('collega alla tanica le linee condense dei soli nodi che scaricano condensa', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.map((n) => n.id)).toContain('T')
    const condense = model.archi.filter((a) => a.stile === 'condensa')
    expect(condense.every((a) => a.a === 'T')).toBe(true)
    // Compressore (ha disoleatore), serbatoio, essiccatore e filtro scaricano condensa.
    expect(condense.map((a) => a.da).sort()).toEqual(['C1', 'E1', 'F1', 'S1'])
  })

  it('non collega al pozzo condense un compressore privo di disoleatore', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ tipo: 'PISTONI', ha_disoleatore: false })],
      disoleatori: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const condense = model.archi.filter((a) => a.stile === 'condensa')
    expect(condense.map((a) => a.da)).toEqual(['S1'])
  })

  it('non genera alcuna linea condense quando la raccolta è assente', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.archi.filter((a) => a.stile === 'condensa')).toHaveLength(0)
    expect(model.nodi.map((n) => n.id)).not.toContain('T')
  })

  it('usa il separatore come pozzo di raccolta senza inserirlo nella catena di trattamento aria', () => {
    const scheda = makeScheda({
      separatori: [makeSeparatore()],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const versoSeparatore = model.archi.filter((a) => a.a === 'SEP1')
    expect(versoSeparatore.every((a) => a.stile === 'condensa')).toBe(true)
    // La mandata dell'aria passa per essiccatore e filtro, mai per il separatore.
    // F1 non è dichiarato prefiltro, quindi è filtro di linea: sta a valle dell'essiccatore.
    expect(model.archi.filter((a) => a.stile === 'standard').map((a) => `${a.da}->${a.a}`)).toEqual([
      'S1->E1',
      'E1->F1',
    ])
  })

  it('mette in serie la catena di trattamento a valle del serbatoio, prefiltri per primi', () => {
    const scheda = makeScheda({
      filtri: [
        makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }),
        makeFiltro({ codice: 'F2', tipo: 'LINEA' }),
      ],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    // Ordine degli schemi reali (es. 541_RELAZIONE_TECNICA): prefiltro, essiccatore, filtro di linea.
    expect(model.archi.filter((a) => a.stile === 'standard').map((a) => `${a.da}->${a.a}`)).toEqual([
      'S1->F1',
      'F1->E1',
      'E1->F2',
    ])
  })

  it('genera un arco flessibile per ogni coppia dichiarata, anche in manifold N:1', () => {
    const scheda = makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1' }),
        makeCompressore({ codice: 'C2' }),
        makeCompressore({ codice: 'C3' }),
      ],
      disoleatori: [
        makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' }),
        makeDisoleatore({ codice: 'C2.1', compressore_associato: 'C2' }),
        makeDisoleatore({ codice: 'C3.1', compressore_associato: 'C3' }),
      ],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })

    const flessibili = model.archi.filter((a) => a.stile === 'flessibile')
    expect(flessibili.map((a) => `${a.da}->${a.a}`)).toEqual(['C1->S1', 'C2->S1', 'C3->S1'])
  })

  it('assegna al gruppo LINEA_DISTRIBUZIONE i serbatoi ubicati fuori dalla sala', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' }),
        makeSerbatoio({ codice: 'S2', ubicazione: 'LINEA_DISTRIBUZIONE' }),
      ],
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.find((n) => n.id === 'S1')?.gruppo).toBe('SALA_COMPRESSORI')
    expect(model.nodi.find((n) => n.id === 'S2')?.gruppo).toBe('LINEA_DISTRIBUZIONE')
  })

  it('compone le etichette nel formato della lista apparecchiature', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ marca: 'KAESER', modello: 'CSD 90 SFC' })],
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.find((n) => n.id === 'C1')?.etichetta).toBe('Compressore KAESER Mod. CSD 90 SFC')
  })
})

describe('puoGenerareSchema', () => {
  it('richiede almeno un collegamento compressore → serbatoio dichiarato', () => {
    const scheda = makeScheda()
    expect(puoGenerareSchema({ scheda, collegamentiCompressoriSerbatoi: {} })).toBe(false)
    expect(puoGenerareSchema({ scheda, collegamentiCompressoriSerbatoi: { C1: [] } })).toBe(false)
    expect(puoGenerareSchema({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })).toBe(true)
  })

  it('è falso se mancano del tutto compressori o serbatoi', () => {
    const senzaSerbatoi = makeScheda({ serbatoi: [] })
    expect(puoGenerareSchema({ scheda: senzaSerbatoi, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })).toBe(false)
  })
})
