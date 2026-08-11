import { describe, it, expect } from 'vitest'
import {
  makeCompressore,
  makeDatiImpianto,
  makeScheda,
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

  it('ordina i codici in modo naturale, non lessicografico', () => {
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
})
