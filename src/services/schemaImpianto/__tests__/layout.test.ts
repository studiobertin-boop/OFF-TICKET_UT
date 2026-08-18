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
  calcolaMuro,
  catenaDagliArchi,
  muroDaAscissa,
  DIMENSIONI_NODO,
  MARGINE_SUPERIORE,
  dimensioniLayout,
  estensioneOrizzontale,
  layoutSchema,
  quoteInstradamento,
} from '../layout'
import { renderSvg } from '../renderSvg'
import { dimensioniDi, SPESSORE_MURO } from '../symbols'
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

describe('layoutSchema', () => {
  it('posiziona ogni nodo del modello, senza perderne né inventarne', () => {
    const model = buildSchemaModel({
      scheda: schedaTrePiuUno(),
      collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] },
    })

    const layout = layoutSchema(model)

    expect(layout.nodi.map((n) => n.id).sort()).toEqual(model.nodi.map((n) => n.id).sort())
    expect(layout.archi).toEqual(model.archi)
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
  // serbatoio è orizzontale apposta, il caso che prima non tornava. (140/300, non più 137/298:
  // Task 8, Blocco 3, l'arrotondamento che porta le ancore sulla griglia.)
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
    expect(dimensioniDi(s1).altezza).toBe(140)

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

    it('mette l’ancora alla quota della fascia su cui corrono le tubazioni di linea', () => {
      const layout = layoutConUtenze()
      const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
      const essiccatore = layout.nodi.find((n) => n.tipo === 'essiccatore')!

      // L'ancora `in` sta in fondo al codolo: la sua quota assoluta è y + altezza VERA, non
      // quella del registro — il riquadro del terminale cresce con la scritta, e dal 17-08-2026
      // l'etichetta di default è già su due righe. Con `DIMENSIONI_NODO.utenze.altezza` questo
      // test tornava lo stesso, ma solo finché l'etichetta stava sotto la soglia di crescita.
      const quotaAncora = utenze.y + dimensioniDi(utenze).altezza
      const centroEssiccatore = essiccatore.y + DIMENSIONI_NODO.essiccatore.altezza / 2

      expect(quotaAncora).toBe(centroEssiccatore)
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
      const quotaAncora = utenze.y + dimensioniDi(utenze).altezza
      const centroEssiccatore = essiccatore.y + DIMENSIONI_NODO.essiccatore.altezza / 2

      expect(quotaAncora).toBe(centroEssiccatore)
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
        // Più in alto del serbatoio più alto: se `quotaCollettore` perdesse il filtro
        // `tipo === 'serbatoio'` e considerasse tutti i nodi, il minimo cadrebbe qui e il
        // primo test lo scoprirebbe (atteso resterebbe 380 solo col filtro applicato).
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

  it('mette il collettore mezzo margine sopra il serbatoio più alto', () => {
    // Serbatoio a y=400, MARGINE=40: 400 - 20 = 380.
    expect(quoteInstradamento(layoutDiProva()).yCollettore).toBe(380)
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

  it('segue gli archi, non il rango per tipo', () => {
    // Per rango sarebbe F1 (prefiltro), E1, F2. Gli archi dicono l'opposto, e vincono loro.
    const model: SchemaModel = {
      nodi: [{ ...stadio('F1'), prefiltro: true }, stadio('E1', 'essiccatore'), stadio('F2'), serbatoio],
      archi: [aria('S1', 'F2'), aria('F2', 'E1'), aria('E1', 'F1'), aria('F1', 'UTENZE')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F2', 'E1', 'F1'])
  })

  it('non gira in tondo su un grafo ciclico', () => {
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F2'), serbatoio],
      archi: [aria('S1', 'F1'), aria('F1', 'F2'), aria('F2', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'F2'])
  })

  it('appende in coda gli stadi che gli archi non raggiungono, nell’ordine di default', () => {
    // F3 e' scollegato: senza il ripiego sparirebbe dal disegno, che e' peggio di un ordine strano.
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F3'), serbatoio],
      archi: [aria('S1', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'F3'])
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
    expect(catenaDagliArchi(model, stadio('T', 'tanica')).map((n) => n.id)).toEqual(['F2', 'F1'])
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
    expect(catenaDagliArchi(model, pozzo).map((n) => n.id)).toEqual(['F1'])
  })
})
