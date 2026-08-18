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
import {
  buildSchemaModel,
  ID_UTENZE,
  notaTubazioni,
  ordinaCatenaTrattamento,
  puoGenerareSchema,
} from '../buildSchemaModel'
import { capoValido } from '../agganci'
import { preferenzeRisolteDaScheda } from '../preferenze'
import { pozzoCondense } from '../layout'

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

    // Senza catena di trattamento le utenze si attaccano direttamente al serbatoio: un nodo e
    // un arco in più rispetto al minimo compressore → serbatoio.
    expect(model.nodi.map((n) => n.id)).toEqual(['C1', 'S1', 'UTENZE'])
    expect(model.nodi.find((n) => n.id === 'S1')?.orientamento).toBe('ORIZZONTALE')
    expect(model.archi).toHaveLength(2)
    expect(model.archi[0]).toMatchObject({
      da: { nodo: 'C1', ancora: 'alto-out' },
      a: { nodo: 'S1', ancora: 'sx' },
      stile: 'flessibile',
    })
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
    expect(condense.every((a) => a.a.nodo === 'T')).toBe(true)
    // Compressore (ha disoleatore), serbatoio, essiccatore e filtro scaricano condensa.
    expect(condense.map((a) => a.da.nodo).sort()).toEqual(['C1', 'E1', 'F1', 'S1'])
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
    expect(condense.map((a) => a.da.nodo)).toEqual(['S1'])
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

    const versoSeparatore = model.archi.filter((a) => a.a.nodo === 'SEP1')
    expect(versoSeparatore.every((a) => a.stile === 'condensa')).toBe(true)
    // La mandata dell'aria passa per essiccatore e filtro, mai per il separatore.
    // F1 non è dichiarato prefiltro, quindi è filtro di linea: sta a valle dell'essiccatore.
    // L'ultimo tratto (F1 → UTENZE) chiude la linea, sempre a valle dell'ultimo stadio.
    expect(
      model.archi.filter((a) => a.stile === 'standard').map((a) => `${a.da.nodo}->${a.a.nodo}`)
    ).toEqual(['S1->E1', 'E1->F1', 'F1->UTENZE'])
  })

  // Stesso rischio del terminale utenze (vedi 'terminale verso le utenze' sotto): con un solo
  // serbatoio candidato qualunque regola di scelta (primo, ultimo, ...) darebbe lo stesso
  // risultato e non discriminerebbe un'inversione dell'ordine. Due serbatoi, e si verifica che
  // la catena parta da quello che alimenta davvero la linea (S1), non dal secondo (S2).
  it('la catena di trattamento parte dal serbatoio che alimenta la linea, non da un secondo serbatoio qualsiasi', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ codice: 'S1' }), makeSerbatoio({ codice: 'S2' })],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1', 'S2'] } })

    expect(model.archi.find((a) => a.stile === 'standard' && a.a.nodo === 'E1')?.da).toEqual({
      nodo: 'S1',
      ancora: 'dx',
    })
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
    // Le utenze chiudono la linea a valle dell'ultimo stadio (F2, il filtro di linea).
    expect(
      model.archi.filter((a) => a.stile === 'standard').map((a) => `${a.da.nodo}->${a.a.nodo}`)
    ).toEqual(['S1->F1', 'F1->E1', 'E1->F2', 'F2->UTENZE'])
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
    expect(flessibili.map((a) => `${a.da.nodo}->${a.a.nodo}`)).toEqual(['C1->S1', 'C2->S1', 'C3->S1'])
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

  // In produzione il campo arriva anche come array di una voce: confrontandolo com'era, per
  // stringa, il separatore dichiarato veniva ignorato e nasceva un pozzo generico in più.
  it('legge la raccolta condense anche quando è un array di una voce', () => {
    const scheda = makeScheda({
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: ['separatore'] as never }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(model.nodi.map((n) => n.id)).not.toContain('RC')
    expect(model.archi.filter((a) => a.stile === 'condensa').every((a) => a.a.nodo === 'SEP1')).toBe(true)
  })

  // Un serbatoio ubicato in linea restava anche nella catena di trattamento: veniva disegnato
  // due volte e compariva due volte nella lista apparecchiature.
  it('tiene i serbatoi fuori dalla catena di trattamento anche se ubicati in linea', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [makeEssiccatore({ ha_scambiatore: false })],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    expect(ordinaCatenaTrattamento(model.nodi, null).map((n) => n.id)).toEqual(['E1'])
  })

  it('ogni arco standard e flessibile nasce con un segno di valvola di intercettazione', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    // L'arco terminale verso ID_UTENZE resta escluso apposta (vedi buildArchi): il terminale ha
    // già il proprio codolo e non porta valvola. Senza questa esclusione il filtro prenderebbe
    // anche quell'arco — è 'standard' come gli altri — e la asserzione fallirebbe su un caso che
    // il disegno esclude di proposito.
    const rigideOFlessibili = model.archi.filter(
      (a) => (a.stile === 'standard' || a.stile === 'flessibile') && a.a.nodo !== ID_UTENZE
    )
    expect(rigideOFlessibili.length).toBeGreaterThan(0)
    for (const arco of rigideOFlessibili) {
      expect(arco.segni).toHaveLength(1)
      expect(arco.segni![0].tipo).toBe('valvola_intercettazione')
      expect(arco.segni![0].t).toBeGreaterThan(0)
      expect(arco.segni![0].t).toBeLessThan(1)
    }
  })

  it('gli archi condensa non hanno segni: la valvola non serve sullo scarico', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const condensa = model.archi.filter((a) => a.stile === 'condensa')
    expect(condensa.length).toBeGreaterThan(0)
    for (const arco of condensa) expect(arco.segni ?? []).toHaveLength(0)
  })
})

describe('ancoraggio degli archi automatici', () => {
  it('la mandata del compressore parte dal cielo ed entra nel fianco BASSO del serbatoio', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [],
      scambiatori: [],
      filtri: [],
    })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const mandata = model.archi.find((a) => a.stile === 'flessibile')

    expect(mandata?.da).toEqual({ nodo: 'C1', ancora: 'alto-out' })
    // `sx-basso` e non `sx` dal 18-08-2026 (convenzione 2): la dorsale scende con un gradino e si
    // aggancia al fianco in basso, non 160 unita' piu' in alto. Il serbatoio di default e'
    // verticale, l'unico dei due che ha quell'ancora.
    expect(mandata?.a).toEqual({ nodo: 'S1', ancora: 'sx-basso' })
  })

  it('ogni arco generato usa ancore che ne accettano lo stile', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const perId = new Map(model.nodi.map((n) => [n.id, n]))

    expect(model.archi.length).toBeGreaterThan(0)
    for (const arco of model.archi) {
      expect(capoValido(perId.get(arco.da.nodo)!, arco.da.ancora, arco.stile), `${arco.id} da`).toBe(true)
      expect(capoValido(perId.get(arco.a.nodo)!, arco.a.ancora, arco.stile), `${arco.id} a`).toBe(true)
    }
  })

  // Il pozzo di raccolta non è sempre una tanica: quando è un separatore la corsia condense
  // entra di fianco (ancora 'sx'), non dall'alto — la sola tanica riceve dal cielo. Senza
  // questo caso il test generico sopra passava anche con un'ancora d'arrivo sbagliata, perché
  // usava solo 'tanica'.
  it('ogni arco generato usa ancore che ne accettano lo stile anche quando il pozzo è un separatore', () => {
    const scheda = makeScheda({
      separatori: [makeSeparatore()],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const perId = new Map(model.nodi.map((n) => [n.id, n]))

    expect(model.archi.length).toBeGreaterThan(0)
    for (const arco of model.archi) {
      expect(capoValido(perId.get(arco.da.nodo)!, arco.da.ancora, arco.stile), `${arco.id} da`).toBe(true)
      expect(capoValido(perId.get(arco.a.nodo)!, arco.a.ancora, arco.stile), `${arco.id} a`).toBe(true)
    }
  })

  it('i nodi dedotti dalla scheda si dichiarano tali', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }) })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    expect(model.nodi.every((n) => n.origine === 'scheda')).toBe(true)
  })
})

describe('notaTubazioni', () => {
  it('non dice nulla quando la scheda non dichiara diametri', () => {
    expect(notaTubazioni(makeScheda({ dati_impianto: makeDatiImpianto() }))).toEqual([])
  })

  // Il riquadro parla dei collegamenti in sala: senza quelli non ha di che parlare, e le linee
  // di distribuzione da sole non bastano a farlo comparire. Scelta del committente, non
  // conseguenza tecnica.
  it('tace se la scheda dichiara solo i diametri delle linee di distribuzione', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_distribuzione_min: 32, dn_distribuzione_max: 50 }),
    })
    expect(notaTubazioni(scheda)).toEqual([])
  })

  it('con i soli collegamenti in sala scrive una riga sola', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_sala_max: 25 }),
    })
    expect(notaTubazioni(scheda)).toEqual(['Collegamenti effettuati con tubazioni da Ø15 a Ø25mm'])
  })

  it('con entrambi i gruppi scrive due righe, e non mescola i loro diametri', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({
        dn_sala_min: 15,
        dn_sala_max: 25,
        dn_distribuzione_min: 32,
        dn_distribuzione_max: 50,
      }),
    })
    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø15 a Ø25mm',
      'Linee effettuate con tubazioni da Ø32 a Ø50mm',
    ])
  })

  // In scheda capita che min e max siano invertiti: gli estremi si ricavano dai valori presenti.
  // Il confronto avviene DENTRO la coppia, non fra tutte e quattro: qui la sala arriva a 25 e la
  // distribuzione parte da 25, e una fusione le farebbe collassare in un intervallo solo.
  it('raddrizza gli estremi scambiati dentro ciascuna coppia', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({
        dn_sala_min: 25,
        dn_sala_max: 20,
        dn_distribuzione_min: 40,
        dn_distribuzione_max: 25,
      }),
    })

    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø20 a Ø25mm',
      'Linee effettuate con tubazioni da Ø25 a Ø40mm',
    ])
  })

  it('usa la forma singola quando gli estremi coincidono', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_sala_max: 15 }),
    })
    expect(notaTubazioni(scheda)).toEqual(['Collegamenti effettuati con tubazioni da Ø15mm'])
  })

  // I quattro campi sono indipendenti e capita di trovarne compilato uno solo: un estremo che
  // c'è si stampa, non si tace.
  it('usa la forma singola anche quando la coppia è compilata a metà', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ dn_sala_min: 15, dn_distribuzione_max: 50 }),
    })
    expect(notaTubazioni(scheda)).toEqual([
      'Collegamenti effettuati con tubazioni da Ø15mm',
      'Linee effettuate con tubazioni da Ø50mm',
    ])
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

describe('terminale verso le utenze', () => {
  it('nasce con la tubazione che parte dall’ultimo stadio della catena di trattamento', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'LINEA' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const utenze = modello.nodi.find((n) => n.tipo === 'utenze')!
    expect(utenze.id).toBe('UTENZE')
    // Due righe: «aria» va a capo sotto «Utenze» (richiesta del committente, 17-08-2026).
    expect(utenze.etichetta).toBe('Utenze\naria')
    expect(utenze.origine).toBe('scheda')

    // La catena è E1 → F1 (i filtri di linea stanno a valle dell'essiccatore): l'ultimo è F1.
    const arco = modello.archi.find((a) => a.a.nodo === 'UTENZE')!
    expect(arco.da).toEqual({ nodo: 'F1', ancora: 'dx' })
    expect(arco.a).toEqual({ nodo: 'UTENZE', ancora: 'in' })
    expect(arco.stile).toBe('standard')
  })

  it('senza catena di trattamento parte dal serbatoio che alimenta la linea', () => {
    // Due serbatoi, non uno solo: con un solo candidato qualunque regola di scelta (primo,
    // ultimo, o altro) restituirebbe lo stesso risultato e il test non discriminerebbe fra
    // "il serbatoio da cui la linea parte" (serbatoiChiave[0], quello giusto) e "l'ultimo
    // serbatoio" (la vecchia formulazione sbagliata della spec, corretta in questo task).
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ codice: 'S1' }), makeSerbatoio({ codice: 'S2' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1', 'S2'] } })

    expect(modello.archi.find((a) => a.a.nodo === 'UTENZE')!.da).toEqual({ nodo: 'S1', ancora: 'dx' })
  })

  it('non nasce affatto se non c’è né catena né serbatoio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: {} })

    expect(modello.nodi.some((n) => n.tipo === 'utenze')).toBe(false)
    expect(modello.archi.some((a) => a.a.nodo === 'UTENZE')).toBe(false)
  })

  it('resta fuori dalla catena di trattamento e dal pozzo di raccolta condense', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const utenze = modello.nodi.find((n) => n.tipo === 'utenze')!

    expect(ordinaCatenaTrattamento(modello.nodi, null).map((n) => n.id)).not.toContain('UTENZE')
    expect(pozzoCondense(modello.nodi, modello)?.id).not.toBe(utenze.id)
    // E non riceve né emette condensa.
    expect(modello.archi.some((a) => a.stile === 'condensa' && a.a.nodo === 'UTENZE')).toBe(false)
    expect(modello.archi.some((a) => a.stile === 'condensa' && a.da.nodo === 'UTENZE')).toBe(false)
  })
})

describe('le convenzioni grafiche dello studio', () => {
  /** Un compressore col disoleatore, un serbatoio verticale, tre stadi: F1 → E1 → F2. */
  const schedaConTreStadi = () =>
    makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'VERTICALE' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }), makeFiltro({ codice: 'F2', tipo: 'LINEA' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      scambiatori: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

  const input = (extra = {}) => ({
    scheda: schedaConTreStadi(),
    collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    ...extra,
  })

  it('la mandata del compressore si aggancia in basso al serbatoio verticale', () => {
    // Convenzione 2: la dorsale scende con un gradino e si aggancia al fianco IN BASSO, non a
    // 160 unita' piu' in alto come faceva fino al 18-08-2026.
    const m = buildSchemaModel(input())
    expect(m.archi.find((a) => a.stile === 'flessibile')!.a.ancora).toBe('sx-basso')
  })

  it('ma sull’orizzontale, che non ha quell’ancora, resta sx invece di finire al centro del corpo', () => {
    // `sx-basso` non esiste sul serbatoio ORIZZONTALE. Chiederlo comunque farebbe ripiegare
    // `posizioneAncora` sul centro del corpo — un tubo attaccato in mezzo alla pancia: sbagliato
    // ma plausibile, il peggior tipo di errore.
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const m = buildSchemaModel(input({ scheda }))
    expect(m.archi.find((a) => a.stile === 'flessibile')!.a.ancora).toBe('sx')
  })

  it('la valvola della mandata sta un passo sotto la dorsale, e da lì in su il tubo è rigido', () => {
    // Convenzione 1: sotto la valvola flessibile, sopra rigido.
    const segno = buildSchemaModel(input()).archi.find((a) => a.stile === 'flessibile')!.segni![0]
    expect(segno.ancoraggio).toEqual({ tipo: 'vertice', vertice: 1, scarto: -10 })
    expect(segno.stileAValle).toBe('standard')
    expect(segno.t).toBe(0.5) // il ripiego, se la geometria non si risolve
  })

  it('fra due stadi consecutivi non c’è più la valvola d’ufficio', () => {
    // Convenzione 6, seconda meta': spariscono le valvole a meta' di ogni tratto fra stadi.
    const m = buildSchemaModel(input())
    const stadi = new Set(['F1', 'E1', 'F2'])
    const fraStadi = m.archi.filter(
      (a) => a.stile === 'standard' && stadi.has(a.da.nodo) && stadi.has(a.a.nodo)
    )
    expect(fraStadi.length).toBeGreaterThan(0)
    expect(fraStadi.every((a) => (a.segni ?? []).length === 0)).toBe(true)
  })

  it('la valvola di riserva sta all’uscita del serbatoio e prima delle utenze', () => {
    const m = buildSchemaModel(input())
    const uscita = m.archi.find((a) => a.da.nodo === 'S1' && a.stile === 'standard')!
    const utenze = m.archi.find((a) => a.a.nodo === ID_UTENZE)!
    for (const arco of [uscita, utenze]) {
      expect(arco.segni).toHaveLength(1)
      expect(arco.segni![0].ancoraggio).toEqual({ tipo: 'meta', tratto: 0 })
    }
  })

  it('le condense seguono il flag dell’operatore, non più il tipo', () => {
    const scheda = schedaConTreStadi()
    const risolte = preferenzeRisolteDaScheda(scheda, { condense: { F1: false, C1: false } })
    const m = buildSchemaModel(input({ scheda, preferenze: risolte }))
    const scarichi = m.archi.filter((a) => a.stile === 'condensa').map((a) => a.da.nodo)
    expect(scarichi).not.toContain('F1')
    expect(scarichi).not.toContain('C1')
    expect(scarichi).toContain('S1')
  })

  it('senza preferenze si comporta come prima: le condense per tipo', () => {
    const scarichi = buildSchemaModel(input())
      .archi.filter((a) => a.stile === 'condensa')
      .map((a) => a.da.nodo)
    expect(scarichi).toContain('F1')
    expect(scarichi).toContain('S1')
    expect(scarichi).toContain('C1') // ha il disoleatore
  })

  it('l’ordine degli stadi scelto dall’operatore diventa l’ordine in cui gli archi li collegano', () => {
    const scheda = schedaConTreStadi()
    const risolte = preferenzeRisolteDaScheda(scheda, { ordineStadi: ['F2', 'E1', 'F1'] })
    const m = buildSchemaModel(input({ scheda, preferenze: risolte }))
    const dopo = (id: string) => m.archi.find((a) => a.da.nodo === id && a.stile === 'standard')!.a.nodo
    expect(dopo('S1')).toBe('F2')
    expect(dopo('F2')).toBe('E1')
    expect(dopo('E1')).toBe('F1')
    expect(dopo('F1')).toBe(ID_UTENZE)
  })

  it('l’ordine dei serbatoi scelto decide anche quale è quello di testa', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      disoleatori: [],
      serbatoi: [
        makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' }),
        makeSerbatoio({ codice: 'S2', ubicazione: 'SALA_COMPRESSORI' }),
      ],
      essiccatori: [], scambiatori: [], filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const risolte = preferenzeRisolteDaScheda(scheda, { ordineSerbatoi: ['S2', 'S1'] })
    const m = buildSchemaModel(input({ scheda, preferenze: risolte, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    // L'ordine dell'array e' l'ordine del disegno: `layoutSchema` filtra per tipo e dispone in
    // fila nell'ordine in cui li trova.
    expect(m.nodi.filter((n) => n.tipo === 'serbatoio').map((n) => n.id)).toEqual(['S2', 'S1'])
    expect(m.archi.find((a) => a.a.nodo === ID_UTENZE)!.da.nodo).toBe('S2')
  })
})
