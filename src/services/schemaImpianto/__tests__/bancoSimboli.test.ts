/**
 * Banco del Blocco 3: misura quanto un impianto cambia da capo a fondo.
 *
 * Ogni lato costruisce la catena INTERA (scheda → layoutSchema → renderSvg). Confrontare
 * due renderSvg sullo stesso layout misurerebbe zero proprio dove il Blocco 3 lavora di
 * più — le dimensioni dei simboli, che entrano nel layout prima del disegno.
 */
import { describe, it, expect } from 'vitest'
import { layoutSchema } from '../layout'
import { renderSvg } from '../renderSvg'
import { buildSchemaModel } from '../buildSchemaModel'
import { makeScheda, makeCompressore, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'

// `buildSchemaModel` non prende la scheda da sola: vuole { scheda, collegamentiCompressoriSerbatoi },
// lo stesso oggetto che ogni test di renderSvg.test.ts costruisce a mano. Il brief del Task 2
// scriveva `buildSchemaModel(scheda)`, che non tipizza contro la firma reale — qui si passa
// l'oggetto completo, col collegamento minimo C1 -> S1 usato ovunque nel resto della suite.
function costruisci(scheda: ReturnType<typeof makeScheda>) {
  const layout = layoutSchema(
    buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
  )
  return { layout, svg: renderSvg(layout) }
}

function catena(scheda: ReturnType<typeof makeScheda>): string {
  return costruisci(scheda).svg
}

describe('banco del Blocco 3', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: true })],
    serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
  })

  it('la catena intera è deterministica: due passate danno lo stesso SVG', () => {
    expect(catena(scheda)).toBe(catena(scheda))
  })

  // Il caso qui sotto NON è quello del piano originale (VERTICALE vs ORIZZONTALE dello stesso
  // serbatoio): quel caso non discrimina. `REGISTRO_SIMBOLI['serbatoio:VERTICALE'].dimensioni` e
  // `['serbatoio:ORIZZONTALE'].dimensioni` puntano OGGI allo stesso oggetto `DIMENSIONI.serbatoio`
  // (symbols/index.ts, voci 'serbatoio:VERTICALE'/'serbatoio:ORIZZONTALE'), e `DIMENSIONI_NODO` in
  // layout.ts è indicizzato solo per `tipo`, mai per orientamento: fra i due orientamenti
  // `layoutSchema` produce nodi e archi identici byte per byte, e tutta la differenza fra i due SVG
  // nasce dentro `renderSvg` (solo il disegno del simbolo cambia). Un banco così resterebbe verde
  // anche se calcolasse il layout una volta sola e lo riusasse per il secondo render — cioè
  // esattamente il montaggio a valle che questo banco deve scoprire, il difetto già pagato dal
  // Blocco D4. PROMEMORIA per il Task 4 di questo blocco: quando il serbatoio ORIZZONTALE avrà un
  // proprio ingombro (dimensioni diverse da VERTICALE), il caso tornerà a discriminare anche sul
  // layout e potrà rientrare qui accanto (o al posto di) questo.
  //
  // Il caso scelto al suo posto sposta davvero il layout: con l'essiccatore la catena aggiunge un
  // nodo (e con lui il suo scambiatore) fra il serbatoio e il terminale utenze, spostando le
  // posizioni di tutto ciò che segue. Si asserisce prima sui NODI del layout — non solo sull'SVG
  // — perché è quell'asserzione a far cadere il test se un domani il banco tornasse a condividere
  // il layout fra i due lati.
  it('DISCRIMINA: due schede con topologie diverse producono layout diversi, e SVG diversi', () => {
    const conEssiccatore = costruisci(scheda)
    const senzaEssiccatore = costruisci(
      makeScheda({
        compressori: [makeCompressore({ ha_disoleatore: true })],
        serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
        essiccatori: [],
        scambiatori: [],
      })
    )

    expect(conEssiccatore.layout.nodi).not.toEqual(senzaEssiccatore.layout.nodi)
    expect(conEssiccatore.svg).not.toBe(senzaEssiccatore.svg)
  })
})
