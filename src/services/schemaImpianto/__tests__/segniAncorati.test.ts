import { describe, it, expect } from 'vitest'
import { risolviPonti, risolviSegniAncorati } from '../segniAncorati'
import { posizioneAncora } from '../renderSvg'
import { instrada, tDaAncoraggio } from '../tratti'
import type { SchemaAncoraggioSegno, SchemaLayout, SchemaNodoPosizionato } from '../types'

// Il layout si costruisce a mano, a coordinate note, invece di passare da `layoutSchema`: cosi'
// l'atteso si calcola sulla polilinea vera e non dipende dalla disposizione automatica, che i
// Task 4 e 6 del Blocco 2 stanno muovendo.
const QUOTE = { yCollettore: 100, yCorsiaCondense: 900 }

const compressore: SchemaNodoPosizionato = {
  id: 'C1',
  tipo: 'compressore',
  etichetta: 'C1',
  gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [],
  origine: 'scheda',
  x: 40,
  y: 400,
}
const serbatoio: SchemaNodoPosizionato = {
  id: 'S1',
  tipo: 'serbatoio',
  etichetta: 'S1',
  gruppo: 'SALA_COMPRESSORI',
  orientamento: 'VERTICALE',
  valvoleSicurezza: [],
  origine: 'scheda',
  x: 300,
  y: 220,
}

/** Compressore → serbatoio, un arco flessibile con un solo segno. */
function layoutConMandata(ancoraggio?: SchemaAncoraggioSegno, t = 0.5): SchemaLayout {
  return {
    nodi: [compressore, serbatoio],
    archi: [
      {
        id: 'flex-1',
        da: { nodo: 'C1', ancora: 'alto-out' },
        a: { nodo: 'S1', ancora: 'sx-basso' },
        stile: 'flessibile',
        segni: [{ id: 'segno-1', tipo: 'valvola_intercettazione', t, stileAValle: 'standard', ancoraggio }],
      },
    ],
    muro: null,
    testi: [],
  }
}

/** La stessa polilinea che disegnerà `renderSvg` — vedi `renderArco`. */
const puntiDellaMandata = () =>
  instrada(
    'flessibile',
    posizioneAncora(compressore, 'alto-out'),
    posizioneAncora(serbatoio, 'sx-basso'),
    undefined,
    QUOTE,
    { da: undefined, a: undefined }
  )

describe('risolviSegniAncorati', () => {
  it('mette la valvola un passo di griglia sotto la dorsale, non a metà tubo', () => {
    const ancoraggio: SchemaAncoraggioSegno = { tipo: 'vertice', vertice: 1, scarto: -10 }
    const risolto = risolviSegniAncorati(layoutConMandata(ancoraggio), QUOTE)
    const atteso = tDaAncoraggio(puntiDellaMandata(), ancoraggio)!

    expect(atteso).not.toBeNull()
    expect(risolto.archi[0].segni![0].t).toBeCloseTo(atteso, 10)
    expect(risolto.archi[0].segni![0].t).not.toBe(0.5)
  })

  it('nessun ancoraggio esce dal layout: il formato salvato non cambia', () => {
    const risolto = risolviSegniAncorati(layoutConMandata({ tipo: 'vertice', vertice: 1, scarto: -10 }), QUOTE)
    for (const arco of risolto.archi) {
      for (const segno of arco.segni ?? []) {
        // `not.toHaveProperty`, non `toBeUndefined`: la chiave va TOLTA. Un layout che la portasse
        // vuota non sarebbe più identico a uno salvato prima che gli ancoraggi esistessero.
        expect(segno).not.toHaveProperty('ancoraggio')
      }
    }
  })

  it('conserva il resto del segno: lo stileAValle non si perde per strada', () => {
    const risolto = risolviSegniAncorati(layoutConMandata({ tipo: 'vertice', vertice: 1, scarto: -10 }), QUOTE)
    expect(risolto.archi[0].segni![0].stileAValle).toBe('standard')
    expect(risolto.archi[0].segni![0].id).toBe('segno-1')
  })

  it('un ancoraggio irrisolvibile lascia la t di ripiego invece di sollevare', () => {
    // Vertice 9 su una polilinea che ne ha 5: `tDaAncoraggio` torna null. Una valvola a metà tubo
    // è sbagliata ma visibile e correggibile; un'eccezione a metà generazione no.
    const risolto = risolviSegniAncorati(layoutConMandata({ tipo: 'vertice', vertice: 9, scarto: -10 }), QUOTE)
    expect(risolto.archi[0].segni![0].t).toBe(0.5)
  })

  it('non tocca i segni posati a mano, che non dichiarano ancoraggio', () => {
    const risolto = risolviSegniAncorati(layoutConMandata(undefined, 0.73), QUOTE)
    expect(risolto.archi[0].segni![0].t).toBe(0.73)
  })

  it('regge un arco il cui capo non sta fra i nodi, tenendo la t di ripiego', () => {
    const layout = layoutConMandata({ tipo: 'vertice', vertice: 1, scarto: -10 })
    layout.archi[0].a = { nodo: 'FANTASMA', ancora: 'sx' }
    expect(() => risolviSegniAncorati(layout, QUOTE)).not.toThrow()
    expect(risolviSegniAncorati(layout, QUOTE).archi[0].segni![0].t).toBe(0.5)
  })
})

describe('il gradino verso un TEE', () => {
  const giunzione = (id: string, x: number, y: number): SchemaNodoPosizionato => ({
    id,
    tipo: 'giunzione',
    etichetta: id,
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
    x,
    y,
  })
  const filtro = (id: string, x: number, y: number): SchemaNodoPosizionato => ({
    id,
    tipo: 'filtro',
    etichetta: id,
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
    x,
    y,
  })

  /** Il layout minimo che serve: due TEE (quello di monte in alto), uno stadio, e il ponte fra i
   *  due — senza un ponte `risolviPonti` esce subito e il gradino non lo posa nessuno. */
  const layout = (ancoraDalTee: string): SchemaLayout => ({
    nodi: [giunzione('BP1-IN', 290, 0), giunzione('BP1-OUT', 700, 90), filtro('F1', 340, 40)],
    archi: [
      {
        id: 'bp-1',
        da: { nodo: 'BP1-IN', ancora: 'dx' },
        a: { nodo: 'BP1-OUT', ancora: 'alto' },
        stile: 'standard',
        forma: 'ponte',
      },
      {
        id: 'std-1',
        da: { nodo: 'BP1-IN', ancora: ancoraDalTee },
        a: { nodo: 'F1', ancora: 'sx' },
        stile: 'standard',
      },
    ],
    muro: null,
    testi: [],
  })

  const risolti = (l: SchemaLayout) => risolviPonti(l)

  const arco = (l: SchemaLayout) => l.archi.find((a) => a.id === 'std-1')!

  it('col lato verticale scende sull’ascissa del TEE, senza gomiti a mezza strada', () => {
    // E' il montante del by-pass: il TEE sta in alto, il tubo deve scendere di li' e poi entrare
    // orizzontale nello stadio. La piega la posa gia' `rottaImboccata` sull'ascissa del TEE:
    // aggiungerci un gradino significherebbe due scalini su un tubo che deve solo scendere.
    expect(arco(risolti(layout('basso'))).punti ?? []).toHaveLength(0)
  })

  it('col lato orizzontale il gradino resta, ed e’ a mezza strada', () => {
    // Non-regressione del difetto trovato guardando il disegno nel Blocco 3: con un lato
    // orizzontale imposto e l'altro capo libero, `rottaImboccata` piega SUBITO sul capo libero e
    // il tratto verticale corre rasente il fianco dell'apparecchiatura, invisibile perche'
    // sovrapposto al suo contorno.
    const punti = arco(risolti(layout('sx'))).punti ?? []
    expect(punti).toHaveLength(2)
    expect(punti[0].x).toBe(punti[1].x)
  })
})
