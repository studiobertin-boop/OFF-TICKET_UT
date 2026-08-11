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
import { renderSvg, righeLista } from '../renderSvg'

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
    // Una linea tratteggiata per ogni scarico condensa, più l'uscita verso le utenze.
    expect(tratteggiate).toHaveLength(condense.length + 1)
  })

  it('disegna l’uscita verso le utenze aria', () => {
    expect(svgMinimo()).toContain('Utenze aria')
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
  /** Quote alle quali le tubazioni disegnate attraversano la verticale `x`. */
  function attraversamenti(svg: string, x: number): number[] {
    const quote: number[] = []
    for (const path of svg.matchAll(/<path d="([^"]+)"/g)) {
      const punti = [...path[1].matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((p) => ({
        x: Number(p[1]),
        y: Number(p[2]),
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
