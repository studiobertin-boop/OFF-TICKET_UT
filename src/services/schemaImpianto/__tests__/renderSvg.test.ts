import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeEssiccatore,
  makeFiltro,
  makeScheda,
  makeSeparatore,
  makeSerbatoio,
  makeValvola,
} from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema } from '../layout'
import { renderSvg, righeLista, raccordoOrtogonale, posizioneAncora } from '../renderSvg'

function svgMinimo(noteTubazioni?: string[]) {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: false })],
    disoleatori: [],
    serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
    essiccatori: [],
    scambiatori: [],
    filtri: [],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
  })
  const layout = layoutSchema(
    buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
  )
  return renderSvg(layout, { noteTubazioni })
}

describe('renderSvg', () => {
  it('produce un SVG autonomo e ben formato', () => {
    const svg = svgMinimo()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toMatch(/viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/)
  })

  it('disegna la tabella lista apparecchiature con i codici delle apparecchiature', () => {
    const svg = svgMinimo()
    expect(svg).toContain('LISTA APPARECCHIATURE')
    expect(svg).toContain('>C1</text>')
    expect(svg).toContain('>S1</text>')
    expect(svg).toContain('Compressore KAESER Mod. CSD 105 SFC')
  })

  it('stampa la nota sui diametri solo quando fornita', () => {
    const nota = 'Collegamenti effettuati con tubazioni da Ø40 a Ø63mm'
    expect(svgMinimo([nota])).toContain(nota)
    expect(svgMinimo()).not.toContain('Collegamenti effettuati')
  })

  it('tratteggia le linee condense e lascia continue le altre', () => {
    const scheda = makeScheda({ dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }) })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    const svg = renderSvg(layout)
    const tratteggiate = svg.match(/stroke-dasharray/g) ?? []
    const condense = layout.archi.filter((a) => a.stile === 'condensa')

    expect(condense.length).toBeGreaterThan(0)
    // Una linea tratteggiata per ogni scarico condensa, più il codolo del terminale utenze.
    expect(tratteggiate).toHaveLength(condense.length + 1)
  })

  it('disegna l’uscita verso le utenze come nodo, non più come freccia d’ufficio', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const utenze = layout.nodi.find((n) => n.tipo === 'utenze')!
    utenze.etichetta = 'Utenze azoto'

    const svg = renderSvg(layout)
    // La scritta viene dal nodo: cambiarla nel layout la cambia nel disegno.
    expect(svg).toContain('>Utenze azoto</text>')
    expect(svg).not.toContain('>Utenze aria</text>')
    // Una sola uscita: se la freccia automatica sopravvivesse, di terminali se ne vedrebbero due.
    expect(svg.match(/stroke-dasharray="10 7"/g) ?? []).toHaveLength(1)
  })

  it('il terminale utenze non compare fra le apparecchiature in lista', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.nodi.some((n) => n.tipo === 'utenze')).toBe(true)
    expect(righeLista(layout).map((r) => r.codice)).not.toContain('UTENZE')
  })

  it('la tubazione che arriva al terminale non porta una seconda punta di freccia, le altre sì', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore()],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    const svg = renderSvg(layout)
    const indice = new Map(layout.nodi.map((n) => [n.id, n]))

    // Un conteggio totale non basta a discriminare: una condizione invertita toglierebbe la
    // punta all'arco sbagliato e la lascerebbe su quello verso il terminale, ricreando il
    // difetto (doppia punta) con lo stesso totale di marker. Si guarda quindi, arco per arco,
    // il path che vi arriva — individuato dal punto dove finisce, non dalla posizione
    // nell'array — e si verifica che sia proprio e solo quello verso il terminale a mancarne.
    // Il flessibile arriva con una curva (comando Q), non con un segmento retto (L): il punto
    // finale va cercato dopo l'uno o l'altro comando, non solo dopo "L".
    for (const arco of layout.archi) {
      const nodoA = indice.get(arco.a.nodo)!
      const fine = posizioneAncora(nodoA, arco.a.ancora)
      const finePattern = new RegExp(`(?:L|Q [-\\d.]+ [-\\d.]+) ${fine.x} ${fine.y}"`)
      const path = svg
        .match(/<path d="[^"]*"[^>]*\/>/g)
        ?.find((p) => finePattern.test(p))
      expect(path, `nessun path trovato per l'arco verso ${arco.a.nodo}`).toBeDefined()
      if (nodoA.tipo === 'utenze') {
        expect(path).not.toContain('marker-end')
      } else {
        expect(path).toContain('marker-end')
      }
    }
  })

  // La scritta sporgeva oltre il bordo destro: nel PNG finiva tagliata a metà.
  it('allarga la viewBox fino a contenere la scritta delle utenze', () => {
    const svg = svgMinimo()
    const larghezza = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)?.[1])
    const xScritta = Number(svg.match(/<text x="(\d+(?:\.\d+)?)"[^>]*>Utenze aria/)?.[1])

    expect(xScritta).toBeGreaterThan(0)
    expect(larghezza).toBeGreaterThan(xScritta + 100)
  })

  it('non lascia entità XML non valide nelle etichette con &', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ marca: 'ROSSI & FIGLI', ha_disoleatore: false })],
      disoleatori: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    const svg = renderSvg(layout)
    expect(svg).toContain('ROSSI &amp; FIGLI')
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/)
  })

  it('disegna il flessibile ondulato per tutta la lunghezza, non a riccioli', () => {
    const svg = svgMinimo()
    const flessibile = svg.match(/<path d="M [^"]*Q [^"]*" fill="none" stroke="#000"[^>]*marker-end/g) ?? []

    expect(flessibile.length).toBeGreaterThan(0)
    // Molte onde, non le quattro del vecchio ricciolo da 40 unità.
    expect((flessibile[0].match(/Q /g) ?? []).length).toBeGreaterThan(8)
  })
})

describe('attacco alle ancore', () => {
  it('la polilinea della mandata comincia esattamente sull’ancora del compressore', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const compressore = layout.nodi.find((n) => n.id === 'C1')!
    const svg = renderSvg(layout)

    // ancora 'alto-out' del compressore: (larghezza/2, 0) in coordinate locali
    const atteso = `M ${compressore.x + 80} ${compressore.y}`
    expect(svg).toContain(atteso)
  })

  // Questo è il caso che discrimina davvero il vecchio calcolo (corpoNodo/centro) dal nuovo:
  // per il compressore l'ancora 'alto-out' coincide algebricamente col vecchio centro/cielo del
  // corpo, quindi il test sopra passerebbe anche senza la modifica. Il separatore-pozzo invece
  // riceve la condensa di fianco (ancora 'sx'), un punto diverso sia dal centro del corpo sia dal
  // punto in cima che il vecchio calcolo produceva — solo qui una regressione a corpoNodo/centro
  // farebbe fallire il test.
  it('la linea condense entra di fianco nel separatore-pozzo, non dall’alto', () => {
    const scheda = makeScheda({
      essiccatori: [], scambiatori: [], filtri: [],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const sep = layout.nodi.find((n) => n.id === 'SEP1')!
    const svg = renderSvg(layout)

    // ancora 'sx' del separatore: (6, 49) in coordinate locali — sul fianco sinistro del
    // rombo, non al centro del corpo né in cima (dove atterrava il vecchio calcolo).
    const atteso = `L ${sep.x + 6} ${sep.y + 49}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="10 7" marker-end="url(#freccia)" />`
    expect(svg).toContain(atteso)
  })

  // Simmetrico sulla partenza: il serbatoio scarica la condensa dalla propria ancora
  // 'basso-out', non da un punto ricavato scendendo di 24px oltre il fondo del corpo (come
  // faceva il vecchio calcolo).
  it('la linea condense parte esattamente dall’ancora basso-out del serbatoio', () => {
    const scheda = makeScheda({
      essiccatori: [], scambiatori: [], filtri: [],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const s1 = layout.nodi.find((n) => n.id === 'S1')!
    const svg = renderSvg(layout)

    // ancora 'basso-out' del serbatoio verticale: (75, 260) in coordinate locali.
    const atteso = `M ${s1.x + 75} ${s1.y + 260}`
    expect(svg).toContain(atteso)
  })
})

describe('varchi nel muro', () => {
  /** Fasce verticali occupate dai tronconi pieni di muratura. */
  function tronconi(svg: string, xMuro: number): [number, number][] {
    return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)]
      .filter((m) => Number(m[1]) === xMuro)
      .map((m) => [Number(m[2]), Number(m[2]) + Number(m[3])] as [number, number])
  }

  // Con un serbatoio in linea, mandata e linee condense attraversano il muro a quote diverse:
  // un varco solo (com'era) lasciava la muratura a tagliare le tubazioni.
  /**
   * Quote alle quali le tubazioni disegnate attraversano la verticale `x`. Il flessibile ora
   * arriva ondulato (comandi Q, non L): si leggono anche i punti d'arrivo delle curve, non solo
   * quelli dei segmenti retti. Ogni Q d'un tratto originariamente orizzontale interpola in linea
   * retta lungo quello stesso tratto (solo il punto di controllo si scosta in perpendicolare), e
   * resta quindi a y costante: la sequenza di piccoli sotto-segmenti individuati così attraversa
   * `x` esattamente dove lo attraverserebbe il tratto liscio.
   */
  function attraversamenti(svg: string, x: number): number[] {
    const quote: number[] = []
    for (const path of svg.matchAll(/<path d="([^"]+)"/g)) {
      const punti = [
        ...path[1].matchAll(/[ML] ([\d.-]+) ([\d.-]+)|Q [\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)/g),
      ].map((p) => ({
        x: Number(p[1] ?? p[3]),
        y: Number(p[2] ?? p[4]),
      }))
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1]
        const b = punti[i]
        if (a.y === b.y && Math.min(a.x, b.x) <= x && x <= Math.max(a.x, b.x)) quote.push(a.y)
      }
    }
    return quote
  }

  it('apre un varco per ogni tubazione che attraversa il muro', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )
    expect(layout.muro).not.toBeNull()

    const svg = renderSvg(layout)
    const muratura = tronconi(svg, layout.muro!.x)
    const quote = [...new Set(attraversamenti(svg, layout.muro!.x))]

    // Mandata del compressore e linea condense del disoleatore passano a quote diverse.
    expect(quote.length).toBeGreaterThan(1)
    for (const y of quote) {
      expect(muratura.some(([a, b]) => y > a && y < b)).toBe(false)
    }
  })

  it('i varchi nel muro si calcolano sulla polilinea liscia, non sull’onda', () => {
    // Se `quoteAttraversamento` ricevesse il tracciato ondulato, i tratti orizzontali non
    // sarebbero più orizzontali e nessun varco si aprirebbe: il muro tornerebbe pieno.
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio({ ubicazione: 'LINEA_DISTRIBUZIONE' })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(layout.muro).not.toBeNull()
    const svg = renderSvg(layout)

    // I tronconi pieni del muro sono i rect di spessore 14. Se `quoteAttraversamento` non
    // trovasse più tratti orizzontali, non si aprirebbe nessun varco e i tronconi coprirebbero
    // l'intera altezza del muro: è questo il confronto che discrimina, non il loro numero (con
    // un varco a ridosso di un estremo il troncone resta uno solo).
    const altezze = [...svg.matchAll(/<rect x="[\d.]+" y="[-\d.]+" width="14" height="([\d.]+)"/g)].map(
      (m) => Number(m[1])
    )
    const coperto = altezze.reduce((s, h) => s + h, 0)
    const altezzaMuro = layout.muro!.yMax - layout.muro!.yMin

    expect(altezze.length).toBeGreaterThan(0)
    expect(coperto).toBeLessThan(altezzaMuro)
  })
})

describe('punti di passaggio', () => {
  it('la polilinea attraversa i gomiti imposti, nell’ordine dato', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    layout.archi[0].punti = [{ x: 300, y: 500 }]

    const svg = renderSvg(layout)
    expect(svg).toContain('300 500')
  })

  it('senza punti il percorso resta quello automatico', () => {
    const scheda = makeScheda({
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
      essiccatori: [], scambiatori: [], filtri: [],
    })
    const layout = layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))
    const automatico = renderSvg(layout)

    layout.archi[0].punti = []
    expect(renderSvg(layout)).toBe(automatico)
  })
})

describe('raccordoOrtogonale', () => {
  it('due punti già allineati non introducono un gomito superfluo', () => {
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 10, y: 90 })).toEqual([{ x: 10, y: 90 }])
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 90, y: 10 })).toEqual([{ x: 90, y: 10 }])
  })

  it('due gomiti coincidenti non producono un segmento a lunghezza zero duplicato', () => {
    expect(raccordoOrtogonale({ x: 10, y: 10 }, { x: 10, y: 10 })).toEqual([{ x: 10, y: 10 }])
  })
})

describe('righeLista', () => {
  it('elenca apparecchiature, accessori e valvole ordinati per codice', () => {
    const scheda = makeScheda({
      serbatoi: [makeSerbatoio({ valvole_aggiuntive: [makeValvola()] })],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => r.codice)).toEqual([
      'C1',
      'C1.1',
      'C1.2',
      'S1',
      'S1.1',
      'S1.2',
    ])
  })

  it('numera i codici in modo naturale, non lessicografico', () => {
    const scheda = makeScheda({
      compressori: Array.from({ length: 3 }, (_, i) =>
        makeCompressore({ codice: `C${i + 1}`, ha_disoleatore: false })
      ),
      disoleatori: [],
      serbatoi: Array.from({ length: 2 }, (_, i) => makeSerbatoio({ codice: `S${i + 1}` })),
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => r.codice)).toEqual([
      'C1',
      'C2',
      'C3',
      'S1',
      'S1.1',
      'S2',
      'S2.1',
    ])
  })

  // L'ordine alfabetico metterebbe E1 prima di F1 e SEP1 in fondo, scollegando la lista dalla
  // sequenza in cui il disegno attraversa le apparecchiature.
  it('segue il flusso dell’aria e non l’alfabeto', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ ha_disoleatore: false })],
      disoleatori: [],
      serbatoi: [makeSerbatoio()],
      essiccatori: [makeEssiccatore({ ha_scambiatore: false })],
      scambiatori: [],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      separatori: [makeSeparatore({ codice: 'SEP1' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'separatore' }),
    })
    const layout = layoutSchema(
      buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } })
    )

    expect(righeLista(layout).map((r) => r.codice)).toEqual([
      'C1',
      'S1',
      'S1.1',
      'F1',
      'E1',
      'SEP1',
    ])
  })
})
