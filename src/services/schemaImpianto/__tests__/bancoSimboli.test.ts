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
import { preferenzeRisolteDaScheda } from '../preferenze'
import {
  makeScheda,
  makeCompressore,
  makeSerbatoio,
  makeFiltro,
  makeEssiccatore,
  makeDatiImpianto,
} from '@/services/relazione/__tests__/fixtures'

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

  // Il caso scelto sposta davvero il layout: con l'essiccatore la catena aggiunge un nodo (e con
  // lui il suo scambiatore) fra il serbatoio e il terminale utenze, spostando le posizioni di
  // tutto ciò che segue. Si asserisce prima sui NODI del layout — non solo sull'SVG — perché è
  // quell'asserzione a far cadere il test se un domani il banco tornasse a condividere il layout
  // fra i due lati.
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

  // Il caso VERTICALE vs ORIZZONTALE dello stesso serbatoio, che il piano originale proponeva:
  // fino al Task 4 di questo blocco NON discriminava, perché `REGISTRO_SIMBOLI['serbatoio:
  // VERTICALE'].dimensioni` e `['serbatoio:ORIZZONTALE'].dimensioni` puntavano allo stesso oggetto
  // `DIMENSIONI.serbatoio`, e `layout.ts` leggeva l'ingombro dei nodi indicizzato solo per `tipo`
  // (mai per orientamento): fra i due orientamenti `layoutSchema` produceva nodi e archi identici
  // salvo il campo `orientamento` stesso — un banco che si fosse fermato lì avrebbe scoperto un
  // banale campo diverso sui NODI, non un vero effetto sul LAYOUT, e sarebbe rimasto verde anche
  // con un `layoutSchema` che calcolasse la riga una volta sola e la riusasse per l'altro
  // orientamento.
  //
  // Dal Task 4 il serbatoio orizzontale ha un riquadro proprio (310×140, contro 100×300 del
  // verticale dopo gli arrotondamenti del Task 8 — `DIMENSIONI_SERBATOIO_ORIZZONTALE` in
  // symbols/index.ts), e `disponiInRiga`
  // (layout.ts) legge quell'ingombro con `dimensioniDi(nodo)` invece di `DIMENSIONI_NODO[tipo]`:
  // un serbatoio più largo sposta davvero a destra tutto ciò che la riga colloca dopo di lui. La
  // scheda porta un essiccatore apposta, per lo stesso motivo del caso sopra: senza un nodo a
  // valle da spostare, l'unica differenza osservabile resterebbe di nuovo il campo `orientamento`
  // sul solo S1, non un effetto sul layout.
  it('DISCRIMINA: lo stesso serbatoio verticale/orizzontale sposta la catena a valle, e produce SVG diversi', () => {
    const base = { compressori: [makeCompressore({ ha_disoleatore: false })] }
    const verticale = costruisci(makeScheda({ ...base, serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })] }))
    const orizzontale = costruisci(
      makeScheda({ ...base, serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })] })
    )

    const essiccatoreDi = (layout: typeof verticale.layout) => layout.nodi.find((n) => n.tipo === 'essiccatore')!
    expect(essiccatoreDi(verticale.layout).x).not.toBe(essiccatoreDi(orizzontale.layout).x)
    expect(verticale.layout.nodi).not.toEqual(orizzontale.layout.nodi)
    expect(verticale.svg).not.toBe(orizzontale.svg)
  })

  // Il blocco toccato in questa sessione ("ordine libero della linea", Task 1-5) non ha un caso
  // qui sopra: i tre test del Blocco 3 costruiscono il modello SENZA `preferenze`, quindi non
  // passano mai da `ordineLinea` ne' da `linearizzaConBypass` — la riprova e' che nessun commit di
  // questa sessione ha toccato questo file prima d'ora (`git log` sul file si ferma al Blocco 3). Un
  // banco verde che non esercita mai il codice appena scritto misura zero e sembra un successo (vedi
  // il commento in testa al file): questo caso lo ancora davvero al blocco corrente, riordinando la
  // linea con `ordineLinea` come fa il pannello «Linea» del Task 4.
  it('DISCRIMINA: un ordineLinea che porta lo stadio in testa sposta la catena e produce SVG diversi', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      essiccatori: [makeEssiccatore({ codice: 'E1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const costruisciConOrdine = (ordineLinea: string[]) => {
      const layout = layoutSchema(
        buildSchemaModel({
          scheda,
          collegamentiCompressoriSerbatoi: { C1: ['S1'] },
          preferenze: preferenzeRisolteDaScheda(scheda, { ordineLinea }),
        })
      )
      return { layout, svg: renderSvg(layout) }
    }
    const serbatoioInTesta = costruisciConOrdine(['S1', 'F1', 'E1'])
    // Il caso che ha originato il lavoro (Step 4 del piano): il filtro davanti al serbatoio, cosi'
    // l'aria lo attraversa PRIMA di entrarci.
    const filtroInTesta = costruisciConOrdine(['F1', 'S1', 'E1'])

    expect(serbatoioInTesta.layout.nodi).not.toEqual(filtroInTesta.layout.nodi)
    expect(serbatoioInTesta.svg).not.toBe(filtroInTesta.svg)
  })
})
