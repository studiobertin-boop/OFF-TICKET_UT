import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeDisoleatore,
  makeEssiccatore,
  makeScheda,
  makeSerbatoio,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { calcolaMuro, DIMENSIONI_NODO, MARGINE_SUPERIORE, dimensioniLayout, layoutSchema } from '../layout'
import type { SchemaLayout } from '../types'

function nodo(layout: SchemaLayout, id: string) {
  const trovato = layout.nodi.find((n) => n.id === id)
  if (!trovato) throw new Error(`Nodo ${id} assente dal layout`)
  return trovato
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

  it('non disegna il muro quando tutte le apparecchiature stanno in sala compressori', () => {
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

    expect(layout.muro).toBeNull()
  })

  it('disegna il muro fra i due gruppi quando c’è anche solo un’apparecchiatura in linea', () => {
    const scheda = makeScheda({
      serbatoi: [
        makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' }),
        makeSerbatoio({ codice: 'S2', ubicazione: 'LINEA_DISTRIBUZIONE' }),
      ],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })

    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.muro).not.toBeNull()
    // Il muro sta a destra di tutto ciò che è in sala compressori.
    const inSala = layout.nodi.filter((n) => n.gruppo === 'SALA_COMPRESSORI')
    for (const n of inSala) {
      expect(layout.muro!.x).toBeGreaterThan(n.x)
    }
  })

  describe('il terminale utenze non conta ai fini del muro', () => {
    it('un impianto di soli compressori e serbatoi in sala, col solo terminale in linea, non ha muro', () => {
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
      expect(layout.muro).toBeNull()
    })

    it('ma un impianto con anche una sola apparecchiatura vera in linea il muro lo disegna ancora', () => {
      // Discrimina un'implementazione che, per far sparire il muro col terminale, finisse per
      // non disegnarlo mai: qui c'è un essiccatore vero in linea, e il muro deve tornare.
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

      expect(layout.muro).not.toBeNull()
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

  describe('collocazione del terminale utenze', () => {
    function layoutConUtenze() {
      const scheda = makeScheda({
        compressori: [makeCompressore({ ha_disoleatore: false })],
        disoleatori: [],
        serbatoi: [makeSerbatoio()],
        essiccatori: [makeEssiccatore()],
        scambiatori: [],
        filtri: [],
        dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      })
      return layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
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

      // L'ancora `in` sta in fondo al codolo: la sua quota assoluta è y + altezza.
      const quotaAncora = utenze.y + DIMENSIONI_NODO.utenze.altezza
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
