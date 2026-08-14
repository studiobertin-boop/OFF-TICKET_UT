import { describe, expect, it } from 'vitest'
import { TOLLERANZA_INSERIMENTO, arcoPiuVicino, idDelleMeta, spezzaArco } from '../inserimentoTee'
import type { Punto } from '../tratti'
import type { SchemaSegnoTubo } from '../types'

/**
 * La rotta `standard` fra due capi disallineati: gira a metà strada (`rottaLinea`, tratti.ts).
 * Lunghezze: 150 + 100 + 150 = 400, quindi il vertice (150,0) sta a t=0,375 e (150,100) a
 * t=0,625.
 */
const ROTTA: Punto[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 150, y: 100 },
  { x: 300, y: 100 },
]

describe('arcoPiuVicino', () => {
  const archi = [
    { id: 'std-1', polilinea: ROTTA },
    { id: 'std-2', polilinea: [{ x: 0, y: 500 }, { x: 300, y: 500 }] },
  ]

  it('sceglie l’arco su cui il punto cade', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 3 })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: 497 })).toBe('std-2')
  })

  // Senza la tolleranza, QUALUNQUE rilascio spezzerebbe il tubo meno lontano: si potrebbe
  // spostare un TEE da una parte all'altra della tela e trovarselo innestato su un tubo che
  // non si stava puntando.
  it('nessun arco se il punto è lontano da tutti', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 250 })).toBeNull()
  })

  it('la tolleranza è inclusiva sul bordo', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO + 0.5 })).toBeNull()
  })

  it('senza archi non sceglie nulla', () => {
    expect(arcoPiuVicino([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('spezzaArco', () => {
  it('il centro sta sulla polilinea, non dove è stato rilasciato il TEE', () => {
    // Rilascio 6 unità a destra del montante: il TEE deve innestarsi SUL tubo, o le due metà
    // partirebbero da un punto che il tubo non tocca e il disegno farebbe uno scalino.
    const { centro } = spezzaArco(ROTTA, [], { x: 156, y: 50 })
    expect(centro).toEqual({ x: 150, y: 50 })
  })

  it('i vertici si dividono fra le due metà secondo dove cade il taglio', () => {
    const { primo, secondo } = spezzaArco(ROTTA, [], { x: 150, y: 50 })
    expect(primo.punti).toEqual([{ x: 150, y: 0 }])
    expect(secondo.punti).toEqual([{ x: 150, y: 100 }])
  })

  // Il punto 2 del contesto: una metà senza gomiti tornerebbe alla rotta nativa del suo
  // stile. Il gomito nel punto medio sta esattamente sul segmento, quindi fissa la forma
  // senza cambiarla.
  it('una metà senza vertici viene fissata con un gomito nel suo punto medio', () => {
    const { centro, primo, secondo } = spezzaArco(ROTTA, [], { x: 80, y: 0 })
    expect(centro).toEqual({ x: 80, y: 0 })
    expect(primo.punti).toEqual([{ x: 40, y: 0 }])
    expect(secondo.punti).toEqual([
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ])
  })

  it('i segni vanno alla metà su cui cadono, con la t rimappata su quella metà', () => {
    const segni: SchemaSegnoTubo[] = [
      { id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 },
      { id: 'r1', tipo: 'riduttore_pressione', t: 0.75 },
    ]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 150, y: 50 }) // taglio a t = 0,5
    expect(primo.segni).toEqual([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }])
    expect(secondo.segni).toEqual([{ id: 'r1', tipo: 'riduttore_pressione', t: 0.5 }])
  })

  // Rilascio proprio sul capo di partenza: la prima metà è lunga zero. Non deve produrre
  // NaN — una t divisa per zero finirebbe nel layout salvato e da lì nel documento.
  it('un taglio sul capo di partenza non produce quote non numeriche', () => {
    const segni: SchemaSegnoTubo[] = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 }]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 0, y: 0 })
    expect(primo.segni).toEqual([])
    expect(secondo.segni).toEqual(segni)
    expect(primo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('idDelleMeta', () => {
  it('deriva due identificativi dal nome dell’arco spezzato', () => {
    expect(idDelleMeta('std-3', new Set(['std-3']))).toEqual(['std-3-a', 'std-3-b'])
  })

  // Spezzare due volte lo stesso tubo non deve produrre due archi con lo stesso id: react-flow
  // ne renderebbe uno solo, e il layout salvato perderebbe l'altro in silenzio.
  it('evita gli identificativi già presi', () => {
    expect(idDelleMeta('std-3', new Set(['std-3', 'std-3-a', 'std-3-b']))).toEqual(['std-3-a2', 'std-3-b2'])
  })
})
