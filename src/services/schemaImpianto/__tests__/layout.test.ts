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
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import {
  GIOCO_FRA_STADI,
  PASSO_GIUNZIONE,
  PASSO_TERMINALE,
  PASSO_CORSIA_BYPASS,
  MARGINE_COLLETTORE_COMPRESSORI,
  PASSO_COMPRESSORI,
  STACCO_COMPRESSORI_SERBATOI,
  STACCO_SERBATOI_LINEA,
  calcolaMuro,
  corpoNodo,
  quotaCollettore,
  catenaDagliArchi,
  muroDaAscissa,
  DIMENSIONI_NODO,
  MARGINE_SUPERIORE,
  dimensioniLayout,
  estensioneOrizzontale,
  layoutSchema,
  pozzoCondense,
  quoteInstradamento,
} from '../layout'
import { posizioneAncora, renderSvg } from '../renderSvg'
import { preferenzeRisolteDaScheda } from '../preferenze'
import { instrada, puntoSuTratto } from '../tratti'
import { dimensioniDi, latoImposto, SPESSORE_MURO } from '../symbols'
import type { Tarature } from '../libreria'
import type { SchemaArco, SchemaLayout, SchemaModel, SchemaNodo, SchemaNodoPosizionato } from '../types'

function nodo(layout: SchemaLayout, id: string) {
  const trovato = layout.nodi.find((n) => n.id === id)
  if (!trovato) throw new Error(`Nodo ${id} assente dal layout`)
  return trovato
}

/** Serbatoio posizionato, il minimo che serve a misurare un ingombro. */
function serbatoioA(id: string, x: number, y: number): SchemaNodoPosizionato {
  return {
    id,
    tipo: 'serbatoio',
    etichetta: id,
    orientamento: 'VERTICALE',
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    origine: 'scheda',
    x,
    y,
  }
}

/** Modello con apparecchiature in entrambi i gruppi: sala compressori e linea distribuzione. */
function modelloConSalaELinea() {
  const scheda = makeScheda({
    serbatoi: [
      makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' }),
      makeSerbatoio({ codice: 'S2', ubicazione: 'LINEA_DISTRIBUZIONE' }),
    ],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  return buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
}

function schedaTrePiuUno() {
  return makeScheda({
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
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
}

/** Un compressore, un serbatoio verticale, tre stadi: il caso minimo con una linea di processo. */
function schedaConTreStadi() {
  return makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'VERTICALE' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }), makeFiltro({ codice: 'F2', tipo: 'LINEA' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
}

describe('layoutSchema', () => {
  it('posiziona ogni nodo del modello, senza perderne né inventarne', () => {
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })

    const layout = layoutSchema(model)

    expect(layout.nodi.map((n) => n.id).sort()).toEqual(model.nodi.map((n) => n.id).sort())
    // Gli archi per IDENTITA' e non in deep-equal: dal 18-08-2026 il layout risolve gli ancoraggi
    // dei segni in `t` numeriche e toglie l'istruzione (`segniAncorati.ts`), quindi gli oggetti
    // non sono piu' gli stessi del modello. Quel che questo test deve fissare e' che non se ne
    // perda ne' se ne inventi nessuno.
    expect(layout.archi.map((a) => a.id)).toEqual(model.archi.map((a) => a.id))
    expect(layout.archi.map((a) => `${a.da.nodo}->${a.a.nodo}:${a.stile}`)).toEqual(
      model.archi.map((a) => `${a.da.nodo}->${a.a.nodo}:${a.stile}`)
    )
  })

  it('restituisce sempre testi: [], mai assente: chi legge il layout non deve ripiegare su ?? []', () => {
    // `deserializzaLayout` e `riconcilia` normalizzano già `testi` a lista vuota: se
    // `layoutSchema` lasciasse il campo assente, il ramo "nessun salvataggio leggibile" di
    // `layoutIniziale` (persistenza.ts) sarebbe l'unico produttore di layout con `testi`
    // undefined, e con `strict: false` un `layout.testi.map(...)` dimenticato in un
    // consumatore non verrebbe segnalato dal compilatore.
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })

    expect(layoutSchema(model).testi).toEqual([])
  })

  it('dispone i compressori in riga, tutti a sinistra del serbatoio che alimentano', () => {
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })

    const layout = layoutSchema(model)
    const [c1, c2, c3] = ['C1', 'C2', 'C3'].map((id) => nodo(layout, id))
    const s1 = nodo(layout, 'S1')

    expect(c1.x).toBeLessThan(c2.x)
    expect(c2.x).toBeLessThan(c3.x)
    expect(c1.y).toBe(c2.y)
    expect(c3.x + DIMENSIONI_NODO.compressore.larghezza).toBeLessThan(s1.x)
  })

  it('allinea la base dei compressori a quella del serbatoio, più alto', () => {
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })

    const layout = layoutSchema(model)
    const baseCompressore = nodo(layout, 'C1').y + DIMENSIONI_NODO.compressore.altezza
    const baseSerbatoio = nodo(layout, 'S1').y + DIMENSIONI_NODO.serbatoio.altezza

    expect(baseCompressore).toBeCloseTo(baseSerbatoio, 5)
  })

  // Fix round 1 (revisione del Task 4): con un serbatoio orizzontale (140 di altezza, meno di
  // metà del verticale, 300) `disponiInRiga` lo centrava sulla stessa quota calcolata per il
  // verticale — la base finiva decine di unità più in alto di quella dei compressori, mentre il
  // commento sopra la funzione promette il contrario. L'allineamento 'basso' legge l'altezza
  // vera di OGNI nodo (`dimensioniDi`), non un'altezza di riga assunta uniforme: qui il
  // serbatoio è orizzontale apposta, il caso che prima non tornava. (180/340 dal 19-08-2026: 30
  // unità di `MARGINE_SCARICO_SERBATOIO`, che il riquadro riserva ora alla valvola di scarico su
  // entrambi gli orientamenti, e 10 in più di `MARGINE_VALVOLA_SERBATOIO`, salito a 50 per la
  // cassa più grande della valvola di sicurezza; erano 140/300 dall'arrotondamento del Task 8,
  // Blocco 3, e 137/298 prima ancora.)
  it('allinea la base anche di un serbatoio orizzontale, alta meno della metà del verticale', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1', ha_disoleatore: false })],
      disoleatori: [], essiccatori: [], scambiatori: [], filtri: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })

    const layout = layoutSchema(model)
    const s1 = nodo(layout, 'S1')
    expect(dimensioniDi(s1).altezza).toBe(180)

    const baseCompressore = nodo(layout, 'C1').y + DIMENSIONI_NODO.compressore.altezza
    const baseSerbatoio = s1.y + dimensioniDi(s1).altezza

    expect(baseCompressore).toBeCloseTo(baseSerbatoio, 5)
  })

  it('colloca il pozzo di raccolta condense sotto la fascia delle apparecchiature', () => {
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })

    const layout = layoutSchema(model)
    const tanica = nodo(layout, 'T')
    const baseSerbatoio = nodo(layout, 'S1').y + DIMENSIONI_NODO.serbatoio.altezza

    expect(tanica.y).toBeGreaterThan(baseSerbatoio)
  })

  // Osservazione 8 del committente: «di default non va disegnato, lo aggiungo solo se serve».
  // Da qui in poi ogni pratica nasce senza muro — la conseguenza piu' visibile del Blocco D4.
  it('l auto-layout non disegna piu il muro', () => {
    expect(layoutSchema(modelloConSalaELinea()).muro).toBeNull()
  })

  // I test che seguono provavano queste regole passando da `layoutSchema(...).muro`: dal
  // Blocco D4 quella strada restituisce sempre `null` (vedi il test sopra), quindi ora
  // interrogano `calcolaMuro` sui nodi che l'auto-layout produce — la stessa funzione che
  // propone l'ascissa al pulsante della barra (`ascissaProposta`, useMuro.ts). La regola di
  // dominio (quali gruppi il muro separa) resta la stessa, solo non gira più in automatico ad
  // ogni disegno.
  it('non c’è muro quando tutte le apparecchiature stanno in sala compressori', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ ubicazione: 'SALA_COMPRESSORI' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(calcolaMuro(layout.nodi)).toBeNull()
  })

  it('c’è un muro possibile fra i due gruppi quando c’è anche solo un’apparecchiatura in linea', () => {
    const layout = layoutSchema(modelloConSalaELinea())
    const muro = calcolaMuro(layout.nodi)

    expect(muro).not.toBeNull()
    // Il muro sta a destra di tutto ciò che è in sala compressori.
    const inSala = layout.nodi.filter((n) => n.gruppo === 'SALA_COMPRESSORI')
    for (const n of inSala) {
      expect(muro!.x).toBeGreaterThan(n.x)
    }
  })

  describe('il terminale utenze non conta ai fini del muro', () => {
    it('un impianto di soli compressori e serbatoi in sala, col solo terminale in linea, non ha un muro possibile', () => {
      const scheda = makeScheda({
        serbatoi: [makeSerbatoio({ ubicazione: 'SALA_COMPRESSORI' })],
        essiccatori: [],
        scambiatori: [],
        filtri: [],
        dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      })

      const layout = layoutSchema(
        buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
      )

      // Il terminale c'è (la linea finisce da qualche parte), ma da solo non è un motivo per
      // separare la sala compressori da una "linea distribuzione" che di fatto non esiste.
      expect(layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
      expect(calcolaMuro(layout.nodi)).toBeNull()
    })

    it('ma un impianto con anche un solo serbatoio vero in linea un muro possibile torna', () => {
      // Discrimina un'implementazione che, per far sparire il muro col terminale, finisse per
      // escludere dal calcolo tutto ciò che è LINEA_DISTRIBUZIONE invece del solo terminale:
      // qui c'è un secondo serbatoio vero in linea, e il muro deve tornare. Il serbatoio è
      // l'unica apparecchiatura che può stare davvero fuori sala (vedi il test più sotto, sugli
      // stadi di trattamento): un essiccatore qui non proverebbe la stessa cosa.
      const layout = layoutSchema(modelloConSalaELinea())

      expect(calcolaMuro(layout.nodi)).not.toBeNull()
    })
  })

  describe('solo il serbatoio può stare fuori sala compressori', () => {
    // Osservazione del committente (14-08-2026): un essiccatore in scheda faceva comparire il
    // muro fra sala e linea, ma nella realtà essiccatore, filtro e separatore restano sempre
    // fisicamente in sala — stanno "a valle" solo nell'ordine delle tubazioni
    // (ordinaCatenaTrattamento in buildSchemaModel.ts), non nella stanza. Il campo `ubicazione`
    // esiste solo sul serbatoio: è l'unica apparecchiatura per cui la scheda lo chiede.
    it('un essiccatore da solo non basta a far comparire un muro possibile', () => {
      const scheda = makeScheda({
        serbatoi: [makeSerbatoio({ ubicazione: 'SALA_COMPRESSORI' })],
        essiccatori: [makeEssiccatore()],
        scambiatori: [],
        filtri: [],
        dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      })

      const layout = layoutSchema(
        buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
      )

      expect(calcolaMuro(layout.nodi)).toBeNull()
    })

    it('nemmeno un filtro, o un separatore, bastano da soli', () => {
      const scheda = makeScheda({
        serbatoi: [makeSerbatoio({ ubicazione: 'SALA_COMPRESSORI' })],
        essiccatori: [],
        scambiatori: [],
        filtri: [makeFiltro()],
        separatori: [makeSeparatore()],
        dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      })

      const layout = layoutSchema(
        buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
      )

      expect(calcolaMuro(layout.nodi)).toBeNull()
    })
  })

  describe('calcolaMuro', () => {
    it('segue il bordo destro della sala compressori', () => {
      const base = { tipo: 'compressore' as const, etichetta: '', valvoleSicurezza: [], origine: 'scheda' as const }
      const primo = calcolaMuro([
        { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 40, y: 200 },
        { ...base, id: 'E1', tipo: 'essiccatore', gruppo: 'LINEA_DISTRIBUZIONE', x: 500, y: 200 },
      ])
      const spostato = calcolaMuro([
        { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 240, y: 200 },
        { ...base, id: 'E1', tipo: 'essiccatore', gruppo: 'LINEA_DISTRIBUZIONE', x: 700, y: 200 },
      ])

      expect(primo).not.toBeNull()
      expect(spostato!.x).toBeGreaterThan(primo!.x)
    })

    it('non c’è muro se manca uno dei due lati', () => {
      const base = { tipo: 'compressore' as const, etichetta: '', valvoleSicurezza: [], origine: 'scheda' as const }
      expect(calcolaMuro([{ ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', x: 40, y: 200 }])).toBeNull()
    })

    it('copre per intero l’inviluppo verticale dei nodi, con lo stesso margine sopra e sotto', () => {
      // Quote scelte apposta ben distanti fra loro: il nodo in sala è quello più in alto
      // (y minore), quello in linea è quello più in basso, così l'asserzione verifica
      // davvero l'inviluppo dei due gruppi e non solo di uno dei due.
      const compressore = {
        tipo: 'compressore' as const,
        etichetta: '',
        valvoleSicurezza: [],
        origine: 'scheda' as const,
        id: 'C1',
        gruppo: 'SALA_COMPRESSORI' as const,
        x: 40,
        y: 100,
      }
      const essiccatore = {
        tipo: 'essiccatore' as const,
        etichetta: '',
        valvoleSicurezza: [],
        origine: 'scheda' as const,
        id: 'E1',
        gruppo: 'LINEA_DISTRIBUZIONE' as const,
        x: 500,
        y: 400,
      }

      const muro = calcolaMuro([compressore, essiccatore])
      expect(muro).not.toBeNull()

      const yTop = Math.min(compressore.y, essiccatore.y)
      const yBottom = Math.max(
        compressore.y + DIMENSIONI_NODO.compressore.altezza,
        essiccatore.y + DIMENSIONI_NODO.essiccatore.altezza
      )

      // Il margine è identico sopra e sotto (non i 55/35 asimmetrici di prima, quando
      // yMin era ancorato allo spazio riservato al collettore sopra le apparecchiature e
      // yMax all'altezza fissa della tanica, a prescindere da dove fosse il pozzo vero):
      // qui non ci sono più le quote interne del layout automatico da cui recuperare
      // un'asimmetria intenzionale, quindi lo stesso margine (MARGINE_SUPERIORE / 2) si
      // applica identico ai due lati dell'inviluppo dei nodi.
      expect(muro!.yMin).toBe(yTop - MARGINE_SUPERIORE / 2)
      expect(muro!.yMax).toBe(yBottom + MARGINE_SUPERIORE / 2)
    })
  })

  describe('muroDaAscissa', () => {
    const base = { tipo: 'compressore' as const, etichetta: '', valvoleSicurezza: [], origine: 'scheda' as const }

    // Dal Blocco D4 il muro e' un oggetto del committente e di lui si salva la sola ascissa:
    // l'altezza continua ad adattarsi al disegno, e salvarla sarebbe una seconda fonte di verita'.
    it('tiene l ascissa data e ricava l altezza dall inviluppo, col margine di calcolaMuro', () => {
      const compressore = { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI' as const, tipo: 'compressore' as const, x: 40, y: 200 }
      const serbatoio = { ...base, id: 'S1', gruppo: 'LINEA_DISTRIBUZIONE' as const, tipo: 'serbatoio' as const, x: 400, y: 100 }
      const muro = muroDaAscissa(333, [compressore, serbatoio])
      expect(muro!.x).toBe(333)
      expect(muro!.yMin).toBe(100 - MARGINE_SUPERIORE / 2)
      // Il fondo dell'inviluppo è il più basso dei due bordi: qui è quello del serbatoio
      // (100 + 260 = 360), non quello del compressore (200 + 150 = 350).
      expect(muro!.yMax).toBe(
        Math.max(
          200 + DIMENSIONI_NODO.compressore.altezza,
          100 + DIMENSIONI_NODO.serbatoio.altezza
        ) + MARGINE_SUPERIORE / 2
      )
    })

    // Il terminale utenze e' un raccordo, non un'apparecchiatura da separare: stessa esclusione di
    // calcolaMuro, e per la stessa ragione — due regole diverse sarebbero di nuovo due fonti.
    it('non lascia che il terminale utenze allarghi l inviluppo', () => {
      const compressore = { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI' as const, tipo: 'compressore' as const, x: 40, y: 200 }
      const utenze = { ...base, id: 'UTENZE', gruppo: 'LINEA_DISTRIBUZIONE' as const, tipo: 'utenze' as const, x: 900, y: 900 }
      expect(muroDaAscissa(333, [compressore, utenze])).toEqual(muroDaAscissa(333, [compressore]))
    })

    // Un disegno senza apparecchiature non ha inviluppo: un muro alto zero, o alto quanto il
    // margine, sarebbe un segno nel vuoto.
    it('non produce un muro se non c e nulla da separare', () => {
      expect(muroDaAscissa(333, [])).toBeNull()
    })
  })

  it('scala in larghezza al crescere delle apparecchiature, senza sovrapporle', () => {
    const conUno = layoutSchema(
      buildSchemaModel({
        scheda: makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }) }),
        collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      })
    )
    const conTre = layoutSchema(
      buildSchemaModel({
        scheda: schedaTrePiuUno(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
      })
    )

    expect(dimensioniLayout(conTre).larghezza).toBeGreaterThan(dimensioniLayout(conUno).larghezza)

    const compressori = conTre.nodi.filter((n) => n.tipo === 'compressore').sort((a, b) => a.x - b.x)
    for (let i = 0; i < compressori.length - 1; i++) {
      const fine = compressori[i].x + DIMENSIONI_NODO.compressore.larghezza
      expect(compressori[i + 1].x).toBeGreaterThanOrEqual(fine)
    }
  })

  it('produce un riquadro che contiene ogni nodo disposto', () => {
    const layout = layoutSchema(
      buildSchemaModel({
        scheda: schedaTrePiuUno(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
      })
    )

    const { larghezza, altezza } = dimensioniLayout(layout)
    for (const n of layout.nodi) {
      expect(n.x + DIMENSIONI_NODO[n.tipo].larghezza).toBeLessThanOrEqual(larghezza)
      expect(n.y + DIMENSIONI_NODO[n.tipo].altezza).toBeLessThanOrEqual(altezza)
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
    }
  })

  // Revisione finale, rilievo Importante: `maxX` leggeva solo `layout.nodi` e `layout.testi`,
  // mai `layout.muro`. Finché il muro nasceva da solo fra i due gruppi restava sempre dentro la
  // pagina; dal Blocco D4 il committente lo trascina dove vuole, e un muro oltre l'ultima
  // apparecchiatura finiva nel markup ma fuori dal viewBox — visibile sulla tela dell'editor,
  // assente nell'anteprima e nel .docx.
  it('un muro posato a destra di tutto il disegno resta dentro la larghezza della pagina', () => {
    const layout = layoutSchema(
      buildSchemaModel({
        scheda: schedaTrePiuUno(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
      })
    )
    const senzaMuro = dimensioniLayout(layout)
    // Ben oltre il bordo destro di adesso: se `dimensioniLayout` ignorasse il muro, la
    // larghezza non cambierebbe affatto e il confronto sotto cadrebbe di sicuro.
    const muro = muroDaAscissa(senzaMuro.larghezza + 200, layout.nodi)
    const conMuro = dimensioniLayout({ ...layout, muro })

    expect(conMuro.larghezza).toBeGreaterThanOrEqual(muro!.x + SPESSORE_MURO)
  })

  // Perché il fondo del muro non è (più) un candidato di `maxY`, e perché questo test fissa
  // l'SVG di `renderSvg` invece di `dimensioniLayout`: vedi il commento su `dimensioniLayout`
  // (`layout.ts`), dove sta la decisione. Qui è un canarino sulla PRESENZA della tabella sotto
  // il disegno, non sulla sua altezza: un margine ridotto (righe più basse) lo lascia verde,
  // perché il margine strutturale resta ampiamente sovrabbondante rispetto ai 15 unità in
  // gioco — a farlo cadere è solo l'assenza della tabella, non il suo restringersi.
  it('in un impianto col muro, il fondo del muro sta dentro l’altezza dichiarata dall’SVG di renderSvg', () => {
    const layout = layoutSchema(modelloConSalaELinea())
    const muro = calcolaMuro(layout.nodi)
    expect(muro).not.toBeNull()

    const svg = renderSvg({ ...layout, muro })
    const altezzaDichiarata = Number(/height="([\d.]+)"/.exec(svg)![1])

    expect(altezzaDichiarata).toBeGreaterThanOrEqual(muro!.yMax)
  })

  // Stesso difetto, sull'altro bordo: `inviluppoVerticale` sottrae `MARGINE_SUPERIORE / 2` (55)
  // dalla quota più alta senza mai fermarsi a zero. La pagina comincia sempre a `y=0`: un muro il
  // cui inviluppo sale più in alto del nodo più alto di 55 (per esempio un'apparecchiatura
  // trascinata a `y=20`, come nel rilievo del committente) produce un `yMin` negativo, e la sua
  // cima finisce tagliata fuori dal viewBox.
  it('la cima del muro non sale sopra il bordo della pagina: yMin non è mai negativo', () => {
    const layout = layoutSchema(modelloConSalaELinea())
    const spostato = layout.nodi.map((n) => (n.tipo === 'compressore' ? { ...n, y: 20 } : n))
    const muro = calcolaMuro(spostato)
    expect(muro).not.toBeNull()

    expect(muro!.yMin).toBeGreaterThanOrEqual(0)
  })

  it('la tela si allarga per contenere un testo libero che sporge oltre le apparecchiature', () => {
    const layout = layoutSchema(buildSchemaModel({ scheda: makeScheda({}), collegamentiCompressoriSerbatoi: {} }))
    const senza = dimensioniLayout(layout)
    const con = dimensioniLayout({
      ...layout,
      testi: [{ id: 'T1', x: senza.larghezza + 500, y: senza.altezza + 300, contenuto: 'Nota' }],
    })
    expect(con.larghezza).toBeGreaterThan(senza.larghezza)
    expect(con.altezza).toBeGreaterThan(senza.altezza)
  })

  /**
   * Il bordo del foglio segue il RIQUADRO del nodo, angolo compreso, non la sola misura. Una
   * taratura che porta la sagoma all'indietro dei pallini (`dx` negativo, il gesto che il modo
   * taratura esiste per fare) fa cominciare il riquadro a coordinate negative: sommare la sola
   * larghezza dichiarerebbe un bordo destro più a destra di dove il disegno arriva davvero
   * (revisione finale, rilievo Importante).
   */
  it('il bordo destro segue dove il disegno finisce davvero, anche con la sagoma tarata all indietro', () => {
    const tanica: SchemaLayout['nodi'][number] = {
      id: 'T1', tipo: 'tanica', etichetta: 'Raccolta condense', gruppo: 'LINEA_DISTRIBUZIONE',
      valvoleSicurezza: [], origine: 'scheda', x: 100, y: 100,
    }
    const layout: SchemaLayout = { nodi: [tanica], archi: [], muro: null, testi: [] }
    // Tanica 80×40. Sagoma trascinata di 30 a sinistra, ancora sul fianco sinistro a x=0:
    // l'inviluppo va da -30 a +50, quindi il bordo destro cade a 100 - 30 + 50 = 150 (non a 180,
    // che è dove finirebbe se il riquadro partisse dall'origine del nodo).
    const libreria: Tarature = {
      tanica: { dx: -30, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'sx', x: 0, y: 20, accetta: ['aria'] }] },
    }

    expect(dimensioniLayout(layout, libreria).larghezza).toBe(150 + 40)
  })

  describe('ingombro stimato di un testo libero', () => {
    // Layout senza nodi: l'unico contributo a `larghezza`/`altezza` è quello del testo, così i
    // due test discriminano sul VALORE calcolato da `ingombroTesto`, non solo sulla direzione
    // della variazione. Il test sopra ("la tela si allarga...") non ci riesce da solo: piazzando
    // l'annotazione a `senza.larghezza + 500`, quell'offset da solo basta a far crescere il
    // riquadro anche se `ingombroTesto` calcolasse un ingombro nullo o scambiasse le due
    // dimensioni fra loro — due mutazioni che infatti sopravvivevano a quel test soltanto.
    const layoutVuoto: SchemaLayout = { nodi: [], archi: [], muro: null, testi: [] }

    it('la larghezza segue la riga più lunga, non il numero di righe', () => {
      // 100 caratteri, dimensione 18, larghezzaCarattere 0.5: 100 × 18 × 0.5 = 900, + MARGINE 40.
      const layout = { ...layoutVuoto, testi: [{ id: 'T1', x: 0, y: 0, contenuto: 'x'.repeat(100) }] }
      expect(dimensioniLayout(layout).larghezza).toBeCloseTo(940, 5)
    })

    it('l’altezza segue il numero di righe, non la lunghezza del contenuto', () => {
      // 10 righe da un carattere: 9 interlinee × 18 × 1,25 = 202,5, + MARGINE 40.
      const dieciRigheCorte = Array.from({ length: 10 }, () => 'x').join('\n')
      const layout = { ...layoutVuoto, testi: [{ id: 'T1', x: 0, y: 0, contenuto: dieciRigheCorte }] }
      expect(dimensioniLayout(layout).altezza).toBeCloseTo(242.5, 5)
    })
  })

  describe('collocazione del terminale utenze', () => {
    /** `etichetta`, se data, sostituisce quella di default sul nodo utenze prima del layout. */
    function layoutConUtenze(etichetta?: string) {
      const scheda = makeScheda({
        compressori: [makeCompressore({ ha_disoleatore: false })],
        disoleatori: [],
        serbatoi: [makeSerbatoio()],
        essiccatori: [makeEssiccatore()],
        scambiatori: [],
        filtri: [],
        dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      })
      const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
      if (etichetta !== undefined) model.nodi.find((n) => n.tipo === 'utenze')!.etichetta = etichetta
      return layoutSchema(model)
    }

    it('sta a destra di tutto il resto della linea', () => {
      const layout = layoutConUtenze()
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
      const altri = layout.nodi.filter((n) => n.tipo !== 'utenze')

      expect(utenze.x).toBeGreaterThan(Math.max(...altri.map((n) => n.x)))
    })

    it('l’ancora dista PASSO_TERMINALE da quella dell’ultimo elemento della linea, non di più', () => {
      // Difetto trovato su una pratica vera (BADOER INFISSI, 18-08-2026): il terminale si
      // posava sul bordo destro della catena PIU' `PASSO_ORIZZONTALE` (60, un margine fra
      // FAMIGLIE — lo stesso che separa i compressori dai serbatoi — non fra un elemento e il
      // tratto che lo prosegue), e ci sommava anche la meta' larghezza del proprio riquadro:
      // 170 unita' invece delle 20 che separano ogni altro elemento della catena, con la
      // valvola di riserva a meta' di un tratto lunghissimo su entrambi i lati.
      const layout = layoutConUtenze()
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
      const essiccatore = layout.nodi.find((n) => n.tipo === 'essiccatore')!

      expect(posizioneAncora(utenze, 'in').x - posizioneAncora(essiccatore, 'dx').x).toBe(PASSO_TERMINALE)
    })

    it('mette l’ancora alla quota della fascia su cui corrono le tubazioni di linea', () => {
      const layout = layoutConUtenze()
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
      const essiccatore = layout.nodi.find((n) => n.tipo === 'essiccatore')!

      // L'ancora `in` sta in fondo al codolo: la sua quota assoluta è y + altezza VERA, non
      // quella del registro — il riquadro del terminale cresce con la scritta, e dal 17-08-2026
      // l'etichetta di default è già su due righe. Con `DIMENSIONI_NODO.utenze.altezza` questo
      // test tornava lo stesso, ma solo finché l'etichetta stava sotto la soglia di crescita.
      //
      // Dal 18-08-2026 la fascia è la quota delle ANCORE della linea, non il centro dei riquadri:
      // l'ancora `sx` del rombo sta a 50 sul riquadro 110, cioè 5 unità sopra la mezzeria. La
      // differenza si vedeva come un gomito di 5 unità all'ingresso di ogni stadio.
      const quotaAncora = utenze.y + dimensioniDi(utenze).altezza

      expect(quotaAncora).toBe(posizioneAncora(essiccatore, 'sx').y)
    })

    it('mette l’ancora alla quota della fascia anche con un’etichetta su molte righe', () => {
      // Otto righe: un terminale molto più alto del minimo del registro, per esercitare la
      // crescita su una scala che il caso di default (due righe) non copre.
      const etichetta = Array.from({ length: 8 }, (_, i) => `riga ${i}`).join('\n')
      const layout = layoutConUtenze(etichetta)
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
      const essiccatore = layout.nodi.find((n) => n.tipo === 'essiccatore')!

      // L'ancora `in` sta in fondo al codolo: con la scritta su più righe il fondo del riquadro
      // non è più a `DIMENSIONI_NODO.utenze.altezza` fisso, ma a `dimensioniDi(utenze).altezza`.
      // La fascia è la quota dell'ancora dello stadio, non il centro del suo riquadro (18-08-2026).
      const quotaAncora = utenze.y + dimensioniDi(utenze).altezza

      expect(quotaAncora).toBe(posizioneAncora(essiccatore, 'sx').y)
    })

    it('allarga il disegno fino a comprendere la scritta', () => {
      const layout = layoutConUtenze()
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!

      expect(dimensioniLayout(layout).larghezza).toBeGreaterThanOrEqual(
        utenze.x + DIMENSIONI_NODO.utenze.larghezza
      )
    })
  })
})

describe('quoteInstradamento', () => {
  /** Layout minimo scritto a mano: numeri fissi, così i valori attesi sono verificabili a occhio. */
  function layoutDiProva(): SchemaLayout {
    return {
      nodi: [
        // Più in alto del serbatoio più alto. Dal 18-08-2026 e' proprio questo compressore a
        // dettare la quota del collettore: la dorsale deve passare sopra i compressori, non solo
        // sopra i serbatoi, o coi serbatoi bassi (l'orizzontale) finirebbe sotto di loro.
        {
          id: 'C1', tipo: 'compressore', etichetta: 'Compressore', gruppo: 'SALA_COMPRESSORI',
          valvoleSicurezza: [], origine: 'scheda', x: 100, y: 200,
        },
        {
          id: 'S1', tipo: 'serbatoio', orientamento: 'VERTICALE', etichetta: 'Serbatoio',
          gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda', x: 500, y: 400,
        },
        // Secondo serbatoio, più in basso del primo: separa `Math.min` da `Math.max` fra i
        // serbatoi, che con un solo serbatoio coinciderebbero e lascerebbero passare la
        // mutazione min→max senza che nessun test se ne accorga.
        {
          id: 'S2', tipo: 'serbatoio', orientamento: 'VERTICALE', etichetta: 'Serbatoio',
          gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda', x: 700, y: 620,
        },
        {
          id: 'T1', tipo: 'tanica', etichetta: 'Raccolta condense', gruppo: 'ALTRO',
          valvoleSicurezza: [], origine: 'scheda', x: 200, y: 900,
        },
      ],
      archi: [
        { id: 'a1', da: { nodo: 'C1', ancora: 'basso-out' }, a: { nodo: 'T1', ancora: 'alto-in' }, stile: 'condensa' },
      ],
      muro: null,
      testi: [],
    }
  }

  it('mette il collettore sopra il più alto fra corpo dei serbatoi e cima dei compressori', () => {
    // Due vincoli, vince il più alto. Serbatoio a y=400: il corpo comincia 40 unità più in basso
    // (`MARGINE_VALVOLA_SERBATOIO`, lo spazio della valvola di sicurezza), quindi 440 - 10 = 430.
    // Compressore a y=200: vince questo. Fino al 18-08-2026 la misura partiva dal RIQUADRO del
    // serbatoio e ignorava i compressori: dava 380.
    //
    // Contro la COSTANTE e non contro il numero: il margine sui compressori si e' mosso una volta
    // (60 -> 80 nel Blocco 4, al valore misurato sul riferimento) e questo test cadeva per un
    // motivo che non e' suo — cio' che deve fissare e' QUALE dei due vincoli vince, non quanto vale.
    expect(quoteInstradamento(layoutDiProva()).yCollettore).toBe(200 - MARGINE_COLLETTORE_COMPRESSORI)
  })

  it('e col serbatoio orizzontale, il cui corpo sta in basso, sono i compressori a dettare', () => {
    // Il caso che impone i due vincoli: guardando il solo serbatoio la dorsale finirebbe SOTTO la
    // cima dei compressori, i montanti scenderebbero invece di salire e la valvola ancorata
    // collasserebbe sul capo del tubo.
    const layout = layoutDiProva()
    const serbatoio = layout.nodi.find((n) => n.id === 'S1')!
    serbatoio.orientamento = 'ORIZZONTALE'
    // Il corpo finisce a 290, sotto la cima dei compressori (200): e' il caso da esercitare.
    serbatoio.y = 250
    expect(quoteInstradamento(layout).yCollettore).toBe(200 - MARGINE_COLLETTORE_COMPRESSORI)
    expect(quoteInstradamento(layout).yCollettore).toBeLessThan(
      layout.nodi.find((n) => n.tipo === 'compressore')!.y
    )
  })

  it('mette la corsia condense 40 unità sopra il corpo del pozzo di raccolta', () => {
    // Tanica a y=900: il suo corpo (corpoNodo) coincide col riquadro dal fix round 1 del Task 4
    // (il rettangolo disegnato non è più rientrato di 6 unità) -> 900 - 40 = 860.
    expect(quoteInstradamento(layoutDiProva()).yCorsiaCondense).toBe(860)
  })

  it('senza pozzo di raccolta la corsia va in fondo al disegno', () => {
    const layout = layoutDiProva()
    layout.nodi = layout.nodi.filter((n) => n.tipo !== 'tanica')
    layout.archi = []
    // Nessun pozzo: la corsia scende a mezzo margine dal fondo della tela, non resta a 860.
    const attesa = dimensioniLayout(layout).altezza - 20
    expect(quoteInstradamento(layout).yCorsiaCondense).toBe(attesa)
  })
})

describe('estensioneOrizzontale', () => {
  const vuoto: SchemaLayout = { nodi: [], archi: [], muro: null, testi: [] }

  it('su una tela vuota il disegno non ha estensione, e la larghezza resta quella di sempre', () => {
    const e = estensioneOrizzontale(vuoto.nodi, vuoto.testi, vuoto.muro)
    expect(e.destra - e.sinistra).toBe(0)
    expect(dimensioniLayout(vuoto).larghezza).toBe(80)
  })

  it('il bordo sinistro è quello del nodo più a sinistra, non zero', () => {
    const nodi = [serbatoioA('S1', 300, 0), serbatoioA('S2', 500, 0)]
    expect(estensioneOrizzontale(nodi, [], null).sinistra).toBe(300)
  })

  it('un’annotazione più a sinistra di ogni apparecchiatura sposta il bordo sinistro', () => {
    const nodi = [serbatoioA('S1', 300, 0)]
    const testi = [{ id: 'T1', x: 120, y: 0, contenuto: 'Nota' }]
    expect(estensioneOrizzontale(nodi, testi, null).sinistra).toBe(120)
  })

  it('un muro posato a sinistra di tutto conta come bordo sinistro', () => {
    const nodi = [serbatoioA('S1', 300, 0)]
    expect(estensioneOrizzontale(nodi, [], { x: 100, yMin: 0, yMax: 200 }).sinistra).toBe(100)
  })

  // `dimensioniLayout` non deve più calcolarsi la larghezza per conto suo: due percorsi paralleli
  // sullo stesso ingombro divergerebbero al primo ritocco a uno dei due.
  it('la larghezza di dimensioniLayout è il bordo destro più un margine', () => {
    const layout = { ...vuoto, nodi: [serbatoioA('S1', 300, 0), serbatoioA('S2', 800, 0)] }
    const destra = estensioneOrizzontale(layout.nodi, layout.testi, layout.muro).destra
    expect(dimensioniLayout(layout).larghezza).toBe(destra + 40)
  })
})

describe('catenaDagliArchi', () => {
  const stadio = (id: string, tipo: SchemaNodo['tipo'] = 'filtro'): SchemaNodo => ({
    id,
    tipo,
    etichetta: id,
    gruppo: 'SALA_COMPRESSORI',
    valvoleSicurezza: [],
    origine: 'scheda',
  })
  const serbatoio: SchemaNodo = { ...stadio('S1'), tipo: 'serbatoio' }
  const aria = (da: string, a: string): SchemaArco => ({
    id: `${da}-${a}`,
    da: { nodo: da, ancora: 'dx' },
    a: { nodo: a, ancora: 'sx' },
    stile: 'standard',
  })

  // Dal 20-08-2026 il serbatoio e' un elemento di linea come gli altri (Task 3): senza una mandata
  // di compressore nel modello — nessuno di questi test la costruisce, sono grafi scritti a mano —
  // `catenaDagliArchi` ripiega sul primo elemento di linea che nessun arco raggiunge. S1 e' sempre
  // la sorgente degli archi d'aria qui sotto e mai il bersaglio di uno, quindi la testa e' lui: la
  // catena attesa comincia con 'S1' dove prima cominciava a valle del serbatoio.
  it('segue gli archi, non il rango per tipo', () => {
    // Per rango sarebbe F1 (prefiltro), E1, F2. Gli archi dicono l'opposto, e vincono loro.
    const model: SchemaModel = {
      nodi: [{ ...stadio('F1'), prefiltro: true }, stadio('E1', 'essiccatore'), stadio('F2'), serbatoio],
      archi: [aria('S1', 'F2'), aria('F2', 'E1'), aria('E1', 'F1'), aria('F1', 'UTENZE')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['S1', 'F2', 'E1', 'F1'])
  })

  it('non gira in tondo su un grafo ciclico', () => {
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F2'), serbatoio],
      archi: [aria('S1', 'F1'), aria('F1', 'F2'), aria('F2', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['S1', 'F1', 'F2'])
  })

  it('appende in coda gli stadi che gli archi non raggiungono, nell’ordine di default', () => {
    // F3 e' scollegato: senza il ripiego sparirebbe dal disegno, che e' peggio di un ordine strano.
    //
    // F3 e S1 sono entrambi candidati alla testa per esclusione (nessun arco li raggiunge), ma il
    // ripiego preferisce S1: e' lui ad avere un successore (l'arco verso F1), cioe' e' davvero la
    // sorgente di una catena. F3 non ha ne' un arco entrante ne' uno uscente — e' un orfano, non la
    // testa della linea — e finisce infatti in coda, nell'ordine di default.
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F3'), serbatoio],
      archi: [aria('S1', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['S1', 'F1', 'F3'])
  })

  it('non segue il ponte di un by-pass, nemmeno quando è il primo arco che esce dal TEE', () => {
    // Da una giunzione di by-pass escono DUE archi: la linea e il ponte. `catenaDagliArchi`
    // prende il primo che trova, e seguendo il ponte salterebbe tutti gli stadi scavalcati —
    // che finirebbero fra gli orfani, appesi in coda nell'ordine di default: un disegno con le
    // linee incrociate, cioe' il difetto che questa funzione e' nata per chiudere.
    //
    // Il ponte sta PRIMO nell'elenco di proposito: con la sola difesa dell'ordine di emissione
    // in `buildArchi` questo test sarebbe verde per la ragione sbagliata.
    const model: SchemaModel = {
      nodi: [
        stadio('BP1-IN', 'giunzione'),
        { ...stadio('F1'), prefiltro: true },
        stadio('F2'),
        stadio('BP1-OUT', 'giunzione'),
        serbatoio,
      ],
      archi: [
        { ...aria('BP1-IN', 'BP1-OUT'), stile: 'flessibile', forma: 'ponte' },
        aria('S1', 'BP1-IN'),
        aria('BP1-IN', 'F1'),
        aria('F1', 'F2'),
        aria('F2', 'BP1-OUT'),
        aria('BP1-OUT', 'UTENZE'),
      ],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['S1', 'BP1-IN', 'F1', 'F2', 'BP1-OUT'])
  })

  it('non segue le linee condense, che non dicono nulla sull’ordine dell’aria', () => {
    // L'arco condensa esce da S1 PRIMA di quello d'aria: seguendolo, la catena si fermerebbe sul
    // pozzo e i due filtri ricadrebbero fra gli orfani, cioe' nell'ordine di default F1 → F2 —
    // l'opposto di quello che gli archi d'aria collegano.
    const model: SchemaModel = {
      nodi: [{ ...stadio('F1'), prefiltro: true }, stadio('F2'), stadio('T', 'tanica'), serbatoio],
      archi: [
        { id: 'c1', da: { nodo: 'S1', ancora: 'basso-out' }, a: { nodo: 'T', ancora: 'alto-in' }, stile: 'condensa' },
        aria('S1', 'F2'),
        aria('F2', 'F1'),
      ],
    }
    expect(catenaDagliArchi(model, stadio('T', 'tanica')).map((n) => n.id)).toEqual(['S1', 'F2', 'F1'])
  })

  it('e’ layoutSchema a usarla: il disegno dispone nell’ordine in cui gli archi collegano', () => {
    // Senza questo, `layoutSchema` potrebbe tornare a `ordinaCatenaTrattamento` e nessuno dei test
    // qui sopra se ne accorgerebbe: chiamano tutti la funzione direttamente.
    const model: SchemaModel = {
      nodi: [{ ...stadio('F1'), prefiltro: true }, stadio('F2'), serbatoio],
      archi: [aria('S1', 'F2'), aria('F2', 'F1')],
    }
    const disposti = layoutSchema(model)
      .nodi.filter((n) => n.tipo === 'filtro')
      .sort((a, b) => a.x - b.x)
      .map((n) => n.id)
    expect(disposti).toEqual(['F2', 'F1'])
  })

  it('il pozzo di raccolta resta fuori dalla linea', () => {
    const pozzo = stadio('SEP1', 'separatore')
    const model: SchemaModel = {
      nodi: [stadio('F1'), pozzo, serbatoio],
      archi: [
        aria('S1', 'F1'),
        { id: 'c1', da: { nodo: 'F1', ancora: 'basso-out' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'condensa' },
      ],
    }
    expect(catenaDagliArchi(model, pozzo).map((n) => n.id)).toEqual(['S1', 'F1'])
  })
})

describe('pozzoCondense quando le condense sono tutte spente', () => {
  const sep: SchemaNodo = {
    id: 'SEP1',
    tipo: 'separatore',
    etichetta: 'SEP1',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
  const s1: SchemaNodo = { ...sep, id: 'S1', tipo: 'serbatoio', gruppo: 'SALA_COMPRESSORI' }

  it('resta il pozzo anche se non riceve più nulla', () => {
    // L'operatore ha tolto ogni spunta: il separatore non ha piu' archi entranti. Prima del
    // 18-08-2026 `pozzoCondense` tornava null e il separatore finiva trascinato dentro la linea
    // di processo, in disaccordo con gli archi.
    const model = {
      nodi: [sep, s1],
      archi: [
        { id: 'ut', da: { nodo: 'S1', ancora: 'dx' }, a: { nodo: 'UTENZE', ancora: 'in' }, stile: 'standard' as const },
      ],
    }
    expect(pozzoCondense(model.nodi, model)?.id).toBe('SEP1')
  })

  it('non è il pozzo se l’aria lo attraversa, cioè se è uno stadio di linea', () => {
    const model = {
      nodi: [sep, s1],
      archi: [
        { id: 'a1', da: { nodo: 'S1', ancora: 'dx' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'standard' as const },
        { id: 'c1', da: { nodo: 'S1', ancora: 'basso-out' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'condensa' as const },
      ],
    }
    expect(pozzoCondense(model.nodi, model)).toBeNull()
  })

  it('un arco d’aria USCENTE basta a escluderlo, non solo uno entrante', () => {
    // Il caso che separa le due regole: un separatore che sta in fondo alla linea (aria in
    // uscita verso le utenze) e riceve anche condensa dal serbatoio. Guardando i soli archi
    // ENTRANTI — la regola fino al 18-08-2026 — sarebbero tutti condensa, e il separatore
    // verrebbe scambiato per il pozzo pur essendo l'ultimo stadio di trattamento.
    const model = {
      nodi: [sep, s1],
      archi: [
        { id: 'c1', da: { nodo: 'S1', ancora: 'basso-out' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'condensa' as const },
        { id: 'a1', da: { nodo: 'SEP1', ancora: 'dx' }, a: { nodo: 'UTENZE', ancora: 'in' }, stile: 'standard' as const },
      ],
    }
    expect(pozzoCondense(model.nodi, model)).toBeNull()
  })
})

describe('la linea di processo si dispone per ancore', () => {
  const disegno = () =>
    layoutSchema(
      buildSchemaModel({ scheda: schedaConTreStadi(), collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
  const stadiDi = (l: SchemaLayout) =>
    l.nodi.filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore').sort((a, b) => a.x - b.x)

  it('l’ancora sx di ogni stadio sta sulla quota dell’ancora dx del serbatoio', () => {
    // Convenzione 4: la linea nasce dritta. Fino al 18-08-2026 gli stadi erano centrati sulla
    // mezzeria dei serbatoi, 55 unita' piu' in basso, e la linea partiva con un gomito che
    // l'operatore raddrizzava a mano su ogni pratica.
    const l = disegno()
    const quota = posizioneAncora(nodo(l, 'S1'), 'dx').y
    for (const stadio of stadiDi(l)) {
      expect(posizioneAncora(stadio, 'sx').y).toBe(quota)
    }
  })

  it('l’ancora dx di uno stadio coincide con l’ancora sx del successivo', () => {
    // Convenzione 3: passo 100, non i 170 del riquadro piu' PASSO_ORIZZONTALE.
    const stadi = stadiDi(disegno())
    expect(stadi.length).toBeGreaterThan(1)
    for (let i = 0; i < stadi.length - 1; i++) {
      expect(posizioneAncora(stadi[i + 1], 'sx').x).toBe(posizioneAncora(stadi[i], 'dx').x + GIOCO_FRA_STADI)
    }
  })

  it('i codoli di due stadi adiacenti si toccano punta a punta, senza entrare l’uno nell’altro', () => {
    // `simboloRombo` (symbols/index.ts) disegna il rombo fra x=0 e x=100 dentro un riquadro largo
    // 110, con le ancore sx/dx sulle DUE PUNTE e un codolo di 10 unita' che sporge fuori da
    // ciascuna. Il collegamento fra due stadi e' fatto dai due codoli che si incontrano: a gioco 0
    // il codolo sinistro del secondo rombo entrava di 10 unita' nel corpo del primo, e i due
    // simboli sembravano fusi — cio' che il disegno mostrava prima del Blocco 4.
    //
    // Non e' un doppione del test qui sopra: quello fissa che il passo venga dalle ANCORE, questo
    // fissa PERCHE' il gioco non puo' essere zero. Il primo passa anche a gioco 0.
    const CODOLO = 10
    const stadi = stadiDi(disegno())
    expect(stadi.length).toBeGreaterThan(1)
    for (let i = 0; i < stadi.length - 1; i++) {
      const puntaDx = posizioneAncora(stadi[i], 'dx').x
      const puntaSx = posizioneAncora(stadi[i + 1], 'sx').x
      expect(puntaDx + CODOLO).toBe(puntaSx - CODOLO)
    }
  })

  it('il passo fra due stadi viene dalle ancore, non dal riquadro più PASSO_ORIZZONTALE', () => {
    // Il numero della convenzione 3. Non fissa `GIOCO_FRA_STADI` — quello e' una scelta del
    // committente, chiusa a 20 nel Blocco 4 — ma fissa che l'avanzamento venga dalle ANCORE (il
    // rombo le ha a 0 e 100 su un riquadro di 110) e non dal riquadro piu' il passo orizzontale.
    const stadi = stadiDi(disegno())
    for (let i = 0; i < stadi.length - 1; i++) {
      expect(stadi[i + 1].x - stadi[i].x).toBe(100 + GIOCO_FRA_STADI)
    }
  })

  it('il terminale utenze sta sulla stessa quota, così la linea vi entra dritta', () => {
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'UTENZE'), 'in').y).toBe(posizioneAncora(nodo(l, 'S1'), 'dx').y)
  })

  it('senza serbatoi la quota ripiega su quella di prima, invece di sollevare', () => {
    const model: SchemaModel = {
      nodi: [
        { id: 'F1', tipo: 'filtro', etichetta: 'F1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' },
      ],
      archi: [],
    }
    expect(() => layoutSchema(model)).not.toThrow()
    expect(layoutSchema(model).nodi[0].y).toBeGreaterThanOrEqual(0)
  })
})

describe('il contratto di sola andata degli ancoraggi', () => {
  it('layoutSchema non lascia uscire nessuna istruzione di ancoraggio', () => {
    // Il formato salvato non cambia di un byte: `renderSvg`, `conversioneFlow`,
    // `SchemaEdgeTubazione`, `useSegniTubo` e la serializzazione non sanno nulla degli ancoraggi,
    // e non devono impararlo.
    const model = buildSchemaModel({
      scheda: schedaConTreStadi(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
    const segni = layoutSchema(model).archi.flatMap((a) => a.segni ?? [])

    expect(segni.length).toBeGreaterThan(0) // o passerebbe su un insieme vuoto
    for (const segno of segni) expect(segno).not.toHaveProperty('ancoraggio')
  })

  it('e li risolve davvero: un ancoraggio seminato sul modello diventa una t calcolata', () => {
    // Finché il Task 6 non semina ancoraggi, il test qui sopra sarebbe verde anche con
    // `risolviSegniAncorati` scollegata. Questo lo semina a mano e guarda il numero.
    const model = buildSchemaModel({
      scheda: schedaConTreStadi(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
    })
    const flex = model.archi.find((a) => a.stile === 'flessibile')!
    flex.segni = [
      { id: 'x', tipo: 'valvola_intercettazione', t: 0.5, ancoraggio: { tipo: 'vertice', vertice: 1, scarto: -10 } },
    ]

    const risolto = layoutSchema(model).archi.find((a) => a.id === flex.id)!
    expect(risolto.segni![0].t).not.toBe(0.5)
    expect(risolto.segni![0]).not.toHaveProperty('ancoraggio')
  })
})

describe('gli stacchi fra le famiglie', () => {
  const impianto = () =>
    layoutSchema(
      buildSchemaModel({
        scheda: schedaTrePiuUno(),
        collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
      })
    )
  const compressoriDi = (l: SchemaLayout) =>
    l.nodi.filter((n) => n.tipo === 'compressore').sort((a, b) => a.x - b.x)

  it('due compressori affiancati stanno a due passi di griglia l’uno dall’altro', () => {
    // Convenzione 8, misurata su `no bypass.png`: fra il bordo destro di C1 e quello sinistro di
    // C2 corrono 11,4 px, cioe' ~20 unita' alla scala di quell'immagine (0,581 px/unita', letta
    // dal reticolo da 10 unita' della tela). Prima erano 60, cioe' `PASSO_ORIZZONTALE`.
    const compressori = compressoriDi(impianto())
    expect(compressori.length).toBeGreaterThan(1)
    for (let i = 0; i + 1 < compressori.length; i++) {
      const bordoDestro = compressori[i].x + dimensioniDi(compressori[i]).larghezza
      expect(compressori[i + 1].x - bordoDestro).toBe(PASSO_COMPRESSORI)
    }
  })

  it('il serbatoio segue i compressori a un solo stacco, non a due sommati', () => {
    // Prima valeva `PASSO_ORIZZONTALE + PASSO_VERTICALE` = 140, e nessuno dei due nomi diceva
    // «stacco fra la sala compressori e i serbatoi» — il secondo si dichiarava perfino VERTICALE.
    // Misurato ~90 sul riferimento (53 px fra il bordo destro di C2 e quello sinistro di S1).
    const l = impianto()
    const compressori = compressoriDi(l)
    const ultimo = compressori[compressori.length - 1]
    const serbatoio = nodo(l, 'S1')
    expect(serbatoio.x - (ultimo.x + dimensioniDi(ultimo).larghezza)).toBe(STACCO_COMPRESSORI_SERBATOI)
  })

  it('il primo stadio segue il serbatoio a `STACCO_SERBATOI_LINEA` dal suo bordo', () => {
    // Su questo tratto sta la valvola di riserva all'uscita del serbatoio (convenzione 6):
    // misurato ~73 sul riferimento (42,5 px), contro i 60 di prima. E' l'unico dei tre stacchi
    // che CRESCE — a 60 la valvola ci stava stretta.
    const l = layoutSchema(
      buildSchemaModel({ scheda: schedaConTreStadi(), collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const serbatoio = nodo(l, 'S1')
    const primo = l.nodi
      .filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore')
      .sort((a, b) => a.x - b.x)[0]
    const bordoSerbatoio = serbatoio.x + dimensioniDi(serbatoio).larghezza
    expect(posizioneAncora(primo, 'sx').x - bordoSerbatoio).toBe(STACCO_SERBATOI_LINEA)
  })
})

describe('la dorsale dei compressori', () => {
  it('si regola sui COMPRESSORI, anche quando il serbatoio è più alto di loro', () => {
    // Il serbatoio non detta piu' la quota della dorsale (decisione del committente, 18-08-2026,
    // Task 4b del Blocco 4). Nel suo disegno la dorsale corre appena sopra i compressori e passa
    // SOTTO la cima della capsula: il vincolo «stare sopra il corpo del serbatoio» la teneva 90
    // unita' piu' in alto del necessario, e i montanti nascevano lunghi il doppio del disegno vero.
    //
    // Il serbatoio verticale di questa scheda e' proprio il caso in cui, prima, vinceva lui.
    const layout = layoutSchema(
      buildSchemaModel({ scheda: schedaConTreStadi(), collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const compressore = nodo(layout, 'C1')
    expect(quotaCollettore(layout)).toBe(compressore.y - MARGINE_COLLETTORE_COMPRESSORI)
    // E la dorsale sta ora piu' in BASSO della cima della capsula: e' il fatto nuovo, quello che
    // il vincolo tolto impediva. Senza questa asserzione il test passerebbe anche se il serbatoio
    // fosse rimasto a dettare, in un impianto dove le due quote si somigliano.
    expect(quotaCollettore(layout)).toBeGreaterThan(corpoNodo(nodo(layout, 'S1')).y)
  })

  for (const orientamento of ['VERTICALE', 'ORIZZONTALE'] as const) {
    it(`e col serbatoio ${orientamento} non entra nella capsula, perché gira in giù sul FIANCO`, () => {
      // E' la premessa su cui poggia la regola qui sopra, e va provata su ENTRAMBI gli
      // orientamenti perche' usano ancore diverse: la dorsale non passa mai sopra il serbatoio, si
      // aggancia a `sx-basso` (verticale) o a `sx` (orizzontale, che `sx-basso` non ce l'ha), e
      // tutt'e due stanno sul BORDO SINISTRO della capsula — `x: 0` in coordinate locali
      // (symbols/index.ts). La corsa orizzontale finisce quindi dove il serbatoio comincia, e da
      // li' scende di fianco.
      //
      // Se un giorno la mandata si agganciasse a un'ancora interna, questo test cade — ed e'
      // esattamente il momento in cui il vincolo tolto andrebbe rimesso.
      const scheda = makeScheda({
        compressori: [makeCompressore({ codice: 'C1' })],
        disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
        serbatoi: [makeSerbatoio({ orientamento })],
      })
      const layout = layoutSchema(
        buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
      )
      const serbatoio = nodo(layout, 'S1')
      const compressore = nodo(layout, 'C1')
      const mandata = layout.archi.find((a) => a.da.nodo === 'C1' && a.a.nodo === 'S1')!
      const punti = instrada(
        mandata.stile,
        posizioneAncora(compressore, mandata.da.ancora),
        posizioneAncora(serbatoio, mandata.a.ancora),
        mandata.punti,
        quoteInstradamento(layout),
        {
          da: latoImposto(compressore, mandata.da.ancora),
          a: latoImposto(serbatoio, mandata.a.ancora),
        }
      )
      const bordoSinistro = corpoNodo(serbatoio).x
      for (const p of punti) expect(p.x).toBeLessThanOrEqual(bordoSinistro)
    })
  }

  it('col serbatoio orizzontale sta a `MARGINE_COLLETTORE_COMPRESSORI` sopra i compressori', () => {
    // E' il caso in cui il vincolo dei compressori vince: la capsula di un serbatoio ORIZZONTALE
    // sta piu' in basso della loro cima. Il montante deve ospitare la valvola (due passi sotto la
    // dorsale) e sotto di essa un tratto di flessibile che si veda: misurato ~79 unita' su
    // `no bypass.png` (46 px fra la dorsale a y=135 e la cima dei compressori a y=181).
    const SCARTO_VALVOLA = 20 // `buildSchemaModel.ts`, convenzione 1: non si esporta per un test
    const l = layoutSchema(
      buildSchemaModel({
        scheda: makeScheda({
          compressori: [makeCompressore({ codice: 'C1' })],
          disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
          serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
        }),
        collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      })
    )
    const compressore = nodo(l, 'C1')
    expect(quotaCollettore(l)).toBe(compressore.y - MARGINE_COLLETTORE_COMPRESSORI)
    // E sotto la valvola resta un tratto di flessibile che si vede: sono le quattro ondulazioni
    // che si contano sul riferimento.
    expect(compressore.y - quotaCollettore(l) - SCARTO_VALVOLA).toBeGreaterThanOrEqual(50)
  })

  it('senza serbatoi ripiega su qualcosa di disegnabile, invece di sollevare', () => {
    const model: SchemaModel = {
      nodi: [
        { id: 'C1', tipo: 'compressore', etichetta: 'C1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' },
      ],
      archi: [],
    }
    expect(() => quotaCollettore(layoutSchema(model))).not.toThrow()
  })
})

describe('il by-pass nel layout', () => {
  const scheda = () =>
    makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'VERTICALE' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }), makeFiltro({ codice: 'F2', tipo: 'LINEA' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

  const disegno = (gruppi: string[][] = [['F1', 'E1', 'F2']]) => {
    const s = scheda()
    return layoutSchema(
      buildSchemaModel({
        scheda: s,
        collegamentiCompressoriSerbatoi: { C1: ['S1'] },
        preferenze: preferenzeRisolteDaScheda(s, {
          bypass: gruppi.map((g, i) => ({ id: `bp${i + 1}`, stadi: g })),
        }),
      })
    )
  }

  // Da una giunzione di by-pass escono DUE archi: la linea e il ponte. Il ponte e' quello che
  // arriva sull'ALTRA giunzione — cercarlo per solo capo di partenza pesca la linea, che e'
  // emessa per prima.
  const ponteDi = (l: SchemaLayout, gruppo = 'BP1') =>
    l.archi.find((a) => a.da.nodo === `${gruppo}-IN` && a.a.nodo === `${gruppo}-OUT`)!

  /** La polilinea vera del ponte: gli stessi punti che disegnera' `renderSvg`. */
  const polilineaPonte = (l: SchemaLayout, gruppo = 'BP1') => {
    const arco = ponteDi(l, gruppo)
    const da = nodo(l, arco.da.nodo)
    const a = nodo(l, arco.a.nodo)
    return instrada(
      arco.stile,
      posizioneAncora(da, arco.da.ancora),
      posizioneAncora(a, arco.a.ancora),
      arco.punti,
      quoteInstradamento(l),
      { da: latoImposto(da, arco.da.ancora), a: latoImposto(a, arco.a.ancora) }
    )
  }

  it('la giunzione di valle cade sulla linea di processo, come gli stadi', () => {
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-OUT'), 'sx').y).toBe(posizioneAncora(nodo(l, 'F1'), 'sx').y)
  })

  it('la giunzione di monte sta invece alla quota dell’uscita del serbatoio', () => {
    // La scelta del committente sul suo disegno (18-08-2026), ed e' ASIMMETRICA di proposito: a
    // monte il flusso si divide PRIMA di scendere negli stadi, a valle si ricongiunge SULLA linea
    // e prosegue verso le utenze a quella quota. Renderla simmetrica aggiungerebbe verso le utenze
    // un tratto verticale che nel riferimento non c'e'.
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(posizioneAncora(nodo(l, 'S1'), 'dx').y)
    // La stessa cosa detta in unita' di corsia: sta `PASSO_CORSIA_BYPASS` sopra la linea, cioe'
    // esattamente di quanto la linea era scesa per fargli posto.
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(
      posizioneAncora(nodo(l, 'F1'), 'sx').y - PASSO_CORSIA_BYPASS
    )
  })

  it('il TEE di monte sta un PASSO_GIUNZIONE prima della punta del primo stadio scavalcato', () => {
    // Asserzione sulla COSTANTE, non sul valore. La simmetria del Blocco 3 non c'e' piu' e non
    // deve esserci: di qua il TEE sta SOPRA la linea, di la' e' di fianco. La misura sul
    // riferimento (Blocco 5) da' 20,6 unita' di qua e 28 di la': un passo solo le copre entrambe.
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').x).toBe(
      posizioneAncora(nodo(l, 'F1'), 'sx').x - PASSO_GIUNZIONE
    )
  })

  it('e il TEE di valle un PASSO_GIUNZIONE dopo la punta dell’ultimo, sulla linea', () => {
    const l = disegno()
    expect(posizioneAncora(nodo(l, 'BP1-OUT'), 'sx').x).toBe(
      posizioneAncora(nodo(l, 'F2'), 'dx').x + PASSO_GIUNZIONE
    )
  })

  it('senza giunzioni le distanze della catena non cambiano', () => {
    // Non-regressione della convenzione 3: la riscrittura di `disponiSequenza` dev'essere
    // invisibile quando by-pass non ce ne sono.
    const l = disegno([])
    const stadi = l.nodi
      .filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore')
      .sort((a, b) => a.x - b.x)
    expect(stadi.length).toBeGreaterThan(1)
    for (let i = 0; i < stadi.length - 1; i++) {
      expect(posizioneAncora(stadi[i + 1], 'sx').x).toBe(posizioneAncora(stadi[i], 'dx').x + GIOCO_FRA_STADI)
    }
  })

  it('con un by-pass la linea di processo scende di una corsia', () => {
    const senza = posizioneAncora(nodo(disegno([]), 'F1'), 'sx').y
    const con = posizioneAncora(nodo(disegno(), 'F1'), 'sx').y
    expect(con).toBe(senza + PASSO_CORSIA_BYPASS)
  })

  it('la corsa del ponte cade sulla quota dell’uscita del serbatoio, e le e’ ADIACENTE', () => {
    // La prima meta' resta vera per un'altra ragione: non perche' il ponte salga di
    // `ALTEZZA_BYPASS` sopra due capi complanari, ma perche' il capo di monte e' gia' li'.
    // La seconda cambia: il tratto che arriva da S1 e la corsa del ponte non sono piu' disgiunti,
    // si TOCCANO sul TEE — ed e' cio' che il riferimento mostra come una riga sola, da x=270
    // (bocchello di S1) a x=575, senza interruzioni.
    const l = disegno()
    const uscita = posizioneAncora(nodo(l, 'S1'), 'dx')
    const punti = polilineaPonte(l)
    expect(punti[0].y).toBe(uscita.y)
    expect(punti[1].y).toBe(uscita.y)
    expect(punti[0].x).toBeGreaterThan(uscita.x)
    // E l'arco che arriva da S1 finisce dove il ponte comincia, senza gomiti fra i due: il gradino
    // dal serbatoio sparisce da se', perche' i suoi due capi sono ora alla stessa quota.
    const daSerbatoio = l.archi.find((a) => a.da.nodo === 'S1' && a.a.nodo === 'BP1-IN')!
    expect(daSerbatoio.punti ?? []).toHaveLength(0)
  })

  it('senza by-pass la linea resta alla quota dell’uscita del serbatoio', () => {
    // Non-regressione della convenzione 4.
    const l = disegno([])
    expect(posizioneAncora(nodo(l, 'F1'), 'sx').y).toBe(posizioneAncora(nodo(l, 'S1'), 'dx').y)
  })

  it('il ponte esce dal layout con tre vertici: capo, gomito, capo', () => {
    // E' su questo che contano i due ancoraggi seminati da `buildArchi` — meta' del tratto 0 e
    // vertice 1. Cambiare il numero di gomiti sposta le due valvole senza che nessun test del
    // modello se ne accorga: il legame fra le due cose sta qui.
    const punti = polilineaPonte(disegno())
    expect(punti).toHaveLength(3)
    expect(punti[0].y).toBe(punti[1].y) // la corsa orizzontale, tratto 0
    expect(punti[1].x).toBe(punti[2].x) // la gamba che scende, tratto 1
  })

  it('col capo di monte preso dall’alto il ponte piegherebbe a mezza quota: per questo il gomito', () => {
    // La ragione del gomito CAMBIA col Blocco 5. Prima: coi due TEE alla stessa quota
    // `rottaImboccata` piegava a `yMedia` — la loro stessa quota — e `dedup` riduceva il ponte a
    // una retta sovrapposta alla linea di processo. Ora i due capi stanno a quote diverse, e la
    // piega dipende dai LATI: prendendo il capo di monte dall'ancora `alto` (verticale su
    // entrambi i capi) la corsa cadrebbe a meta' fra le due quote — un ponte che non corre ne'
    // sulla quota del suo capo ne' su quella della linea.
    const l = disegno()
    const quotaMonte = posizioneAncora(nodo(l, 'BP1-IN'), 'alto').y
    const quotaValle = posizioneAncora(nodo(l, 'BP1-OUT'), 'alto').y
    const dallAlto = instrada(
      'standard',
      posizioneAncora(nodo(l, 'BP1-IN'), 'alto'),
      posizioneAncora(nodo(l, 'BP1-OUT'), 'alto'),
      undefined,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), 'alto'), a: latoImposto(nodo(l, 'BP1-OUT'), 'alto') }
    )
    expect(dallAlto.some((p) => p.y !== quotaMonte && p.y !== quotaValle)).toBe(true)
    // Preso di FIANCO, invece, la piega che `rottaImboccata` produce da se' coincide col gomito
    // scritto dal layout: il ponte non dipende da un'euristica per stare al suo posto. Questo
    // test e' la sentinella del giorno in cui le due risposte divergessero.
    const senzaGomiti = instrada(
      'standard',
      posizioneAncora(nodo(l, 'BP1-IN'), 'dx'),
      posizioneAncora(nodo(l, 'BP1-OUT'), 'alto'),
      undefined,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), 'dx'), a: latoImposto(nodo(l, 'BP1-OUT'), 'alto') }
    )
    expect(senzaGomiti).toEqual(polilineaPonte(l))
  })

  it('le tre valvole finiscono dove le convenzioni le vogliono, su DUE archi', () => {
    // Si misura sui PUNTI ricalcolati, non sulle `t`: una `t` giusta su una polilinea sbagliata
    // non e' una valvola al posto giusto. Dal Blocco 5 le tre valvole non stanno piu' tutte sul
    // ponte: quella di monte e' scesa sul montante, che e' un normale arco della catena.
    const l = disegno()
    const punti = polilineaPonte(l)
    const segniPonte = ponteDi(l).segni!.map((s) => puntoSuTratto(punti, s.t).punto)
    // Centro: a meta' della corsa orizzontale, che ora e' il tratto 0.
    expect(segniPonte[0]).toEqual({ x: (punti[0].x + punti[1].x) / 2, y: punti[0].y })
    // Valle: due passi di griglia sotto il gomito, sulla gamba che scende.
    expect(segniPonte[1]).toEqual({ x: punti[1].x, y: punti[1].y + 20 })

    // Monte: due passi sotto il TEE, sul montante che scende verso il primo stadio scavalcato.
    const montante = l.archi.find((a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'F1')!
    const puntiMontante = instrada(
      montante.stile,
      posizioneAncora(nodo(l, 'BP1-IN'), montante.da.ancora),
      posizioneAncora(nodo(l, 'F1'), 'sx'),
      montante.punti,
      quoteInstradamento(l),
      { da: latoImposto(nodo(l, 'BP1-IN'), montante.da.ancora), a: undefined }
    )
    expect(puntiMontante).toHaveLength(3)
    expect(puntiMontante[0].x).toBe(puntiMontante[1].x) // scende sull'ascissa del TEE
    expect(puntoSuTratto(puntiMontante, montante.segni![0].t).punto).toEqual({
      x: puntiMontante[0].x,
      y: puntiMontante[0].y + 20,
    })
  })

  it('nessun arco in uscita da layoutSchema porta ancora forma', () => {
    // Il contratto di sola andata, sullo stampo di quello gia' scritto per `ancoraggio`.
    const l = disegno()
    expect(l.archi.some((a) => (a.punti ?? []).length > 0)).toBe(true) // o passerebbe a vuoto
    for (const arco of l.archi) expect(arco).not.toHaveProperty('forma')
  })

  it('il tubo che sale a un TEE di monte in mezzo alla catena fa il gradino a mezza strada', () => {
    // Difetto trovato guardando il disegno, non dai test (Blocco 3). Il TEE impone il lato `sx`, e
    // `rottaImboccata` con un capo solo imposto piega SUBITO, sul capo libero: il tratto verticale
    // correva sul bordo dell'apparecchiatura, invisibile perche' sovrapposto al suo contorno, e il
    // tubo sembrava uscire dalla pancia invece che dal bocchello — sbagliato ma plausibile, il
    // peggior tipo di errore per questo modulo.
    //
    // Dal Blocco 5 il caso non e' piu' quello dell'uscita del serbatoio: col by-pass in testa alla
    // catena il TEE di monte sta alla quota del bocchello e fra i due non c'e' dislivello (lo
    // fissa «la corsa del ponte ... e le e' ADIACENTE», qui sopra). La regola resta viva dove il
    // dislivello c'e' ancora: un by-pass che comincia in MEZZO alla catena, dove la linea sale
    // dallo stadio precedente fino al TEE.
    const l = disegno([['E1']])
    const arco = l.archi.find((a) => a.da.nodo === 'F1' && a.a.nodo === 'BP1-IN')!
    const partenza = posizioneAncora(nodo(l, 'F1'), 'dx')
    const tee = posizioneAncora(nodo(l, 'BP1-IN'), 'sx')
    expect(tee.y).toBeLessThan(partenza.y)
    const punti = instrada(arco.stile, partenza, tee, arco.punti, quoteInstradamento(l), {
      da: undefined,
      a: latoImposto(nodo(l, 'BP1-IN'), 'sx'),
    })
    // Quattro vertici: parte in orizzontale, sale a mezza strada, arriva in orizzontale.
    expect(punti).toHaveLength(4)
    expect(punti[1].x).toBe((partenza.x + tee.x) / 2)
    expect(punti[1].x).toBeGreaterThan(partenza.x)
    expect(punti[punti.length - 1].y).toBe(punti[punti.length - 2].y)
  })

  it('ma senza dislivello non inventa gomiti', () => {
    // Dentro la catena i capi stanno tutti alla stessa quota — il capo di VALLE resta sulla linea,
    // come gli stadi — e un gomito li' sarebbe markup in piu' in ogni documento consegnato, oltre
    // che un tranello per gli ancoraggi, che contano vertici e tratti.
    const l = disegno([['E1']])
    const arco = l.archi.find((a) => a.da.nodo === 'E1' && a.a.nodo === 'BP1-OUT')!
    expect(posizioneAncora(nodo(l, 'BP1-OUT'), 'sx').y).toBe(posizioneAncora(nodo(l, 'E1'), 'dx').y)
    expect(arco.punti ?? []).toHaveLength(0)
  })

  it('due by-pass disgiunti corrono sulla stessa corsia, e non si vedono scalini', () => {
    const l = disegno([['F1'], ['F2']])
    const yPrimo = Math.min(...polilineaPonte(l, 'BP1').map((p) => p.y))
    const ySecondo = Math.min(...polilineaPonte(l, 'BP2').map((p) => p.y))
    expect(yPrimo).toBe(ySecondo)
    // Dal Blocco 5 la corsia non e' piu' una proprieta' del ponte ma della quota a cui il layout
    // posa il suo capo di MONTE: e' quello che questo test sorveglia adesso.
    expect(posizioneAncora(nodo(l, 'BP1-IN'), 'sx').y).toBe(posizioneAncora(nodo(l, 'BP2-IN'), 'sx').y)
  })

  it('due by-pass annidati mettono i capi di monte su due quote diverse', () => {
    // Le corsie servono a questo e a nient'altro. Il gruppo interno corre in basso e quello che lo
    // contiene lo scavalca: `assegnaCorsie` assegna dal ponte piu' CORTO al piu' lungo, ed e' la
    // stessa funzione che usa `linearizzaConBypass` — le due risposte non possono divergere.
    const l = disegno([['F1', 'E1', 'F2'], ['E1']])
    const monte = (g: string) => posizioneAncora(nodo(l, `${g}-IN`), 'sx').y
    expect(monte('BP2')).toBeGreaterThan(monte('BP1'))
    expect(monte('BP1')).toBe(monte('BP2') - PASSO_CORSIA_BYPASS)
  })
})

describe('la corsia del ponte sopra un serbatoio scavalcato', () => {
  // Collaudo Task 5 (piano `2026-08-20-ordine-libero-linea-schema`), step 1. `PASSO_CORSIA_BYPASS`
  // e' stato misurato su un riferimento dove gli scavalcati erano rombi alti 110: un serbatoio
  // verticale e' alto 300 e porta la valvola di sicurezza SOPRA il corpo (`MARGINE_VALVOLA_SERBATOIO`,
  // symbols/index.ts) — a corsia fissa il ponte gli passava dritto nel mezzo, attraverso quella
  // valvola. Il fatto che `S1` sia dentro `ordineLinea` invece che a monte di tutto e' cio' che il
  // Blocco 5 (Task 1-4) ha reso possibile: prima i serbatoi stavano sempre fuori dalla sequenza
  // scavalcabile, e questo caso non poteva capitare.
  it('il ponte di un by-pass non attraversa il serbatoio che scavalca', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const model = buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, {
        ordineLinea: ['F1', 'S1', 'E1'],
        bypass: [{ id: 'bp1', stadi: ['S1'] }],
      }),
    })
    const layout = layoutSchema(model)
    const tee = layout.nodi.find((n) => n.id === 'BP1-IN')!
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    // Il TEE di monte sta sulla corsia del ponte: deve restare SOPRA la cima del serbatoio, o il
    // ponte gli passa dentro — attraverso la valvola di sicurezza che sta sul cielo del corpo.
    expect(tee.y).toBeLessThan(s1.y)
  })
})

describe('il by-pass che scavalca la testa della linea', () => {
  // Debito lasciato dalla revisione del Task 2 (piano `2026-08-20-ordine-libero-linea-schema`):
  // qui `sequenza[0]` e' esso stesso un TEE — il gruppo di by-pass copre il PRIMO elemento della
  // linea — e la mandata del compressore atterra su una giunzione invece che su un'apparecchiatura.
  // Prima del Blocco 5 non poteva capitare: il primo elemento scavalcabile era sempre uno stadio di
  // trattamento, mai la testa della catena. Il revisore aveva tracciato il codice e concluso che
  // degrada correttamente — per riuso del ramo `dalCapoDiMonte` in `buildArchi`
  // (`buildSchemaModel.ts`, l'arco dal TEE scende dal `basso` verso il primo scavalcato, la stessa
  // regola di un TEE in mezzo alla catena) e perche' le quattro ancore della giunzione COINCIDONO
  // nel suo centro (`ancoraMandata` ripiega su `sx`, che per una giunzione e' lo stesso punto di
  // `basso` e `dx` — bypass.ts, symbols/index.ts) — ma era inferenza, non un disegno guardato
  // davvero. Questo test lo genera e verifica che non emergano tubi incrociati.
  it('la mandata del compressore atterra sul TEE, non sul serbatoio che scavalca', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const modelInput = {
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, {
        ordineLinea: ['S1', 'F1', 'E1'],
        bypass: [{ id: 'bp1', stadi: ['S1'] }],
      }),
    }
    const model = buildSchemaModel(modelInput)

    // Sanity: questo e' davvero il caso «testa scavalcata» — il primo elemento della sequenza e'
    // il TEE di monte, non S1.
    const mandata = model.archi.find((a) => a.da.nodo === 'C1')!
    expect(mandata.a.nodo).toBe('BP1-IN')
    // Nessuna ancora `sx-basso` su una giunzione (solo il serbatoio ce l'ha): il ripiego di
    // `ancoraMandata` deve portarla su `sx`, non lasciarla `undefined` o farla cadere sul centro
    // per un'ancora inesistente.
    expect(mandata.a.ancora).toBe('sx')

    const layout = layoutSchema(model)
    const tee = nodo(layout, 'BP1-IN')
    const s1 = nodo(layout, 'S1')
    const c1 = nodo(layout, 'C1')

    // Le quattro ancore della giunzione coincidono: il punto in cui la mandata atterra e' lo
    // stesso da cui parte il montante verso S1 e lo stesso da cui parte il ponte verso BP1-OUT —
    // e' cosi' che un TEE si disegna, non un difetto.
    const puntoTee = posizioneAncora(tee, 'sx')
    expect(posizioneAncora(tee, 'basso')).toEqual(puntoTee)
    expect(posizioneAncora(tee, 'dx')).toEqual(puntoTee)

    // Il TEE sta a monte di S1 (a sinistra, senza sovrapporsi al suo riquadro): la mandata non
    // attraversa il corpo del serbatoio per raggiungerlo.
    expect(tee.x + dimensioniDi(tee, {}).larghezza).toBeLessThanOrEqual(s1.x)

    // La mandata sale dal compressore fino al TEE: nessun tratto che scenda di nuovo verso il
    // basso a meta' strada, che sarebbe la firma di un incrocio.
    const puntiMandata = instrada(
      mandata.stile,
      posizioneAncora(c1, mandata.da.ancora),
      puntoTee,
      mandata.punti,
      quoteInstradamento(layout),
      { da: latoImposto(c1, mandata.da.ancora), a: latoImposto(tee, mandata.a.ancora) }
    )
    for (let i = 0; i < puntiMandata.length - 1; i++) {
      expect(puntiMandata[i + 1].y).toBeLessThanOrEqual(puntiMandata[i].y)
    }

    // Il montante che scende dal TEE verso S1 (il ramo `dalCapoDiMonte` riusato in testa alla
    // linea, la stessa regola di un TEE in mezzo alla catena). Qui il TEE NON e' alla quota
    // dell'uscita di un serbatoio a monte — non ce n'e' uno, S1 e' proprio cio' che scavalca — sta
    // invece sopra la sua cima (la corsia calcolata sull'ingombro reale, vedi il test sul ponte qui
    // sopra): il montante scende davvero, un gradino vero e non un tratto piatto.
    const montante = layout.archi.find((a) => a.da.nodo === 'BP1-IN' && a.a.nodo === 'S1')!
    expect(montante.da.ancora).toBe('basso')
    expect(puntoTee.y).toBeLessThan(posizioneAncora(s1, 'sx').y)
  })
})

describe('linea con ordine libero', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })

  const modelConOrdine = (ordineLinea: string[]) =>
    buildSchemaModel({
      scheda,
      collegamentiCompressoriSerbatoi: { C1: ['S1'] },
      preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea }),
    })

  it('la catena comprende i serbatoi e parte dalla testa della mandata', () => {
    const model = modelConOrdine(['F1', 'S1', 'E1'])
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'S1', 'E1'])
  })

  it('dispone gli elementi nell’ordine scelto, da sinistra a destra', () => {
    const layout = layoutSchema(modelConOrdine(['F1', 'S1', 'E1']))
    const x = (id: string) => layout.nodi.find((n) => n.id === id)!.x
    expect(x('F1')).toBeLessThan(x('S1'))
    expect(x('S1')).toBeLessThan(x('E1'))
  })

  it('il serbatoio resta appoggiato alla quota di base anche in mezzo alla linea', () => {
    // Disporlo «per ancore» come i rombi lo staccherebbe da terra: i due orientamenti hanno
    // l'ancora `sx` alla stessa quota relativa ma riquadri di altezza diversa.
    const dritta = layoutSchema(modelConOrdine(['S1', 'F1', 'E1']))
    const intrecciata = layoutSchema(modelConOrdine(['F1', 'S1', 'E1']))
    const base = (l: typeof dritta, id: string) => {
      const n = l.nodi.find((m) => m.id === id)!
      return n.y + dimensioniDi(n, {}).altezza
    }
    expect(base(intrecciata, 'S1')).toBe(base(dritta, 'S1'))
  })

  it('regge una linea senza serbatoi, col ripiego sulla quota di sempre', () => {
    // Già possibile prima del 20-08-2026 (`quotaLineaProcesso` aveva il ripiego): la mandata
    // arriva al primo stadio e nulla si rompe.
    const senzaSerbatoi = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const model = buildSchemaModel({ scheda: senzaSerbatoi, collegamentiCompressoriSerbatoi: { C1: [] } })
    const layout = layoutSchema(model)
    expect(layout.nodi.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('senza preferenze il disegno è identico a quello di prima', () => {
    // Non-regressione al pixel: una pratica mai riordinata non deve muoversi di un'unità.
    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    const layout = layoutSchema(model)
    const x = (id: string) => layout.nodi.find((n) => n.id === id)!.x
    expect(x('S1')).toBeLessThan(x('F1'))
    expect(x('F1')).toBeLessThan(x('E1'))
    // L'ancora `sx` di F1 cade a STACCO_SERBATOI_LINEA dal bordo destro di S1, come sempre.
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    expect(x('F1')).toBe(s1.x + dimensioniDi(s1, {}).larghezza + STACCO_SERBATOI_LINEA)
  })
})

describe('lo stacco finale della sequenza', () => {
  // Pin puro della correzione del 20-08-2026 (senza questo test la copriva solo lo snapshot SVG
  // pinnato di renderSvg.test.ts, un controllo d'integrazione che una rigenerazione della fixture
  // potrebbe far sparire senza che nessuno se ne accorga). Quando la sequenza finisce su un
  // serbatoio — qui perché non ci sono stadi a valle — lo stacco verso ciò che segue deve restare
  // `STACCO_SERBATOI_LINEA`, non il `PASSO_ORIZZONTALE` generico fra famiglie: prima del
  // 20-08-2026, quando serbatoi e catena erano due righe separate, una catena vuota ripiegava
  // proprio su `rigaSerbatoi.xFinale + STACCO_SERBATOI_LINEA`. Senza questo caso in
  // `disponiSequenza`, una pratica con un solo serbatoio e senza stadi si sposterebbe di 10 unità.
  it('resta STACCO_SERBATOI_LINEA quando l’ultimo elemento è un serbatoio, non PASSO_ORIZZONTALE', () => {
    const soloServatoio = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda: soloServatoio, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    const tanica = layout.nodi.find((n) => n.tipo === 'tanica')!

    expect(tanica.x).toBe(s1.x + dimensioniDi(s1, {}).larghezza + STACCO_SERBATOI_LINEA)
  })
})
