import { describe, expect, it } from 'vitest'
import { renderSvg, righeLegenda } from '../renderSvg'
import { riduttorePressione, simboloSegno, valvolaIntercettazione, valvolaNonRitorno } from '../symbols'
import { ondula, percorso, RAGGIO_SORMONTO, sormontiDelDisegno, tracciato, type Punto } from '../tratti'
import type { SchemaLayout, SchemaNodoPosizionato, SchemaSegnoTubo } from '../types'

const p = (x: number, y: number): Punto => ({ x, y })

describe('sormontiDelDisegno', () => {
  const orizzontale = [p(0, 100), p(200, 100)]
  const verticale = [p(80, 0), p(80, 300)]

  it('un tratto orizzontale che incrocia un verticale lo scavalca, e il verticale resta dritto', () => {
    const [suOrizzontale, suVerticale] = sormontiDelDisegno([orizzontale, verticale])
    expect(suOrizzontale).toEqual([p(80, 100)])
    expect(suVerticale).toEqual([])
  })

  it('dove un tubo FINISCE sull’altro non c’è incrocio: è un’unione', () => {
    // Il verticale si ferma sull'orizzontale (una T), poi l'orizzontale finisce sul verticale (un
    // gomito condiviso): in nessuno dei due casi si scavalca.
    expect(sormontiDelDisegno([orizzontale, [p(80, 0), p(80, 100)]])[0]).toEqual([])
    expect(sormontiDelDisegno([[p(0, 100), p(80, 100)], verticale])[0]).toEqual([])
  })

  it('due verticali sovrapposti danno un sormonto solo, e una polilinea può scavalcare se stessa', () => {
    expect(sormontiDelDisegno([orizzontale, verticale, [p(80, 50), p(80, 200)]])[0]).toEqual([p(80, 100)])
    // Un cappio: sale, va a destra, scende, torna a sinistra incrociando il primo tratto.
    const cappio = [p(50, 200), p(50, 0), p(150, 0), p(150, 100), p(0, 100)]
    expect(sormontiDelDisegno([cappio])[0]).toEqual([p(50, 100)])
  })

  it('tubi paralleli o che si sfiorano senza incrociarsi non danno nulla', () => {
    expect(sormontiDelDisegno([orizzontale, [p(0, 150), p(200, 150)]])).toEqual([[], []])
    expect(sormontiDelDisegno([orizzontale, [p(300, 0), p(300, 300)]])).toEqual([[], []])
  })
})

describe('tracciato', () => {
  const r = RAGGIO_SORMONTO

  it('senza sormonti è esattamente il tracciato di sempre', () => {
    const punti = [p(0, 100), p(200, 100), p(200, 300)]
    expect(tracciato(punti, 'standard')).toBe(percorso(punti))
    expect(tracciato(punti, 'condensa', [])).toBe(percorso(punti))
    expect(tracciato(punti, 'flessibile', [])).toBe(ondula(punti))
    // E un sormonto che non cade su questo tratto non lo tocca.
    expect(tracciato(punti, 'standard', [p(80, 999)])).toBe(percorso(punti))
  })

  it('il ponticello è un arco di raggio 6 che passa SOPRA, in un tracciato solo', () => {
    const d = tracciato([p(0, 100), p(200, 100)], 'standard', [p(80, 100)])
    expect(d).toBe(`M 0 100 L ${80 - r} 100 A ${r} ${r} 0 0 1 ${80 + r} 100 L 200 100`)
    expect(d.match(/M /g)).toHaveLength(1)
  })

  it('percorso verso sinistra, l’arco passa comunque sopra', () => {
    const d = tracciato([p(200, 100), p(0, 100)], 'standard', [p(80, 100)])
    expect(d).toBe(`M 200 100 L ${80 + r} 100 A ${r} ${r} 0 0 0 ${80 - r} 100 L 0 100`)
  })

  it('più sormonti sullo stesso tratto, in ordine di percorrenza; quelli senza spazio si saltano', () => {
    const d = tracciato([p(0, 100), p(200, 100)], 'standard', [p(150, 100), p(50, 100), p(3, 100), p(55, 100)])
    // (3,100) è troppo vicino al capo, (55,100) al sormonto precedente.
    expect(d.match(/A /g)).toHaveLength(2)
    expect(d.indexOf(`${50 + r} 100`)).toBeLessThan(d.indexOf(`${150 + r} 100`))
  })

  it('vale anche sul flessibile: l’onda si interrompe per l’arco e riprende', () => {
    const d = tracciato([p(0, 100), p(200, 100)], 'flessibile', [p(80, 100)])
    expect(d).toContain(`A ${r} ${r} 0 0 1 ${80 + r} 100`)
    expect(d.match(/Q /g)!.length).toBeGreaterThan(2)
    expect(d.match(/M /g)).toHaveLength(1)
  })
})

describe('valvola di non ritorno e riduttore invertito', () => {
  it('la non ritorno è la farfalla della valvola di intercettazione, più la freccetta', () => {
    const svg = valvolaNonRitorno(0, 0, { x: 1, y: 0 })
    expect(svg.startsWith(valvolaIntercettazione(0, 0, 'orizzontale'))).toBe(true)
    // Punta piena a destra, sopra la farfalla.
    expect(svg).toContain('<path d="M 7.5 -8 L 4 -9.5 L 4 -6.5 Z" fill="#000" />')
  })

  it('invertire gira la punta e lascia la freccetta dalla stessa parte del tubo', () => {
    expect(valvolaNonRitorno(0, 0, { x: -1, y: 0 })).toContain('<path d="M -7.5 -8 L -4 -9.5 L -4 -6.5 Z" fill="#000" />')
    // In verticale la freccetta sta a destra della farfalla, verso l'alto o verso il basso.
    const su = valvolaNonRitorno(0, 0, { x: 0, y: -1 })
    expect(su.startsWith(valvolaIntercettazione(0, 0, 'verticale'))).toBe(true)
    expect(su).toContain('<path d="M 8 -7.5 L 9.5 -4 L 6.5 -4 Z" fill="#000" />')
    expect(valvolaNonRitorno(0, 0, { x: 0, y: 1 })).toContain('<path d="M 8 7.5 L 9.5 4 L 6.5 4 Z" fill="#000" />')
  })

  it('il riduttore non invertito è quello di sempre; invertito è il suo specchio', () => {
    for (const o of ['orizzontale', 'verticale'] as const) {
      expect(riduttorePressione(10, 20, o, false)).toBe(riduttorePressione(10, 20, o))
      expect(riduttorePressione(10, 20, o, true)).not.toBe(riduttorePressione(10, 20, o))
    }
    // Orizzontale: l'ala grande (9) passa da sinistra a destra, la piccola (5,4) da destra a sinistra.
    expect(riduttorePressione(0, 0, 'orizzontale')).toContain('M -9 -4.5')
    expect(riduttorePressione(0, 0, 'orizzontale', true)).toContain('M 9 -4.5')
    expect(riduttorePressione(0, 0, 'orizzontale', true)).toContain('M -5.39')
  })

  it('simboloSegno sceglie il disegno dal tipo e dal verso', () => {
    const destra = { orizzontale: true, direzione: { x: 1, y: 0 } }
    expect(simboloSegno({ tipo: 'valvola_intercettazione' }, 0, 0, destra)).toBe(valvolaIntercettazione(0, 0))
    expect(simboloSegno({ tipo: 'riduttore_pressione' }, 0, 0, destra)).toBe(riduttorePressione(0, 0))
    expect(simboloSegno({ tipo: 'riduttore_pressione', inverso: true }, 0, 0, destra)).toBe(riduttorePressione(0, 0, 'orizzontale', true))
    expect(simboloSegno({ tipo: 'valvola_non_ritorno' }, 0, 0, destra)).toBe(valvolaNonRitorno(0, 0, { x: 1, y: 0 }))
    expect(simboloSegno({ tipo: 'valvola_non_ritorno', inverso: true }, 0, 0, destra)).toBe(valvolaNonRitorno(0, 0, { x: -1, y: 0 }))
  })
})

describe('nel documento', () => {
  const nodo = (id: string, x: number, y: number): SchemaNodoPosizionato => ({
    id, tipo: 'giunzione', etichetta: id, gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'manuale', x, y,
  })
  /** Due tubi a croce fra quattro TEE: uno orizzontale, uno verticale, che si incrociano a (200, 200). */
  const croce = (segni: SchemaSegnoTubo[] = []): SchemaLayout => ({
    nodi: [nodo('O', 90, 190), nodo('E', 290, 190), nodo('N', 190, 90), nodo('S', 190, 290)],
    archi: [
      { id: 'h', da: { nodo: 'O', ancora: 'dx' }, a: { nodo: 'E', ancora: 'sx' }, stile: 'standard', segni },
      { id: 'v', da: { nodo: 'N', ancora: 'basso' }, a: { nodo: 'S', ancora: 'alto' }, stile: 'standard' },
    ],
    muro: null,
    testi: [],
  })

  it('il tubo orizzontale scavalca quello verticale, che resta dritto', () => {
    const svg = renderSvg(croce())
    expect(svg).toContain('<path d="M 100 200 L 194 200 A 6 6 0 0 1 206 200 L 300 200" fill="none"')
    expect(svg).toContain('<path d="M 200 100 L 200 300" fill="none"')
  })

  it('la non ritorno segue il percorso del tubo, e invertita guarda dall’altra parte', () => {
    const base: SchemaSegnoTubo = { id: 's', tipo: 'valvola_non_ritorno', t: 0.25 }
    expect(renderSvg(croce([base]))).toContain(valvolaNonRitorno(150, 200, { x: 1, y: 0 }))
    expect(renderSvg(croce([{ ...base, inverso: true }]))).toContain(valvolaNonRitorno(150, 200, { x: -1, y: 0 }))
  })

  it('entra in legenda solo quando nel disegno ce n’è una', () => {
    const descrizioni = (l: SchemaLayout) => righeLegenda(l).map((r) => r.descrizione)
    expect(descrizioni(croce())).not.toContain('Valvola di non ritorno')
    expect(descrizioni(croce([{ id: 's', tipo: 'valvola_non_ritorno', t: 0.25 }]))).toContain('Valvola di non ritorno')
  })
})
